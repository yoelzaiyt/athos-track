// Transforma o formato cru do fornecedor BRGPS em NormalizedPosition (entidade
// do ATHOS Core). Pura — sem I/O, sem Supabase, sem HTTP — para ser testável
// isoladamente (ver seção 40 do brief).

import type { BatteryLevel, BrGpsHistoryPointRaw, BrGpsTagRaw, NormalizedPosition, PositionQualityFlag } from './types.ts';

// Seção 9 do brief: -1 inválido, 0 extremamente baixo, 1 baixo, 2 médio, 3 alto.
// Nunca inventar porcentagem a partir disso.
const BATTERY_MAP: Record<number, BatteryLevel> = {
  [-1]: 'UNKNOWN',
  0: 'CRITICAL',
  1: 'LOW',
  2: 'MEDIUM',
  3: 'HIGH',
};

export function mapBatteryLevel(raw: number): BatteryLevel {
  return BATTERY_MAP[raw] ?? 'UNKNOWN';
}

function unixToDate(seconds: number): Date {
  return new Date(seconds * 1000);
}

function isValidCoordinate(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export interface MapTagOptions {
  now?: Date;
  /** Posições mais antigas que isto (ms) viram flag STALE_POSITION — não bloqueiam persistência, só sinalizam. */
  staleThresholdMs?: number;
}

export function mapTagToNormalizedPosition(raw: BrGpsTagRaw, opts: MapTagOptions = {}): NormalizedPosition {
  const now = opts.now ?? new Date();
  const staleThresholdMs = opts.staleThresholdMs ?? 30 * 60_000;

  const occurredAt = unixToDate(raw.timestamp);
  const providerPublishedAt = unixToDate(raw.publishTime);

  const qualityFlags: PositionQualityFlag[] = [];

  if (!isValidCoordinate(raw.lat, raw.lng)) {
    qualityFlags.push('INVALID_COORDINATE');
  }
  if (occurredAt.getTime() > now.getTime() + 60_000) {
    qualityFlags.push('FUTURE_TIMESTAMP');
  }
  if (now.getTime() - occurredAt.getTime() > staleThresholdMs) {
    qualityFlags.push('STALE_POSITION');
  }
  if (raw.battery < -1 || raw.battery > 3) {
    qualityFlags.push('INVALID_BATTERY');
  }

  return {
    provider: 'BRGPS',
    externalDeviceId: String(raw.id),
    occurredAt,
    providerPublishedAt,
    receivedAt: now,
    latitude: raw.lat,
    longitude: raw.lng,
    sourceType: 'PROVIDER_API',
    batteryRaw: raw.battery,
    batteryLevel: mapBatteryLevel(raw.battery),
    mac: raw.mac,
    active: raw.isActived,
    qualityFlags,
  };
}

export interface MappedHistoryPoint {
  externalDeviceId: string;
  occurredAt: Date;
  latitude: number;
  longitude: number;
  providerDistanceRaw?: number;
  qualityFlags: PositionQualityFlag[];
}

export function mapHistoryPoint(raw: BrGpsHistoryPointRaw): MappedHistoryPoint {
  const qualityFlags: PositionQualityFlag[] = [];
  if (!isValidCoordinate(raw.lat, raw.lng)) qualityFlags.push('INVALID_COORDINATE');

  return {
    externalDeviceId: String(raw.id),
    occurredAt: unixToDate(raw.timestamp),
    latitude: raw.lat,
    longitude: raw.lng,
    // Seção 14: unidade não confirmada pelo fornecedor — guardamos cru, sem
    // apresentar unidade inventada no frontend.
    providerDistanceRaw: raw.distance,
    qualityFlags,
  };
}

// Fingerprint de deduplicação — seção 19 do brief.
export function positionFingerprint(p: Pick<NormalizedPosition, 'provider' | 'externalDeviceId' | 'occurredAt' | 'latitude' | 'longitude'>): string {
  return `${p.provider}|${p.externalDeviceId}|${p.occurredAt.getTime()}|${p.latitude.toFixed(6)}|${p.longitude.toFixed(6)}`;
}
