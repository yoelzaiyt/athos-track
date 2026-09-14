// Login próprio contra user_profiles.password_hash (bcrypt), substituindo o
// Supabase Auth (GoTrue). Devolve só { id, email } no "user" — o mesmo
// mínimo que src/context/AuthContext.tsx já espera de session.user — porque
// resolveUserProfile() ali busca o perfil completo (nome/role/cliente/
// unidade) via GET /rest/user_profiles logo em seguida. Não duplicamos essa
// lógica aqui.

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit, { MemoryStore } from 'express-rate-limit';
import { pool } from './db';
import { signAuthToken, requireAuth, type AuthTokenPayload } from './auth';
import { writeAuditLog } from './audit';
import { getMailProvider } from '../mail';
import {
  buildResetEmail,
  buildResetLink,
  generateResetToken,
  hashResetToken,
  resetTokenHashMatches,
  resolveAppPublicUrl,
  validateNewPassword,
} from './passwordReset';

export const authRouter = Router();

// SEC-007 (ver SECURITY-GATE-REPORT.md): até esta correção, /auth/login não
// tinha nenhum freio — 15 tentativas de senha errada levavam ~1,4s e a 16ª
// (certa) autenticava normalmente, sem lockout nenhum. Dois limitadores:
//   - por IP: contém um único atacante testando muitas contas.
//   - por e-mail: contém um atacante mirando uma conta só, mesmo trocando de
//     IP. Só conta tentativa FALHA (skipSuccessfulRequests) — um usuário
//     legítimo errando a senha 2x e acertando na 3ª não é penalizado.
const loginLimiterByIp = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts from this network. Try again later.' },
});

const loginAttemptsByEmail = new Map<string, { count: number; resetAt: number }>();
const EMAIL_WINDOW_MS = 15 * 60 * 1000;
const EMAIL_MAX_ATTEMPTS = 8;

function loginLimiterByEmail(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) {
  const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : null;
  if (!email) {
    next();
    return;
  }
  const now = Date.now();
  const entry = loginAttemptsByEmail.get(email);
  if (entry && entry.resetAt > now && entry.count >= EMAIL_MAX_ATTEMPTS) {
    res.status(429).json({ error: 'Too many login attempts for this account. Try again later.' });
    return;
  }
  next();
}

function registerFailedAttempt(email: string) {
  const now = Date.now();
  const entry = loginAttemptsByEmail.get(email.toLowerCase());
  if (!entry || entry.resetAt <= now) {
    loginAttemptsByEmail.set(email.toLowerCase(), { count: 1, resetAt: now + EMAIL_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

function clearFailedAttempts(email: string) {
  loginAttemptsByEmail.delete(email.toLowerCase());
}

authRouter.post('/login', loginLimiterByIp, loginLimiterByEmail, async (req, res) => {
  const { email: rawEmail, password } = req.body ?? {};
  if (typeof rawEmail !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }
  // Normaliza igual ao registerFailedAttempt/clearFailedAttempts (que já usam
  // toLowerCase) — sem isso, um e-mail com capitalização diferente da
  // cadastrada (autocapitalize do teclado mobile, por exemplo) sempre caía
  // em "Invalid credentials" mesmo com a senha certa, já que `where email = $1`
  // é case-sensitive.
  const email = rawEmail.trim().toLowerCase();

  try {
    const result = await pool.query(
      'select id, email, password_hash, is_active, session_version from user_profiles where email = $1',
      [email]
    );
    const profile = result.rows[0];
    if (!profile || !profile.password_hash) {
      registerFailedAttempt(email);
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, profile.password_hash);
    if (!valid) {
      registerFailedAttempt(email);
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // SEC-009: senha certa não basta se a conta foi desativada por um admin.
    if (!profile.is_active) {
      res.status(401).json({ error: 'Account is inactive' });
      return;
    }

    clearFailedAttempts(email);

    // Satisfaz a FK histórica user_profiles.auth_user_id -> auth.users(id)
    // (ver server/db/00_bootstrap.sql) usando o próprio id do perfil como
    // "auth id" — não existe mais um conceito de identidade separado do perfil.
    // Em bancos que ainda são o Supabase real (não o schema `auth` mínimo do
    // bootstrap), auth.users já tem uma linha própria pra esse e-mail com outro
    // id (conta GoTrue histórica) — o ON CONFLICT (id) não cobre esse caso e o
    // insert falha por unique constraint de e-mail. Não é fatal pro login: só
    // ignoramos e seguimos, best-effort.
    try {
      await pool.query('insert into auth.users (id, email) values ($1, $2) on conflict (id) do nothing', [
        profile.id,
        profile.email,
      ]);
    } catch (err) {
      console.warn('[auth] Falha ao satisfazer FK histórica auth.users (ignorado):', (err as Error).message);
    }

    const token = signAuthToken({
      sub: profile.id,
      email: profile.email,
      sessionVersion: profile.session_version,
    });
    res.json({ token, user: { id: profile.id, email: profile.email } });
  } catch (err) {
    console.error('[auth] /login failed:', (err as Error).message);
    res.status(500).json({ error: 'Login failed' });
  }
});

authRouter.get('/session', requireAuth, (req, res) => {
  res.json({ user: { id: req.auth!.sub, email: req.auth!.email } });
});

// SEC-008: até esta correção, "logout" só apagava o token do localStorage no
// navegador — o token continuava 100% válido no servidor até expirar
// sozinho (até 7 dias). Incrementar session_version torna o token usado
// nesta chamada (e qualquer outro já emitido antes) inválido imediatamente,
// em qualquer dispositivo — não só um "esconder localmente".
authRouter.post('/logout', requireAuth, async (req, res) => {
  try {
    await pool.query('update user_profiles set session_version = session_version + 1 where id = $1', [req.auth!.sub]);
    res.status(204).end();
  } catch (err) {
    console.error('[auth] /logout failed:', (err as Error).message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ===================== SEC-010 fase 2: recuperação de senha =====================
// Até aqui, "esqueci minha senha" só tinha um caminho: um humano rodar
// scripts/provision-user-password.ts. Agora existe o fluxo real:
//   1. POST /auth/password-reset/request  { email }            -> manda o e-mail
//   2. POST /auth/password-reset/validate { token }            -> a tela checa o link
//   3. POST /auth/password-reset/confirm  { token, password }  -> troca a senha
//
// Três garantias que valem repetir, porque são o que separa isso de um
// "esqueci a senha" inseguro:
//   * O token só existe em claro no e-mail do dono da conta (o banco guarda
//     SHA-256 — ver server/api/passwordReset.ts).
//   * Uso único + expiração curta: confirmar marca used_at, e pedir um link
//     novo invalida os anteriores ('superseded').
//   * Trocar a senha incrementa session_version (SEC-008) — quem estava
//     logado com um token roubado cai na hora, em qualquer dispositivo. Esse
//     é o ponto do fluxo: recuperar a conta tem que EXPULSAR o invasor.

const RESET_GENERIC_MESSAGE =
  'Se existir uma conta ativa com este e-mail, enviamos as instruções de redefinição. Confira também a caixa de spam.';

const RESET_INVALID_MESSAGE =
  'Este link de redefinição não é mais válido (expirou, já foi usado ou foi substituído por um mais novo). Peça um novo link na tela de login.';

// Freio por IP nos três endpoints (um atacante varrendo e-mails ou chutando
// tokens). O freio por e-mail vem logo abaixo e é o que contém o abuso de
// disparar dezenas de e-mails pra mesma vítima.
const resetIpStore = new MemoryStore();
const resetLimiterByIp = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: resetIpStore,
  message: { error: 'Muitas solicitações a partir desta rede. Tente novamente mais tarde.' },
});

const resetRequestsByEmail = new Map<string, { count: number; resetAt: number }>();
const RESET_EMAIL_WINDOW_MS = 15 * 60 * 1000;
const RESET_EMAIL_MAX = 3;

/** Zera os dois freios (IP e e-mail) do fluxo de recuperação. Existe pros
 *  testes de integração: eles disparam dezenas de requisições do mesmo
 *  127.0.0.1 e, sem isso, um caso derrubaria o seguinte por 429 — o que
 *  esconderia a falha real que o caso queria pegar. NÃO é exposto por
 *  nenhuma rota HTTP; só por import direto do módulo. */
export function clearPasswordResetThrottles(): void {
  resetIpStore.resetAll?.();
  resetRequestsByEmail.clear();
}

/** true quando ainda há cota pra mandar e-mail pra este endereço na janela. */
function consumeResetQuota(email: string): boolean {
  const now = Date.now();
  const key = email.toLowerCase();
  const entry = resetRequestsByEmail.get(key);
  if (!entry || entry.resetAt <= now) {
    resetRequestsByEmail.set(key, { count: 1, resetAt: now + RESET_EMAIL_WINDOW_MS });
    return true;
  }
  if (entry.count >= RESET_EMAIL_MAX) return false;
  entry.count += 1;
  return true;
}

/** Actor real do audit log pros eventos não autenticados deste fluxo: é o
 *  próprio dono da conta, com role/client_id lidos frescos do banco — não um
 *  "system" genérico. */
function auditActorFromProfile(profile: {
  id: string;
  email: string;
  role: string;
  client_id: string | null;
  unit_id: string | null;
}): AuthTokenPayload {
  return {
    sub: profile.id,
    email: profile.email,
    role: profile.role,
    client_id: profile.client_id,
    unit_id: profile.unit_id,
  };
}

interface ResetTokenLookup {
  token_id: string;
  user_id: string;
  email: string;
  name: string | null;
  role: string;
  client_id: string | null;
  unit_id: string | null;
  is_active: boolean;
  expires_at: string | Date;
  used_at: string | Date | null;
  token_hash: string;
}

type ResetTokenFailure = 'malformed' | 'unknown' | 'used' | 'expired' | 'inactive';

// Um objeto só (em vez de união discriminada) porque este tsconfig roda sem
// `strict`/`strictNullChecks` — sem isso o TS não estreita `{ok:true}|{ok:false}`
// e todo call site precisaria de cast.
interface ResetTokenResult {
  ok: boolean;
  row: ResetTokenLookup | null;
  reason: ResetTokenFailure | null;
}

function resetTokenFailure(reason: ResetTokenFailure): ResetTokenResult {
  return { ok: false, row: null, reason };
}

/** Busca o token pelo HASH (nunca pelo valor em claro) e devolve junto o
 *  perfil dono dele. Uma query só: validar e confirmar precisam exatamente
 *  das mesmas checagens, então não podem divergir. */
async function lookupResetToken(rawToken: unknown): Promise<ResetTokenResult> {
  if (typeof rawToken !== 'string' || rawToken.length < 20 || rawToken.length > 200) {
    return resetTokenFailure('malformed');
  }
  const tokenHash = hashResetToken(rawToken);
  const result = await pool.query(
    `select t.id as token_id, t.user_id, t.expires_at, t.used_at, t.token_hash,
            u.email, u.name, u.role, u.client_id, u.unit_id, u.is_active
       from password_reset_tokens t
       join user_profiles u on u.id = t.user_id
      where t.token_hash = $1`,
    [tokenHash]
  );
  const row = result.rows[0] as ResetTokenLookup | undefined;
  if (!row) return resetTokenFailure('unknown');
  // Redundante com o `where` (o lookup já é por hash), mas mantém a
  // comparação do segredo em tempo constante e à prova de um refactor futuro
  // que troque esse where por algo mais frouxo.
  if (!resetTokenHashMatches(row.token_hash, tokenHash)) return resetTokenFailure('unknown');
  if (row.used_at) return resetTokenFailure('used');
  if (new Date(row.expires_at).getTime() <= Date.now()) return resetTokenFailure('expired');
  if (!row.is_active) return resetTokenFailure('inactive');
  return { ok: true, row, reason: null };
}

/** Esconde o e-mail na tela de redefinição ("ma***@empresa.com") — confirma
 *  pro usuário que o link é da conta dele sem imprimir o endereço inteiro
 *  numa tela que pode estar sendo projetada ou compartilhada. */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const head = local.slice(0, 2);
  return `${head}${'*'.repeat(Math.max(1, local.length - head.length))}@${domain}`;
}

authRouter.post('/password-reset/request', resetLimiterByIp, async (req, res) => {
  const rawEmail = req.body?.email;
  if (typeof rawEmail !== 'string' || !rawEmail.includes('@')) {
    res.status(400).json({ error: 'Informe um e-mail válido.' });
    return;
  }
  const email = rawEmail.trim().toLowerCase();

  // Honestidade primeiro (princípio "se aparece na tela, tem que ser real"):
  // sem SMTP configurado ou sem URL pública do app, NÃO existe como mandar
  // e-mail — então o endpoint diz isso, em vez de responder "enviamos" e não
  // enviar nada. Esta resposta não depende do e-mail informado, então não
  // revela se a conta existe.
  const mailProvider = getMailProvider();
  const appUrl = resolveAppPublicUrl();
  if (!mailProvider || !appUrl) {
    console.warn(
      `[auth] /password-reset/request indisponível — ${
        !mailProvider ? 'SMTP não configurado (SMTP_HOST/MAIL_FROM)' : 'sem URL pública (APP_PUBLIC_URL/CORS_ORIGIN)'
      }.`
    );
    res.status(503).json({
      error:
        'A recuperação automática de senha não está configurada neste ambiente. Fale com o administrador da sua empresa ou com o suporte ATHOS.',
    });
    return;
  }

  try {
    const profileResult = await pool.query(
      'select id, email, name, role, client_id, unit_id, is_active from user_profiles where email = $1',
      [email]
    );
    const profile = profileResult.rows[0];

    // Conta inexistente ou desativada: resposta idêntica à do caminho feliz
    // (202 + mensagem genérica), pra não virar um oráculo de "quem tem conta
    // aqui". Nada é enviado, nada é gravado.
    if (!profile || !profile.is_active) {
      res.status(202).json({ message: RESET_GENERIC_MESSAGE });
      return;
    }

    if (!consumeResetQuota(email)) {
      // Mesma mensagem genérica: um atacante não distingue "cota estourada"
      // (conta existe) de "conta não existe".
      res.status(202).json({ message: RESET_GENERIC_MESSAGE });
      return;
    }

    const { token, tokenHash, expiresAt } = generateResetToken();

    // Pedir um link novo invalida os anteriores: no fim, no máximo um link
    // vivo por conta.
    await pool.query(
      `update password_reset_tokens set used_at = now(), consumed_reason = 'superseded'
        where user_id = $1 and used_at is null`,
      [profile.id]
    );
    const inserted = await pool.query(
      `insert into password_reset_tokens (user_id, token_hash, expires_at, requested_ip)
       values ($1, $2, $3, $4) returning id`,
      [profile.id, tokenHash, expiresAt.toISOString(), req.ip ?? null]
    );
    const tokenId = inserted.rows[0].id as string;

    const link = buildResetLink(appUrl, token);
    const mail = buildResetEmail({ recipientName: profile.name ?? null, link, expiresAt });

    try {
      const sent = await mailProvider.sendMail({
        to: profile.email,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });
      // `detail` NUNCA carrega o token nem o link (o link contém o token).
      await writeAuditLog({
        actor: auditActorFromProfile(profile),
        action: 'PASSWORD_RESET_REQUESTED',
        entityType: 'user_profiles',
        entityId: profile.id,
        result: 'success',
        detail: {
          token_id: tokenId,
          expires_at: expiresAt.toISOString(),
          mail_provider: mailProvider.id,
          message_id: sent.messageId,
          requested_ip: req.ip ?? null,
        },
      });
      res.status(202).json({ message: RESET_GENERIC_MESSAGE });
    } catch (mailErr) {
      // O envio falhou de verdade (SMTP fora, credencial errada, destinatário
      // recusado). Invalidamos o token recém-criado e contamos a verdade.
      // Trade-off consciente: esta resposta só aparece pra e-mail que EXISTE,
      // então um atacante com o SMTP quebrado conseguiria inferir existência
      // de conta — aceitável perto da alternativa, que é deixar o usuário
      // legítimo esperando pra sempre um e-mail que nunca vai chegar.
      await pool.query(
        `update password_reset_tokens set used_at = now(), consumed_reason = 'superseded' where id = $1`,
        [tokenId]
      );
      await writeAuditLog({
        actor: auditActorFromProfile(profile),
        action: 'PASSWORD_RESET_REQUESTED',
        entityType: 'user_profiles',
        entityId: profile.id,
        result: 'error',
        detail: { token_id: tokenId, mail_provider: mailProvider.id, error: (mailErr as Error).message },
      });
      console.error('[auth] Falha ao enviar e-mail de redefinição:', (mailErr as Error).message);
      res.status(502).json({
        error:
          'Não conseguimos enviar o e-mail de redefinição agora. Tente novamente em alguns minutos ou fale com o suporte ATHOS.',
      });
    }
  } catch (err) {
    console.error('[auth] /password-reset/request failed:', (err as Error).message);
    res.status(500).json({ error: 'Não foi possível processar a solicitação.' });
  }
});

authRouter.post('/password-reset/validate', resetLimiterByIp, async (req, res) => {
  try {
    const lookup = await lookupResetToken(req.body?.token);
    if (!lookup.ok || !lookup.row) {
      res.status(400).json({ valid: false, error: RESET_INVALID_MESSAGE, reason: lookup.reason });
      return;
    }
    res.json({
      valid: true,
      email: maskEmail(lookup.row.email),
      expiresAt: new Date(lookup.row.expires_at).toISOString(),
    });
  } catch (err) {
    console.error('[auth] /password-reset/validate failed:', (err as Error).message);
    res.status(500).json({ valid: false, error: 'Não foi possível validar o link.' });
  }
});

authRouter.post('/password-reset/confirm', resetLimiterByIp, async (req, res) => {
  const passwordError = validateNewPassword(req.body?.password);
  if (passwordError) {
    res.status(400).json({ error: passwordError });
    return;
  }

  try {
    const lookup = await lookupResetToken(req.body?.token);
    if (!lookup.ok || !lookup.row) {
      res.status(400).json({ error: RESET_INVALID_MESSAGE, reason: lookup.reason });
      return;
    }
    const row = lookup.row;
    const passwordHash = await bcrypt.hash(req.body.password as string, 10);

    // Tudo numa transação: ou a senha muda E o token morre E as sessões
    // antigas caem, ou nada acontece. Um crash no meio não pode deixar um
    // token já "gasto" com a senha antiga ainda valendo (nem o contrário).
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // O `used_at is null` no WHERE é a trava contra duas confirmações
      // simultâneas com o mesmo link: só a primeira transação acha a linha.
      const consumed = await client.query(
        `update password_reset_tokens set used_at = now(), consumed_reason = 'used'
          where id = $1 and used_at is null returning id`,
        [row.token_id]
      );
      if (consumed.rowCount === 0) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: RESET_INVALID_MESSAGE, reason: 'used' });
        return;
      }
      // session_version++ (SEC-008): redefinir a senha derruba toda sessão já
      // emitida — é o que expulsa quem tinha roubado o acesso.
      await client.query(
        'update user_profiles set password_hash = $1, session_version = session_version + 1 where id = $2',
        [passwordHash, row.user_id]
      );
      // Qualquer outro link pendente da mesma conta perde a validade junto.
      await client.query(
        `update password_reset_tokens set used_at = now(), consumed_reason = 'superseded'
          where user_id = $1 and used_at is null`,
        [row.user_id]
      );
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }

    // Quem acabou de recuperar a conta não pode encontrar a porta trancada
    // pelo limitador de tentativas de login (SEC-007) das senhas erradas de
    // antes — o dono legítimo já provou a posse do e-mail.
    clearFailedAttempts(row.email);

    await writeAuditLog({
      actor: auditActorFromProfile({
        id: row.user_id,
        email: row.email,
        role: row.role,
        client_id: row.client_id,
        unit_id: row.unit_id,
      }),
      action: 'PASSWORD_RESET_COMPLETED',
      entityType: 'user_profiles',
      entityId: row.user_id,
      result: 'success',
      detail: { token_id: row.token_id, sessions_revoked: true, requested_ip: req.ip ?? null },
    });

    res.status(204).end();
  } catch (err) {
    console.error('[auth] /password-reset/confirm failed:', (err as Error).message);
    res.status(500).json({ error: 'Não foi possível redefinir a senha.' });
  }
});
