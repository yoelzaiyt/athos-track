import { describe, expect, it } from 'vitest';
import { deriveAssetStatus, countDerivedStatuses, DEFAULT_STATUS_CONFIG, type StatusBasisAsset } from './deviceStatus';

const now = new Date('2026-09-11T12:00:00Z').getTime();
const iso = (msAgo: number) => new Date(now - msAgo).toISOString();

function basis(partial: Partial<StatusBasisAsset> = {}): StatusBasisAsset {
  return { assetId: 'a1', ...partial };
}

describe('deriveAssetStatus', () => {
  it('classifica como offline quando nunca recebeu telemetria real', () => {
    const r = deriveAssetStatus(basis(), DEFAULT_STATUS_CONFIG, now);
    expect(r.key).toBe('offline');
  });

  it('classifica como OFFLINE quando contato é mais velho que a janela stale', () => {
    const r = deriveAssetStatus(basis({ packetTs: iso(25 * 3600_000) }), DEFAULT_STATUS_CONFIG, now);
    expect(r.key).toBe('offline');
    expect(r.rationale).toContain('h');
  });

  it('classifica como STALE entre as janelas online e stale', () => {
    const r = deriveAssetStatus(basis({ packetTs: iso(30 * 60_000) }), DEFAULT_STATUS_CONFIG, now);
    expect(r.key).toBe('stale');
  });

  it('classifica como ONLINE com contato recente e sem dados de movimento', () => {
    const r = deriveAssetStatus(basis({ packetTs: iso(60_000) }), DEFAULT_STATUS_CONFIG, now);
    expect(r.key).toBe('online');
  });

  it('classifica como MOVING via velocidade real da tag (GT06)', () => {
    const r = deriveAssetStatus(basis({ packetTs: iso(60_000), speedKmh: 42 }), DEFAULT_STATUS_CONFIG, now);
    expect(r.key).toBe('moving');
    expect(r.rationale).toContain('velocidade');
  });

  it('classifica como MOVING via deslocamento derivado de trilha (BRGPS)', () => {
    const r = deriveAssetStatus(
      basis({ packetTs: iso(60_000), motion: { distanceKm: 0.5, windowMs: 60_000, derivedSpeedKmh: 30 } }),
      DEFAULT_STATUS_CONFIG,
      now
    );
    expect(r.key).toBe('moving');
    expect(r.rationale).toContain('deslocamento');
  });

  it('classifica como STOPPED com contato recente e deslocamento nulo observado', () => {
    const r = deriveAssetStatus(
      basis({ packetTs: iso(60_000), motion: { distanceKm: 0, windowMs: 120_000, derivedSpeedKmh: 0 } }),
      DEFAULT_STATUS_CONFIG,
      now
    );
    expect(r.key).toBe('stopped');
  });

  it('classifica como STOPPED com velocidade real abaixo do threshold', () => {
    const r = deriveAssetStatus(basis({ packetTs: iso(60_000), speedKmh: 1 }), DEFAULT_STATUS_CONFIG, now);
    expect(r.key).toBe('stopped');
  });

  it('ALERT tem prioridade máxima quando existe alerta real não reconhecido', () => {
    const r = deriveAssetStatus(basis({ packetTs: iso(60_000), unackedAlerts: 1 }), DEFAULT_STATUS_CONFIG, now);
    expect(r.key).toBe('alert');
  });

  it('ALERT vale mesmo para ativo sem contato recente (offline) se alerta pendente', () => {
    const r = deriveAssetStatus(basis({ unackedAlerts: 2 }), DEFAULT_STATUS_CONFIG, now);
    expect(r.key).toBe('alert');
  });

  it('ignora placeholder "Agora" — sem timestamp real vira offline', () => {
    const r = deriveAssetStatus(basis({ lastComm: 'Agora', packetTs: 'Agora' }), DEFAULT_STATUS_CONFIG, now);
    expect(r.key).toBe('offline');
  });

  it('respeita janelas configuradas (prova de config não-hardcoded)', () => {
    const config = { onlineWindowMs: 60_000, staleWindowMs: 5 * 60_000, movingSpeedKmh: 5, movingDisplacementKmh: 3 };
    const recent = deriveAssetStatus(basis({ packetTs: iso(30_000) }), config, now);
    expect(recent.key).toBe('online');
    const stale = deriveAssetStatus(basis({ packetTs: iso(2 * 60_000) }), config, now);
    expect(stale.key).toBe('stale');
    const offline = deriveAssetStatus(basis({ packetTs: iso(10 * 60_000) }), config, now);
    expect(offline.key).toBe('offline');
  });
});

describe('countDerivedStatuses', () => {
  it('agrega corretamente e soma o total de ativos', () => {
    const assets: StatusBasisAsset[] = [
      basis({ packetTs: iso(60_000) }),
      basis({ assetId: 'a2', packetTs: iso(30_000), speedKmh: 50 }),
      basis({ assetId: 'a3', packetTs: iso(30_000), motion: { distanceKm: 0, windowMs: 60_000, derivedSpeedKmh: 0 } }),
      basis({ assetId: 'a4', packetTs: iso(2 * 3600_000) }),
      basis({ assetId: 'a5', unackedAlerts: 1 }),
      basis({ assetId: 'a6' }),
    ];
    const counts = countDerivedStatuses(assets, DEFAULT_STATUS_CONFIG, now);
    expect(counts).toEqual({ online: 1, moving: 1, stopped: 1, stale: 1, alert: 1, offline: 1 });
    expect(Object.values(counts).reduce((s: number, n: number) => s + n, 0)).toBe(6);
  });
});