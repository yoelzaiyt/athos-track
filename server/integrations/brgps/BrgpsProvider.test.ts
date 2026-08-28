import { describe, expect, it } from 'vitest';
import { BrgpsProvider } from './BrgpsProvider.ts';
import type { Pool } from 'pg';

function fakePool(rows: unknown[]): Pool {
  return { query: async () => ({ rows }) } as unknown as Pool;
}

describe('BrgpsProvider.healthCheck', () => {
  it('mapeia a linha de provider_health quando existe', async () => {
    const provider = new BrgpsProvider(
      { baseUrl: 'http://example.invalid', apiToken: 'x' },
      fakePool([
        {
          status: 'HEALTHY',
          last_success_at: new Date('2026-08-24T11:10:55.829Z'),
          last_error_at: null,
          last_error_message: null,
          requests_total: '389',
          requests_failed: '1',
          rate_limited_total: '0',
        },
      ])
    );

    const health = await provider.healthCheck();
    expect(health.providerId).toBe('brgps');
    expect(health.status).toBe('HEALTHY');
    expect(health.requestsTotal).toBe(389);
    expect(health.requestsFailed).toBe(1);
  });

  it('nunca inventa "HEALTHY" quando não há linha ainda — UNAVAILABLE explícito', async () => {
    const provider = new BrgpsProvider({ baseUrl: 'http://example.invalid', apiToken: 'x' }, fakePool([]));
    const health = await provider.healthCheck();
    expect(health.status).toBe('UNAVAILABLE');
    expect(health.requestsTotal).toBe(0);
  });
});
