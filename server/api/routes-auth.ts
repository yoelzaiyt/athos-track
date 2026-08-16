// Login próprio contra user_profiles.password_hash (bcrypt), substituindo o
// Supabase Auth (GoTrue). Devolve só { id, email } no "user" — o mesmo
// mínimo que src/context/AuthContext.tsx já espera de session.user — porque
// resolveUserProfile() ali busca o perfil completo (nome/role/cliente/
// unidade) via GET /rest/user_profiles logo em seguida. Não duplicamos essa
// lógica aqui.

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from './db';
import { signAuthToken, requireAuth } from './auth';

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  try {
    const result = await pool.query(
      'select id, email, password_hash from user_profiles where email = $1',
      [email]
    );
    const profile = result.rows[0];
    if (!profile || !profile.password_hash) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, profile.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Satisfaz a FK histórica user_profiles.auth_user_id -> auth.users(id)
    // (ver server/db/00_bootstrap.sql) usando o próprio id do perfil como
    // "auth id" — não existe mais um conceito de identidade separado do perfil.
    await pool.query('insert into auth.users (id, email) values ($1, $2) on conflict (id) do nothing', [
      profile.id,
      profile.email,
    ]);

    const token = signAuthToken({ sub: profile.id, email: profile.email });
    res.json({ token, user: { id: profile.id, email: profile.email } });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

authRouter.get('/session', requireAuth, (req, res) => {
  res.json({ user: { id: req.auth!.sub, email: req.auth!.email } });
});
