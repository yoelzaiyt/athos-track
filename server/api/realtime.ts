// Substitui o Supabase Realtime: mantém uma conexão Postgres dedicada com
// "LISTEN table_changes" (alimentado pelos triggers de
// server/db/02_realtime_notify.sql) e repassa cada evento pros clientes
// conectados via Socket.io, num canal por tabela. O shim do cliente em
// src/lib/supabaseClient.ts assina esse mesmo canal pra imitar
// supabase.channel(...).on('postgres_changes', ...).
//
// SEC-003 (ver SECURITY-GATE-REPORT.md): até esta correção, qualquer socket
// conectado recebia TODOS os eventos de TODOS os tenants, sem autenticação
// nenhuma. Agora: (1) a conexão exige um JWT válido (mesmo formato da API
// REST, com client_id/role); (2) cada socket entra numa room por tenant
// (`client:<client_id>`) ou, se for ATHOS_ADMIN, na room `admins`, que recebe
// tudo; (3) cada evento é emitido só pra room do tenant dono da linha.

import type { Server as SocketIOServer, Socket } from 'socket.io';
import { Client } from 'pg';
import { pool } from './db';
import { resolveAuth, AuthError } from './auth';

function tenantRoom(clientId: string) {
  return `client:${clientId}`;
}

async function authenticateSocket(socket: Socket, next: (err?: Error) => void) {
  const token = (socket.handshake.auth?.token as string | undefined) ?? (socket.handshake.query?.token as string | undefined);
  if (!token) {
    next(new Error('Missing auth token'));
    return;
  }
  try {
    // Mesma checagem de sessão ativa/revogada do requireAuth HTTP (SEC-008/
    // SEC-009) — um usuário desativado ou deslogado remotamente também
    // perde a conexão de realtime, não só o acesso REST.
    const payload = await resolveAuth(token);
    if (payload.role === 'ATHOS_ADMIN') {
      socket.join('admins');
    } else if (payload.client_id) {
      socket.join(tenantRoom(payload.client_id));
    } else {
      next(new Error('User has no client_id assigned'));
      return;
    }
    next();
  } catch (err) {
    next(new Error(err instanceof AuthError ? err.message : 'Invalid or expired token'));
  }
}

// system_alerts não tem client_id direto — resolve via assets.
async function resolveClientId(table: string, row: Record<string, unknown> | null): Promise<string | null> {
  if (!row) return null;
  if (typeof row.client_id === 'string') return row.client_id;
  if (table === 'system_alerts' && typeof row.asset_id === 'string') {
    const { rows } = await pool.query('select client_id from assets where id = $1', [row.asset_id]);
    return rows[0]?.client_id ?? null;
  }
  return null;
}

export async function startRealtimeBridge(io: SocketIOServer) {
  io.use(authenticateSocket);

  const connectionString = process.env.DATABASE_URL!;
  const listener = new Client({
    connectionString,
    ssl: connectionString.includes('railway') || connectionString.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  });

  await listener.connect();
  await listener.query('LISTEN table_changes');

  listener.on('notification', (msg) => {
    if (!msg.payload) return;
    (async () => {
      try {
        const payload = JSON.parse(msg.payload!) as {
          table: string;
          eventType: string;
          new: Record<string, unknown> | null;
          old: Record<string, unknown> | null;
        };
        const clientId = await resolveClientId(payload.table, payload.new ?? payload.old);
        const event = `postgres_changes:${payload.table}`;
        if (clientId) {
          io.to(tenantRoom(clientId)).to('admins').emit(event, payload);
        } else {
          // Sem client_id resolvível: não sabemos o tenant dono da linha —
          // por segurança, manda só pros admins ATHOS, não faz broadcast geral.
          io.to('admins').emit(event, payload);
        }
      } catch (err) {
        console.error('[realtime] Failed to parse NOTIFY payload:', (err as Error).message);
      }
    })();
  });

  listener.on('error', (err) => {
    console.error('[realtime] Listener connection error:', err.message);
  });

  console.log('[realtime] Listening for table_changes notifications.');
}
