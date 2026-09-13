import { AssetDevice } from '../types';

/**
 * Instrumentação de latência ponta-a-ponta (DEV-only, honesta).
 *
 * Objetivo (seção 9 do brief): medir de onde vem a lentidão
 *   DEVICE_TIMESTAMP -> VENDOR_TIMESTAMP -> BACKEND_RECEIVED_AT ->
 *   DB_PERSISTED_AT -> UI_UPDATED_AT
 * e NÃO concluir nada sem evidência.
 *
 * O que existe HOJE no modelo de dados do frontend:
 *   - telemetry.packetTimestamp     -> timestamp do pacote na tag (DEVICE)
 *   - telemetry.providerPublishedAt -> publishTime do fornecedor (VENDOR)
 *   - telemetry.lastCommunication   -> gravado pelo backend quando persistiu (DB proxy)
 *                                            (só quando é ISO real; "Agora" é placeholder de simulação)
 * O que NÃO existe ainda (precisa de coluna nova no banco — PENDING, fora desta rodada):
 *   - BACKEND_RECEIVED_AT e DB_PERSISTED_AT granularmente (hoje lastCommunication
 *     já é o momento da persistência, gente escreve no mesmo processamento do
 *     webhook/worker -> aproximação válida, coluna dedicada fica como pendência).
 *
 * Este módulo é puro (sem React/DOM) e apenas calcula métricas legíveis; não
 * fabrica timestamp nenhum.
 */

export interface LatencyMetrics {
  /** timestamp do device (pacote) se ISO real */
  deviceTs: number | null;
  /** publishTime do fornecedor se ISO real */
  vendorTs: number | null;
  /** T3: telemetry_server_received_at — instante em que nosso servidor recebeu/recolheu a posição */
  serverRxTs: number | null;
  /** lastCommunication se ISO real (não "Agora") */
  uiTs: number | null;
  /** idade do UI (agora - uiTs), ms */
  uiAgeMs: number | null;
  /** atraso device -> vendor (ms) — negativo indica relógio da tag atrasado */
  deviceToVendorMs: number | null;
  /** atraso device -> nosso servidor (ms) — NEGATIVO = caminho direto começou a ser usado */
  deviceToServerRxMs: number | null;
  /** atraso vendor -> UI (ms) — tempo de ingestão + persistência + entrega */
  vendorToUiMs: number | null;
  /** atraso server received -> UI (ms) — pipeline real backend->frontend */
  serverRxToUiMs: number | null;
  /** latência total device -> UI (ms) */
  deviceToUiMs: number | null;
  /** true se algum timestamp foi placeholder ("Agora") e foi ignorado */
  hadPlaceholder: boolean;
  /** true se os timestamps vieram do provider (dado real), false se simulação */
  fromProvider: boolean;
}

function toTimestampMs(value: string | undefined | null): number | null {
  if (!value) return null;
  if (value === 'Agora' || value === '') return null;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : null;
}

export function buildLatencyMetrics(asset: AssetDevice | null | undefined, now = Date.now()): LatencyMetrics | null {
  if (!asset) return null;
  const deviceTs = toTimestampMs(asset.telemetry?.packetTimestamp);
  const vendorTs = toTimestampMs(asset.telemetry?.providerPublishedAt);
  const serverRxTs = toTimestampMs(asset.telemetry?.serverReceivedAt);
  const uiTs = toTimestampMs(asset.telemetry?.lastCommunication);

  const placeholder = new Set([
    asset.telemetry?.packetTimestamp,
    asset.telemetry?.providerPublishedAt,
    asset.telemetry?.serverReceivedAt,
    asset.telemetry?.lastCommunication,
  ]).has('Agora');

  return {
    deviceTs,
    vendorTs,
    serverRxTs,
    uiTs,
    uiAgeMs: uiTs != null ? now - uiTs : null,
    deviceToVendorMs: deviceTs != null && vendorTs != null ? vendorTs - deviceTs : null,
    deviceToServerRxMs: deviceTs != null && serverRxTs != null ? serverRxTs - deviceTs : null,
    vendorToUiMs: vendorTs != null && uiTs != null ? uiTs - vendorTs : null,
    serverRxToUiMs: serverRxTs != null && uiTs != null ? uiTs - serverRxTs : null,
    deviceToUiMs: deviceTs != null && uiTs != null ? uiTs - deviceTs : null,
    hadPlaceholder: placeholder,
    fromProvider: !!asset.provider,
  };
}

export function formatLatencyMs(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}min`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

// UI_REFRESH_LATENCY_MS (rodada operacional, FASE 12): tempo entre o instante
// em que o BACKEND recebeu a telemetria (telemetry_server_received_at) e o
// instante em que a UI efetivamente aplicou o update (uiUpdatedAt, carimbado
// no merge do realtime em AssetContext). Só calcula com ISO real — nunca
// fabrica timestamp ("Agora" simulado retorna null).
export function uiRefreshLatencyMs(serverReceivedAt?: string | null, uiUpdatedAt?: string | null, now = Date.now()): number | null {
  const server = toTimestampMs(serverReceivedAt);
  if (server == null) return null;
  const parsedUi = uiUpdatedAt ? Date.parse(uiUpdatedAt) : NaN;
  const ui = Number.isFinite(parsedUi) ? parsedUi : now;
  const ms = ui - server;
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
}