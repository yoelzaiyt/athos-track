import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from './db';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('Missing JWT_SECRET — set it in the environment (any long random string).');
}

// O que fica DENTRO do JWT — de propósito mínimo (sub/email/sv). Role,
// client_id e unit_id NÃO vão mais no token (ver SEC-008 em
// SECURITY-GATE-REPORT.md): iam ficar "congelados" no valor de quando o
// login aconteceu, então mudar o papel/empresa de alguém só valia depois de
// relogar. Agora resolveAuth busca esses campos frescos no banco a cada
// requisição — junto com o resto da checagem de revogação abaixo.
interface JwtClaims {
  sub: string; // user_profiles.id
  email: string;
  sv: number; // session_version no momento do login
}

// O que fica em req.auth (HTTP) / socket.data.auth (Socket.IO) depois de
// validado — usado por todo o resto da API (server/api/rest.ts,
// server/api/realtime.ts) pra decidir tenant/role.
export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: string;
  client_id: string | null;
  unit_id: string | null;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export function signAuthToken(payload: { sub: string; email: string; sessionVersion: number }): string {
  const claims: JwtClaims = { sub: payload.sub, email: payload.email, sv: payload.sessionVersion };
  return jwt.sign(claims, JWT_SECRET!, { expiresIn: '7d' });
}

// SEC-008/SEC-009: valida o JWT E confirma que a sessão ainda está ativa —
// role/client_id/unit_id/is_active/session_version vêm frescos do banco a
// cada chamada, não do token. É isso que torna "desativar um usuário" ou
// "deslogar de todo lugar" (session_version++, ver /auth/logout e
// scripts/provision-user-password.ts) efetivos imediatamente, mesmo com um
// token ainda dentro da validade de 7 dias — usado tanto pelo requireAuth
// HTTP quanto pela autenticação do handshake do Socket.IO
// (server/api/realtime.ts), pros dois caminhos terem a mesma garantia.
export async function resolveAuth(token: string): Promise<AuthTokenPayload> {
  let claims: JwtClaims;
  try {
    claims = jwt.verify(token, JWT_SECRET!) as JwtClaims;
  } catch {
    throw new AuthError('Invalid or expired token');
  }

  if (!claims.sv) {
    // Token emitido antes desta correção (formato antigo, com role/client_id
    // dentro do JWT) — fail-closed, pede login de novo em vez de confiar nele.
    throw new AuthError('Token outdated — please sign in again');
  }

  const result = await pool.query(
    'select role, client_id, unit_id, is_active, session_version from user_profiles where id = $1',
    [claims.sub]
  );
  const profile = result.rows[0];
  if (!profile || !profile.is_active) {
    throw new AuthError('Account is inactive');
  }
  if (profile.session_version !== claims.sv) {
    throw new AuthError('Session revoked — please sign in again');
  }

  return {
    sub: claims.sub,
    email: claims.email,
    role: profile.role,
    client_id: profile.client_id,
    unit_id: profile.unit_id,
  };
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload;
    }
  }
}

// A autorização por role/tenant (quem pode ver/alterar o quê) é decidida
// depois disso, em server/api/rest.ts — ver SEC-001/002/005 em
// SECURITY-GATE-REPORT.md.
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  if (!token) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }

  try {
    req.auth = await resolveAuth(token);
    next();
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(401).json({ error: err.message });
      return;
    }
    console.error('[auth] requireAuth lookup failed:', (err as Error).message);
    res.status(500).json({ error: 'Internal error' });
  }
}
