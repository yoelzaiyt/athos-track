// Autenticação por chave de API para as rotas públicas /v1 (card #8).
//
// Aceita a chave em `X-API-Key: athos_live_...` ou em
// `Authorization: Bearer athos_live_...`. A chave em texto puro nunca é
// guardada: procura as chaves ativas com o mesmo prefixo (índice parcial
// idx_api_keys_active_prefix) e confere o hash bcrypt de cada uma.
//
// Depois de validar, preenche req.auth como um principal de papel API_KEY,
// sem unidade e preso ao client_id dono da chave. Isso deixa o resto da API
// reaproveitar o que já existe: withTenantContext (RLS por tenant) e o rate
// limit de server/api/rateLimit.ts, que passa a contar por chave.

import type { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from './db';

export const API_KEY_ROLE = 'API_KEY';
const KEY_PREFIX_LENGTH = 18; // igual a generateApiKey() em apiKeys.ts

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      apiKeyId?: string;
    }
  }
}

function extractKey(req: Request): string | null {
  const header = req.headers['x-api-key'];
  if (typeof header === 'string' && header.startsWith('athos_live_')) return header.trim();
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer athos_live_')) return auth.slice('Bearer '.length).trim();
  return null;
}

export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const key = extractKey(req);
  if (!key) {
    res.status(401).json({ error: 'Chave de API ausente. Envie o header X-API-Key.' });
    return;
  }

  try {
    const candidates = await pool.query(
      'select id, client_id, key_hash from api_keys where key_prefix = $1 and revoked_at is null',
      [key.slice(0, KEY_PREFIX_LENGTH)]
    );

    let match: { id: string; client_id: string | null } | null = null;
    for (const row of candidates.rows) {
      if (await bcrypt.compare(key, row.key_hash)) {
        match = row;
        break;
      }
    }

    // Mesma resposta para chave inexistente, errada ou revogada: não revela
    // qual prefixo existe.
    if (!match) {
      res.status(401).json({ error: 'Chave de API inválida ou revogada.' });
      return;
    }
    if (!match.client_id) {
      res.status(403).json({ error: 'Chave de API sem empresa vinculada. Gere uma chave nova.' });
      return;
    }

    req.apiKeyId = match.id;
    req.auth = { sub: `api_key:${match.id}`, email: '', role: API_KEY_ROLE, client_id: match.client_id, unit_id: null };

    // Registro de último uso sem segurar a resposta; uma falha aqui não deve
    // derrubar a consulta.
    pool
      .query('update api_keys set last_used_at = now() where id = $1', [match.id])
      .catch((err) => console.error('[api-key] falha ao registrar last_used_at:', (err as Error).message));

    next();
  } catch (err) {
    console.error('[api-key] falha na validação:', (err as Error).message);
    res.status(500).json({ error: 'Internal error' });
  }
}
