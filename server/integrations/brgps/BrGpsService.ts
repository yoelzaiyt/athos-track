// Orquestração de sincronização, histórico e ativação — seção 5 do brief.
// É a única peça que conhece Adapter (fornecedor) E Repository (banco ATHOS)
// ao mesmo tempo; nem o CLI nem o poller falam direto com o adapter ou o db.

import { BrGpsAdapter } from './BrGpsAdapter.ts';
import type { BrGpsRepository } from './db.ts';

export interface SyncTickSummary {
  targets: number;
  fetched: number;
  applied: number;
  deduped: number;
  stale: number;
  geofenceEvents: number;
  errors: number;
}

export class BrGpsService {
  constructor(
    private adapter: BrGpsAdapter,
    private repo: BrGpsRepository
  ) {}

  /** Descobre dispositivos no fornecedor e registra os novos como UNASSIGNED — seção 12. */
  async syncDeviceCatalog(): Promise<{ discovered: number; newlyRegistered: number }> {
    const ids = await this.adapter.discoverAllDeviceIds();
    const newlyRegistered = await this.repo.upsertDiscoveredDevices(ids);
    console.log(`[brgps-service] catálogo: ${ids.length} dispositivos no fornecedor, ${newlyRegistered} novos registrados como UNASSIGNED.`);
    return { discovered: ids.length, newlyRegistered };
  }

  /** PATCH /tag — ativação administrativa (seção 15, nunca por usuário de campo). */
  async activateDevices(externalIds: string[]): Promise<void> {
    await this.adapter.activateDevices(externalIds);
    await this.repo.markDevicesActived(externalIds, true);
    console.log(`[brgps-service] ${externalIds.length} dispositivo(s) ativado(s) no fornecedor e marcados como is_actived=true.`);
  }

  /** Um ciclo de polling: busca posições em lote só dos dispositivos ASSIGNED+ativados e aplica. Seção 18-20. */
  async runSyncTick(): Promise<SyncTickSummary> {
    const summary: SyncTickSummary = { targets: 0, fetched: 0, applied: 0, deduped: 0, stale: 0, geofenceEvents: 0, errors: 0 };

    const targets = await this.repo.getActivePositionTargets();
    summary.targets = targets.length;

    if (targets.length === 0) {
      await this.repo.upsertProviderHealth({ status: 'HEALTHY', success: true });
      return summary;
    }

    const byExternalId = new Map(targets.map((t) => [t.externalDeviceId, t]));

    try {
      const positions = await this.adapter.fetchPositions(targets.map((t) => t.externalDeviceId));
      summary.fetched = positions.length;

      for (const position of positions) {
        const target = byExternalId.get(position.externalDeviceId);
        if (!target) continue; // não deveria acontecer, mas não derruba o ciclo

        if (position.qualityFlags.includes('INVALID_COORDINATE') || position.qualityFlags.includes('INVALID_BATTERY')) {
          console.warn(`[brgps-service] posição descartada por qualidade (${position.qualityFlags.join(',')}) — device ${position.externalDeviceId}`);
          continue;
        }
        if (position.qualityFlags.includes('STALE_POSITION')) summary.stale += 1;

        const result = await this.repo.applyPosition(target, position);
        if (result.deduped) {
          summary.deduped += 1;
          continue;
        }
        if (result.positionUpdated) summary.applied += 1;

        if (result.geofenceEvent) {
          summary.geofenceEvents += 1;
          await this.repo.createGeofenceAlert(target, result.geofenceEvent, position);
          if (result.geofenceEvent.type === 'exit') {
            await this.repo.createRecoveryOccurrence(target, result.geofenceEvent, position);
          }
        }
      }

      await this.repo.upsertProviderHealth({
        status: 'HEALTHY',
        success: true,
        requestsDelta: 1,
        positionsReceivedDelta: summary.fetched,
        positionsDedupedDelta: summary.deduped,
      });
    } catch (err) {
      summary.errors += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[brgps-service] falha no ciclo de sync: ${message}`);
      await this.repo.upsertProviderHealth({
        status: 'DEGRADED',
        success: false,
        errorMessage: message,
        requestsDelta: 1,
        failedDelta: 1,
      });
    }

    console.log(
      `[brgps-service] ciclo concluído: alvos=${summary.targets} recebidas=${summary.fetched} ` +
      `aplicadas=${summary.applied} dedup=${summary.deduped} stale=${summary.stale} ` +
      `eventosGeofence=${summary.geofenceEvents} erros=${summary.errors}`
    );

    return summary;
  }

  /** GET /tag/history real — seção 13, 35. */
  async syncHistory(externalId: string, timeFrom: Date, timeTo: Date) {
    const target = await this.repo.getAssetForExternalId(externalId);
    if (!target) {
      throw new Error(`Dispositivo externo ${externalId} não está vinculado a nenhum asset ATHOS ainda.`);
    }
    const points = await this.adapter.fetchHistory(externalId, timeFrom, timeTo);
    console.log(`[brgps-service] histórico real: ${points.length} pontos para ${target.assetName} (${target.assetCode}) entre ${timeFrom.toISOString()} e ${timeTo.toISOString()}.`);
    return { target, points };
  }
}
