// Comunicação HTTP crua com o fornecedor BRGPS. Não conhece nada do Core ATHOS
// (Asset/Device/Position) — só fala o protocolo do fornecedor. Ver seção 5 do brief.
//
// Responsabilidades: headers obrigatórios (api_token/timestamp gerados aqui, nunca
// no frontend), timeout, retry controlado (só erros transitórios), rate limit
// (100 req/min por endpoint, seção 4) e parsing do envelope padrão (seção 16).
// Nunca loga api_token.

import type { BrGpsClientConfig, BrGpsEnvelope } from './types.ts';

export class BrGpsRateLimitError extends Error {
  constructor(public endpoint: string) {
    super(`[BrGpsClient] rate limit local excedido para ${endpoint} (100 req/min)`);
    this.name = 'BrGpsRateLimitError';
  }
}

export class BrGpsProviderError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public problem?: string | null
  ) {
    super(message);
    this.name = 'BrGpsProviderError';
  }
}

interface RequestMetrics {
  requestsTotal: number;
  requestsFailed: number;
  rateLimited: number;
}

// Janela deslizante simples de 60s por endpoint — suficiente para um único
// processo de poller de longa duração (não é um limiter distribuído).
class SlidingWindowLimiter {
  private hits = new Map<string, number[]>();

  constructor(private limitPerMinute: number) {}

  tryConsume(endpoint: string): boolean {
    const now = Date.now();
    const windowStart = now - 60_000;
    const arr = (this.hits.get(endpoint) ?? []).filter((t) => t > windowStart);
    if (arr.length >= this.limitPerMinute) {
      this.hits.set(endpoint, arr);
      return false;
    }
    arr.push(now);
    this.hits.set(endpoint, arr);
    return true;
  }
}

export class BrGpsClient {
  private readonly baseUrl: string;
  private readonly apiToken: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly limiter = new SlidingWindowLimiter(100);
  readonly metrics: RequestMetrics = { requestsTotal: 0, requestsFailed: 0, rateLimited: 0 };

  // Desvio entre o relógio local e o relógio real (lido do header HTTP `Date`
  // devolvido pelo próprio fornecedor). O timestamp exigido pela doc tem
  // validade de ~3min contra o relógio DO FORNECEDOR — se o relógio da máquina
  // que roda este processo estiver errado (fuso mal configurado, VM com clock
  // drift), toda chamada seria rejeitada com "Timestamp error." mesmo com o
  // api_token correto. Em vez de mexer no relógio do sistema operacional
  // (fora do escopo/perigoso), corrigimos aqui: toda resposta HTTP (mesmo uma
  // falha lógica com statusCode != 200) já carrega a hora real do fornecedor
  // no header padrão `Date`, e usamos isso pra recalibrar antes do próximo request.
  private clockOffsetMs = 0;

  constructor(config: BrGpsClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiToken = config.apiToken;
    this.timeoutMs = config.timeoutMs ?? 10_000;
    this.maxRetries = config.maxRetries ?? 2;
  }

  private buildHeaders(): Record<string, string> {
    // timestamp gerado agora, imediatamente antes do request — validade de
    // ~3min segundo a documentação do fornecedor (seção 1 do brief). Corrigido
    // pelo desvio de relógio detectado via header Date (ver clockOffsetMs).
    const correctedNowMs = Date.now() + this.clockOffsetMs;
    return {
      api_token: this.apiToken,
      timestamp: String(Math.floor(correctedNowMs / 1000)),
      'Content-Type': 'application/json',
    };
  }

  private recalibrateClock(dateHeader: string | null): void {
    if (!dateHeader) return;
    const serverNowMs = Date.parse(dateHeader);
    if (Number.isNaN(serverNowMs)) return;
    const newOffset = serverNowMs - Date.now();
    if (Math.abs(newOffset - this.clockOffsetMs) > 2000) {
      console.warn(`[brgps] desvio de relógio local detectado: ${Math.round(newOffset / 1000)}s — corrigindo timestamp dos próximos requests.`);
    }
    this.clockOffsetMs = newOffset;
  }

  private isTimestampError(err: unknown): boolean {
    return err instanceof BrGpsProviderError && /timestamp/i.test(err.message);
  }

  private isTransientError(err: unknown): boolean {
    if (err instanceof BrGpsProviderError) {
      // 5xx e timeout são transitórios; erro de timestamp é retryable só na
      // primeira vez (a recalibração de clockOffsetMs já corrigiu o próximo
      // header); 4xx de auth/validação genuína não adianta repetir.
      return (err.statusCode ?? 0) >= 500 || this.isTimestampError(err);
    }
    if (err instanceof Error) {
      return err.name === 'AbortError' || err.message.includes('ECONNRESET') || err.message.includes('fetch failed');
    }
    return false;
  }

  private async requestOnce<T>(path: string, params?: Record<string, string | undefined>, method: 'GET' | 'PATCH' = 'GET', body?: unknown): Promise<BrGpsEnvelope<T>> {
    const url = new URL(this.baseUrl + path);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) url.searchParams.set(k, v);
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const startedAt = Date.now();

    try {
      const res = await fetch(url.toString(), {
        method,
        headers: this.buildHeaders(),
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const durationMs = Date.now() - startedAt;
      this.recalibrateClock(res.headers.get('date'));
      const json = (await res.json().catch(() => null)) as BrGpsEnvelope<T> | null;

      console.log(
        `[brgps] ${method} ${path} status=${res.status} duration=${durationMs}ms ` +
        `providerStatusCode=${json?.statusCode ?? 'n/a'}`
      );

      if (!res.ok || !json || json.statusCode !== 200) {
        throw new BrGpsProviderError(
          `Resposta inválida do BRGPS em ${path}: HTTP ${res.status}, statusCode=${json?.statusCode}, message=${json?.message}, problem=${json?.problem}`,
          json?.statusCode ?? res.status,
          json?.problem ?? null
        );
      }

      return json;
    } finally {
      clearTimeout(timer);
    }
  }

  async request<T>(path: string, params?: Record<string, string | undefined>, method: 'GET' | 'PATCH' = 'GET', body?: unknown): Promise<T> {
    if (!this.limiter.tryConsume(path)) {
      this.metrics.rateLimited += 1;
      throw new BrGpsRateLimitError(path);
    }

    this.metrics.requestsTotal += 1;

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const envelope = await this.requestOnce<T>(path, params, method, body);
        return envelope.data as T;
      } catch (err) {
        lastError = err;
        if (attempt < this.maxRetries && this.isTransientError(err)) {
          // Erro de timestamp já foi corrigido por recalibrateClock() na
          // resposta que acabou de chegar — não precisa esperar, só reenviar.
          const backoffMs = this.isTimestampError(err) ? 0 : 500 * (attempt + 1);
          console.warn(`[brgps] tentativa ${attempt + 1}/${this.maxRetries} falhou para ${path}, retry em ${backoffMs}ms: ${(err as Error).message}`);
          if (backoffMs > 0) await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }
        break;
      }
    }

    this.metrics.requestsFailed += 1;
    throw lastError;
  }
}
