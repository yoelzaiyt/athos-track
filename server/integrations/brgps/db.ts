// Acesso a dados do BrGpsService ao Postgres do ATHOS (Supabase) via DIRECT_URL —
// mesmo padrão do server/gt06-listener/index.ts e scripts/seed-supabase.ts: este
// processo é um gateway de backend confiável, não um cliente anônimo, então
// conecta direto (bypassa RLS) em vez de usar a anon key do supabase-js.
//
// Não cria um sistema de posição paralelo: current position continua em
// assets.telemetry_*, histórico continua em asset_route_points (a mesma tabela
// que HistoryPage.tsx já esperava usar — ver comentário na migration original).

import { Client } from 'pg';
import type { NormalizedPosition } from './types.ts';
import { isInsideGeofence } from '../shared/geofenceEngine.ts';
import { positionFingerprint } from './BrGpsMapper.ts';

export interface PositionTarget {
  providerDeviceId: string;
  externalDeviceId: string;
  assetId: string;
  assetName: string;
  assetCode: string;
  category: string;
  subcategory: string | null;
  clientId: string;
  unitId: string;
  unitName: string;
  status: string;
  geofenceId: string | null;
  geofenceName: string | null;
}

export interface GeofenceEventResult {
  type: 'entry' | 'exit';
  geofenceId: string;
  geofenceName: string;
}

export interface ApplyPositionResult {
  deduped: boolean;
  positionUpdated: boolean;
  geofenceEvent: GeofenceEventResult | null;
}

export class BrGpsRepository {
  private client: Client;

  constructor(connectionString: string) {
    this.client = new Client({ connectionString });
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    await this.client.end();
  }

  // ===== Device discovery (seção 11/12) =====

  async upsertDiscoveredDevices(externalIds: string[]): Promise<number> {
    if (externalIds.length === 0) return 0;
    const { rowCount } = await this.client.query(
      `insert into provider_devices (provider, external_device_id)
       select 'BRGPS', unnest($1::text[])
       on conflict (provider, external_device_id) do nothing`,
      [externalIds]
    );
    return rowCount ?? 0;
  }

  async markDevicesActived(externalIds: string[], actived: boolean): Promise<void> {
    if (externalIds.length === 0) return;
    await this.client.query(
      `update provider_devices set is_actived = $1 where provider = 'BRGPS' and external_device_id = any($2::text[])`,
      [actived, externalIds]
    );
  }

  async listUnassignedDevices(): Promise<{ id: string; externalDeviceId: string; isActived: boolean; discoveredAt: string }[]> {
    const { rows } = await this.client.query(
      `select id, external_device_id, is_actived, discovered_at
       from provider_devices where provider = 'BRGPS' and status = 'UNASSIGNED'
       order by discovered_at desc`
    );
    return rows.map((r) => ({
      id: r.id,
      externalDeviceId: r.external_device_id,
      isActived: r.is_actived,
      discoveredAt: r.discovered_at,
    }));
  }

  // ===== Sync targets (seção 18) =====

  async getActivePositionTargets(): Promise<PositionTarget[]> {
    const { rows } = await this.client.query(
      `select pd.id as provider_device_id, pd.external_device_id,
              a.id as asset_id, a.name as asset_name, a.code as asset_code,
              a.category, a.subcategory, a.client_id, a.unit_id, a.unit_name,
              a.status, a.geofence_id, a.geofence_name
       from provider_devices pd
       join assets a on a.id = pd.asset_id
       where pd.provider = 'BRGPS' and pd.status = 'ASSIGNED' and pd.is_actived = true`
    );
    return rows.map((r) => ({
      providerDeviceId: r.provider_device_id,
      externalDeviceId: r.external_device_id,
      assetId: r.asset_id,
      assetName: r.asset_name,
      assetCode: r.asset_code,
      category: r.category,
      subcategory: r.subcategory,
      clientId: r.client_id,
      unitId: r.unit_id,
      unitName: r.unit_name,
      status: r.status,
      geofenceId: r.geofence_id,
      geofenceName: r.geofence_name,
    }));
  }

  // ===== Aplicação de posição (seções 8, 19, 20, 27, 28) =====

  async applyPosition(target: PositionTarget, position: NormalizedPosition): Promise<ApplyPositionResult> {
    const fingerprint = positionFingerprint(position);

    const dedupCheck = await this.client.query('select 1 from asset_route_points where fingerprint = $1', [fingerprint]);
    if ((dedupCheck.rowCount ?? 0) > 0) {
      return { deduped: true, positionUpdated: false, geofenceEvent: null };
    }

    const currentRow = await this.client.query(
      'select telemetry_packet_timestamp, status from assets where id = $1',
      [target.assetId]
    );
    const current = currentRow.rows[0];
    const lastKnownAt: Date | null = current?.telemetry_packet_timestamp ? new Date(current.telemetry_packet_timestamp) : null;
    // Seção 20: nunca substituir a posição atual por uma mais antiga — só grava histórico.
    // Isto é só uma checagem ESPECULATIVA (baseada num SELECT que já pode
    // estar obsoleto no momento em que o UPDATE abaixo realmente roda) —
    // decide se vale a pena computar geofence/tentar o UPDATE, não é a
    // fonte de verdade final. Ver isNewer (resultado real) mais abaixo.
    const speculativeIsNewer = !lastKnownAt || position.occurredAt.getTime() > lastKnownAt.getTime();

    let geofenceEvent: GeofenceEventResult | null = null;
    let isNewer = false;

    if (speculativeIsNewer) {
      let nextStatus: string = current?.status ?? target.status;

      if (target.geofenceId) {
        const geoRow = await this.client.query(
          'select id, name, type, coordinates, radius, exit_alert, entry_alert from geofences where id = $1',
          [target.geofenceId]
        );
        const geofence = geoRow.rows[0];
        if (geofence) {
          const inside = isInsideGeofence(position.latitude, position.longitude, {
            id: geofence.id,
            name: geofence.name,
            type: geofence.type,
            coordinates: geofence.coordinates,
            radius: geofence.radius,
          });
          const wasOutside = current?.status === 'out_of_geofence';

          if (!inside && !wasOutside) {
            nextStatus = 'out_of_geofence';
            if (geofence.exit_alert) {
              geofenceEvent = { type: 'exit', geofenceId: geofence.id, geofenceName: geofence.name };
            }
          } else if (inside && wasOutside) {
            nextStatus = 'online';
            if (geofence.entry_alert) {
              geofenceEvent = { type: 'entry', geofenceId: geofence.id, geofenceName: geofence.name };
            }
          }
        }
      }

      // MULTI-PROVIDER-VALIDATION.md (teste de concorrência real): o SELECT
      // acima pode estar obsoleto no instante em que este UPDATE roda de
      // verdade — sob concorrência, duas chamadas concorrentes podiam ler
      // "sou mais novo" a partir do mesmo estado antigo e a que gravasse
      // por ÚLTIMO em relógio de parede vencia, mesmo carregando o
      // timestamp de GPS mais ANTIGO das duas (lost update clássico,
      // confirmado com 40 chamadas concorrentes no mesmo asset — a posição
      // final não batia com o timestamp mais recente enviado). Fechado
      // tornando a comparação parte da própria condição do UPDATE — o
      // Postgres serializa por lock de linha, então quem quer que grave
      // por último sempre reavalia contra o valor JÁ COMMITADO, não contra
      // a leitura obsoleta de antes. `isNewer` real = o UPDATE realmente
      // afetou uma linha, não mais a checagem especulativa de cima.
      const updateResult = await this.client.query(
        `update assets set
           telemetry_latitude = $1, telemetry_longitude = $2,
           telemetry_battery_raw = $3, telemetry_battery_level_category = $4,
           telemetry_last_communication = $5, telemetry_packet_timestamp = $6,
           telemetry_provider_published_at = $7, telemetry_position_source = 'GPS',
           status = $8, mac = coalesce($9, mac), updated_at = now()
         where id = $10
           and (telemetry_packet_timestamp is null or telemetry_packet_timestamp < $6)
         returning id`,
        [
          position.latitude,
          position.longitude,
          position.batteryRaw,
          position.batteryLevel,
          position.receivedAt.toISOString(),
          position.occurredAt.toISOString(),
          position.providerPublishedAt.toISOString(),
          nextStatus,
          position.mac ?? null,
          target.assetId,
        ]
      );
      isNewer = (updateResult.rowCount ?? 0) > 0;
      if (!isNewer) {
        // Perdeu a corrida de verdade — um concorrente com timestamp mais
        // novo já commitou entre nossa leitura e nosso UPDATE. O status/
        // geofenceEvent que calculamos acima partiu de um estado que já
        // não vale mais — descarta, não dispara alerta baseado nele.
        geofenceEvent = null;
      }
    }

    // MULTI-PROVIDER-VALIDATION.md (teste de concorrência real, 40 chamadas
    // simultâneas contra o mesmo asset): a checagem de dedup acima (SELECT
    // antes deste INSERT) não é atômica — sob concorrência de verdade, duas
    // chamadas com o MESMO fingerprint podiam passar as duas pela checagem
    // (nenhuma via a linha da outra ainda) e só uma das duas conseguia
    // inserir; a outra estourava a constraint única (`idx_route_points_
    // fingerprint`) como EXCEÇÃO NÃO TRATADA, derrubando o resto do ciclo
    // de sync inteiro (o `for` em BrGpsService.runSyncTick não tem try/catch
    // por posição, só no ciclo todo). `on conflict do nothing` torna o
    // INSERT em si a fonte de verdade atômica do dedup — quem perder a
    // corrida cai graciosamente em "já deduplicado" (mesmo formato do
    // dedup check acima) em vez de derrubar o ciclo. Isso também evita
    // disparar `geofenceEvent` duas vezes pra exatamente a mesma leitura.
    const inserted = await this.client.query(
      `insert into asset_route_points
         (asset_id, latitude, longitude, speed, event, recorded_at, provider, provider_published_at, distance_raw, battery_raw, fingerprint)
       values ($1, $2, $3, 0, $4, $5, 'BRGPS', $6, $7, $8, $9)
       on conflict (fingerprint) where fingerprint is not null do nothing
       returning id`,
      [
        target.assetId,
        position.latitude,
        position.longitude,
        geofenceEvent ? (geofenceEvent.type === 'exit' ? 'geofence_exit' : 'geofence_entry') : null,
        position.occurredAt.toISOString(),
        position.providerPublishedAt.toISOString(),
        position.providerDistanceRaw ?? null,
        position.batteryRaw,
        fingerprint,
      ]
    );
    if ((inserted.rowCount ?? 0) === 0) {
      // Perdeu a corrida pro fingerprint — um concorrente já gravou
      // exatamente esta leitura entre a checagem e este insert.
      return { deduped: true, positionUpdated: false, geofenceEvent: null };
    }

    await this.client.query('update provider_devices set last_synced_at = now() where id = $1', [target.providerDeviceId]);

    return { deduped: false, positionUpdated: isNewer, geofenceEvent };
  }

  // ===== Alertas e recuperação de campo (seções 28/29) =====

  async createGeofenceAlert(target: PositionTarget, event: GeofenceEventResult, position: NormalizedPosition): Promise<void> {
    await this.client.query(
      `insert into system_alerts (asset_id, asset_name, category, unit_name, type, title, message, severity, latitude, longitude)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        target.assetId,
        target.assetName,
        target.category,
        target.unitName,
        event.type === 'exit' ? 'geofence_exit' : 'geofence_entry',
        event.type === 'exit' ? 'Saída de cerca virtual' : 'Retorno à cerca virtual',
        `${target.assetName} (${target.assetCode}) ${event.type === 'exit' ? 'saiu de' : 'retornou a'} "${event.geofenceName}" — posição real via API BRGPS.`,
        event.type === 'exit' ? 'critical' : 'info',
        position.latitude,
        position.longitude,
      ]
    );
  }

  async createRecoveryOccurrence(target: PositionTarget, event: GeofenceEventResult, position: NormalizedPosition): Promise<void> {
    const batteryPercent =
      position.batteryLevel === 'HIGH' ? 90 : position.batteryLevel === 'MEDIUM' ? 55 : position.batteryLevel === 'LOW' ? 20 : null;

    await this.client.query(
      `insert into recovery_occurrences
         (asset_id, asset_name, asset_code, category, subcategory, client_id, unit_id, unit_name,
          geofence_id, geofence_name, status, priority, exit_detected_at,
          last_asset_lat, last_asset_lng, last_asset_source, last_asset_timestamp,
          battery_level, is_simulated)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'detectado','normal',$11,$12,$13,'GPS',$14,$15,false)`,
      [
        target.assetId,
        target.assetName,
        target.assetCode,
        target.category,
        target.subcategory,
        target.clientId,
        target.unitId,
        target.unitName,
        event.geofenceId,
        event.geofenceName,
        position.occurredAt.toISOString(),
        position.latitude,
        position.longitude,
        position.occurredAt.toISOString(),
        batteryPercent,
      ]
    );
  }

  // ===== Provider health (seção 38) =====

  async upsertProviderHealth(patch: {
    status: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
    success?: boolean;
    errorMessage?: string;
    requestsDelta?: number;
    failedDelta?: number;
    rateLimitedDelta?: number;
    positionsReceivedDelta?: number;
    positionsDedupedDelta?: number;
  }): Promise<void> {
    await this.client.query(
      `insert into provider_health (provider, status, last_success_at, last_error_at, last_error_message,
         requests_total, requests_failed, rate_limited_total, positions_received_total, positions_deduplicated_total, updated_at)
       values ('BRGPS', $1,
         case when $2 then now() else null end,
         case when $2 then null else now() end,
         $3, $4, $5, $6, $7, $8, now())
       on conflict (provider) do update set
         status = excluded.status,
         last_success_at = coalesce(excluded.last_success_at, provider_health.last_success_at),
         last_error_at = coalesce(excluded.last_error_at, provider_health.last_error_at),
         last_error_message = coalesce(excluded.last_error_message, provider_health.last_error_message),
         requests_total = provider_health.requests_total + excluded.requests_total,
         requests_failed = provider_health.requests_failed + excluded.requests_failed,
         rate_limited_total = provider_health.rate_limited_total + excluded.rate_limited_total,
         positions_received_total = provider_health.positions_received_total + excluded.positions_received_total,
         positions_deduplicated_total = provider_health.positions_deduplicated_total + excluded.positions_deduplicated_total,
         updated_at = now()`,
      [
        patch.status,
        patch.success ?? false,
        patch.errorMessage ?? null,
        patch.requestsDelta ?? 0,
        patch.failedDelta ?? 0,
        patch.rateLimitedDelta ?? 0,
        patch.positionsReceivedDelta ?? 0,
        patch.positionsDedupedDelta ?? 0,
      ]
    );
  }

  // ===== Histórico real (seção 13/35) =====

  async getAssetForExternalId(externalDeviceId: string): Promise<PositionTarget | null> {
    const { rows } = await this.client.query(
      `select pd.id as provider_device_id, pd.external_device_id,
              a.id as asset_id, a.name as asset_name, a.code as asset_code,
              a.category, a.subcategory, a.client_id, a.unit_id, a.unit_name,
              a.status, a.geofence_id, a.geofence_name
       from provider_devices pd
       join assets a on a.id = pd.asset_id
       where pd.provider = 'BRGPS' and pd.external_device_id = $1`,
      [externalDeviceId]
    );
    const r = rows[0];
    if (!r) return null;
    return {
      providerDeviceId: r.provider_device_id,
      externalDeviceId: r.external_device_id,
      assetId: r.asset_id,
      assetName: r.asset_name,
      assetCode: r.asset_code,
      category: r.category,
      subcategory: r.subcategory,
      clientId: r.client_id,
      unitId: r.unit_id,
      unitName: r.unit_name,
      status: r.status,
      geofenceId: r.geofence_id,
      geofenceName: r.geofence_name,
    };
  }
}
