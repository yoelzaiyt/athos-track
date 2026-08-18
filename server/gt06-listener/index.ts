// Listener TCP real do protocolo GT06 — recebe conexões de rastreadores
// físicos, decodifica login/localização/heartbeat e grava eventos de
// homologação no Supabase. Substitui, para testes com hardware real, o
// GT06DemoAdapter (src/homologation/adapters/gt06DemoAdapter.ts), que só
// simula a sequência com timers.
//
// Uso: npx tsx server/gt06-listener/index.ts
// (ou: npm run gt06:listen)
//
// Configuração (via .env, raiz do projeto):
//   GT06_LISTENER_PORT   porta TCP a escutar (padrão 5023)
//   GT06_LISTENER_HOST   interface a escutar (padrão 0.0.0.0, todas)
//   DIRECT_URL           string de conexão Postgres (já usada pelas migrations)
//
// Pré-requisito pro evento ficar registrado: o IMEI do dispositivo real
// precisa já existir em homologation_requests.test_imei — ou seja, alguém
// preencheu o formulário público (/homologacao) com esse IMEI antes de ligar
// o rastreador. Sem isso o listener ainda decodifica e loga tudo no console
// (então dá pra confirmar a conexão), só não persiste no banco (não há
// request_id pra satisfazer a FK).
//
// Por que Postgres direto (DIRECT_URL) em vez da anon key do Supabase: as
// tabelas de homologação dão à role anon permissão só de INSERT, sem SELECT
// (ver supabase/migrations/20260814160000_add_homologation_tables.sql) — de
// propósito, pra um fornecedor nunca ler dados de outra solicitação pelo
// banco. Esse listener precisa localizar a solicitação pelo IMEI (SELECT),
// então atua como gateway confiável (mesmo padrão de scripts/seed-supabase.ts),
// não como cliente anônimo. Não expor este processo direto à internet sem
// revisitar essa decisão.

import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';
import {
  parseFrames,
  buildAck,
  decodeBcdImei,
  decodeLocation,
  decodeHeartbeat,
  decodeAlarm,
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
console.log('[gt06-listener] conectado ao Postgres.');

interface Session {
  imei?: string;
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
      console.log(`[gt06-listener] LOGIN de ${remote} — IMEI ${imei}`);

      socket.write(buildAck(frame.protocol, frame.serial));
      session.loginOk = true;

      const request = await findRequestByImei(imei);
      if (!request) {
        console.warn(
          `[gt06-listener] IMEI ${imei} não corresponde a nenhuma solicitação de homologação ` +
          `(homologation_requests.test_imei) — conexão confirmada, mas nada será gravado no banco. ` +
          `Cadastre esse IMEI em /homologacao primeiro se quiser rastrear o histórico.`
        );
        return;
      }

      session.requestId = request.id;
      session.sessionToken = request.session_token;
      session.deviceId = await insertDevice(session);
      await insertEvent(session, { packetType: 'LOGIN_PACKET (0x01)', step: 'imei_identified', status: 'success' });
      console.log(`[gt06-listener] IMEI ${imei} vinculado à solicitação ${request.id} — evento gravado.`);
      break;
    }

    case PROTOCOL.HEARTBEAT: {
      const hb = decodeHeartbeat(frame.content);
      console.log(
        `[gt06-listener] HEARTBEAT de ${remote} (imei=${session.imei ?? '?'})` +
        (hb ? ` — bateria=${hb.voltageLevel} sinal=${hb.gsmSignal}` : ' — conteúdo curto demais pra decodificar')
      );
      socket.write(buildAck(frame.protocol, frame.serial));
      session.heartbeatOk = true;
      await insertEvent(session, {
        packetType: `HEARTBEAT (0x${frame.protocol.toString(16)})`,
        step: 'heartbeat_received',
        status: 'success',
      });
      break;
    }

    case PROTOCOL.LOCATION:
    case PROTOCOL.LOCATION_V3:
    case PROTOCOL.LOCATION_4G:
    case PROTOCOL.LOCATION_V4: {
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
      await insertEvent(session, {
        packetType: `GPS_LOCATION (0x${frame.protocol.toString(16)})`,
        step: 'location_packet_received',
        status: loc ? 'success' : 'error',
      });
      break;
    }

    case PROTOCOL.ALARM: {
      const alarm = decodeAlarm(frame.content);
      if (alarm) {
        console.log(
          `[gt06-listener] ALARME de ${remote} (imei=${session.imei ?? '?'}) — ${alarm.alarmName} ` +
          `lat=${alarm.latitude.toFixed(6)} lon=${alarm.longitude.toFixed(6)} bateria=${alarm.voltageLevel} sinal=${alarm.gsmSignal}`
        );
      } else {
        console.warn(`[gt06-listener] pacote de alarme de ${remote} curto demais pra decodificar. raw=${frame.content.toString('hex')}`);
      }
      socket.write(buildAck(frame.protocol, frame.serial));
      await insertEvent(session, {
        packetType: `ALARM (0x16)${alarm ? ` ${alarm.alarmName}` : ''}`,
        step: 'location_packet_received',
        status: alarm ? 'success' : 'error',
      });
      break;
    }

    default:
      console.log(
        `[gt06-listener] pacote não tratado de ${remote}: protocolo 0x${frame.protocol.toString(16)}, ` +
        `${frame.content.length} bytes de conteúdo — raw=${frame.raw.toString('hex')}`
      );
  }
}

const server = net.createServer((socket) => {
  const remote = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[gt06-listener] nova conexão: ${remote}`);

  const session: Session = { loginOk: false, locationOk: false, heartbeatOk: false, buffer: Buffer.alloc(0) };

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
  process.exit(0);
});
