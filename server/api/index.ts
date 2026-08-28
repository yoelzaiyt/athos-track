// API própria que substitui o Supabase (Postgres direto no Railway + Auth
// própria + Realtime via Socket.io). Ver docs/deploy/RAILWAY_VERCEL.md para
// o passo a passo de deploy completo.

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { authRouter } from './routes-auth';
import { restRouter } from './rest';
import { providersRouter } from './routes-providers';
import { startRealtimeBridge } from './realtime';
import { pool, closeDbPools } from './db';
import { ProviderRegistry } from '../integrations/shared/ProviderRegistry';
import { BrgpsProvider } from '../integrations/brgps/BrgpsProvider';

const PORT = Number(process.env.PORT) || 4000;
const HOST = '0.0.0.0'; // Railway roteia pra dentro do container por IP, não por "localhost".

// HOMOLOGATION-READINESS-REPORT.md, Fase 5 (CORS): CORS_ORIGIN aceita uma
// lista separada por vírgula (ex.: domínio de produção + previews da
// Vercel), não só um único valor — antes só suportava string única. Sem
// CORS_ORIGIN definido, cai em '*' (mesmo default de sempre, mantido só
// pra não quebrar quem já roda em dev sem configurar nada) — em
// produção/homologação pública isso precisa ser setado explicitamente pro
// domínio real do frontend (ver relatório, Fase 5: não deixar '*' em
// homologação pública sem necessidade técnica).
const CORS_ORIGIN_RAW = process.env.CORS_ORIGIN || '*';
const CORS_ORIGIN: string | string[] =
  CORS_ORIGIN_RAW === '*' ? '*' : CORS_ORIGIN_RAW.split(',').map((o) => o.trim()).filter(Boolean);

// Multi-provider (brief seção 4): 'brgps' é o provider real; 'heile' e
// 'jason' são aliases pro mesmo fornecedor (mesmo token, mesmos endpoints —
// ver server/integrations/shared/TrackingProvider.ts). BRGPS_BASE_URL/
// BRGPS_API_TOKEN continuam sendo a fonte de verdade — HEILE_API_KEY/
// JASON_API_TOKEN no .env, quando definidos, têm que apontar pro mesmo valor.
if (process.env.BRGPS_ENABLED === 'true' && process.env.BRGPS_BASE_URL && process.env.BRGPS_API_TOKEN) {
  const brgpsProvider = new BrgpsProvider(
    { baseUrl: process.env.BRGPS_BASE_URL, apiToken: process.env.BRGPS_API_TOKEN },
    pool
  );
  ProviderRegistry.register(brgpsProvider, ['heile', 'jason']);
} else {
  console.warn('[api] Provider BRGPS/Heile/Jason não registrado — BRGPS_ENABLED/BASE_URL/TOKEN ausentes no .env.');
}

const app = express();
// Necessário pra express-rate-limit (server/api/routes-auth.ts) enxergar o IP
// real do cliente em vez do IP interno do proxy — Railway/Vercel sempre ficam
// na frente da API em produção.
app.set('trust proxy', 1);
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// HOMOLOGATION-READINESS-REPORT.md, Fase 1: healthcheck do Railway (e
// qualquer monitor externo) — {status:'ok'} é o formato pedido nesta
// rodada; {ok:true} mantido também porque é o que já existia (sem
// consumidor conhecido dependendo dele, mas sem necessidade de quebrar).
app.get('/health', (_req, res) => res.json({ status: 'ok', ok: true }));
app.use('/auth', authRouter);
app.use('/rest', restRouter);
app.use('/providers', providersRouter);

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, { cors: { origin: CORS_ORIGIN } });

async function main() {
  await startRealtimeBridge(io);
  httpServer.listen(PORT, HOST, () => {
    console.log(`[api] Listening on ${HOST}:${PORT}`);
  });
}

main().catch((err) => {
  console.error('[api] Failed to start:', err.message);
  process.exit(1);
});

// HOMOLOGATION-READINESS-REPORT.md, Fase 1 (shutdown gracioso): Railway
// manda SIGTERM antes de derrubar/trocar o processo (deploy novo, restart,
// scale down). Sem isso, requisições em voo eram cortadas abruptamente e a
// conexão com o Postgres não era fechada de forma limpa. Para de aceitar
// conexão nova, deixa o que já está em voo terminar, fecha as pools do
// banco, e só então sai.
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[api] ${signal} recebido — encerrando graciosamente...`);
  io.close();
  httpServer.close(async (err) => {
    if (err) console.error('[api] Erro ao fechar o servidor HTTP:', err.message);
    try {
      await closeDbPools();
    } catch (poolErr) {
      console.error('[api] Erro ao fechar pools do banco:', (poolErr as Error).message);
    }
    process.exit(err ? 1 : 0);
  });
  // Não trava o processo indefinidamente se alguma conexão HTTP ficar presa
  // (ex.: long-polling do Socket.IO que não fecha sozinho a tempo).
  setTimeout(() => {
    console.warn('[api] Timeout no shutdown gracioso — forçando saída.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
