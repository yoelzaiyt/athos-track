// Aplica, em ordem, o schema completo num Postgres novo (o do Railway):
//   1. server/db/00_bootstrap.sql        — shim mínimo do schema `auth` do Supabase
//   2. supabase/migrations/*.sql         — schema original, sem nenhuma edição
//   3. server/db/01_add_password_auth.sql — coluna de senha pra API própria
//   4. server/db/02_realtime_notify.sql   — triggers de LISTEN/NOTIFY
//
// Idempotente na medida em que os próprios arquivos são (todos usam
// `if not exists` / `create or replace` / `drop ... if exists`), exceto as
// migrations históricas do Supabase, que não são re-executáveis por design
// (mesma limitação que já existia rodando contra o Supabase). Rodar uma vez
// contra um banco vazio.
//
// Uso: DATABASE_URL=postgresql://... npx tsx server/db/migrate.ts

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, '..', '..');

function loadEnvFile() {
  try {
    const content = readFileSync(path.join(projectDir, '.env'), 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const i = trimmed.indexOf('=');
      if (i === -1) continue;
      const key = trimmed.slice(0, i);
      let value = trimmed.slice(i + 1);
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // sem .env local (ex: rodando direto no Railway com env vars do painel) — ok.
  }
}

loadEnvFile();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('FALHOU: defina DATABASE_URL (a connection string do Postgres do Railway).');
  process.exit(1);
}

const supabaseMigrationsDir = path.join(projectDir, 'supabase', 'migrations');

function collectSqlFiles(): { label: string; sql: string }[] {
  const files: { label: string; sql: string }[] = [];

  files.push({
    label: '00_bootstrap.sql',
    sql: readFileSync(path.join(__dirname, '00_bootstrap.sql'), 'utf-8'),
  });

  const migrationFiles = readdirSync(supabaseMigrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const f of migrationFiles) {
    files.push({ label: `supabase/migrations/${f}`, sql: readFileSync(path.join(supabaseMigrationsDir, f), 'utf-8') });
  }

  files.push({
    label: '01_add_password_auth.sql',
    sql: readFileSync(path.join(__dirname, '01_add_password_auth.sql'), 'utf-8'),
  });
  files.push({
    label: '02_realtime_notify.sql',
    sql: readFileSync(path.join(__dirname, '02_realtime_notify.sql'), 'utf-8'),
  });

  return files;
}

async function main() {
  const client = new Client({ connectionString: databaseUrl, ssl: databaseUrl!.includes('railway') ? { rejectUnauthorized: false } : undefined });
  await client.connect();
  console.log('Conectado ao Postgres.');

  const files = collectSqlFiles();
  for (const { label, sql } of files) {
    process.stdout.write(`Aplicando ${label}... `);
    try {
      await client.query(sql);
      console.log('OK');
    } catch (err) {
      console.log('FALHOU');
      await client.end();
      throw err;
    }
  }

  await client.end();
  console.log('Schema aplicado com sucesso.');
}

main().catch((err) => {
  console.error('Erro:', err.message);
  process.exitCode = 1;
});
