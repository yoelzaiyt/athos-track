// Status operacional DERIVADO de dados reais (FASE 4/5/6 da rodada de refino
// operacional). Substitui a leitura direta de `assets.status` no painel — a
// coluna `status` do banco mistura conectividade (offline/online/
// awaiting_first_signal), estado de geofence (out_of_geofence) e só nunca
// 'moving'/'stopped' vindos de rastreador (BRGPS e GT06 nunca derivam esses
// dois — ver brgps/db.ts e gt06/db.ts). Este módulo decide a classificação
// exibida a partir de:
//   - timestamps REAIS de última comunicação/pacote (nunca placeholder);
//   - velocidade real do rastreador (GT06 sempre tem speed; BRGPS nunca);
//   - deslocamento derivado dos 2 últimos pontos de trilha (BRGPS);
//   - alertas reais não reconhecidos (system_alerts).
//
// Regras (janelas configuráveis, uma fonte central — sem hard-code espalhado):
//   - ALERT  : existe alerta real não reconhecido (quaisquer severidade).
//   - MOVING : contato recente e velocidade observada >= threshold.
//   - STOPPED: contato recente, SEM deslocamento observado (tem dados de
//              movimento pra comprovar imobilidade).
//   - ONLINE : contato recente, sem evidência de movimento (não inventa
//              "parado" sem dados de movimento).
//   - STALE  : contato entre onlineWindow e staleWindow (posição conhecida
//              mas velha).
//   - OFFLINE: contato mais velho que staleWindow, ou nunca comunicou.

export type DerivedStatusKey = 'alert' | 'moving' | 'stopped' | 'online' | 'stale' | 'offline';

export interface DeviceStatusConfig {
  /** Contato neste intervalo (ms) = comunicação recente (ONLINE/MOVING/STOPPED). */
  onlineWindowMs: number;
  /** Entre onlineWindowMs e staleWindowMs = STALE. Acima = OFFLINE. */
  staleWindowMs: number;
  /** Velocidade real do rastreador (km/h) acima da qual = MOVING. */
  movingSpeedKmh: number;
  /** Velocidade derivada de deslocamento (km/h) acima da qual = MOVING. */
  movingDisplacementKmh: number;
}

export const DEFAULT_STATUS_CONFIG: DeviceStatusConfig = {
  onlineWindowMs: 15 * 60 * 1000, // 15min
  staleWindowMs: 24 * 60 * 60 * 1000, // 24h
  movingSpeedKmh: 5,
  movingDisplacementKmh: 3,
};

/** Entrada de um asset conforme /stats/status-basis (dados reais do backend). */
export interface StatusBasisAsset {
  assetId: string;
  assetName?: string | null;
  status?: string | null;
  category?: string | null;
  lastComm?: string | null;
  packetTs?: string | null;
  serverReceivedAt?: string | null;
  speedKmh?: number | null;
  batteryLevel?: number | null;
  batteryCategory?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  unackedCritical?: number;
  unackedAlerts?: number;
  motion?: { distanceKm: number; windowMs: number; derivedSpeedKmh: number | null } | null;
}

export interface DerivedStatus {
  key: DerivedStatusKey;
  label: string;
  /** Exploração legível da decisão (pra auditoria no UI). */
  rationale: string;
}

export const STATUS_META: Record<DerivedStatusKey, { label: string; color: string }> = {
  moving: { label: 'Em Movimento', color: '#06b6d4' },
  stopped: { label: 'Parados', color: '#3b82f6' },
  online: { label: 'Online', color: '#10b981' },
  alert: { label: 'Em Alerta', color: '#f43f5e' },
  stale: { label: 'Posição Antiga', color: '#f59e0b' },
  offline: { label: 'Offline', color: '#64748b' },
};

function parseIso(value?: string | null): number | null {
  if (!value) return null;
  if (value === 'Agora' || value === '') return null;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : null;
}

export function deriveAssetStatus(
  basis: StatusBasisAsset,
  config: DeviceStatusConfig = DEFAULT_STATUS_CONFIG,
  now = Date.now()
): DerivedStatus {
  const lastSeen = parseIso(basis.packetTs) ?? parseIso(basis.lastComm);

  if ((basis.unackedAlerts ?? 0) > 0) {
    return { key: 'alert', label: STATUS_META.alert.label, rationale: `Alerta real não reconhecido pendente (${basis.unackedAlerts}).` };
  }

  if (!lastSeen) {
    return { key: 'offline', label: STATUS_META.offline.label, rationale: 'Nunca recebeu telemetria real (sem timestamp de comunicação).' };
  }

  const age = now - lastSeen;
  if (age <= config.onlineWindowMs) {
    const speed = basis.speedKmh;
    const derived = basis.motion?.derivedSpeedKmh ?? null;
    const moving = (speed != null && speed >= config.movingSpeedKmh) || (derived != null && derived >= config.movingDisplacementKmh);

    if (moving) {
      const cause = speed != null && speed >= config.movingSpeedKmh ? `velocidade ${speed.toFixed(1)}km/h da tag` : `deslocamento ${derived?.toFixed(2)}km/h entre trilha-points`;
      return { key: 'moving', label: STATUS_META.moving.label, rationale: `Contato recente e ${cause}.` };
    }

    const hasMovementData = speed != null || basis.motion != null;
    if (hasMovementData) {
      return { key: 'stopped', label: STATUS_META.stopped.label, rationale: 'Contato recente e sem deslocamento observado nos dados de movimento.' };
    }

    return { key: 'online', label: STATUS_META.online.label, rationale: 'Contato recente; sem dados de movimento pra classificar além de online.' };
  }

  if (age <= config.staleWindowMs) {
    return {
      key: 'stale',
      label: STATUS_META.stale.label,
      rationale: `Último contato há ${Math.round(age / 60_000)}min (dentro da janela de posição antiga).`,
    };
  }

  return { key: 'offline', label: STATUS_META.offline.label, rationale: `Sem contato há ${Math.round(age / 3_600_000)}h.` };
}

export function countDerivedStatuses(
  assets: StatusBasisAsset[],
  config: DeviceStatusConfig = DEFAULT_STATUS_CONFIG,
  now = Date.now()
): Record<DerivedStatusKey, number> {
  const counts: Record<DerivedStatusKey, number> = { alert: 0, moving: 0, stopped: 0, online: 0, stale: 0, offline: 0 };
  for (const a of assets) counts[deriveAssetStatus(a, config, now).key] += 1;
  return counts;
}