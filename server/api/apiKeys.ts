// Emissão/gestão de chaves de API para terceiros autenticarem contra esta
// API (ingestão de dados, integrações externas) — diferente do JWT de sessão
// de usuário emitido em routes-auth.ts. O valor em texto puro da chave só
// existe na resposta HTTP de criação; a partir daí só o hash bcrypt persiste.

import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from './db';
import { requireAuth } from './auth';

export const apiKeysRouter = Router();
apiKeysRouter.use(requireAuth);

function generateApiKey(): { fullKey: string; prefix: string } {
  const random = crypto.randomBytes(24).toString('base64url');
  const fullKey = `athos_live_${random}`;
  const prefix = fullKey.slice(0, 18); // "athos_live_" + 7 chars, suficiente pra identificar sem expor a chave
  return { fullKey, prefix };
}

// GET /api-keys — lista chaves (nunca devolve o hash nem a chave em texto puro)
apiKeysRouter.get('/', async (_req, res) => {
  try {
    const result = await pool.query(
      'select id, name, key_prefix, created_at, last_used_at, revoked_at from api_keys order by created_at desc'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api-keys { name }  — gera e devolve a chave em texto puro (única vez)
apiKeysRouter.post('/', async (req, res) => {
  const { name } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  try {
    const { fullKey, prefix } = generateApiKey();
    const keyHash = await bcrypt.hash(fullKey, 10);
    const result = await pool.query(
      'insert into api_keys (name, key_prefix, key_hash) values ($1, $2, $3) returning id, name, key_prefix, created_at, last_used_at, revoked_at',
      [name.trim(), prefix, keyHash]
    );
    res.status(201).json({ ...result.rows[0], apiKey: fullKey });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// DELETE /api-keys/:id — revoga (soft delete, mantém histórico)
apiKeysRouter.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'update api_keys set revoked_at = now() where id = $1 and revoked_at is null returning id',
      [req.params.id]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'API key not found or already revoked' });
      return;
    }
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
