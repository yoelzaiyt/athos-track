// Teste de integração real (mesmo padrão de rbac.test.ts: API Express real
// numa porta efêmera, Postgres real de DATABASE_URL, sem mock) que trava
// permanentemente a classificação correta das 12 tags reais ZAFFARI/SÃO
// JOÃO — pedido explícito da sessão "VALIDAÇÃO REAL DAS 12 TAGS" (2026-09-10),
// depois de descobrir que as 2 tags do São João estavam cadastradas como
// 'cart' (herdado do teste de homologação original), fazendo CartsModule.tsx
// mostrar 12 carrinhos e BoxesModule.tsx mostrar 0 caixas.
//
// Diferente de rbac.test.ts (tenants sintéticos RBACTEST-*, descartáveis),
// este teste depende dos tenants REAIS ZAFFARI/SAO-JOAO existirem com
// exatamente 10 e 2 assets respectivamente — se algum dia esse número mudar
// de propósito (nova tag cadastrada, tag desativada), ajuste as constantes
// abaixo junto com a mudança real, não o contrário.
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import bcrypt from 'bcryptjs';
import { pool } from './db';
import { authRouter } from './routes-auth';
import { restRouter } from './rest';

const PASSWORD = 'TagClassTest!2026';
let server: Server;
let baseUrl: string;
const tokens: Record<'zaffari' | 'saoJoao', string> = {} as never;
let zaffariClientId: string;
let saoJoaoClientId: string;

async function api(token: string | null, method: string, path: string) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* noop */
  }
  return { status: res.status, body: json as any };
}

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/auth', authRouter);
  app.use('/rest', restRouter);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as any).port}`;

  zaffariClientId = (await pool.query(`select id from company_clients where code='ZAFFARI'`)).rows[0].id;
  saoJoaoClientId = (await pool.query(`select id from company_clients where code='SAO-JOAO'`)).rows[0].id;

  const passwordHash = await bcrypt.hash(PASSWORD, 4);
  await pool.query(
    `insert into user_profiles (name, email, role, client_id, unit_id, password_hash, is_active)
     values ('TAGCLASS Zaffari Viewer','tagclass-zaffari@example.com','VIEWER',$1,null,$2,true)
     on conflict (email) do nothing`,
    [zaffariClientId, passwordHash]
  );
  await pool.query(
    `insert into user_profiles (name, email, role, client_id, unit_id, password_hash, is_active)
     values ('TAGCLASS SaoJoao Viewer','tagclass-saojoao@example.com','VIEWER',$1,null,$2,true)
     on conflict (email) do nothing`,
    [saoJoaoClientId, passwordHash]
  );

  async function login(email: string) {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`login failed ${email}: ${res.status} ${JSON.stringify(body)}`);
    return body.token as string;
  }
  tokens.zaffari = await login('tagclass-zaffari@example.com');
  tokens.saoJoao = await login('tagclass-saojoao@example.com');
});

afterAll(async () => {
  await pool.query(`delete from user_profiles where email in ('tagclass-zaffari@example.com','tagclass-saojoao@example.com')`);
  server.close();
});

async function countByCategory(clientId: string, category: 'cart' | 'box') {
  const r = await pool.query(`select count(*)::int as n from assets where client_id = $1 and category = $2`, [clientId, category]);
  return r.rows[0].n as number;
}

describe('Classificação de tags — ZAFFARI (carrinhos) vs SÃO JOÃO (caixas)', () => {
  it('ZAFFARI: 10 carrinhos, 0 caixas', async () => {
    expect(await countByCategory(zaffariClientId, 'cart')).toBe(10);
    expect(await countByCategory(zaffariClientId, 'box')).toBe(0);
  });

  it('SÃO JOÃO: 0 carrinhos, 2 caixas', async () => {
    expect(await countByCategory(saoJoaoClientId, 'cart')).toBe(0);
    expect(await countByCategory(saoJoaoClientId, 'box')).toBe(2);
  });

  it('CENTRAL: 10 carrinhos + 2 caixas = 12 no total, entre os dois tenants', async () => {
    const r = await pool.query(
      `select
         count(*) filter (where category = 'cart')::int as carts,
         count(*) filter (where category = 'box')::int as boxes,
         count(*)::int as total
       from assets where client_id in ($1, $2)`,
      [zaffariClientId, saoJoaoClientId]
    );
    expect(r.rows[0].carts).toBe(10);
    expect(r.rows[0].boxes).toBe(2);
    expect(r.rows[0].total).toBe(12);
  });

  it('nenhuma das 10 tags Zaffari está classificada como caixa (imeis exatos)', async () => {
    const expected = [
      '3092524960', '3092524712', '3092533124', '3092524666', '3092533106',
      '3092524840', '3092524939', '3092533107', '3092524906', '3092533120',
    ];
    const r = await pool.query(
      `select imei from assets where client_id = $1 and category = 'cart' order by imei`,
      [zaffariClientId]
    );
    expect(r.rows.map((row) => row.imei).sort()).toEqual([...expected].sort());
  });
});

describe('Isolamento de tenant — ZAFFARI x SÃO JOÃO (real, via API)', () => {
  it('usuário ZAFFARI não lista nenhum asset do SÃO JOÃO', async () => {
    const r = await api(tokens.zaffari, 'GET', '/rest/assets');
    const codes = (r.body ?? []).map((a: any) => a.code);
    expect(codes).not.toContain('CAR-01');
    expect(codes).not.toContain('CAR-03');
    expect(codes.length).toBe(10);
  });

  it('usuário SÃO JOÃO não lista nenhum asset do ZAFFARI', async () => {
    const r = await api(tokens.saoJoao, 'GET', '/rest/assets');
    const codes = (r.body ?? []).map((a: any) => a.code);
    expect(codes.some((c: string) => c.startsWith('ZAF-CART'))).toBe(false);
    expect(codes.length).toBe(2);
  });

  it('usuário ZAFFARI: leitura direta por IMEI de tag do SÃO JOÃO devolve vazio', async () => {
    const r = await api(tokens.zaffari, 'GET', '/rest/assets?eq_imei=1603000067');
    expect(r.body).toEqual([]);
  });

  it('usuário SÃO JOÃO: leitura direta por IMEI de tag do ZAFFARI devolve vazio', async () => {
    const r = await api(tokens.saoJoao, 'GET', '/rest/assets?eq_imei=3092524960');
    expect(r.body).toEqual([]);
  });
});
