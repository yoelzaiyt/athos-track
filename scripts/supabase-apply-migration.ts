// Aplica UM arquivo de supabase/migrations/*.sql direto num Postgres do
// Supabase, via DIRECT_URL (pooler em modo sessão). Diferente de
// server/db/migrate.ts (que roda o pipeline inteiro incluindo
// 00_bootstrap.sql — isso sobrescreve auth.role()/auth.uid() com stubs e
// QUEBRA um projeto Supabase real), este script só roda o arquivo pedido,
// sem tocar em mais nada. Uso pontual pra migration nova que ainda não foi
// aplicada manualmente.
//
// Uso: npx tsx scripts/supabase-apply-migration.ts 20260904120000_add_gt06_homolog_devices.sql

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '..', '.env') });

const fileName = process.argv[2];
if (!fileName) {
  console.error('Uso: npx tsx scripts/supabase-apply-migration.ts <arquivo.sql em supabase/migrations/>');
  process.exit(1);
}

const filePath = path.resolve(__dirname, '..', 'supabase', 'migrations', fileName);
const sql = readFileSync(filePath, 'utf-8');

const connectionString = process.env.DIRECT_URL;
if (!connectionString) {
  console.error('FALHOU: defina DIRECT_URL no .env (pooler de sessão do Supabase).');
  process.exit(1);
}
if (!connectionString.includes('supabase')) {
  console.error('FALHOU: DIRECT_URL não parece apontar pro Supabase — abortando por segurança.');
  process.exit(1);
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();
  console.log(`Conectado. Aplicando ${fileName}...`);
  await client.query(sql);
  console.log('OK.');
  await client.end();
}

main().catch(async (err) => {
  console.error('FALHOU:', err.message);
  await client.end();
  process.exit(1);
});
