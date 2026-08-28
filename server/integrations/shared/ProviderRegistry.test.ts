import { describe, expect, it } from 'vitest';
import { ProviderRegistryImpl } from './ProviderRegistry.ts';
import type { TrackingProvider, ProviderHealthStatus } from './TrackingProvider.ts';

function makeFakeProvider(id: string): TrackingProvider {
  return {
    id,
    async activateDevice() {},
    async getCurrentLocation() {
      return [];
    },
    async getLocationHistory() {
      return [];
    },
    async discoverDeviceIds() {
      return [];
    },
    async healthCheck(): Promise<ProviderHealthStatus> {
      return {
        providerId: id,
        status: 'HEALTHY',
        lastSuccessAt: null,
        lastErrorAt: null,
        lastErrorMessage: null,
        requestsTotal: 0,
        requestsFailed: 0,
        rateLimitedTotal: 0,
      };
    },
  };
}

describe('ProviderRegistry', () => {
  it('resolve aliases pro mesmo provider real (Heile/Jason = BRGPS)', () => {
    const registry = new ProviderRegistryImpl();
    const brgps = makeFakeProvider('brgps');
    registry.register(brgps, ['heile', 'jason']);

    expect(registry.get('brgps')).toBe(brgps);
    expect(registry.get('heile')).toBe(brgps);
    expect(registry.get('jason')).toBe(brgps);
    expect(registry.get('brgps')!.id).toBe('brgps');
  });

  it('provider desconhecido retorna undefined, nunca inventa um provider', () => {
    const registry = new ProviderRegistryImpl();
    expect(registry.get('provedor-que-nao-existe')).toBeUndefined();
  });
});
