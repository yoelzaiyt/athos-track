// Aplica um arquivo de migration SQL específico via DIRECT_URL — não há
// psql logado neste ambiente (mesma razão dos outros scripts em scripts/).
// Uso: npx tsx scripts/apply-migration.ts <nome-do-arquivo.sql>
//
// Substituiu scripts/supabase-apply-migration.ts (removido na consolidação
// num banco único no Railway): aquele abortava quando DIRECT_URL não
// continha "supabase", o que passou a barrar justamente o banco certo.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';
import { sslFor } from '../server/db/connectionSsl';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '../.env') });

const fileArg = process.argv[2];
if (!fileArg) {
  console.error('uso: npx tsx scripts/apply-migration.ts <nome-do-arquivo.sql>');
  process.exit(1);
}

const filePath = path.resolve(__dirname, '../supabase/migrations', fileArg);
const sql = fs.readFileSync(filePath, 'utf-8');

const connectionString = process.env.DIRECT_URL;
if (!connectionString) {
  console.error('FALHOU: defina DIRECT_URL no .env (conexão direta com o Postgres).');
  process.exit(1);
}

const client = new Client({ connectionString, ssl: sslFor(connectionString) });
await client.connect();
try {
  await client.query(sql);
  console.log(`[apply-migration] ${fileArg} aplicada com sucesso.`);
} finally {
  await client.end();
}
