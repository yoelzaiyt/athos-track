// Teste de integração real das chaves de API (card #8), no mesmo padrão do
// rbac.test.ts: sobe a API numa porta efêmera e bate com fetch contra o
// Postgres de DATABASE_URL (banco DESCARTÁVEL — grupo `db` do vitest).
//
// Cobre: quem pode gerenciar chaves, isolamento entre empresas em /api-keys e
// em /v1/assets, chave inválida/revogada e registro de último uso.
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import { createServer, type Server } from 'node:http';
import bcrypt from 'bcryptjs';
import { pool } from './db';
import { authRouter } from './routes-auth';
import { apiKeysRouter } from './apiKeys';
import { v1Router } from './routes-v1';

const PASSWORD = 'ApiKeyAudit!2026-Test';
let server: Server;
let baseUrl: string;
const ids: Record<string, string> = {};
const tokens: Record<string, string> = {};
let keyA = '';
let keyAId = '';

async function call(method: string, path: string, opts: { token?: string; apiKey?: string; body?: unknown } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.apiKey ? { 'X-API-Key': opts.apiKey } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* 204 */
  }
  return { status: res.status, body: json };
}

async function cleanup() {
  await pool.query(`delete from assets where code like 'APIKEYTEST-%'`);
  await pool.query(`delete from user_profiles where email like 'apikeytest-%@example.com'`);
  await pool.query(`delete from company_units where name like 'APIKEYTEST Unit%'`);
  // on delete cascade em api_keys.client_id leva as chaves junto.
  await pool.query(`delete from company_clients where code like 'APIKEYTEST-%'`);
}

async function makeUser(role: string, clientId: string, label: string) {
  const email = `apikeytest-${label}@example.com`;
  await pool.query(
    `insert into user_profiles (name, email, role, client_id, password_hash, is_active) values ($1,$2,$3,$4,$5,true)`,
    [`API Key Test ${label}`, email, role, clientId, await bcrypt.hash(PASSWORD, 4)]
  );
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(body)}`);
  tokens[label] = body.token;
}

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/auth', authRouter);
  app.use('/api-keys', apiKeysRouter);
  app.use('/v1', v1Router);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;

  await cleanup();

  for (const [label, cnpj] of [['A', '33.333.333/0001-33'], ['B', '44.444.444/0001-44']] as const) {
    const t = await pool.query(
      `insert into company_clients (name, code, cnpj, status, enabled_modules) values ($1,$2,$3,'active','["assets"]') returning id`,
      [`APIKEYTEST Tenant ${label}`, `APIKEYTEST-${label}`, cnpj]
    );
    ids[`tenant${label}`] = t.rows[0].id;
    const u = await pool.query(
      `insert into company_units (client_id, name, city, state, address, status) values ($1,$2,'SP','SP','x','active') returning id`,
      [t.rows[0].id, `APIKEYTEST Unit ${label}`]
    );
    const a = await pool.query(
      `insert into assets (name, code, imei, category, client_id, unit_id, status, protocol, unit_name)
       values ($1,$2,$3,'asset',$4,$5,'available','GT06','un') returning id`,
      [`APIKEYTEST Asset ${label}`, `APIKEYTEST-ASSET-${label}`, `9900000000000${label === 'A' ? '01' : '02'}`, t.rows[0].id, u.rows[0].id]
    );
    ids[`asset${label}`] = a.rows[0].id;
  }

  await makeUser('CLIENT_ADMIN', ids.tenantA, 'admin-a');
  await makeUser('VIEWER', ids.tenantA, 'viewer-a');
  await makeUser('CLIENT_ADMIN', ids.tenantB, 'admin-b');
}, 30_000);

afterAll(async () => {
  await cleanup();
  await new Promise((resolve) => server.close(resolve));
});

describe('gestão de chaves de API', () => {
  it('VIEWER não lista nem gera chaves', async () => {
    expect((await call('GET', '/api-keys', { token: tokens['viewer-a'] })).status).toBe(403);
    expect((await call('POST', '/api-keys', { token: tokens['viewer-a'], body: { name: 'x' } })).status).toBe(403);
  });

  it('CLIENT_ADMIN gera chave presa à própria empresa, mesmo mandando clientId de outra', async () => {
    const r = await call('POST', '/api-keys', {
      token: tokens['admin-a'],
      body: { name: 'ERP Tenant A', clientId: ids.tenantB },
    });
    expect(r.status).toBe(201);
    expect(r.body.apiKey).toMatch(/^athos_live_/);
    expect(r.body.client_id).toBe(ids.tenantA);
    expect(r.body.key_hash).toBeUndefined();
    keyA = r.body.apiKey;
    keyAId = r.body.id;
  });

  it('CLIENT_ADMIN de outra empresa não vê nem revoga a chave', async () => {
    const list = await call('GET', '/api-keys', { token: tokens['admin-b'] });
    expect(list.status).toBe(200);
    expect(list.body.map((k: { id: string }) => k.id)).not.toContain(keyAId);

    expect((await call('DELETE', `/api-keys/${keyAId}`, { token: tokens['admin-b'] })).status).toBe(404);
  });
});

describe('GET /v1/assets por chave de API', () => {
  it('recusa requisição sem chave ou com chave inválida', async () => {
    expect((await call('GET', '/v1/assets')).status).toBe(401);
    expect((await call('GET', '/v1/assets', { apiKey: `${keyA.slice(0, 18)}chave-errada` })).status).toBe(401);
  });

  it('devolve só os ativos da empresa dona da chave e registra o último uso', async () => {
    const r = await call('GET', '/v1/assets', { apiKey: keyA });
    expect(r.status).toBe(200);
    const assetIds = r.body.data.map((a: { id: string }) => a.id);
    expect(assetIds).toContain(ids.assetA);
    expect(assetIds).not.toContain(ids.assetB);

    // last_used_at é gravado sem segurar a resposta; espera o update terminar.
    await new Promise((resolve) => setTimeout(resolve, 300));
    const row = await pool.query('select last_used_at from api_keys where id = $1', [keyAId]);
    expect(row.rows[0].last_used_at).not.toBeNull();
  });

  it('chave revogada deixa de funcionar na hora', async () => {
    expect((await call('DELETE', `/api-keys/${keyAId}`, { token: tokens['admin-a'] })).status).toBe(204);
    expect((await call('GET', '/v1/assets', { apiKey: keyA })).status).toBe(401);
  });
});
