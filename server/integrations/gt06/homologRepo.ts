// Persistência do teste de campo com tag física de terceiro (correlação
// external_label_id -> IMEI real), tabela gt06_homolog_devices — completamente
// separada de server/integrations/gt06/db.ts (que grava em assets/frota real)
// e de homologation_requests (fluxo de fornecedor com formulário prévio).
// Usado só quando GT06_HOMOLOG_MODE=true, ver server/gt06-listener/index.ts.

import { Client } from 'pg';
import { sslFor } from '../../db/connectionSsl';

export interface HomologDeviceRow {
  id: string;
  externalLabelId: string;
  imei: string | null;
  protocol: string;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  lastIp: string | null;
  lastPort: number | null;
  lastPacketType: string | null;
  lastRawHex: string | null;
  lastLatitude: number | null;
  lastLongitude: number | null;
  lastGpsAt: string | null;
  status: 'WAITING_DEVICE' | 'CONNECTED' | 'DISCONNECTED';
}

function mapRow(r: any): HomologDeviceRow {
  return {
    id: r.id,
    externalLabelId: r.external_label_id,
    imei: r.imei,
    protocol: r.protocol,
    firstSeenAt: r.first_seen_at,
    lastSeenAt: r.last_seen_at,
    lastIp: r.last_ip,
    lastPort: r.last_port,
    lastPacketType: r.last_packet_type,
    lastRawHex: r.last_raw_hex,
    lastLatitude: r.last_latitude,
    lastLongitude: r.last_longitude,
    lastGpsAt: r.last_gps_at,
    status: r.status,
  };
}

export class Gt06HomologRepository {
  private client: Client;

  constructor(connectionString: string) {
    this.client = new Client({ connectionString, ssl: sslFor(connectionString) });
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    await this.client.end();
  }

  async getByLabel(externalLabelId: string): Promise<HomologDeviceRow | null> {
    const { rows } = await this.client.query('select * from gt06_homolog_devices where external_label_id = $1', [externalLabelId]);
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async getByImei(imei: string): Promise<HomologDeviceRow | null> {
    const { rows } = await this.client.query('select * from gt06_homolog_devices where imei = $1', [imei]);
    return rows[0] ? mapRow(rows[0]) : null;
  }

  // Correlaciona a etiqueta física (external_label_id, ex: "3092660181") com
  // o IMEI real extraído do login GT06. Nunca aceita imei vindo de outro
  // lugar que não o próprio frame decodificado — não há caminho no chamador
  // que permita "adivinhar" esse valor.
  async recordLogin(opts: { externalLabelId: string; imei: string; ip: string; rawHex: string }): Promise<HomologDeviceRow> {
    const { rows } = await this.client.query(
      `update gt06_homolog_devices set
         imei = $2, status = 'CONNECTED',
         first_seen_at = coalesce(first_seen_at, now()),
         last_seen_at = now(), last_ip = $3, last_packet_type = 'LOGIN', last_raw_hex = $4,
         updated_at = now()
       where external_label_id = $1
       returning *`,
      [opts.externalLabelId, opts.imei, opts.ip, opts.rawHex]
    );
    return mapRow(rows[0]);
  }

  async recordFrame(opts: { externalLabelId: string; ip: string; port: number; packetType: string; rawHex: string }): Promise<void> {
    await this.client.query(
      `update gt06_homolog_devices set
         last_seen_at = now(), last_ip = $2, last_port = $3, last_packet_type = $4, last_raw_hex = $5,
         updated_at = now()
       where external_label_id = $1`,
      [opts.externalLabelId, opts.ip, opts.port, opts.packetType, opts.rawHex]
    );
  }

  async recordGps(opts: { externalLabelId: string; latitude: number; longitude: number; occurredAt: Date }): Promise<void> {
    await this.client.query(
      `update gt06_homolog_devices set
         last_latitude = $2, last_longitude = $3, last_gps_at = $4, updated_at = now()
       where external_label_id = $1`,
      [opts.externalLabelId, opts.latitude, opts.longitude, opts.occurredAt.toISOString()]
    );
  }

  async recordDisconnect(externalLabelId: string): Promise<void> {
    await this.client.query(
      `update gt06_homolog_devices set status = 'DISCONNECTED', updated_at = now() where external_label_id = $1 and status = 'CONNECTED'`,
      [externalLabelId]
    );
  }
}
