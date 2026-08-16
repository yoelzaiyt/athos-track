// Listener TCP real do protocolo GT06 — recebe conexões de rastreadores
// físicos e decodifica login/localização/heartbeat/alarme/RFID. Dois modos,
// decididos pelo IMEI do pacote de login:
//
//  - PRODUÇÃO: o IMEI já existe em assets.imei (ativo real de frota) — grava
//    posição/telemetria/histórico/alertas pelo mesmo caminho que o BRGPS usa
//    (server/integrations/gt06/db.ts, espelhando server/integrations/brgps/db.ts).
//  - HOMOLOGAÇÃO: o IMEI não é de nenhum asset, mas existe em
//    homologation_requests.test_imei — grava eventos de progresso pro portal
//    de homologação de fornecedor (fluxo original deste arquivo).
//
// Se o IMEI não bater com nenhum dos dois, a conexão ainda é decodificada e
// logada no console (dá pra confirmar que o dispositivo está falando GT06
// corretamente), só não persiste nada.
//
// Substitui, para testes com hardware real, o GT06DemoAdapter
// (src/homologation/adapters/gt06DemoAdapter.ts), que só simula a sequência
// com timers.
//
// Uso: npx tsx server/gt06-listener/index.ts
// (ou: npm run gt06:listen)
//
// Configuração (via .env, raiz do projeto):
//   GT06_LISTENER_PORT   porta TCP a escutar (padrão 5023)
//   GT06_LISTENER_HOST   interface a escutar (padrão 0.0.0.0, todas)
//   DIRECT_URL           string de conexão Postgres (já usada pelas migrations)
//
// Por que Postgres direto (DIRECT_URL) em vez da anon key do Supabase: as
// tabelas de homologação dão à role anon permissão só de INSERT, sem SELECT
// (ver supabase/migrations/20260814160000_add_homologation_tables.sql) — de
// propósito, pra um fornecedor nunca ler dados de outra solicitação pelo
// banco. Esse listener precisa localizar assets/solicitações pelo IMEI
// (SELECT), então atua como gateway confiável (mesmo padrão de
// scripts/seed-supabase.ts e server/integrations/brgps), não como cliente
// anônimo. Não expor este processo direto à internet sem revisitar essa
// decisão.

import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';
import { Gt06Repository, type AssetTarget } from '../integrations/gt06/db.ts';
import {
  parseFrames,
  buildAck,
  decodeBcdImei,
  decodeLocation,
  decodeHeartbeat,
  decodeAlarm,
  decodeRfid,
  mapAlarmCode,
  PROTOCOL,
  type Gt06Frame,
} from './protocol.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '../../.env') });

const PORT = Number(process.env.GT06_LISTENER_PORT ?? 5023);
const HOST = process.env.GT06_LISTENER_HOST ?? '0.0.0.0';

const connectionString = process.env.DIRECT_URL;
if (!connectionString) {
  console.error('[gt06-listener] DIRECT_URL não definido no .env — não dá pra consultar/gravar solicitações de homologação.');
  process.exit(1);
}

const db = new Client({ connectionString });
await db.connect();
const gt06Repo = new Gt06Repository(connectionString);
await gt06Repo.connect();
console.log('[gt06-listener] conectado ao Postgres.');

interface Session {
  imei?: string;
  mode: 'production' | 'homologation' | 'unknown';
  assetTarget?: AssetTarget;
  requestId?: string;
  sessionToken?: string;
  deviceId?: string;
  loginOk: boolean;
  locationOk: boolean;
  heartbeatOk: boolean;
  buffer: Buffer;
}

function maskImei(imei: string): string {
  if (imei.length <= 6) return '*'.repeat(imei.length);
  const prefix = imei.slice(0, 2);
  const suffix = imei.slice(-4);
  return `${prefix}${'*'.repeat(imei.length - 6)}${suffix}`;
}

async function findRequestByImei(imei: string) {
  const { rows } = await db.query<{ id: string; session_token: string }>(
    `select id, session_token from homologation_requests where test_imei = $1 order by created_at desc limit 1`,
    [imei]
  );
  return rows[0];
}

async function insertDevice(session: Session) {
  const id = randomUUID();
  await db.query(
    `insert into homologation_devices (id, request_id, imei, demo_mode) values ($1, $2, $3, false)`,
    [id, session.requestId, session.imei]
  );
  return id;
}

async function insertEvent(
  session: Session,
  opts: { packetType: string; step: string; status: 'pending' | 'success' | 'error' }
) {
  if (!session.requestId || !session.sessionToken) return;
  await db.query(
    `insert into homologation_events
       (id, request_id, device_id, session_token, imei_masked, protocol, packet_type, step, status)
     values ($1, $2, $3, $4, $5, 'GT06', $6, $7, $8)`,
    [
      randomUUID(),
      session.requestId,
      session.deviceId ?? null,
      session.sessionToken,
      maskImei(session.imei ?? ''),
      opts.packetType,
      opts.step,
      opts.status,
    ]
  );
}

async function handleFrame(frame: Gt06Frame, session: Session, socket: net.Socket, remote: string) {
  if (!frame.crcValid) {
    console.warn(`[gt06-listener] CRC inválido de ${remote} (protocolo 0x${frame.protocol.toString(16)}) — pacote ignorado. raw=${frame.raw.toString('hex')}`);
    return;
  }

  switch (frame.protocol) {
    case PROTOCOL.LOGIN: {
      const imei = decodeBcdImei(frame.content);
      session.imei = imei;
      socket.write(buildAck(frame.protocol, frame.serial));
      session.loginOk = true;

      const asset = await gt06Repo.findAssetByImei(imei);
      if (asset) {
        session.mode = 'production';
        session.assetTarget = asset;
        console.log(`[gt06-listener] LOGIN de ${remote} — IMEI ${imei} vinculado ao asset "${asset.assetName}" (${asset.assetCode}), modo produção.`);
        break;
      }

      const request = await findRequestByImei(imei);
      if (!request) {
        session.mode = 'unknown';
        console.warn(
          `[gt06-listener] LOGIN de ${remote} — IMEI ${imei} não corresponde a nenhum asset (assets.imei) ` +
          `nem a solicitação de homologação (homologation_requests.test_imei) — conexão confirmada, mas ` +
          `nada será gravado no banco. Cadastre o dispositivo em um asset, ou o IMEI em /homologacao.`
        );
        return;
      }

      session.mode = 'homologation';
      session.requestId = request.id;
      session.sessionToken = request.session_token;
      session.deviceId = await insertDevice(session);
      await insertEvent(session, { packetType: 'LOGIN_PACKET (0x01)', step: 'imei_identified', status: 'success' });
      console.log(`[gt06-listener] LOGIN de ${remote} — IMEI ${imei} vinculado à solicitação de homologação ${request.id}.`);
      break;
    }

    case PROTOCOL.HEARTBEAT:
    case PROTOCOL.HEARTBEAT_ALT: {
      const hb = decodeHeartbeat(frame.content);
      console.log(
        `[gt06-listener] HEARTBEAT de ${remote} (imei=${session.imei ?? '?'})` +
        (hb ? ` — bateria=${hb.voltageLevel} sinal=${hb.gsmSignal}` : ' — conteúdo curto demais pra decodificar')
      );
      socket.write(buildAck(frame.protocol, frame.serial));
      session.heartbeatOk = true;

      if (hb && session.mode === 'production' && session.assetTarget) {
        await gt06Repo.applyHeartbeat(session.assetTarget.assetId, hb.voltageLevel);

        // Seção 5.4.1.7 / nota do doc: alarme de bateria baixa costuma vir
        // repetido pelo heartbeat, não só pelo pacote de Alarm (0x16).
        if (hb.alarmCode !== undefined) {
          const mapping = mapAlarmCode(hb.alarmCode);
          if (mapping.alertType) {
            const lastPos = await gt06Repo.getLastKnownPosition(session.assetTarget.assetId);
            if (lastPos) {
              await gt06Repo.createAlert(session.assetTarget, {
                type: mapping.alertType,
                title: mapping.label,
                message: `${session.assetTarget.assetName} (${session.assetTarget.assetCode}) — ${mapping.label} (heartbeat GT06).`,
                severity: mapping.severity,
                latitude: lastPos.latitude,
                longitude: lastPos.longitude,
              });
            }
          }
        }
      } else if (session.mode === 'homologation') {
        await insertEvent(session, {
          packetType: `HEARTBEAT (0x${frame.protocol.toString(16)})`,
          step: 'heartbeat_received',
          status: 'success',
        });
      }
      break;
    }

    case PROTOCOL.LOCATION:
    case PROTOCOL.LOCATION_V3:
    case PROTOCOL.LOCATION_V4:
    case PROTOCOL.LOCATION_4G:
    case PROTOCOL.LOCATION_LEGACY_EXT: {
      const loc = decodeLocation(frame.content);
      if (loc) {
        console.log(
          `[gt06-listener] LOCALIZAÇÃO de ${remote} (imei=${session.imei ?? '?'}) — ` +
          `lat=${loc.latitude.toFixed(6)} lon=${loc.longitude.toFixed(6)} vel=${loc.speedKmh}km/h ` +
          `sat=${loc.satellites} em ${loc.timestamp.toISOString()}`
        );
      } else {
        console.warn(`[gt06-listener] pacote de localização de ${remote} curto demais pra decodificar. raw=${frame.content.toString('hex')}`);
      }
      session.locationOk = true;

      if (loc && session.mode === 'production' && session.assetTarget) {
        await applyLocationToAsset(session.assetTarget, loc);
      } else if (session.mode === 'homologation') {
        await insertEvent(session, {
          packetType: `GPS_LOCATION (0x${frame.protocol.toString(16)})`,
          step: 'location_packet_received',
          status: loc ? 'success' : 'error',
        });
      }
      break;
    }

    case PROTOCOL.ALARM: {
      const alarm = decodeAlarm(frame.content);
      const mapping = alarm ? mapAlarmCode(alarm.alarmCode) : null;
      console.log(
        `[gt06-listener] ALARME de ${remote} (imei=${session.imei ?? '?'})` +
        (alarm ? ` — ${mapping!.label} (0x${alarm.alarmCode.toString(16).padStart(2, '0')})` : ' — conteúdo curto demais pra decodificar')
      );
      session.locationOk = session.locationOk || Boolean(alarm?.location);

      if (alarm?.location && session.mode === 'production' && session.assetTarget) {
        // Bit1 do Terminal Information (seção 5.3.1.14): 1 = ACC alta (ignição ligada).
        const ignition = (alarm.terminalInfo & 0x02) !== 0;
        await applyLocationToAsset(session.assetTarget, alarm.location, ignition);
        if (mapping?.alertType) {
          await gt06Repo.createAlert(session.assetTarget, {
            type: mapping.alertType,
            title: mapping.label,
            message: `${session.assetTarget.assetName} (${session.assetTarget.assetCode}) — ${mapping.label} (alarme GT06).`,
            severity: mapping.severity,
            latitude: alarm.location.latitude,
            longitude: alarm.location.longitude,
          });
        }
      } else if (session.mode === 'homologation') {
        await insertEvent(session, {
          packetType: `ALARM (0x16)${mapping ? ` — ${mapping.label}` : ''}`,
          step: 'location_packet_received',
          status: alarm ? 'success' : 'error',
        });
      }
      break;
    }

    case PROTOCOL.RFID: {
      const rfid = decodeRfid(frame.content);
      console.log(
        `[gt06-listener] RFID de ${remote} (imei=${session.imei ?? '?'})` +
        (rfid ? ` — cartão ${rfid.cardId} (${rfid.valid ? 'válido' : 'inválido'})` : ' — conteúdo curto demais pra decodificar')
      );
      // Sem persistência dedicada ainda (não existe hoje um registro de
      // "quem passou o cartão" no schema, distinto do doorLockCardId da
      // trava elétrica) — decodificado corretamente, mas só logado por ora.
      if (session.mode === 'homologation') {
        await insertEvent(session, {
          packetType: 'RFID_CARD (0x17)',
          step: 'location_packet_received',
          status: rfid ? 'success' : 'error',
        });
      }
      break;
    }

    default:
      console.log(
        `[gt06-listener] pacote não tratado de ${remote}: protocolo 0x${frame.protocol.toString(16)}, ` +
        `${frame.content.length} bytes de conteúdo — raw=${frame.raw.toString('hex')}`
      );
  }
}

async function applyLocationToAsset(
  target: AssetTarget,
  loc: NonNullable<ReturnType<typeof decodeLocation>>,
  ignition?: boolean
) {
  const result = await gt06Repo.applyPosition(target, {
    latitude: loc.latitude,
    longitude: loc.longitude,
    speedKmh: loc.speedKmh,
    course: loc.course,
    occurredAt: loc.timestamp,
    satellites: loc.satellites,
    ignition,
  });

  if (result.geofenceEvent) {
    const event = result.geofenceEvent;
    await gt06Repo.createAlert(target, {
      type: event.type === 'exit' ? 'geofence_exit' : 'geofence_entry',
      title: event.type === 'exit' ? 'Saída de cerca virtual' : 'Retorno à cerca virtual',
      message: `${target.assetName} (${target.assetCode}) ${event.type === 'exit' ? 'saiu de' : 'retornou a'} "${event.geofenceName}" — posição real via rastreador GT06.`,
      severity: event.type === 'exit' ? 'critical' : 'info',
      latitude: loc.latitude,
      longitude: loc.longitude,
    });
  }

  return result;
}

const server = net.createServer((socket) => {
  const remote = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[gt06-listener] nova conexão: ${remote}`);

  const session: Session = { mode: 'unknown', loginOk: false, locationOk: false, heartbeatOk: false, buffer: Buffer.alloc(0) };

  socket.on('data', (chunk) => {
    session.buffer = Buffer.concat([session.buffer, chunk]);
    const { frames, rest } = parseFrames(session.buffer);
    session.buffer = rest;

    for (const frame of frames) {
      handleFrame(frame, session, socket, remote).catch((err) => {
        console.error(`[gt06-listener] erro processando frame de ${remote}:`, err);
      });
    }
  });

  socket.on('close', () => {
    console.log(
      `[gt06-listener] conexão encerrada: ${remote} ` +
      `(imei=${session.imei ?? '?'}, login=${session.loginOk}, location=${session.locationOk}, heartbeat=${session.heartbeatOk})`
    );
  });

  socket.on('error', (err) => {
    console.error(`[gt06-listener] erro de socket em ${remote}:`, err.message);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[gt06-listener] escutando em ${HOST}:${PORT} (protocolo GT06/TCP).`);
  console.log('[gt06-listener] aponte o dispositivo de teste para o IP desta máquina nessa porta.');
});

process.on('SIGINT', async () => {
  console.log('\n[gt06-listener] encerrando...');
  server.close();
  await db.end();
  await gt06Repo.disconnect();
  process.exit(0);
});
