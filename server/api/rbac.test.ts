// Teste de integração real da rodada "RBAC + SECURITY HARDENING" (ver
// RBAC-SECURITY-GATE.md). Sobe a API de verdade (Express + restRouter +
// authRouter) numa porta efêmera e bate nela com fetch, contra o mesmo
// Postgres de dev de DATABASE_URL — não é unit test com mock, é o mesmo
// caminho que um cliente HTTP real percorre (login real, JWT real,
// tenantScopeClause real, RLS real via withTenantContext).
//
// Cria 2 tenants + 1 usuário por papel (RBACTEST-*), roda os ataques, e
// apaga tudo no afterAll — mesmo padrão usado nas rodadas anteriores pra
// teste manual ao vivo (ver TENANT-MANAGER-REPORT.md), só que automatizado.
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import bcrypt from 'bcryptjs';
import { pool } from './db';
import { authRouter } from './routes-auth';
import { restRouter } from './rest';
import { providersRouter } from './routes-providers';

const PASSWORD = 'RbacAudit!2026-Test';
let server: Server;
let baseUrl: string;

const ids: Record<string, string> = {};
const tokens: Record<string, string> = {};

async function api(token: string | null, method: string, path: string, body?: unknown) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* 204 etc */
  }
  return { status: res.status, body: json as any };
}

async function cleanup() {
  await pool.query(`delete from assets where code like 'RBACTEST-%'`);
  await pool.query(`delete from user_profiles where email like 'rbactest-%@example.com'`);
  await pool.query(`delete from company_units where name like 'RBACTEST Unit%'`);
  await pool.query(`delete from company_clients where code like 'RBACTEST-%'`);
}

async function makeUser(role: string, clientId: string | null, unitId: string | null, label: string) {
  const email = `rbactest-${label}@example.com`;
  const passwordHash = await bcrypt.hash(PASSWORD, 4); // custo baixo — só teste, roda rápido
  const r = await pool.query(
    `insert into user_profiles (name, email, role, client_id, unit_id, password_hash, is_active)
     values ($1,$2,$3,$4,$5,$6,true) returning id`,
    [`RBAC Test ${label}`, email, role, clientId, unitId, passwordHash]
  );
  return { id: r.rows[0].id as string, email, role };
}

async function login(email: string) {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(body)}`);
  return body.token as string;
}

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/auth', authRouter);
  app.use('/rest', restRouter);
  app.use('/providers', providersRouter);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;

  await cleanup();

  const tA = await pool.query(
    `insert into company_clients (name, code, cnpj, status, enabled_modules) values ('RBACTEST Tenant A','RBACTEST-A','11.111.111/0001-11','active','["assets","carts"]') returning id`
  );
  const tB = await pool.query(
    `insert into company_clients (name, code, cnpj, status, enabled_modules) values ('RBACTEST Tenant B','RBACTEST-B','22.222.222/0001-22','active','["assets"]') returning id`
  );
  ids.tenantA = tA.rows[0].id;
  ids.tenantB = tB.rows[0].id;

  const uA = await pool.query(
    `insert into company_units (client_id, name, city, state, address, status) values ($1,'RBACTEST Unit A','SP','SP','x','active') returning id`,
    [ids.tenantA]
  );
  const uB = await pool.query(
    `insert into company_units (client_id, name, city, state, address, status) values ($1,'RBACTEST Unit B','SP','SP','x','active') returning id`,
    [ids.tenantB]
  );
  ids.unitA = uA.rows[0].id;
  ids.unitB = uB.rows[0].id;

  const tenantAdminA = await makeUser('CLIENT_ADMIN', ids.tenantA, null, 'tenantadmin-a');
  const managerA = await makeUser('FLEET_MANAGER', ids.tenantA, null, 'manager-a');
  const operatorA = await makeUser('OPERATOR', ids.tenantA, ids.unitA, 'operator-a');
  const viewerA = await makeUser('VIEWER', ids.tenantA, null, 'viewer-a');
  const tenantAdminB = await makeUser('CLIENT_ADMIN', ids.tenantB, null, 'tenantadmin-b');
  ids.tenantAdminAId = tenantAdminA.id;
  ids.managerAId = managerA.id;
  ids.operatorAId = operatorA.id;
  ids.viewerAId = viewerA.id;
  ids.tenantAdminBId = tenantAdminB.id;

  for (const u of [tenantAdminA, managerA, operatorA, viewerA, tenantAdminB]) {
    tokens[u.role + (u.email.includes('-a@') ? 'A' : 'B')] = await login(u.email);
  }

  const assetA = await pool.query(
    `insert into assets (name, code, imei, category, client_id, unit_id, status, protocol, unit_name)
     values ('RBACTEST Asset A','RBACTEST-ASSET-A','000000000000001','asset',$1,$2,'available','GT06','un') returning id`,
    [ids.tenantA, ids.unitA]
  );
  const assetB = await pool.query(
    `insert into assets (name, code, imei, category, client_id, unit_id, status, protocol, unit_name)
     values ('RBACTEST Asset B','RBACTEST-ASSET-B','000000000000002','asset',$1,$2,'available','GT06','un') returning id`,
    [ids.tenantB, ids.unitB]
  );
  ids.assetA = assetA.rows[0].id;
  ids.assetB = assetB.rows[0].id;
}, 30_000);

afterAll(async () => {
  await cleanup();
  await new Promise((resolve) => server.close(resolve));
});

describe('RBAC — tenant isolation (testes ofensivos #1/#3/#4/#6/#9/#10)', () => {
  it('VIEWER (tenant A) não lê asset de tenant B por id', async () => {
    const r = await api(tokens.VIEWERA, 'GET', `/rest/assets?eq_id=${ids.assetB}`);
    expect(r.status).toBe(200);
    expect(r.body).toEqual([]);
  });

  it('MANAGER (A) não consegue PATCH em asset de tenant B via eq_id na query — nenhuma linha afetada', async () => {
    const r = await api(tokens.FLEET_MANAGERA, 'PATCH', `/rest/assets?eq_id=${ids.assetB}`, { name: 'HACKED' });
    expect(r.status).toBe(200);
    expect(r.body).toEqual([]);
    const check = await pool.query('select name from assets where id = $1', [ids.assetB]);
    expect(check.rows[0].name).toBe('RBACTEST Asset B');
  });

  it('TENANT_ADMIN (A) não consegue DELETE asset de tenant B', async () => {
    await api(tokens.CLIENT_ADMINA, 'DELETE', `/rest/assets?eq_id=${ids.assetB}`);
    const check = await pool.query('select 1 from assets where id = $1', [ids.assetB]);
    expect(check.rowCount).toBe(1);
  });

  it('VIEWER (A) consultando provider_devices/asset_route_points de asset de tenant B devolve vazio, não erro', async () => {
    const r1 = await api(tokens.VIEWERA, 'GET', `/rest/provider_devices?eq_asset_id=${ids.assetB}`);
    expect(r1.status).toBe(200);
    expect(r1.body).toEqual([]);
    const r2 = await api(tokens.OPERATORA, 'GET', `/rest/asset_route_points?eq_asset_id=${ids.assetB}`);
    expect(r2.status).toBe(200);
    expect(r2.body).toEqual([]);
  });

  it('sem token nenhum: 401', async () => {
    const r = await api(null, 'GET', '/rest/assets');
    expect(r.status).toBe(401);
  });
});

describe('RBAC — tentativas de alterar tenant_id/provider_id em requests (#2/#3/#8)', () => {
  it('OPERATOR (A) não consegue INSERT com client_id de outro tenant', async () => {
    const r = await api(tokens.OPERATORA, 'POST', '/rest/assets', {
      name: 'Injected',
      code: 'RBACTEST-INJECT',
      imei: '000000000000009',
      category: 'asset',
      client_id: ids.tenantB,
      status: 'available',
      protocol: 'GT06',
      unit_name: 'x',
    });
    expect(r.status).toBe(403);
  });

  it('TENANT_ADMIN (A) não consegue PATCH client_id do próprio asset pra outro tenant', async () => {
    const r = await api(tokens.CLIENT_ADMINA, 'PATCH', `/rest/assets?eq_id=${ids.assetA}`, { client_id: ids.tenantB });
    expect(r.status).toBe(403);
    const check = await pool.query('select client_id from assets where id = $1', [ids.assetA]);
    expect(check.rows[0].client_id).toBe(ids.tenantA);
  });

  it('TENANT_ADMIN não consegue trocar defaultProviderId (admin-only), mesmo no próprio tenant', async () => {
    const r = await api(tokens.CLIENT_ADMINA, 'PATCH', `/rest/company_clients?eq_id=${ids.tenantA}`, {
      defaultProviderId: 'jason',
    });
    expect(r.status).toBe(403);
  });
});

describe('RBAC — endpoints administrativos (#7)', () => {
  it('VIEWER não lê tabela admin-only (system_integrations)', async () => {
    const r = await api(tokens.VIEWERA, 'GET', '/rest/system_integrations');
    expect(r.status).toBe(403);
  });

  it('TENANT_ADMIN não cria novo tenant', async () => {
    const r = await api(tokens.CLIENT_ADMINA, 'POST', '/rest/company_clients', {
      name: 'x',
      code: 'RBACTEST-HACK',
      cnpj: '0',
      status: 'active',
    });
    expect(r.status).toBe(403);
  });

  it('OPERATOR não ativa dispositivo de provider', async () => {
    const r = await api(tokens.OPERATORA, 'POST', '/providers/brgps/activate', { externalIds: ['X'] });
    expect(r.status).toBe(403);
  });
});

describe('RBAC — privilege escalation (#12)', () => {
  it('TENANT_ADMIN não consegue promover usuário do próprio tenant a ATHOS_ADMIN', async () => {
    const r = await api(tokens.CLIENT_ADMINA, 'PATCH', `/rest/user_profiles?eq_id=${ids.operatorAId}`, {
      role: 'ATHOS_ADMIN',
    });
    expect(r.status).toBe(403);
  });

  it('OPERATOR não consegue se auto-promover a CLIENT_ADMIN', async () => {
    const r = await api(tokens.OPERATORA, 'PATCH', `/rest/user_profiles?eq_id=${ids.operatorAId}`, {
      role: 'CLIENT_ADMIN',
    });
    expect(r.status).toBe(403);
  });

  it('TENANT_ADMIN não consegue mover usuário do próprio tenant pra outro tenant', async () => {
    const r = await api(tokens.CLIENT_ADMINA, 'PATCH', `/rest/user_profiles?eq_id=${ids.operatorAId}`, {
      client_id: ids.tenantB,
    });
    expect(r.status).toBe(403);
  });
});

describe('RBAC granular — papéis (novidade desta rodada)', () => {
  it('VIEWER não consegue criar (POST)', async () => {
    const r = await api(tokens.VIEWERA, 'POST', '/rest/assets', {
      name: 'x',
      code: 'RBACTEST-VWR',
      imei: '9',
      category: 'asset',
      status: 'available',
      protocol: 'GT06',
      unit_name: 'x',
    });
    expect(r.status).toBe(403);
  });

  it('VIEWER não consegue editar (PATCH) nem dado do próprio tenant', async () => {
    const r = await api(tokens.VIEWERA, 'PATCH', `/rest/assets?eq_id=${ids.assetA}`, { name: 'x' });
    expect(r.status).toBe(403);
  });

  it('OPERATOR não consegue apagar (DELETE) nem dado do próprio tenant', async () => {
    const r = await api(tokens.OPERATORA, 'DELETE', `/rest/assets?eq_id=${ids.assetA}`);
    expect(r.status).toBe(403);
    const check = await pool.query('select 1 from assets where id = $1', [ids.assetA]);
    expect(check.rowCount).toBe(1);
  });

  it('MANAGER consegue apagar dado operacional do próprio tenant', async () => {
    const r = await api(tokens.FLEET_MANAGERA, 'DELETE', `/rest/assets?eq_id=${ids.assetA}`);
    expect(r.status).toBe(204);
  });

  it('TENANT_ADMIN consegue desativar usuário do próprio tenant (capacidade nova)', async () => {
    const r = await api(tokens.CLIENT_ADMINA, 'PATCH', `/rest/user_profiles?eq_id=${ids.viewerAId}`, {
      is_active: false,
    });
    expect(r.status).toBe(200);
    expect(r.body[0].is_active).toBe(false);
    await pool.query('update user_profiles set is_active = true where id = $1', [ids.viewerAId]);
  });

  it('TENANT_ADMIN (A) não consegue desativar usuário de outro tenant (B)', async () => {
    const r = await api(tokens.CLIENT_ADMINA, 'PATCH', `/rest/user_profiles?eq_id=${ids.tenantAdminBId}`, {
      is_active: false,
    });
    expect(r.status).toBe(200);
    expect(r.body).toEqual([]);
  });
});

describe('Robustez de erro (#5 e vazamento de schema)', () => {
  it('SQL injection via nome de tabela na URL é rejeitado (404, allowlist)', async () => {
    const r = await api(tokens.CLIENT_ADMINA, 'GET', `/rest/assets'; DROP TABLE assets;--`);
    expect(r.status).toBe(404);
  });

  it('erro do driver pg não vaza detalhe de schema pro cliente', async () => {
    const r = await api(tokens.CLIENT_ADMINA, 'GET', `/rest/assets?order=id;drop table assets;--`);
    expect(r.status).toBe(500);
    expect(JSON.stringify(r.body)).not.toMatch(/relation|syntax error|pg_|column .* does not exist/i);
    expect(r.body).toEqual({ error: 'Internal error' });
  });
});
