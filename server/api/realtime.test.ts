// Regressão para o bug real achado ao vivo em 2026-09-10: startRealtimeBridge
// usava DATABASE_URL (pooler PgBouncer em modo transação, porta 6543) pra
// "LISTEN table_changes" — LISTEN/NOTIFY não sobrevive a esse tipo de pool
// (a conexão física é multiplexada entre clientes a cada transação, então o
// NOTIFY nunca chega no socket que fez o LISTEN). Resultado prático: o
// frontend nunca recebia atualização de posição sem F5 manual, mesmo com o
// pipeline de ingestão funcionando 100% (trigger + NOTIFY disparavam
// certinho, só a entrega pro processo da API se perdia). Corrigido trocando
// pra DIRECT_URL (porta 5432, sem pooler) em server/api/realtime.ts.
//
// Este teste sobe a API real (Express + Socket.io + startRealtimeBridge),
// conecta um cliente Socket.io real (mesmo caminho do frontend via
// src/lib/supabaseClient.ts), dispara um UPDATE real em assets, e verifica
// que o cliente recebe o evento — prova que o LISTEN está numa conexão que
// realmente recebe NOTIFY, não só que o código "parece" certo.
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import bcrypt from 'bcryptjs';
import { pool } from './db';
import { authRouter } from './routes-auth';
import { restRouter } from './rest';
import { startRealtimeBridge } from './realtime';

const PASSWORD = 'RealtimeE2E!2026';
let server: Server;
let baseUrl: string;
let zaffariClientId: string;
let saoJoaoClientId: string;

async function loginSocket(email: string): Promise<ClientSocket> {
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const loginBody = await loginRes.json();
  if (!loginRes.ok) throw new Error(`login failed for ${email}: ${JSON.stringify(loginBody)}`);
  const socket: ClientSocket = ioClient(baseUrl, { transports: ['websocket'], auth: { token: loginBody.token } });
  await new Promise<void>((resolve, reject) => {
    socket.on('connect', () => resolve());
    socket.on('connect_error', (err) => reject(err));
  });
  return socket;
}

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/auth', authRouter);
  app.use('/rest', restRouter);
  server = createServer(app);
  const io = new SocketIOServer(server, { cors: { origin: '*' } });
  await startRealtimeBridge(io);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as any).port}`;

  zaffariClientId = (await pool.query(`select id from company_clients where code='ZAFFARI'`)).rows[0].id;
  saoJoaoClientId = (await pool.query(`select id from company_clients where code='SAO-JOAO'`)).rows[0].id;
  const passwordHash = await bcrypt.hash(PASSWORD, 4);
  await pool.query(
    `insert into user_profiles (name, email, role, client_id, unit_id, password_hash, is_active)
     values ('REALTIMEE2E Zaffari','realtimee2e-zaffari@example.com','VIEWER',$1,null,$2,true)
     on conflict (email) do update set password_hash=excluded.password_hash, is_active=true`,
    [zaffariClientId, passwordHash]
  );
  await pool.query(
    `insert into user_profiles (name, email, role, client_id, unit_id, password_hash, is_active)
     values ('REALTIMEE2E SaoJoao','realtimee2e-saojoao@example.com','VIEWER',$1,null,$2,true)
     on conflict (email) do update set password_hash=excluded.password_hash, is_active=true`,
    [saoJoaoClientId, passwordHash]
  );
});

afterAll(async () => {
  await pool.query(
    `delete from user_profiles where email in ('realtimee2e-zaffari@example.com','realtimee2e-saojoao@example.com')`
  );
  server.close();
});

describe('Realtime bridge (LISTEN/NOTIFY -> Socket.io) — regressão do bug de pooler', () => {
  it('um UPDATE real em assets chega no cliente Socket.io conectado (sem F5)', async () => {
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'realtimee2e-zaffari@example.com', password: PASSWORD }),
    });
    const loginBody = await loginRes.json();
    expect(loginRes.ok).toBe(true);
    const token = loginBody.token as string;

    const socket: ClientSocket = ioClient(baseUrl, { transports: ['websocket'], auth: { token } });

    const gotEvent = new Promise<{ table: string; eventType: string }>((resolve) => {
      socket.on('postgres_changes:assets', (payload) => resolve(payload));
    });

    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => resolve());
      socket.on('connect_error', (err) => reject(err));
    });

    await pool.query(`update assets set updated_at = now() where imei = '3092524960'`);

    const payload = await Promise.race([
      gotEvent,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);

    socket.disconnect();

    expect(payload, 'nenhum evento chegou no cliente em 5s — LISTEN/NOTIFY quebrado de novo?').not.toBeNull();
    expect(payload?.table).toBe('assets');
    expect(payload?.eventType).toBe('UPDATE');
  }, 10000);
});

describe('Realtime bridge — isolamento de tenant no Socket.io (seção 20/21 do brief de navegação)', () => {
  it('usuário SÃO JOÃO nunca recebe evento de asset do ZAFFARI', async () => {
    const zaffariSocket = await loginSocket('realtimee2e-zaffari@example.com');
    const saoJoaoSocket = await loginSocket('realtimee2e-saojoao@example.com');

    let saoJoaoReceived = false;
    let zaffariReceived: { table: string; eventType: string } | null = null;
    saoJoaoSocket.on('postgres_changes:assets', () => {
      saoJoaoReceived = true;
    });
    const zaffariGotEvent = new Promise<void>((resolve) => {
      zaffariSocket.on('postgres_changes:assets', (payload) => {
        zaffariReceived = payload;
        resolve();
      });
    });

    // ZAF-CART-01 é um asset ZAFFARI real — o evento deve ir só pra room
    // client:<zaffariClientId>, nunca pra client:<saoJoaoClientId>.
    await pool.query(`update assets set updated_at = now() where imei = '3092524960'`);

    await Promise.race([zaffariGotEvent, new Promise((resolve) => setTimeout(resolve, 4000))]);
    // Janela extra só pra dar tempo de um vazamento indevido chegar no socket errado.
    await new Promise((resolve) => setTimeout(resolve, 1500));

    zaffariSocket.disconnect();
    saoJoaoSocket.disconnect();

    expect(zaffariReceived, 'usuário Zaffari deveria ter recebido o evento do próprio tenant').not.toBeNull();
    expect(saoJoaoReceived, 'VAZAMENTO: usuário São João recebeu evento de asset do Zaffari').toBe(false);
  }, 10000);

  it('usuário ZAFFARI nunca recebe evento de asset do SÃO JOÃO', async () => {
    const zaffariSocket = await loginSocket('realtimee2e-zaffari@example.com');
    const saoJoaoSocket = await loginSocket('realtimee2e-saojoao@example.com');

    let zaffariReceived = false;
    let saoJoaoReceived: { table: string; eventType: string } | null = null;
    zaffariSocket.on('postgres_changes:assets', () => {
      zaffariReceived = true;
    });
    const saoJoaoGotEvent = new Promise<void>((resolve) => {
      saoJoaoSocket.on('postgres_changes:assets', (payload) => {
        saoJoaoReceived = payload;
        resolve();
      });
    });

    // CAR-03 (3092524777) é um asset SÃO JOÃO real.
    await pool.query(`update assets set updated_at = now() where imei = '3092524777'`);

    await Promise.race([saoJoaoGotEvent, new Promise((resolve) => setTimeout(resolve, 4000))]);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    zaffariSocket.disconnect();
    saoJoaoSocket.disconnect();

    expect(saoJoaoReceived, 'usuário São João deveria ter recebido o evento do próprio tenant').not.toBeNull();
    expect(zaffariReceived, 'VAZAMENTO: usuário Zaffari recebeu evento de asset do São João').toBe(false);
  }, 10000);
});
