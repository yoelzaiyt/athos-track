import { describe, expect, it } from 'vitest';
import { mapBatteryLevel, mapHistoryPoint, mapTagToNormalizedPosition, positionFingerprint } from './BrGpsMapper.ts';
import type { BrGpsHistoryPointRaw, BrGpsTagRaw } from './types.ts';

describe('mapBatteryLevel', () => {
  it('mapeia os 5 níveis crus do fornecedor (seção 9 do brief)', () => {
    expect(mapBatteryLevel(-1)).toBe('UNKNOWN');
    expect(mapBatteryLevel(0)).toBe('CRITICAL');
    expect(mapBatteryLevel(1)).toBe('LOW');
    expect(mapBatteryLevel(2)).toBe('MEDIUM');
    expect(mapBatteryLevel(3)).toBe('HIGH');
  });

  it('nunca inventa um nível para valor fora do intervalo documentado', () => {
    expect(mapBatteryLevel(99)).toBe('UNKNOWN');
  });
});

function makeRawTag(overrides: Partial<BrGpsTagRaw> = {}): BrGpsTagRaw {
  return {
    id: 2506180001,
    timestamp: 1751680994,
    publishTime: 1751682383,
    lat: 22.6788393,
    lng: 113.7959922,
    battery: 1,
    mac: '21:02:8B:F7:DB:EB',
    isActived: true,
    ...overrides,
  };
}

describe('mapTagToNormalizedPosition', () => {
  it('converte um exemplo real da documentação sem perder campos', () => {
    const now = new Date('2025-07-05T00:00:00Z');
    const result = mapTagToNormalizedPosition(makeRawTag(), { now });

    expect(result.provider).toBe('BRGPS');
    expect(result.externalDeviceId).toBe('2506180001');
    expect(result.latitude).toBe(22.6788393);
    expect(result.longitude).toBe(113.7959922);
    expect(result.batteryRaw).toBe(1);
    expect(result.batteryLevel).toBe('LOW');
    expect(result.mac).toBe('21:02:8B:F7:DB:EB');
    expect(result.active).toBe(true);
    expect(result.sourceType).toBe('PROVIDER_API');
    expect(result.occurredAt.getTime()).toBe(1751680994 * 1000);
    expect(result.providerPublishedAt.getTime()).toBe(1751682383 * 1000);
  });

  it('sinaliza INVALID_COORDINATE sem descartar a posição', () => {
    const result = mapTagToNormalizedPosition(makeRawTag({ lat: 200, lng: 113 }));
    expect(result.qualityFlags).toContain('INVALID_COORDINATE');
  });

  it('sinaliza FUTURE_TIMESTAMP quando o timestamp está no futuro', () => {
    const now = new Date('2020-01-01T00:00:00Z');
    const result = mapTagToNormalizedPosition(makeRawTag(), { now });
    expect(result.qualityFlags).toContain('FUTURE_TIMESTAMP');
  });

  it('sinaliza STALE_POSITION além do limiar configurado', () => {
    const now = new Date((1751680994 + 3600) * 1000); // 1h depois do timestamp
    const result = mapTagToNormalizedPosition(makeRawTag(), { now, staleThresholdMs: 30 * 60_000 });
    expect(result.qualityFlags).toContain('STALE_POSITION');
  });

  it('sinaliza INVALID_BATTERY para valor fora de -1..3', () => {
    const result = mapTagToNormalizedPosition(makeRawTag({ battery: 9 as BrGpsTagRaw['battery'] }));
    expect(result.qualityFlags).toContain('INVALID_BATTERY');
    expect(result.batteryLevel).toBe('UNKNOWN');
  });
});

describe('mapHistoryPoint', () => {
  it('converte um ponto de histórico real da documentação', () => {
    const raw: BrGpsHistoryPointRaw = {
      id: 2506180001,
      timestamp: 1750830306,
      lat: 22.602131,
      lng: 113.831854,
      distance: 56,
    };
    const result = mapHistoryPoint(raw);
    expect(result.externalDeviceId).toBe('2506180001');
    expect(result.latitude).toBe(22.602131);
    expect(result.providerDistanceRaw).toBe(56);
    expect(result.occurredAt.getTime()).toBe(1750830306 * 1000);
    expect(result.qualityFlags).toEqual([]);
  });
});

describe('positionFingerprint', () => {
  it('gera o mesmo fingerprint para a mesma posição (dedup determinístico)', () => {
    const a = mapTagToNormalizedPosition(makeRawTag());
    const b = mapTagToNormalizedPosition(makeRawTag());
    expect(positionFingerprint(a)).toBe(positionFingerprint(b));
  });

  it('gera fingerprints diferentes quando o timestamp muda', () => {
    const a = mapTagToNormalizedPosition(makeRawTag());
    const b = mapTagToNormalizedPosition(makeRawTag({ timestamp: 1751680995 }));
    expect(positionFingerprint(a)).not.toBe(positionFingerprint(b));
  });
});
