// Teste de integração real do fluxo de recuperação de senha (SEC-010 fase 2),
// no mesmo padrão de server/api/rbac.test.ts: sobe a API de verdade numa
// porta efêmera e bate nela com fetch, contra o Postgres de dev de
// DATABASE_URL. Nada de mock do banco — o que é testado aqui é exatamente o
// caminho que o navegador percorre.
//
// O único ponto substituído é o PROVEDOR DE E-MAIL: em vez de mandar e-mail
// de verdade, injetamos um provedor que captura a mensagem
// (setMailProviderOverride) — é assim que o teste consegue ler o link e
// provar que o token que chega ao usuário funciona, e que o banco guarda só
// o hash dele.
import 'dotenv/config';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import bcrypt from 'bcryptjs';
import { pool } from './db';
import { authRouter, clearPasswordResetThrottles } from './routes-auth';
import { setMailProviderOverride, type MailMessage, type MailProvider } from '../mail';
import { hashResetToken, validateNewPassword, buildResetLink, resolveAppPublicUrl } from './passwordReset';

const OLD_PASSWORD = 'SenhaAntiga!2026';
const NEW_PASSWORD = 'SenhaNova2026';
const APP_URL = 'https://reset-test.athos.local';

let server: Server;
let baseUrl: string;
let previousAppPublicUrl: string | undefined;

const sentMails: MailMessage[] = [];

/** Provedor de captura: implementa a mesma interface do SMTP real, só que
 *  guarda a mensagem em memória em vez de entregar. */
const captureProvider: MailProvider = {
  id: 'capture',
  from: 'ATHOS TRACK <test@athos.local>',
  async sendMail(message) {
    sentMails.push(message);
    return { messageId: `capture-${sentMails.length}` };
  },
};

/** Provedor que sempre falha — usado pra provar que o servidor NÃO responde
 *  "enviamos" quando o envio quebrou de verdade. */
const failingProvider: MailProvider = {
  id: 'failing',
  from: 'ATHOS TRACK <test@athos.local>',
  async sendMail() {
    throw new Error('SMTP connection refused (simulado)');
  },
};

async function api(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
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
  await pool.query(`delete from user_profiles where email like 'resettest-%@example.com'`);
}

async function makeUser(label: string, isActive = true) {
  const email = `resettest-${label}@example.com`;
  const passwordHash = await bcrypt.hash(OLD_PASSWORD, 4); // custo baixo: é teste, roda rápido
  const r = await pool.query(
    `insert into user_profiles (name, email, role, password_hash, is_active)
     values ($1, $2, 'CLIENT_ADMIN', $3, $4) returning id`,
    [`Reset Test ${label}`, email, passwordHash, isActive]
  );
  return { id: r.rows[0].id as string, email };
}

/** Extrai o token do link que foi pro e-mail — é exatamente o que o usuário
 *  faz ao clicar. Falha alto se o corpo não tiver o link. */
function tokenFromMail(mail: MailMessage): string {
  const match = mail.text.match(/redefinir-senha\?token=([^\s]+)/);
  if (!match) throw new Error('E-mail enviado não contém link de redefinição');
  return decodeURIComponent(match[1]);
}

beforeAll(async () => {
  previousAppPublicUrl = process.env.APP_PUBLIC_URL;
  process.env.APP_PUBLIC_URL = APP_URL;
  setMailProviderOverride(captureProvider);

  await cleanup();
  const app = express();
  app.use(express.json());
  app.use('/auth', authRouter);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Falha ao subir servidor de teste');
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  setMailProviderOverride(undefined);
  if (previousAppPublicUrl === undefined) delete process.env.APP_PUBLIC_URL;
  else process.env.APP_PUBLIC_URL = previousAppPublicUrl;
  await cleanup();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
});

beforeEach(() => {
  sentMails.length = 0;
  setMailProviderOverride(captureProvider);
  // Cada caso começa com os freios zerados: todos batem do mesmo 127.0.0.1,
  // então sem isso um caso estouraria a cota do seguinte (429) e esconderia
  // a falha real. O comportamento dos freios em si é testado no caso da cota.
  clearPasswordResetThrottles();
});

describe('política de senha e montagem do link (unidade)', () => {
  it('recusa senha curta, sem letra ou sem número, e aceita uma válida', () => {
    expect(validateNewPassword('Curta1')).toMatch(/8 caracteres/);
    expect(validateNewPassword('12345678')).toMatch(/letra/);
    expect(validateNewPassword('semnumeros')).toMatch(/número/);
    expect(validateNewPassword(null)).toMatch(/Informe a nova senha/);
    expect(validateNewPassword(NEW_PASSWORD)).toBeNull();
  });

  it('monta o link na rota pública do SPA, com o token escapado', () => {
    expect(buildResetLink('https://app.exemplo.com/', 'ab+c/d')).toBe(
      'https://app.exemplo.com/redefinir-senha?token=ab%2Bc%2Fd'
    );
  });

  it('resolve a URL pública a partir de APP_PUBLIC_URL', () => {
    expect(resolveAppPublicUrl()).toBe(APP_URL);
  });
});

describe('fluxo completo de recuperação de senha', () => {
  it('envia e-mail real, aceita o token uma única vez e troca a senha', async () => {
    const user = await makeUser('fluxo');

    // Sessão ativa ANTES da redefinição — tem que morrer no fim (SEC-008).
    const loginAntes = await api('POST', '/auth/login', { email: user.email, password: OLD_PASSWORD });
    expect(loginAntes.status).toBe(200);
    const tokenAntigoDeSessao = loginAntes.body.token as string;

    const pedido = await api('POST', '/auth/password-reset/request', { email: user.email });
    expect(pedido.status).toBe(202);
    expect(sentMails).toHaveLength(1);
    expect(sentMails[0].to).toBe(user.email);
    expect(sentMails[0].html).toContain('redefinir-senha?token=');

    const token = tokenFromMail(sentMails[0]);

    // O banco guarda só o SHA-256: procurar pelo token em claro não acha nada,
    // procurar pelo hash acha exatamente uma linha.
    const emClaro = await pool.query('select 1 from password_reset_tokens where token_hash = $1', [token]);
    expect(emClaro.rowCount).toBe(0);
    const porHash = await pool.query('select user_id, used_at from password_reset_tokens where token_hash = $1', [
      hashResetToken(token),
    ]);
    expect(porHash.rowCount).toBe(1);
    expect(porHash.rows[0].user_id).toBe(user.id);
    expect(porHash.rows[0].used_at).toBeNull();

    const validacao = await api('POST', '/auth/password-reset/validate', { token });
    expect(validacao.status).toBe(200);
    expect(validacao.body.valid).toBe(true);
    expect(validacao.body.email).toContain('@example.com');
    expect(validacao.body.email).not.toBe(user.email); // mascarado

    // Senha fraca é recusada ANTES de consumir o token.
    const fraca = await api('POST', '/auth/password-reset/confirm', { token, password: 'abc' });
    expect(fraca.status).toBe(400);
    const aindaVivo = await api('POST', '/auth/password-reset/validate', { token });
    expect(aindaVivo.status).toBe(200);

    const confirma = await api('POST', '/auth/password-reset/confirm', { token, password: NEW_PASSWORD });
    expect(confirma.status).toBe(204);

    // Senha nova entra; senha antiga não entra mais.
    const loginNovo = await api('POST', '/auth/login', { email: user.email, password: NEW_PASSWORD });
    expect(loginNovo.status).toBe(200);
    const loginVelho = await api('POST', '/auth/login', { email: user.email, password: OLD_PASSWORD });
    expect(loginVelho.status).toBe(401);

    // A sessão que existia antes foi revogada (session_version++).
    const sessaoAntiga = await api('GET', '/auth/session', undefined, tokenAntigoDeSessao);
    expect(sessaoAntiga.status).toBe(401);

    // Uso único: o mesmo link não serve de novo.
    const reuso = await api('POST', '/auth/password-reset/confirm', { token, password: 'OutraSenha2026' });
    expect(reuso.status).toBe(400);
    expect(reuso.body.reason).toBe('used');
    const revalida = await api('POST', '/auth/password-reset/validate', { token });
    expect(revalida.status).toBe(400);
    expect(revalida.body.reason).toBe('used');

    const consumido = await pool.query('select used_at, consumed_reason from password_reset_tokens where token_hash = $1', [
      hashResetToken(token),
    ]);
    expect(consumido.rows[0].used_at).not.toBeNull();
    expect(consumido.rows[0].consumed_reason).toBe('used');
  });

  it('pedir um link novo invalida o anterior', async () => {
    const user = await makeUser('supersede');

    await api('POST', '/auth/password-reset/request', { email: user.email });
    await api('POST', '/auth/password-reset/request', { email: user.email });
    expect(sentMails).toHaveLength(2);

    const primeiro = tokenFromMail(sentMails[0]);
    const segundo = tokenFromMail(sentMails[1]);

    const antigo = await api('POST', '/auth/password-reset/validate', { token: primeiro });
    expect(antigo.status).toBe(400);
    expect(antigo.body.reason).toBe('used');

    const novo = await api('POST', '/auth/password-reset/validate', { token: segundo });
    expect(novo.status).toBe(200);

    const linha = await pool.query('select consumed_reason from password_reset_tokens where token_hash = $1', [
      hashResetToken(primeiro),
    ]);
    expect(linha.rows[0].consumed_reason).toBe('superseded');
  });

  it('recusa token expirado', async () => {
    const user = await makeUser('expirado');
    await api('POST', '/auth/password-reset/request', { email: user.email });
    const token = tokenFromMail(sentMails[0]);

    // Empurra a expiração pro passado — mesma linha, sem recriar nada.
    await pool.query(`update password_reset_tokens set expires_at = now() - interval '1 minute' where token_hash = $1`, [
      hashResetToken(token),
    ]);

    const validacao = await api('POST', '/auth/password-reset/validate', { token });
    expect(validacao.status).toBe(400);
    expect(validacao.body.reason).toBe('expired');

    const confirma = await api('POST', '/auth/password-reset/confirm', { token, password: NEW_PASSWORD });
    expect(confirma.status).toBe(400);
    expect(confirma.body.reason).toBe('expired');
  });

  it('recusa token inventado e token malformado', async () => {
    const inventado = await api('POST', '/auth/password-reset/validate', { token: 'A'.repeat(43) });
    expect(inventado.status).toBe(400);
    expect(inventado.body.reason).toBe('unknown');

    const curto = await api('POST', '/auth/password-reset/validate', { token: 'abc' });
    expect(curto.status).toBe(400);
    expect(curto.body.reason).toBe('malformed');
  });

  it('não revela se a conta existe: e-mail desconhecido recebe a mesma resposta, sem envio', async () => {
    const user = await makeUser('existe');
    const existente = await api('POST', '/auth/password-reset/request', { email: user.email });
    const inexistente = await api('POST', '/auth/password-reset/request', {
      email: 'resettest-nao-existe@example.com',
    });

    expect(existente.status).toBe(inexistente.status);
    expect(existente.body.message).toBe(inexistente.body.message);
    // ...e só a conta real gerou e-mail.
    expect(sentMails).toHaveLength(1);
    expect(sentMails[0].to).toBe(user.email);
  });

  it('conta desativada não recebe link (mesma resposta genérica)', async () => {
    const user = await makeUser('inativa', false);
    const resposta = await api('POST', '/auth/password-reset/request', { email: user.email });
    expect(resposta.status).toBe(202);
    expect(sentMails).toHaveLength(0);
  });

  it('responde 503 honesto quando não há provedor de e-mail configurado', async () => {
    setMailProviderOverride(null);
    const user = await makeUser('sem-smtp');
    const resposta = await api('POST', '/auth/password-reset/request', { email: user.email });
    expect(resposta.status).toBe(503);
    expect(resposta.body.error).toMatch(/não está configurada/i);
    expect(sentMails).toHaveLength(0);
  });

  it('quando o envio falha de verdade, responde erro e invalida o token criado', async () => {
    setMailProviderOverride(failingProvider);
    const user = await makeUser('smtp-quebrado');
    const resposta = await api('POST', '/auth/password-reset/request', { email: user.email });
    expect(resposta.status).toBe(502);

    // O token criado antes da tentativa de envio não pode ficar vivo.
    const linhas = await pool.query(
      'select used_at, consumed_reason from password_reset_tokens where user_id = $1',
      [user.id]
    );
    expect(linhas.rowCount).toBe(1);
    expect(linhas.rows[0].used_at).not.toBeNull();
    expect(linhas.rows[0].consumed_reason).toBe('superseded');
  });

  it('limita a 3 e-mails por conta na janela (anti-abuso), sem mudar a resposta', async () => {
    const user = await makeUser('cota');
    for (let i = 0; i < 5; i += 1) {
      const r = await api('POST', '/auth/password-reset/request', { email: user.email });
      expect(r.status).toBe(202); // resposta idêntica: a cota não vaza nada
    }
    expect(sentMails).toHaveLength(3);
  });

  it('grava a trilha de auditoria sem nunca guardar o token', async () => {
    const user = await makeUser('auditoria');
    await api('POST', '/auth/password-reset/request', { email: user.email });
    const token = tokenFromMail(sentMails[0]);
    await api('POST', '/auth/password-reset/confirm', { token, password: NEW_PASSWORD });

    const logs = await pool.query(
      `select action, result, detail::text as detail from audit_logs
        where entity_id = $1 order by created_at`,
      [user.id]
    );
    const acoes = logs.rows.map((r: any) => r.action);
    expect(acoes).toContain('PASSWORD_RESET_REQUESTED');
    expect(acoes).toContain('PASSWORD_RESET_COMPLETED');
    for (const row of logs.rows) {
      expect(row.detail ?? '').not.toContain(token);
    }
    await pool.query('delete from audit_logs where entity_id = $1', [user.id]);
  });
});
