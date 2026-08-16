// Substitui o Supabase Realtime: mantém uma conexão Postgres dedicada com
// "LISTEN table_changes" (alimentado pelos triggers de
// server/db/02_realtime_notify.sql) e repassa cada evento pros clientes
// conectados via Socket.io, num canal por tabela. O shim do cliente em
// src/lib/supabaseClient.ts assina esse mesmo canal pra imitar
// supabase.channel(...).on('postgres_changes', ...).

import { Client } from 'pg';
import type { Server as SocketIOServer } from 'socket.io';

export async function startRealtimeBridge(io: SocketIOServer) {
  const connectionString = process.env.DATABASE_URL!;
  const listener = new Client({
    connectionString,
    ssl: connectionString.includes('railway') || connectionString.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  });

  await listener.connect();
  await listener.query('LISTEN table_changes');

  listener.on('notification', (msg) => {
    if (!msg.payload) return;
    try {
      const payload = JSON.parse(msg.payload) as { table: string; eventType: string; new: unknown; old: unknown };
      io.emit(`postgres_changes:${payload.table}`, payload);
    } catch (err) {
      console.error('[realtime] Failed to parse NOTIFY payload:', (err as Error).message);
    }
  });

  listener.on('error', (err) => {
    console.error('[realtime] Listener connection error:', err.message);
  });

  console.log('[realtime] Listening for table_changes notifications.');
}
