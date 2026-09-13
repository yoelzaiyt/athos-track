// Consolidação do Postgres de produção (Railway) — uso ÚNICO, 12/09/2026.
//
// Contexto: o banco de produção tinha schema mas nunca teve ledger, e estava
// ~20 migrations atrás. O estado era misto (20260828010000 aplicada à mão, as
// anteriores 20260818000000/20260828000000 não). Este script põe o banco em dia
// e cria o ledger, com uma decisão explícita do dono do projeto:
//
//   PRODUÇÃO FICA SÓ COM OS REGISTROS ATUAIS — 1 cliente (ATHOS-01) e os 10
//   carrinhos da conta BRGPS 1 (CART-3092524666 … CART-3092533124).
//
// Por isso as migrations que criariam tenants/ativos novos (São João, Zaffari,
// CAR-03) NÃO rodam: entram no ledger com adopted=true, que é exatamente a
// semântica de "registrado sem executar". As três migrations mistas rodam só a
// parte DDL (constraints, coluna enabled_modules e a tabela
// tag_tenant_transfers), porque o app depende desse schema.
//
// Observação registrada na análise: as 10 tags que
// 20260910100200_register_zaffari_tags criaria são exatamente os 10 carrinhos
// que já existem em produção — só que sob ATHOS-01, não sob um tenant Zaffari.
// Manter como está é a decisão tomada.
//
// Pré-requisito: túnel aberto noutro terminal —
//   railway connect Postgres --tunnel-only -P 54329
//
// Uso (uma das duas formas):
//   PROBE_URL='postgresql://...' npx tsx scripts/consolidate-railway-prod.ts
//   TUNNEL_FILE=<arquivo com a saída do railway connect> npx tsx scripts/consolidate-railway-prod.ts

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { Client } from 'pg';
import { sha256 } from '../server/db/migrationLedger.ts';

const LEDGER = 'athos_schema_migrations';
const migDir = path.join(process.cwd(), 'supabase', 'migrations');
const dbDir = path.join(process.cwd(), 'server', 'db');

const connUrl =
  process.env.PROBE_URL ??
  (process.env.TUNNEL_FILE
    ? (readFileSync(process.env.TUNNEL_FILE, 'utf-8').match(/URL:\s+(\S+)/) ?? [])[1]
    : undefined);
if (!connUrl) {
  throw new Error(
    'Defina PROBE_URL, ou TUNNEL_FILE apontando pra saída de:\n' +
      '  railway connect Postgres --tunnel-only -P 54329'
  );
}

// Mesma ordem canônica de server/db/migrate.ts (collectSqlFiles).
const files: { label: string; sql: string }[] = [];
files.push({ label: '00_bootstrap.sql', sql: readFileSync(path.join(dbDir, '00_bootstrap.sql'), 'utf-8') });
for (const f of readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()) {
  files.push({ label: `supabase/migrations/${f}`, sql: readFileSync(path.join(migDir, f), 'utf-8') });
}
for (const f of ['01_add_password_auth.sql', '02_realtime_notify.sql', '03_api_keys.sql', '04_integration_provider.sql']) {
  files.push({ label: f, sql: readFileSync(path.join(dbDir, f), 'utf-8') });
}

// Já presentes no banco — cada um verificado objeto a objeto antes de escrever
// este script (função auth.role, user_profiles.password_hash, trigger
// assets_notify_update, tabela api_keys, coluna assets.provider,
// user_profiles.session_version).
const ALREADY = new Set([
  '00_bootstrap.sql',
  '01_add_password_auth.sql',
  '02_realtime_notify.sql',
  '03_api_keys.sql',
  '04_integration_provider.sql',
  'supabase/migrations/20260828010000_add_session_revocation.sql',
]);

// Dados de negócio dispensados por decisão do dono do projeto.
const SKIP_DATA = new Set([
  'supabase/migrations/20260906200000_link_brgps_3092524777_asset.sql',
  'supabase/migrations/20260910110000_link_zaffari_tags_to_brgps2_devices.sql',
  'supabase/migrations/20260912000000_register_sao_joao_boxes.sql',
]);

// Mistas: só a DDL roda; o DML que cria tenant/ativo fica de fora.
const DDL_ONLY: Record<string, string> = {
  'supabase/migrations/20260828020000_add_box_category_and_tenants.sql': `
    alter table assets drop constraint if exists assets_category_check;
    alter table assets add constraint assets_category_check check (category in (
      'cart', 'vehicle', 'truck', 'forklift', 'asset', 'bike', 'cargo', 'box', 'tag', 'agro'
    ));
    alter table company_clients add column if not exists enabled_modules jsonb not null default '["assets"]'::jsonb;`,

  'supabase/migrations/20260910100100_transfer_car01_car03_to_sao_joao.sql': `
    create table if not exists tag_tenant_transfers (
      id uuid primary key default gen_random_uuid(),
      asset_id uuid not null references assets(id) on delete restrict,
      tag_imei text not null,
      old_client_id uuid references company_clients(id),
      new_client_id uuid not null references company_clients(id),
      old_unit_id uuid references company_units(id),
      new_unit_id uuid references company_units(id),
      performed_by text not null,
      reason text not null,
      transferred_at timestamptz not null default now()
    );
    create index if not exists idx_tag_tenant_transfers_asset on tag_tenant_transfers(asset_id);
    alter table tag_tenant_transfers enable row level security;
    drop policy if exists tag_tenant_transfers_app_role on tag_tenant_transfers;
    create policy tag_tenant_transfers_app_role on tag_tenant_transfers for all using (true) with check (true);`,

  'supabase/migrations/20260910100200_register_zaffari_tags.sql': `
    alter table assets drop constraint if exists assets_status_check;
    alter table assets add constraint assets_status_check check (status in (
      'online', 'offline', 'moving', 'stopped', 'out_of_geofence',
      'low_battery', 'maintenance', 'available', 'in_use', 'awaiting_first_signal'
    ));`,
};

// Tudo até esta migration (inclusive) já estava no banco.
const APPLIED_THROUGH = 'supabase/migrations/20260815060000_add_brgps_provider_integration.sql';

const PLACEHOLDER = '__ATHOS_APP_RW_PASSWORD__';

// Senha da role athos_app_rw (RLS real). A migration 20260828030000 traz um
// placeholder que nunca teve substituição no repo — se rodasse como estava, a
// role nasceria com a senha literal versionada em Git. Gerada aqui e gravada
// em .backups/ (gitignored) pra ir depois pro APP_DATABASE_URL.
const password = randomBytes(24).toString('base64url');

async function main() {
  const client = new Client({ connectionString: connUrl, ssl: false });
  await client.connect();
  console.log('Conectado ao Postgres de produção.\n');

  await client.query(`
    create table if not exists ${LEDGER} (
      label text primary key,
      checksum text not null,
      applied_at timestamptz not null default now(),
      adopted boolean not null default false
    )
  `);

  let ran = 0;
  let adoptedCount = 0;

  for (const { label, sql } of files) {
    const checksum = sha256(sql);
    let mode: string;
    let toRun: string | null;

    if (ALREADY.has(label) || label <= APPLIED_THROUGH) {
      mode = 'já aplicada ';
      toRun = null;
    } else if (SKIP_DATA.has(label)) {
      mode = 'DISPENSADA  ';
      toRun = null;
    } else if (DDL_ONLY[label]) {
      mode = 'só DDL      ';
      toRun = DDL_ONLY[label];
    } else {
      mode = 'APLICANDO   ';
      toRun = sql.split(PLACEHOLDER).join(password);
    }

    // adopted=true = está no ledger sem ter rodado como escrita no arquivo.
    const adopted = toRun === null || Boolean(DDL_ONLY[label]);

    try {
      await client.query('begin');
      if (toRun) await client.query(toRun);
      await client.query(
        `insert into ${LEDGER} (label, checksum, adopted) values ($1, $2, $3)
         on conflict (label) do nothing`,
        [label, checksum, adopted]
      );
      await client.query('commit');
      if (toRun) ran++;
      else adoptedCount++;
      console.log(`  ${mode} ${label.replace('supabase/migrations/', '')}`);
    } catch (err) {
      await client.query('rollback').catch(() => {});
      console.error(`\nFALHOU em ${label}:`);
      console.error('  ' + (err as Error).message.split('\n')[0]);
      console.error('Nada desse arquivo ficou aplicado (rollback). Ledger não mente.');
      await client.end();
      process.exit(1);
    }
  }

  mkdirSync('.backups', { recursive: true });
  writeFileSync('.backups/athos_app_rw_password.txt', password + '\n', 'utf-8');

  console.log(`\n${ran} arquivo(s) executado(s), ${adoptedCount} registrado(s) sem executar.`);
  console.log('Senha da role athos_app_rw gravada em .backups/athos_app_rw_password.txt');
  console.log('Próximo passo: pôr APP_DATABASE_URL (com essa senha) nas variáveis do Railway.');

  await client.end();
}

main().catch((err) => {
  console.error('ERRO:', (err as Error).message);
  process.exit(1);
});
