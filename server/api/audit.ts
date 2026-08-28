// Trilha de auditoria persistida (seção 21 do brief multi-tenant/multi-provider)
// — substitui/complementa o console.error usado até aqui pra eventos
// administrativos. Só este módulo escreve em audit_logs; server/api/rest.ts
// bloqueia POST/PATCH/DELETE nessa tabela via o proxy genérico pra ninguém
// conseguir forjar uma entrada (SYSTEM_APPEND_ONLY_TABLES).

import { pool } from './db';
import type { AuthTokenPayload } from './auth';

export async function writeAuditLog(params: {
  actor: AuthTokenPayload;
  action: string;
  entityType: string;
  entityId?: string | null;
  result: 'success' | 'error';
  detail?: Record<string, unknown>;
}) {
  try {
    await pool.query(
      `insert into audit_logs (actor_id, actor_email, client_id, action, entity_type, entity_id, result, detail)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        params.actor.sub,
        params.actor.email,
        params.actor.client_id,
        params.action,
        params.entityType,
        params.entityId ?? null,
        params.result,
        // Nunca gravar secrets aqui — quem chama writeAuditLog é responsável
        // por não incluir token/senha/api_key no `detail`.
        params.detail ? JSON.stringify(params.detail) : null,
      ]
    );
  } catch (err) {
    // Falha ao auditar não pode derrubar a operação que está sendo auditada.
    console.error('[audit] Falha ao gravar audit_logs (ignorado):', (err as Error).message);
  }
}
