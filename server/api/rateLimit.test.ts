// Unit test do rate limit por usuário/tenant (card #38). Sem banco: um
// middleware falso preenche req.auth a partir de headers, no lugar do
// requireAuth real.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApiRateLimit } from './rateLimit';

let server: Server;
let baseUrl: string;
const limiter = createApiRateLimit({ windowMs: 60_000, userLimit: 3, tenantLimit: 5 });

beforeAll(async () => {
  const app = express();
  app.use((req, _res, next) => {
    req.auth = {
      sub: String(req.headers['x-user']),
      email: 'teste@example.com',
      role: req.headers['x-tenant'] ? 'CLIENT_ADMIN' : 'ATHOS_ADMIN',
      client_id: req.headers['x-tenant'] ? String(req.headers['x-tenant']) : null,
      unit_id: null,
    };
    next();
  });
  app.use(...limiter.middleware);
  app.get('/ping', (_req, res) => res.json({ ok: true }));

  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const hit = (user: string, tenant?: string) =>
  fetch(`${baseUrl}/ping`, { headers: { 'x-user': user, ...(tenant ? { 'x-tenant': tenant } : {}) } });

describe('rate limit por usuário e por tenant', () => {
  it('bloqueia o usuário acima do limite com 429 e corpo claro', async () => {
    for (let i = 0; i < 3; i++) expect((await hit('u1', 'tenant-a')).status).toBe(200);

    const blocked = await hit('u1', 'tenant-a');
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({ scope: 'user', limit: 3 });
    expect(blocked.headers.get('ratelimit')).toBeTruthy();
  });

  it('soma usuários da mesma empresa no balde do tenant', async () => {
    // tenant-a já gastou 3 no teste anterior. A requisição barrada pelo balde
    // do usuário não chega ao do tenant, então não conta aqui.
    expect((await hit('u2', 'tenant-a')).status).toBe(200);
    expect((await hit('u3', 'tenant-a')).status).toBe(200);

    const blocked = await hit('u5', 'tenant-a');
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({ scope: 'tenant', limit: 5 });
  });

  it('não deixa um tenant consumir o orçamento de outro', async () => {
    expect((await hit('u4', 'tenant-b')).status).toBe(200);
  });

  it('admin sem client_id usa só o balde de usuário', async () => {
    for (let i = 0; i < 3; i++) expect((await hit('admin-1')).status).toBe(200);
    expect((await hit('admin-1')).status).toBe(429);
  });

  it('conta quantas vezes disparou, por escopo e por tenant', () => {
    const stats = limiter.stats();
    expect(stats.hits).toEqual({ user: 2, tenant: 1 });
    expect(stats.byTenant).toMatchObject({ 'tenant-a': 2, 'sem-tenant': 1 });
  });
});
