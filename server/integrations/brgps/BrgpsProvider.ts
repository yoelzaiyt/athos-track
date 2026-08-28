// Implementação real de TrackingProvider em cima do que já existia
// (BrGpsClient/BrGpsAdapter/BrGpsMapper — não reimplementados, só embrulhados
// no contrato comum). Ver server/integrations/shared/TrackingProvider.ts
// pra por que isto também serve como "Heile" e "Jason" do brief recebido —
// é o mesmo fornecedor, mesmo token, mesmos endpoints.

import type { Pool } from 'pg';
import { BrGpsAdapter } from './BrGpsAdapter.ts';
import { BrGpsClient } from './BrGpsClient.ts';
import type {
  LocationHistoryPoint,
  NormalizedLocation,
  ProviderHealthStatus,
  TrackingProvider,
} from '../shared/TrackingProvider.ts';

const PROVIDER_ROW_KEY = 'BRGPS'; // valor gravado em provider_health.provider (ver server/integrations/brgps/db.ts)

export class BrgpsProvider implements TrackingProvider {
  readonly id = 'brgps';

  private readonly adapter: BrGpsAdapter;

  constructor(
    config: { baseUrl: string; apiToken: string },
    private readonly healthPool: Pool
  ) {
    this.adapter = new BrGpsAdapter(new BrGpsClient(config));
  }

  async activateDevice(externalIds: string[]): Promise<void> {
    await this.adapter.activateDevices(externalIds);
  }

  async getCurrentLocation(externalIds: string[]): Promise<NormalizedLocation[]> {
    return this.adapter.fetchPositions(externalIds);
  }

  async getLocationHistory(externalId: string, from: Date, to: Date): Promise<LocationHistoryPoint[]> {
    const points = await this.adapter.fetchHistory(externalId, from, to);
    return points.map((p) => ({
      externalDeviceId: p.externalDeviceId,
      occurredAt: p.occurredAt,
      latitude: p.latitude,
      longitude: p.longitude,
      providerDistanceRaw: p.providerDistanceRaw,
    }));
  }

  async discoverDeviceIds(isActived?: boolean): Promise<string[]> {
    return this.adapter.discoverAllDeviceIds(isActived);
  }

  async healthCheck(): Promise<ProviderHealthStatus> {
    const { rows } = await this.healthPool.query(
      `select status, last_success_at, last_error_at, last_error_message,
              requests_total, requests_failed, rate_limited_total
       from provider_health where provider = $1`,
      [PROVIDER_ROW_KEY]
    );
    const row = rows[0];
    if (!row) {
      return {
        providerId: this.id,
        status: 'UNAVAILABLE',
        lastSuccessAt: null,
        lastErrorAt: null,
        lastErrorMessage: 'Nenhum ciclo de sync rodou ainda (provider_health sem linha para BRGPS).',
        requestsTotal: 0,
        requestsFailed: 0,
        rateLimitedTotal: 0,
      };
    }
    return {
      providerId: this.id,
      status: row.status,
      lastSuccessAt: row.last_success_at,
      lastErrorAt: row.last_error_at,
      lastErrorMessage: row.last_error_message,
      requestsTotal: Number(row.requests_total),
      requestsFailed: Number(row.requests_failed),
      rateLimitedTotal: Number(row.rate_limited_total),
    };
  }
}
