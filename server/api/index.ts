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
import { pool } from './db';
import { ProviderRegistry } from '../integrations/shared/ProviderRegistry';
import { BrgpsProvider } from '../integrations/brgps/BrgpsProvider';

const PORT = Number(process.env.PORT) || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

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

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/auth', authRouter);
app.use('/rest', restRouter);
app.use('/providers', providersRouter);

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, { cors: { origin: CORS_ORIGIN } });

async function main() {
  await startRealtimeBridge(io);
  httpServer.listen(PORT, () => {
    console.log(`[api] Listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('[api] Failed to start:', err.message);
  process.exit(1);
});
