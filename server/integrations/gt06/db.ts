// Persistência da ingestão GT06 real (dispositivo de frota, não o fluxo de
// homologação de fornecedor). Mesmo padrão do BrGpsRepository
// (server/integrations/brgps/db.ts): current position em assets.telemetry_*,
// histórico em asset_route_points, geofence via server/integrations/shared,
// alertas em system_alerts — nenhuma tabela nova precisou ser criada porque
// essas colunas já são genéricas por provider desde a migration BRGPS.
//
// Diferença chave em relação ao BRGPS: lá o vínculo dispositivo→asset passa
// por descoberta + vinculação manual (provider_devices), porque o provedor
// não expõe o identificador que o ATHOS já usa. No GT06 o próprio pacote de
// login carrega o IMEI, e assets.imei já existe (unique, obrigatório) — o
// vínculo é direto, sem passo de "descoberta" nem tela de admin extra.

import { Client } from 'pg';
import { isInsideGeofence } from '../shared/geofenceEngine.ts';

export interface AssetTarget {
  assetId: string;
  assetName: string;
  assetCode: string;
  category: string;
  unitName: string;
  status: string;
  geofenceId: string | null;
  geofenceName: string | null;
}

export interface PositionInput {
  latitude: number;
  longitude: number;
  speedKmh: number;
  course: number;
  occurredAt: Date;
  satellites: number;
  ignition?: boolean;
}

export interface GeofenceEventResult {
  type: 'entry' | 'exit';
  geofenceId: string;
  geofenceName: string;
}

export interface ApplyPositionResult {
  positionUpdated: boolean;
  geofenceEvent: GeofenceEventResult | null;
}

export class Gt06Repository {
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

  async findAssetByImei(imei: string): Promise<AssetTarget | null> {
    const { rows } = await this.client.query(
      `select id, name, code, category, unit_name, status, geofence_id, geofence_name
       from assets where imei = $1`,
      [imei]
    );
    const r = rows[0];
    if (!r) return null;
    return {
      assetId: r.id,
      assetName: r.name,
      assetCode: r.code,
      category: r.category,
      unitName: r.unit_name,
      status: r.status,
      geofenceId: r.geofence_id,
      geofenceName: r.geofence_name,
    };
  }

  // Grava posição + telemetria + histórico. Diferente do BRGPS (que só
  // recebe lat/lng/bateria), o GT06 já entrega velocidade e curso reais no
  // próprio pacote — não precisa ser derivado.
  async applyPosition(target: AssetTarget, position: PositionInput): Promise<ApplyPositionResult> {
    let nextStatus: string = target.status;
    let geofenceEvent: GeofenceEventResult | null = null;

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
        const wasOutside = target.status === 'out_of_geofence';

        if (!inside && !wasOutside) {
          nextStatus = 'out_of_geofence';
          if (geofence.exit_alert) geofenceEvent = { type: 'exit', geofenceId: geofence.id, geofenceName: geofence.name };
        } else if (inside && wasOutside) {
          nextStatus = 'online';
          if (geofence.entry_alert) geofenceEvent = { type: 'entry', geofenceId: geofence.id, geofenceName: geofence.name };
        }
      }
    }
    // Sem geofence associada (ou sem transição): mantém o status atual, mesmo
    // padrão do BrGpsRepository.applyPosition — moving/stopped não é decidido
    // aqui, pra não duplicar/conflitar com a lógica de status que já existe
    // no resto do app.

    // Nota: position.satellites não vira telemetry_gps_accuracy — o GT06 dá
    // contagem de satélites (unidade "quantidade"), não uma precisão em
    // metros como esse campo espera (ver TelemetryData.gpsAccuracy). Sem
    // conversão confiável entre as duas coisas, o campo fica intocado.
    await this.client.query(
      `update assets set
         telemetry_latitude = $1, telemetry_longitude = $2, telemetry_speed = $3,
         telemetry_heading = $4,
         telemetry_last_communication = $5, telemetry_packet_timestamp = $5,
         telemetry_position_source = 'GPS Satellite',
         telemetry_ignition = coalesce($6, telemetry_ignition),
         status = $7, provider = 'GT06', updated_at = now()
       where id = $8`,
      [
        position.latitude,
        position.longitude,
        position.speedKmh,
        position.course,
        position.occurredAt.toISOString(),
        position.ignition ?? null,
        nextStatus,
        target.assetId,
      ]
    );

    await this.client.query(
      `insert into asset_route_points (asset_id, latitude, longitude, speed, event, recorded_at, provider)
       values ($1, $2, $3, $4, $5, $6, 'GT06')`,
      [
        target.assetId,
        position.latitude,
        position.longitude,
        position.speedKmh,
        geofenceEvent ? (geofenceEvent.type === 'exit' ? 'geofence_exit' : 'geofence_entry') : null,
        position.occurredAt.toISOString(),
      ]
    );

    return { positionUpdated: true, geofenceEvent };
  }

  // Heartbeat sem GPS: atualiza só o "estou vivo" (bateria/sinal/last_communication),
  // sem mexer em posição. Reaproveita a mesma categoria neutra de bateria que
  // o BRGPS usa (BatteryLevelCategory) — o GT06 também só informa uma faixa
  // (0-6), não uma porcentagem real.
  async applyHeartbeat(assetId: string, voltageLevel: number): Promise<void> {
    const category = voltageLevelToCategory(voltageLevel);
    await this.client.query(
      `update assets set
         telemetry_battery_level_category = $1,
         telemetry_last_communication = now(), provider = 'GT06', updated_at = now()
       where id = $2`,
      [category, assetId]
    );
  }

  // Usado quando um código de alarme chega dentro de um Heartbeat (seção
  // 5.4.1.7 — o heartbeat não carrega GPS próprio), pra não gravar o alerta
  // sem coordenadas.
  async getLastKnownPosition(assetId: string): Promise<{ latitude: number; longitude: number } | null> {
    const { rows } = await this.client.query(
      'select telemetry_latitude, telemetry_longitude from assets where id = $1',
      [assetId]
    );
    const r = rows[0];
    if (!r || r.telemetry_latitude == null || r.telemetry_longitude == null) return null;
    return { latitude: r.telemetry_latitude, longitude: r.telemetry_longitude };
  }

  async createAlert(target: AssetTarget, opts: {
    type: string;
    title: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
    latitude: number;
    longitude: number;
  }): Promise<void> {
    await this.client.query(
      `insert into system_alerts (asset_id, asset_name, category, unit_name, type, title, message, severity, latitude, longitude)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [target.assetId, target.assetName, target.category, target.unitName, opts.type, opts.title, opts.message, opts.severity, opts.latitude, opts.longitude]
    );
  }
}

function voltageLevelToCategory(level: number): 'UNKNOWN' | 'CRITICAL' | 'LOW' | 'MEDIUM' | 'HIGH' {
  // Seção 5.4.1.5: 0 sem energia, 1 extremamente baixa, 2 muito baixa
  // (alarme), 3 baixa (usável), 4 média, 5 alta, 6 muito alta.
  if (level <= 0) return 'CRITICAL';
  if (level <= 2) return 'LOW';
  if (level <= 3) return 'MEDIUM';
  if (level <= 6) return 'HIGH';
  return 'UNKNOWN';
}
