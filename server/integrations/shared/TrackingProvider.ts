// Contrato comum pra qualquer fornecedor de rastreamento (prompt
// "MULTI-TENANT + MULTI-PROVIDER", seção 4). Hoje só tem um implementador
// real: server/integrations/brgps/BrgpsProvider.ts.
//
// Importante — "Heile" e "Jason" (nomes usados no brief recebido) e "BRGPS"
// (nome já em uso neste projeto desde antes desta rodada) são o MESMO
// fornecedor: mesmo token (o valor passado como "chave da Heile" bate
// exatamente com BRGPS_API_TOKEN já configurado), mesma URL de documentação
// (brgps.com), mesmos endpoints (PATCH /tag ativação, GET /tag localização,
// GET /tag/history histórico — idênticos ao já implementado). Confirmado
// pelo responsável do projeto nesta sessão. Por isso este projeto NÃO tem
// providers/heile/ e providers/jason/ como duas integrações separadas — isso
// seria fabricar uma segunda integração fake pro mesmo fornecedor real
// (proibido pela seção 35 do prompt: "não criar dados simulados fingindo
// serem dados reais"). Vira um só provider, registrado sob os três nomes no
// ProviderRegistry (ver providerId 'brgps', alias 'heile', alias 'jason').
//
// Reaproveita os tipos que já existiam em server/integrations/brgps/types.ts
// (NormalizedPosition já É o "NormalizedLocation" pedido no brief — mesmo
// campo por campo, só nome diferente) em vez de recriar um modelo paralelo.

import type { NormalizedPosition } from '../brgps/types.ts';

/** Mesmo modelo normalizado que já existia como NormalizedPosition — alias
 * com o nome usado no brief de multi-provider, sem duplicar a definição. */
export type NormalizedLocation = NormalizedPosition;

export type ProviderHealthState = 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';

export interface ProviderHealthStatus {
  providerId: string;
  status: ProviderHealthState;
  lastSuccessAt: Date | null;
  lastErrorAt: Date | null;
  lastErrorMessage: string | null;
  requestsTotal: number;
  requestsFailed: number;
  rateLimitedTotal: number;
}

export interface LocationHistoryPoint {
  externalDeviceId: string;
  occurredAt: Date;
  latitude: number;
  longitude: number;
  providerDistanceRaw?: number;
}

/**
 * Contrato que todo fornecedor de rastreamento precisa implementar. O
 * restante da aplicação (rest.ts, ProviderRegistry, telas de dispositivos)
 * só conhece esta interface — nunca o SDK/protocolo específico de um
 * fornecedor (seção 4 do brief: "não espalhar regras específicas de Heile
 * ou Jason pela aplicação").
 */
export interface TrackingProvider {
  /** Identificador estável do provider (ex.: 'brgps'). Usado como chave em provider_devices/provider_health. */
  readonly id: string;

  /** PATCH /tag equivalente — ativa dispositivo(s) no fornecedor. Só dispositivos ativados retornam localização. */
  activateDevice(externalIds: string[]): Promise<void>;

  /** GET /tag equivalente — localização atual em lote (batching, não 1 chamada por tag). */
  getCurrentLocation(externalIds: string[]): Promise<NormalizedLocation[]>;

  /** GET /tag/history equivalente. */
  getLocationHistory(externalId: string, from: Date, to: Date): Promise<LocationHistoryPoint[]>;

  /** GET /tag/all equivalente — descobre todos os dispositivos já vistos pelo fornecedor. */
  discoverDeviceIds(isActived?: boolean): Promise<string[]>;

  /** Status atual do provider — usado pela tela de Provider Health (seção 22). */
  healthCheck(): Promise<ProviderHealthStatus>;
}
