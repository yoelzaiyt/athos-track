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
import { apiKeysRouter } from './apiKeys';
import { startRealtimeBridge } from './realtime';

const PORT = Number(process.env.PORT) || 4000;
// CORS_ORIGIN aceita uma ou mais origins separadas por vírgula (ex:
// "https://athos-track-delta.vercel.app,http://localhost:3000") para permitir
// deploy de produção e desenvolvimento local contra a mesma API.
const CORS_ORIGIN = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const corsOrigin = CORS_ORIGIN.length <= 1 ? CORS_ORIGIN[0] ?? '*' : CORS_ORIGIN;

const app = express();
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/auth', authRouter);
app.use('/rest', restRouter);
app.use('/api-keys', apiKeysRouter);

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, { cors: { origin: corsOrigin } });

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
