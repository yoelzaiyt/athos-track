// Login próprio contra user_profiles.password_hash (bcrypt), substituindo o
// Supabase Auth (GoTrue). Devolve só { id, email } no "user" — o mesmo
// mínimo que src/context/AuthContext.tsx já espera de session.user — porque
// resolveUserProfile() ali busca o perfil completo (nome/role/cliente/
// unidade) via GET /rest/user_profiles logo em seguida. Não duplicamos essa
// lógica aqui.

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { pool } from './db';
import { signAuthToken, requireAuth } from './auth';

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
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

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
