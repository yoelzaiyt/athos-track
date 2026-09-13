// Emissão/gestão de chaves de API para terceiros autenticarem contra esta
// API (ingestão de dados, integrações externas) — diferente do JWT de sessão
// de usuário emitido em routes-auth.ts. O valor em texto puro da chave só
// existe na resposta HTTP de criação; a partir daí só o hash bcrypt persiste.
//
// Card #8: até aqui qualquer usuário logado, de qualquer empresa e papel,
// listava, criava e revogava as chaves de TODAS as empresas. Agora:
//   - só ATHOS_ADMIN e CLIENT_ADMIN gerenciam chaves;
//   - toda chave pertence a uma empresa (api_keys.client_id, migration
//     server/db/05_api_keys_tenant.sql) e é o escopo do que ela consulta em /v1;
//   - CLIENT_ADMIN só vê/gera/revoga chaves da própria empresa; ATHOS_ADMIN
//     escolhe a empresa ao gerar e vê todas.

import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from './db';
import { requireAuth, type AuthTokenPayload } from './auth';
import { writeAuditLog } from './audit';

export const apiKeysRouter = Router();
apiKeysRouter.use(requireAuth);

const ADMIN_ROLE = 'ATHOS_ADMIN';
const TENANT_ADMIN_ROLE = 'CLIENT_ADMIN';

apiKeysRouter.use((req, res, next) => {
  const role = req.auth!.role;
  if (role !== ADMIN_ROLE && role !== TENANT_ADMIN_ROLE) {
    res.status(403).json({ error: `Only ${ADMIN_ROLE} or ${TENANT_ADMIN_ROLE} can manage API keys` });
    return;
  }
  next();
});

const isAdmin = (auth: AuthTokenPayload) => auth.role === ADMIN_ROLE;

function generateApiKey(): { fullKey: string; prefix: string } {
  const random = crypto.randomBytes(24).toString('base64url');
  const fullKey = `athos_live_${random}`;
  const prefix = fullKey.slice(0, 18); // "athos_live_" + 7 chars, suficiente pra identificar sem expor a chave
  return { fullKey, prefix };
}

const PUBLIC_COLUMNS = 'k.id, k.name, k.key_prefix, k.client_id, c.name as client_name, k.created_at, k.last_used_at, k.revoked_at';

// GET /api-keys — lista chaves (nunca devolve o hash nem a chave em texto puro)
apiKeysRouter.get('/', async (req, res) => {
  const auth = req.auth!;
  if (!isAdmin(auth) && !auth.client_id) {
    res.status(403).json({ error: 'User has no client_id assigned' });
    return;
  }
  try {
    const result = await pool.query(
      `select ${PUBLIC_COLUMNS}
         from api_keys k
         left join company_clients c on c.id = k.client_id
        ${isAdmin(auth) ? '' : 'where k.client_id = $1'}
        order by k.created_at desc`,
      isAdmin(auth) ? [] : [auth.client_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[api-keys] list failed:', (err as Error).message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// POST /api-keys { name, clientId? } — gera e devolve a chave em texto puro
// (única vez). clientId só é aceito de ATHOS_ADMIN, e é obrigatório para ele.
apiKeysRouter.post('/', async (req, res) => {
  const auth = req.auth!;
  const { name, clientId } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const targetClientId = isAdmin(auth) ? (typeof clientId === 'string' ? clientId : null) : auth.client_id;
  if (!targetClientId) {
    res.status(isAdmin(auth) ? 400 : 403).json({
      error: isAdmin(auth) ? 'clientId is required' : 'User has no client_id assigned',
    });
    return;
  }

  try {
    const exists = await pool.query('select 1 from company_clients where id = $1', [targetClientId]);
    if (exists.rowCount === 0) {
      res.status(400).json({ error: 'Unknown clientId' });
      return;
    }

    const { fullKey, prefix } = generateApiKey();
    const keyHash = await bcrypt.hash(fullKey, 10);
    const inserted = await pool.query(
      'insert into api_keys (name, key_prefix, key_hash, client_id, created_by) values ($1, $2, $3, $4, $5) returning id',
      [name.trim(), prefix, keyHash, targetClientId, auth.sub]
    );
    const id = inserted.rows[0].id as string;
    const row = await pool.query(
      `select ${PUBLIC_COLUMNS} from api_keys k left join company_clients c on c.id = k.client_id where k.id = $1`,
      [id]
    );

    await writeAuditLog({
      actor: auth,
      action: 'api_key.create',
      entityType: 'api_key',
      entityId: id,
      result: 'success',
      detail: { name: name.trim(), clientId: targetClientId, keyPrefix: prefix },
    });
    res.status(201).json({ ...row.rows[0], apiKey: fullKey });
  } catch (err) {
    console.error('[api-keys] create failed:', (err as Error).message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// DELETE /api-keys/:id — revoga (soft delete, mantém histórico). Chave de
// outra empresa responde 404, igual a inexistente.
apiKeysRouter.delete('/:id', async (req, res) => {
  const auth = req.auth!;
  try {
    const result = await pool.query(
      `update api_keys set revoked_at = now()
        where id = $1 and revoked_at is null ${isAdmin(auth) ? '' : 'and client_id = $2'}
        returning id`,
      isAdmin(auth) ? [req.params.id] : [req.params.id, auth.client_id]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'API key not found or already revoked' });
      return;
    }
    await writeAuditLog({
      actor: auth,
      action: 'api_key.revoke',
      entityType: 'api_key',
      entityId: req.params.id,
      result: 'success',
    });
    res.status(204).end();
  } catch (err) {
    console.error('[api-keys] revoke failed:', (err as Error).message);
    res.status(500).json({ error: 'Internal error' });
  }
});
