// Dump lógico do banco — uma cópia de segurança antes de mexer em produção.
//
// Existe porque o plano atual do Railway NÃO tem backup automático nem PITR
// (a aba Backups do serviço diz que é só no Pro). Enquanto isso não mudar,
// rode isto antes de qualquer migration ou alteração manual de dado.
//
// Formato: um JSON por tabela, mais _schema_columns.json (colunas, tipos,
// nullability e defaults) e _manifest.json (contagem por tabela). Não é um
// pg_dump — não restaura sozinho — mas preserva todo o conteúdo, que é o que
// não dá pra reconstruir. O schema vem das migrations versionadas.
//
// Pré-requisito: túnel aberto noutro terminal —
//   railway connect Postgres --tunnel-only -P 54329
//
// Uso:
//   npm run db:dump                      (usa 127.0.0.1:54329, o padrão do túnel)
//   PROBE_URL='postgresql://...' npm run db:dump
//   DUMP_DIR=.backups/antes-da-x npm run db:dump

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

const TUNNEL_PADRAO = 'postgresql://postgres@127.0.0.1:54329/railway';

function resolveUrl(): string {
  if (process.env.PROBE_URL) return process.env.PROBE_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.TUNNEL_FILE) {
    const m = readFileSync(process.env.TUNNEL_FILE, 'utf-8').match(/URL:\s+(\S+)/);
    if (m) return m[1];
  }
  return TUNNEL_PADRAO;
}

async function main() {
  const url = resolveUrl();
  const client = new Client({
    connectionString: url,
    // Ponta local do túnel é TCP puro — o túnel já cifra ponta a ponta.
    ssl: /127\.0\.0\.1|localhost/.test(url) ? false : { rejectUnauthorized: false },
  });
  await client.connect();

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = process.env.DUMP_DIR ?? path.join('.backups', `railway-prod-${stamp}`);
  mkdirSync(dir, { recursive: true });

  const tabelas = await client.query(
    "select tablename from pg_tables where schemaname = 'public' order by tablename"
  );

  const manifest: Record<string, number> = {};
  for (const { tablename } of tabelas.rows) {
    const res = await client.query(`select * from public."${tablename}"`);
    writeFileSync(path.join(dir, `${tablename}.json`), JSON.stringify(res.rows, null, 2), 'utf-8');
    manifest[tablename] = res.rowCount ?? 0;
  }

  const colunas = await client.query(`
    select table_name, column_name, data_type, is_nullable, column_default
    from information_schema.columns
    where table_schema = 'public'
    order by table_name, ordinal_position
  `);
  writeFileSync(path.join(dir, '_schema_columns.json'), JSON.stringify(colunas.rows, null, 2), 'utf-8');

  const ledger = await client
    .query('select label, checksum, applied_at, adopted from athos_schema_migrations order by label')
    .catch(() => null);
  if (ledger) {
    writeFileSync(path.join(dir, '_ledger.json'), JSON.stringify(ledger.rows, null, 2), 'utf-8');
  }

  writeFileSync(
    path.join(dir, '_manifest.json'),
    JSON.stringify(
      {
        takenAt: new Date().toISOString(),
        host: url.replace(/\/\/[^@]+@/, '//***@'),
        tables: manifest,
        ledgerEntries: ledger?.rowCount ?? null,
      },
      null,
      2
    ),
    'utf-8'
  );

  const total = Object.values(manifest).reduce((a, b) => a + b, 0);
  console.log(`Dump em ${dir}`);
  console.log(`${tabelas.rowCount} tabelas, ${total} linhas.`);
  for (const [t, n] of Object.entries(manifest).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])) {
    console.log('  ' + String(n).padStart(7) + '  ' + t);
  }
  if (ledger) console.log(`Ledger: ${ledger.rowCount} registros.`);

  await client.end();
}

main().catch((err) => {
  console.error('FALHOU:', (err as Error).message);
  console.error('O túnel está aberto? railway connect Postgres --tunnel-only -P 54329');
  process.exit(1);
});
