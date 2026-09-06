// Instrumentação isolada pro teste de campo com a tag física de terceiro
// (etiqueta 3092660181, IMEI real ainda desconhecido). Não decodifica nada
// sozinha — só formata/loga o que server/gt06-listener/index.ts já decodificou
// via protocol.ts, mantém contadores em memória pro /diagnostics/gt06, e sobe
// um servidor HTTP mínimo à parte (não é o server/api de produção).
//
// Ativado só com GT06_HOMOLOG_MODE=true — com a flag desligada (padrão),
// server/gt06-listener/index.ts não chama nada daqui, então o comportamento
// de produção fica byte a byte igual ao de antes desta revisão.

import http from 'node:http';
import type { Gt06HomologRepository, HomologDeviceRow } from '../integrations/gt06/homologRepo.ts';
import {
  PROTOCOL,
  decodeLocation,
  decodeHeartbeat,
  decodeAlarm,
  decodeRfid,
  decodeBcdImei,
  type Gt06Frame,
} from './protocol.ts';

// Reaproveita os decoders puros de protocol.ts só pra preencher o campo
// decoded_payload do log [GT06 FRAME] — não substitui a decodificação "de
// verdade" que handleFrame (index.ts) já faz; é só uma prévia read-only.
export function previewDecode(frame: Gt06Frame): unknown {
  try {
    switch (frame.protocol) {
      case PROTOCOL.LOGIN:
        return { imei: decodeBcdImei(frame.content) };
      case PROTOCOL.LOCATION:
      case PROTOCOL.LOCATION_V3:
      case PROTOCOL.LOCATION_V4:
      case PROTOCOL.LOCATION_4G:
      case PROTOCOL.LOCATION_LEGACY_EXT:
        return decodeLocation(frame.content);
      case PROTOCOL.HEARTBEAT:
      case PROTOCOL.HEARTBEAT_ALT:
        return decodeHeartbeat(frame.content);
      case PROTOCOL.ALARM:
        return decodeAlarm(frame.content);
      case PROTOCOL.RFID:
        return decodeRfid(frame.content);
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export interface HomologStats {
  listenerPort: number;
  connections: number;
  totalFrames: number;
  lastFrameAt: string | null;
  lastImei: string | null;
}

const stats: HomologStats = {
  listenerPort: 0,
  connections: 0,
  totalFrames: 0,
  lastFrameAt: null,
  lastImei: null,
};

export function initHomologStats(listenerPort: number): void {
  stats.listenerPort = listenerPort;
}

// Log incondicional de QUALQUER byte recebido no socket, antes de qualquer
// tentativa de reconhecer frame GT06 — ao contrário de logFrame (que só roda
// pra frames que parseFrames já validou como 0x7878...0x0d0a), isto cobre o
// caso de um dispositivo falando um protocolo diferente do esperado, que
// parseFrames descartaria silenciosamente na resincronização.
export function logRawChunk(remoteIp: string, remotePort: number, chunk: Buffer): void {
  console.log(
    `[GT06 RAW TCP DATA]\n` +
    `timestamp: ${new Date().toISOString()}\n` +
    `remote_ip: ${remoteIp}\n` +
    `remote_port: ${remotePort}\n` +
    `bytes: ${chunk.length}\n` +
    `hex: ${chunk.toString('hex')}`
  );
}

export function logConnection(remoteIp: string, remotePort: number): void {
  stats.connections += 1;
  console.log(
    `[GT06 CONNECTION]\n` +
    `timestamp: ${new Date().toISOString()}\n` +
    `remote_ip: ${remoteIp}\n` +
    `remote_port: ${remotePort}`
  );
}

export interface FrameLogInput {
  remoteIp: string;
  remotePort: number;
  bytes: number;
  hex: string;
  protocolNumber: number;
  imei: string | undefined;
  serial: number | undefined;
  crcValid: boolean | undefined;
  decodedPayload: unknown;
}

export function logFrame(input: FrameLogInput): void {
  stats.totalFrames += 1;
  stats.lastFrameAt = new Date().toISOString();
  if (input.imei) stats.lastImei = input.imei;

  const field = <T>(v: T | undefined | null): string => (v === undefined || v === null || v === '' ? 'UNKNOWN' : String(v));

  console.log(
    `[GT06 FRAME]\n` +
    `timestamp: ${stats.lastFrameAt}\n` +
    `remote_ip: ${input.remoteIp}\n` +
    `remote_port: ${input.remotePort}\n` +
    `bytes: ${input.bytes}\n` +
    `hex: ${input.hex}\n` +
    `protocol_number: 0x${input.protocolNumber.toString(16).padStart(2, '0')}\n` +
    `imei: ${field(input.imei)}\n` +
    `serial: ${field(input.serial)}\n` +
    `checksum_status: ${input.crcValid === undefined ? 'UNKNOWN' : input.crcValid ? 'VALID' : 'INVALID'}\n` +
    `decoded_payload: ${input.decodedPayload ? JSON.stringify(input.decodedPayload) : 'UNKNOWN'}`
  );
}

export function logAck(protocolNumber: number, serial: number, hex: string): void {
  console.log(
    `[GT06 ACK]\n` +
    `protocol: 0x${protocolNumber.toString(16).padStart(2, '0')}\n` +
    `serial: ${serial}\n` +
    `hex: ${hex}`
  );
}

export function logDeviceDetected(opts: { externalLabelId: string; imei: string; remoteIp: string; protocol: string }): void {
  console.log(
    `\nGT06 DEVICE DETECTED\n` +
    `\nExternal Label:\n${opts.externalLabelId}\n` +
    `\nReal IMEI:\n${opts.imei}\n` +
    `\nRemote IP:\n${opts.remoteIp}\n` +
    `\nProtocol:\n${opts.protocol}\n` +
    `\nLogin:\nPASS\n`
  );
}

export interface GpsLogInput {
  imei: string;
  latitude: number;
  longitude: number;
  timestamp: Date;
  speedKmh: number;
  course: number;
  satellites: number | 'UNKNOWN';
  mcc?: number;
  mnc?: number;
  lac?: number;
  cellId?: number;
  gpsValid: boolean;
  source: 'GPS' | 'LBS';
}

export function logGps(input: GpsLogInput): void {
  const field = <T>(v: T | undefined): string => (v === undefined ? 'UNKNOWN' : String(v));
  console.log(
    `[GT06 GPS]\n` +
    `imei: ${input.imei}\n` +
    `latitude: ${input.latitude}\n` +
    `longitude: ${input.longitude}\n` +
    `timestamp: ${input.timestamp.toISOString()}\n` +
    `speed_kmh: ${input.speedKmh}\n` +
    `course: ${input.course}\n` +
    `satellites: ${input.satellites}\n` +
    `mcc: ${field(input.mcc)}\n` +
    `mnc: ${field(input.mnc)}\n` +
    `lac: ${field(input.lac)}\n` +
    `cell_id: ${field(input.cellId)}\n` +
    `gps_valido: ${input.gpsValid ? 'SIM' : 'NAO'}\n` +
    `origem: ${input.source}`
  );
}

// Servidor HTTP mínimo, só pra diagnóstico deste teste — porta própria
// (GT06_HOMOLOG_DIAG_PORT), separado do server/api de produção. Não expõe
// nada além do status do listener e do dispositivo correlacionado.
export function startDiagnosticsServer(opts: { port: number; homologRepo: Gt06HomologRepository; externalLabelId: string }): http.Server {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    if (req.url === '/diagnostics/gt06') {
      res.end(JSON.stringify({
        listener: 'online',
        port: stats.listenerPort,
        connections: stats.connections,
        totalFrames: stats.totalFrames,
        lastFrameAt: stats.lastFrameAt,
        lastImei: stats.lastImei,
      }, null, 2));
      return;
    }

    if (req.url === `/diagnostics/gt06/${opts.externalLabelId}`) {
      let device: HomologDeviceRow | null = null;
      try {
        device = await opts.homologRepo.getByLabel(opts.externalLabelId);
      } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'failed to query homolog device', detail: (err as Error).message }));
        return;
      }

      if (!device) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'not found', externalLabelId: opts.externalLabelId }));
        return;
      }

      res.end(JSON.stringify({
        externalLabelId: device.externalLabelId,
        imei: device.imei,
        status: device.status,
        lastSeenAt: device.lastSeenAt,
        lastPacketType: device.lastPacketType,
        lastGps: device.lastLatitude !== null && device.lastLongitude !== null
          ? { latitude: device.lastLatitude, longitude: device.lastLongitude, at: device.lastGpsAt }
          : null,
      }, null, 2));
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'not found' }));
  });

  server.listen(opts.port, () => {
    console.log(`[gt06-homolog] diagnóstico HTTP em http://localhost:${opts.port}/diagnostics/gt06`);
  });

  return server;
}
