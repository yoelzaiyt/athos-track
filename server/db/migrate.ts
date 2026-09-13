// Aplica, em ordem, o schema completo num Postgres novo SEM ser Supabase
// (ex: Railway, local): server/db/00_bootstrap.sql cria um schema `auth`
// mínimo e SOBRESCREVE auth.role()/auth.uid() com stubs — nunca rodar este
// script inteiro contra um projeto Supabase real, isso quebraria as funções
// nativas do GoTrue. Contra Supabase, aplique só os passos 3/4 à mão
// (server/db/01_add_password_auth.sql, server/db/02_realtime_notify.sql).
//   1. server/db/00_bootstrap.sql        — shim mínimo do schema `auth`
//   2. supabase/migrations/*.sql         — schema original, sem nenhuma edição
//   3. server/db/01_add_password_auth.sql — coluna de senha pra API própria
//   4. server/db/02_realtime_notify.sql   — triggers de LISTEN/NOTIFY
//   5. server/db/03_api_keys.sql          — tabela de chaves de API
//   6. server/db/04_integration_provider.sql — system_integrations.provider
//   7. server/db/05_api_keys_tenant.sql    — api_keys.client_id/created_by
//
// LEDGER: o que já foi aplicado fica registrado em `athos_schema_migrations`,
// e cada arquivo roda UMA vez só. Isso existe porque as migrations históricas
// do Supabase NÃO são reexecutáveis por design — antes do ledger, rodar este
// script duas vezes no mesmo banco era imprevisível.
//
// Modos:
//   (padrão)          aplica só o que falta, cada arquivo numa transação
//   --check           somente leitura: diz o que falta e sai. NÃO escreve nada
//   --baseline        marca tudo como aplicado SEM rodar (banco já migrado à
//                     mão, que só precisa passar a ser rastreado)
//   --baseline-until=<trecho do label>
//                     idem, mas só até esse arquivo (inclusive) — o resto
//                     continua pendente e é aplicado no próximo run normal
//
// Trava de segurança: num banco que já tem schema mas ainda não tem ledger, o
// modo padrão se RECUSA a rodar (é exatamente o caso em que reexecutar as
// migrations históricas quebra o banco). Rode --check, depois --baseline.
//
// Uso: DATABASE_URL=postgresql://... npx tsx server/db/migrate.ts [--check]

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Client } from 'pg';
import {
  computeDrift,
  isUpToDate,
  resolveBaselineCutoff,
  sha256,
  type LedgerRecord,
  type SqlFile,
} from './migrationLedger.ts';
import { sslFor } from './connectionSsl';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, '..', '..');

const LEDGER_TABLE = 'athos_schema_migrations';

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
  console.error('FALHOU: defina DATABASE_URL (a connection string do Postgres).');
  process.exit(1);
}

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const baselineAll = args.includes('--baseline');
const baselineUntilArg = args.find((a) => a.startsWith('--baseline-until='));
const baselineUntil = baselineUntilArg ? baselineUntilArg.split('=')[1] : null;

const supabaseMigrationsDir = path.join(projectDir, 'supabase', 'migrations');

function collectSqlFiles(): SqlFile[] {
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
  files.push({
    label: '03_api_keys.sql',
    sql: readFileSync(path.join(__dirname, '03_api_keys.sql'), 'utf-8'),
  });
  files.push({
    label: '04_integration_provider.sql',
    sql: readFileSync(path.join(__dirname, '04_integration_provider.sql'), 'utf-8'),
  });
  files.push({
    label: '05_api_keys_tenant.sql',
    sql: readFileSync(path.join(__dirname, '05_api_keys_tenant.sql'), 'utf-8'),
  });

  return files.map((f) => ({ ...f, checksum: sha256(f.sql) }));
}

// A migration 20260828030000 (RLS real) cria a role athos_app_rw com o
// placeholder __ATHOS_APP_RW_PASSWORD__. O comentário dela sempre prometeu
// que o valor viria de ATHOS_APP_RW_PASSWORD "em tempo de aplicação", mas a
// substituição nunca existiu em lugar nenhum do repo: rodando como estava, a
// role que tem select/insert/update/delete em TODAS as tabelas nasceria com
// uma senha literal versionada em Git. Substituído aqui, na hora de executar
// — nunca no checksum, pra que o hash do ledger dependa do arquivo e não da
// senha do ambiente.
const PASSWORD_PLACEHOLDER = '__ATHOS_APP_RW_PASSWORD__';

function resolvePlaceholders(label: string, sql: string): string {
  if (!sql.includes(PASSWORD_PLACEHOLDER)) return sql;

  const password = process.env.ATHOS_APP_RW_PASSWORD;
  if (!password) {
    throw new Error(
      `${label} cria a role athos_app_rw e exige ATHOS_APP_RW_PASSWORD no ambiente.
` +
        'Defina uma senha forte (a MESMA que vai em APP_DATABASE_URL) e rode de novo.'
    );
  }
  if (password.length < 16) {
    throw new Error('ATHOS_APP_RW_PASSWORD precisa ter pelo menos 16 caracteres.');
  }
  if (password.includes("'") || password.includes('\\')) {
    throw new Error(
      "ATHOS_APP_RW_PASSWORD não pode conter aspa simples nem barra invertida — " +
        'o valor vai dentro de um literal SQL na migration.'
    );
  }
  return sql.split(PASSWORD_PLACEHOLDER).join(password);
}

function newClient(): Client {
  return new Client({
    connectionString: databaseUrl,
    ssl: sslFor(databaseUrl!),
  });
}

async function ledgerExists(client: Client): Promise<boolean> {
  const res = await client.query('select to_regclass($1) as reg', [LEDGER_TABLE]);
  return res.rows[0].reg !== null;
}

// "Banco já tem schema" = a tabela central da aplicação existe. Usado só pela
// trava de segurança; um banco vazio (CI) não dispara nada.
async function schemaExists(client: Client): Promise<boolean> {
  const res = await client.query(`select to_regclass('company_clients') as reg`);
  return res.rows[0].reg !== null;
}

async function ensureLedger(client: Client): Promise<void> {
  await client.query(`
    create table if not exists ${LEDGER_TABLE} (
      label text primary key,
      checksum text not null,
      applied_at timestamptz not null default now(),
      adopted boolean not null default false
    )
  `);
}

async function readLedger(client: Client): Promise<Map<string, LedgerRecord>> {
  const res = await client.query(`select label, checksum, adopted from ${LEDGER_TABLE}`);
  return new Map(res.rows.map((r) => [r.label, { checksum: r.checksum, adopted: r.adopted }]));
}

async function runCheck(client: Client, files: SqlFile[]): Promise<number> {
  const hasLedger = await ledgerExists(client);
  const hasSchema = await schemaExists(client);

  console.log(`Arquivos no repo: ${files.length}`);
  console.log(`Ledger (${LEDGER_TABLE}): ${hasLedger ? 'presente' : 'AUSENTE'}`);
  console.log(`Schema da aplicação: ${hasSchema ? 'presente' : 'banco vazio'}`);

  if (!hasLedger) {
    if (!hasSchema) {
      console.log('\nBanco vazio e sem ledger: um run normal aplica os ' + files.length + ' arquivos do zero.');
      return 1;
    }
    console.log(
      '\nEste banco TEM schema mas NÃO tem ledger — não é possível afirmar, a partir daqui,\n' +
        'quais migrations já foram aplicadas (o registro nunca existiu). Não deduza pelo\n' +
        'nome dos arquivos. Confira à mão o que falta (as colunas/tabelas das migrations\n' +
        'mais recentes), e depois adote o estado atual com:\n' +
        '  npx tsx server/db/migrate.ts --baseline-until=<último arquivo realmente aplicado>\n' +
        'A partir daí o run normal aplica só o resto, e --check passa a valer.'
    );
    return 2;
  }

  const applied = await readLedger(client);
  const drift = computeDrift(files, applied);
  const { pending, changed, unknown } = drift;

  console.log(`Registradas como aplicadas: ${applied.size}`);

  if (pending.length) {
    console.log(`\nPENDENTES (${pending.length}) — em ordem de aplicação:`);
    for (const f of pending) console.log(`  - ${f.label}`);
  }
  if (changed.length) {
    console.log(
      `\nALTERADAS DEPOIS DE APLICADAS (${changed.length}) — o arquivo no repo mudou desde que rodou.\n` +
        'O banco NÃO reflete o conteúdo atual; um run normal não vai reaplicar:'
    );
    for (const f of changed) console.log(`  - ${f.label}`);
  }
  if (unknown.length) {
    console.log(
      `\nNO LEDGER MAS NÃO NO REPO (${unknown.length}) — arquivo removido/renomeado depois de aplicado:`
    );
    for (const label of unknown) console.log(`  - ${label}`);
  }

  if (isUpToDate(drift)) {
    console.log('\nEm dia: nada pendente, nada divergente.');
    return 0;
  }
  return 1;
}

async function runBaseline(client: Client, files: SqlFile[]): Promise<void> {
  await ensureLedger(client);
  const applied = await readLedger(client);

  const cutoff = resolveBaselineCutoff(files, baselineUntil);

  const target = files.slice(0, cutoff).filter((f) => !applied.has(f.label));
  if (!target.length) {
    console.log('Nada a adotar: todos esses arquivos já estão no ledger.');
    return;
  }

  console.log(`Adotando ${target.length} arquivo(s) como já aplicados — SEM executar o SQL:`);
  for (const f of target) {
    await client.query(
      `insert into ${LEDGER_TABLE} (label, checksum, adopted) values ($1, $2, true) on conflict (label) do nothing`,
      [f.label, f.checksum]
    );
    console.log(`  adotado  ${f.label}`);
  }
  const remaining = files.length - cutoff;
  console.log(
    `\nFeito. ${remaining} arquivo(s) seguem pendentes` +
      (remaining ? ' — rode o modo padrão para aplicá-los.' : '.')
  );
}

async function runApply(client: Client, files: SqlFile[]): Promise<void> {
  const hasLedger = await ledgerExists(client);
  if (!hasLedger && (await schemaExists(client))) {
    throw new Error(
      'ABORTADO: este banco já tem schema mas não tem ledger de migrations.\n' +
        'Reaplicar as migrations históricas do Supabase aqui é destrutivo (elas não são\n' +
        'reexecutáveis). Rode primeiro:\n' +
        '  npx tsx server/db/migrate.ts --check\n' +
        'e depois adote o estado atual com --baseline-until=<último arquivo aplicado>.'
    );
  }

  await ensureLedger(client);
  const applied = await readLedger(client);

  const pending = files.filter((f) => !applied.has(f.label));
  const skipped = files.length - pending.length;
  if (skipped) console.log(`${skipped} arquivo(s) já no ledger — pulando.`);
  if (!pending.length) {
    console.log('Nada a aplicar: schema em dia.');
    return;
  }

  for (const { label, sql, checksum } of pending) {
    process.stdout.write(`Aplicando ${label}... `);
    // Arquivo + registro no ledger na MESMA transação: se o SQL falhar no meio,
    // nada fica aplicado pela metade e o ledger não mente sobre o que rodou.
    try {
      await client.query('begin');
      await client.query(resolvePlaceholders(label, sql));
      await client.query(`insert into ${LEDGER_TABLE} (label, checksum) values ($1, $2)`, [label, checksum]);
      await client.query('commit');
      console.log('OK');
    } catch (err) {
      await client.query('rollback').catch(() => {});
      console.log('FALHOU (revertido)');
      throw err;
    }
  }

  console.log(`Schema aplicado com sucesso (${pending.length} arquivo(s)).`);
}

async function main() {
  const client = newClient();
  await client.connect();
  console.log('Conectado ao Postgres.');

  const files = collectSqlFiles();

  try {
    if (checkOnly) {
      process.exitCode = await runCheck(client, files);
      return;
    }
    if (baselineAll || baselineUntil) {
      await runBaseline(client, files);
      return;
    }
    await runApply(client, files);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Erro:', err.message);
  process.exitCode = 1;
});
