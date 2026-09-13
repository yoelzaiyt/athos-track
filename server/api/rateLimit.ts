// Rate limit das rotas autenticadas (/rest e /providers), card #38 do Trello.
//
// Até aqui só /auth/login tinha freio (SEC-007, routes-auth.ts). Um script
// mal comportado de UM tenant podia saturar a API e o pool do Postgres de
// TODOS — incidente de disponibilidade coletiva num SaaS multi-tenant.
//
// Dois baldes, aplicados DEPOIS do requireAuth (a chave vem de req.auth,
// não do IP: vários usuários de uma empresa costumam sair pelo mesmo NAT):
//   - por usuário (sub do JWT): contém uma aba/script descontrolado.
//   - por tenant (client_id): contém a empresa inteira somando usuários.
//     ATHOS_ADMIN sem client_id fica só no balde de usuário.
//
// Dimensionamento (medido no frontend, não arbitrário): cada carga de página
// dispara ~20 GETs /rest em paralelo (AssetContext) e o dashboard faz 2
// polls periódicos em /stats. 300/min por usuário = ~15 recargas completas
// por minuto, folga grande pro uso humano e corta laço de script. 1500/min
// por tenant = 5 usuários no teto ao mesmo tempo. Ajustável sem deploy de
// código via RATE_LIMIT_USER_PER_MIN / RATE_LIMIT_TENANT_PER_MIN.
//
// Store em memória: vale pra réplica única (hoje numReplicas=1 no Railway).
// Com mais réplicas, cada uma conta separado — trocar por um store
// compartilhado (Redis) antes de escalar horizontalmente.

import type { Request, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';

export interface RateLimitOptions {
  windowMs?: number;
  userLimit?: number;
  tenantLimit?: number;
}

type Scope = 'user' | 'tenant';

interface RateLimitStats {
  since: string;
  hits: Record<Scope, number>;
  byTenant: Record<string, number>;
}

function readLimit(envName: string, fallback: number): number {
  const parsed = Number(process.env[envName]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function createApiRateLimit(options: RateLimitOptions = {}): {
  middleware: RequestHandler[];
  stats: () => RateLimitStats;
} {
  const windowMs = options.windowMs ?? 60_000;
  const userLimit = options.userLimit ?? readLimit('RATE_LIMIT_USER_PER_MIN', 300);
  const tenantLimit = options.tenantLimit ?? readLimit('RATE_LIMIT_TENANT_PER_MIN', 1500);

  // Métrica pedida no card: quantas vezes o limite disparou, e pra quem.
  const counters: RateLimitStats = { since: new Date().toISOString(), hits: { user: 0, tenant: 0 }, byTenant: {} };

  const build = (scope: Scope, limit: number, keyOf: (req: Request) => string | null) =>
    rateLimit({
      windowMs,
      limit,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: (req) => keyOf(req) === null,
      keyGenerator: (req) => `${scope}:${keyOf(req)}`,
      handler: (req, res, _next, opts) => {
        const tenant = req.auth?.client_id ?? 'sem-tenant';
        counters.hits[scope] += 1;
        counters.byTenant[tenant] = (counters.byTenant[tenant] ?? 0) + 1;
        console.warn(
          `[rate-limit] 429 escopo=${scope} tenant=${tenant} usuario=${req.auth?.sub ?? '?'} ${req.method} ${req.originalUrl}`
        );
        res.status(opts.statusCode).json({
          error:
            scope === 'user'
              ? 'Muitas requisições deste usuário. Aguarde alguns segundos e tente de novo.'
              : 'Muitas requisições desta empresa. Aguarde alguns segundos e tente de novo.',
          scope,
          limit,
          windowSeconds: Math.round(windowMs / 1000),
        });
      },
    });

  return {
    middleware: [
      build('user', userLimit, (req) => req.auth?.sub ?? null),
      build('tenant', tenantLimit, (req) => req.auth?.client_id ?? null),
    ],
    stats: () => ({ ...counters, hits: { ...counters.hits }, byTenant: { ...counters.byTenant } }),
  };
}

// Instância única compartilhada por /rest e /providers: o orçamento de um
// usuário é um só, não um por roteador.
export const apiRateLimit = createApiRateLimit();
