import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveMapLanguage, getMapUIStrings } from './mapLanguage';

describe('resolveMapLanguage', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns pt for BR region', () => {
    expect(resolveMapLanguage('BR')).toBe('pt');
  });

  it('returns en for CN region', () => {
    expect(resolveMapLanguage('CN')).toBe('en');
  });

  it('returns en for unknown region with non-PT browser', () => {
    vi.stubGlobal('navigator', { language: 'en-US' });
    expect(resolveMapLanguage('ZZ')).toBe('en');
  });

  it('falls back to browser language when no region', () => {
    vi.stubGlobal('navigator', { language: 'pt-BR' });
    expect(resolveMapLanguage()).toBe('pt');
  });

  it('returns en when browser is non-PT and no region', () => {
    vi.stubGlobal('navigator', { language: 'en-US' });
    expect(resolveMapLanguage()).toBe('en');
  });

  it('returns en when navigator unavailable (SSR)', () => {
    vi.stubGlobal('navigator', undefined);
    expect(resolveMapLanguage()).toBe('en');
  });
});

describe('getMapUIStrings', () => {
  it('returns pt strings', () => {
    const s = getMapUIStrings('pt');
    expect(s.modeSatellite).toBe('Satélite');
    expect(s.clusterLabel).toBe('ATIVOS');
    expect(s.outlierNotice(3)).toContain('3 ativo');
  });

  it('returns en strings as default', () => {
    const s = getMapUIStrings('en');
    expect(s.modeSatellite).toBe('Satellite');
    expect(s.clusterLabel).toBe('ASSETS');
    expect(s.outlierNotice(5)).toBe('5 asset(s) outside initial framing (still on map)');
  });

  it('falls back to en for unknown lang', () => {
    const s = getMapUIStrings('xx' as any);
    expect(s.modeSatellite).toBe('Satellite');
  });
});
