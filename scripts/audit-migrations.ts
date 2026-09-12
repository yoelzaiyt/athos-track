// Auditoria SOMENTE LEITURA: para cada migration do repo, procura no banco um
// marcador (tabela, coluna, policy, role, constraint ou dado) que só existe se
// ela foi aplicada. Serve para bancos sem ledger (athos_schema_migrations),
// onde `npm run db:check` não consegue dizer o que falta.
//
// Tudo roda dentro de uma transação READ ONLY — o Postgres recusa qualquer
// escrita, mesmo que um marcador seja escrito errado.
//
// Resultado de cada linha:
//   OK       marcador encontrado — aplicada
//   FALTA    marcador ausente — provavelmente NÃO aplicada
//   ?        sem marcador confiável — conferir à mão
// Marcadores de DADO (inserts/updates) são indicativos: o dado pode ter sido
// alterado depois por outro caminho.
//
// Pré-requisito: túnel aberto noutro terminal —
//   railway connect Postgres --tunnel-only -P 54329
// Uso:
//   PROBE_URL='postgresql://postgres:<senha>@127.0.0.1:54329/railway' npx tsx scripts/audit-migrations.ts

import { Client } from 'pg';

type Probe = { label: string; kind: 'schema' | 'dado' | '?'; sql?: string };

const col = (t: string, c: string) =>
  `select exists (select 1 from information_schema.columns where table_schema='public' and table_name='${t}' and column_name='${c}')`;
const table = (t: string) => `select to_regclass('public.${t}') is not null`;
const policy = (t: string, p: string) =>
  `select exists (select 1 from pg_policies where schemaname='public' and tablename='${t}' and policyname='${p}')`;

const ZAFFARI = `('3092524960','3092524712','3092533124','3092524666','3092533106','3092524840','3092524939','3092533107','3092524906','3092533120')`;

const probes: Probe[] = [
  { label: '00_bootstrap.sql', kind: 'schema', sql: `select to_regnamespace('auth') is not null` },
  { label: '20260813120000_init_schema', kind: 'schema', sql: table('company_clients') },
  { label: '20260813130000_relax_display_time_columns', kind: '?' },
  { label: '20260813140000_add_asset_denormalized_names', kind: 'schema', sql: col('assets', 'unit_name') },
  // A policy *_authenticated_only é derrubada de propósito por 20260828030000;
  // depois dela, a ausência não indica que esta migration faltou.
  {
    label: '20260813150000_require_authenticated_rls',
    kind: 'schema',
    sql: `select ${policy('assets', 'assets_authenticated_only').replace(/^select /, '')} or exists (select 1 from pg_roles where rolname='athos_app_rw')`,
  },
  { label: '20260814160000_add_homologation_tables', kind: 'schema', sql: table('homologation_requests') },
  { label: '20260814161000_add_homologation_admin_notes', kind: 'schema', sql: col('homologation_requests', 'admin_notes') },
  { label: '20260815000000_add_asset_alert_config', kind: 'schema', sql: col('assets', 'alert_config') },
  { label: '20260815050000_add_field_recovery_occurrences', kind: 'schema', sql: table('recovery_occurrences') },
  { label: '20260815051000_add_recovery_return_destination', kind: 'schema', sql: col('recovery_occurrences', 'return_destination_lat') },
  { label: '20260815060000_add_brgps_provider_integration', kind: 'schema', sql: col('assets', 'provider_device_id') },
  {
    label: '20260816000000_add_gt06_alert_types',
    kind: 'schema',
    sql: `select exists (select 1 from pg_constraint where conname='system_alerts_type_check' and pg_get_constraintdef(oid) like '%device_removed%')`,
  },
  { label: '20260818000000_add_animals_table', kind: 'schema', sql: table('animals') },
  { label: '20260828000000_add_cargo_shipments_tenant', kind: 'schema', sql: col('cargo_shipments', 'client_id') },
  { label: '20260828010000_add_session_revocation', kind: 'schema', sql: col('user_profiles', 'session_version') },
  { label: '20260828020000_add_box_category_and_tenants', kind: 'schema', sql: col('company_clients', 'enabled_modules') },
  { label: '20260828030000_real_rls_defense_in_depth', kind: 'schema', sql: `select exists (select 1 from pg_roles where rolname='athos_app_rw')` },
  { label: '20260828040000_add_audit_logs', kind: 'schema', sql: table('audit_logs') },
  { label: '20260828050000_tenant_manager_fields', kind: 'schema', sql: col('company_clients', 'slug') },
  { label: '20260828060000_rbac_security_hardening', kind: 'schema', sql: policy('audit_logs', 'audit_logs_tenant_scoped') },
  { label: '20260904120000_add_gt06_homolog_devices', kind: 'schema', sql: table('gt06_homolog_devices') },
  { label: '20260906200000_link_brgps_3092524777_asset', kind: 'dado', sql: `select exists (select 1 from assets where imei='3092524777')` },
  {
    label: '20260906210000_online_status_and_cleanup_no_comm_tag',
    kind: 'dado',
    sql: `select not exists (select 1 from assets where imei='3092660181' and provider is null)`,
  },
  { label: '20260906220000_add_device_integration_catalog_core', kind: 'schema', sql: table('vendors') },
  { label: '20260906220100_add_device_identifiers', kind: 'schema', sql: table('device_identifiers') },
  {
    label: '20260910100000_add_route_points_client_id_for_transfer_isolation',
    kind: 'schema',
    sql: col('asset_route_points', 'client_id'),
  },
  { label: '20260910100100_transfer_car01_car03_to_sao_joao', kind: 'schema', sql: table('tag_tenant_transfers') },
  { label: '20260910100200_register_zaffari_tags', kind: 'dado', sql: `select count(*) = 10 from assets where imei in ${ZAFFARI}` },
  {
    label: '20260910110000_link_zaffari_tags_to_brgps2_devices',
    kind: 'dado',
    sql: `select count(*) = 10 from assets where imei in ${ZAFFARI} and provider = 'BRGPS_2'`,
  },
  {
    label: '20260910120000_fix_awaiting_signal_stuck_status',
    kind: 'dado',
    sql: `select not exists (select 1 from assets where status='awaiting_first_signal' and telemetry_packet_timestamp is not null)`,
  },
  {
    label: '20260910130000_fix_sao_joao_category_to_box',
    kind: 'dado',
    sql: `select count(*) = 2 from assets where imei in ('1603000067','3092524777') and category = 'box'`,
  },
  { label: '20260911010000_add_telemetry_server_received_at', kind: 'schema', sql: col('assets', 'telemetry_server_received_at') },
  {
    label: '20260912000000_register_sao_joao_boxes',
    kind: 'dado',
    sql: `select count(*) = 2 from assets where imei in ('1603000067','3092524777')`,
  },
  { label: '20260912100000_app_role_policies_for_catalog_tables', kind: 'schema', sql: policy('vendors', 'vendors_app_role') },
  { label: '01_add_password_auth.sql', kind: 'schema', sql: col('user_profiles', 'password_hash') },
  { label: '02_realtime_notify.sql', kind: 'schema', sql: `select to_regproc('public.notify_table_change') is not null` },
  { label: '03_api_keys.sql', kind: 'schema', sql: table('api_keys') },
  { label: '04_integration_provider.sql', kind: 'schema', sql: col('system_integrations', 'provider') },
];

async function main() {
  const url = process.env.PROBE_URL ?? 'postgresql://postgres@127.0.0.1:54329/railway';
  const client = new Client({
    connectionString: url,
    ssl: /127\.0\.0\.1|localhost/.test(url) ? false : { rejectUnauthorized: false },
  });
  await client.connect();

  const faltando: string[] = [];
  try {
    await client.query('begin read only');

    const ledger = await client.query(`select to_regclass('public.athos_schema_migrations') is not null as ok`);
    console.log(`Ledger athos_schema_migrations: ${ledger.rows[0].ok ? 'presente' : 'AUSENTE'}\n`);

    for (const p of probes) {
      if (!p.sql) {
        console.log(`  ?      ${p.label}  (sem marcador — conferir à mão)`);
        continue;
      }
      // Savepoint por marcador: um erro (ex.: tabela ausente numa query de dado)
      // não aborta a transação e as linhas seguintes continuam rodando.
      await client.query('savepoint p');
      try {
        const res = await client.query(p.sql);
        const ok = Object.values(res.rows[0])[0] === true;
        const tag = ok ? 'OK   ' : 'FALTA';
        console.log(`  ${tag}  ${p.label}${p.kind === 'dado' ? '  [dado]' : ''}`);
        if (!ok) faltando.push(p.label);
        await client.query('release savepoint p');
      } catch (err) {
        await client.query('rollback to savepoint p');
        console.log(`  ERRO   ${p.label}  (${(err as Error).message})`);
        faltando.push(p.label);
      }
    }

    await client.query('rollback');
  } finally {
    await client.end();
  }

  console.log(`\n${probes.length} migrations verificadas; ${faltando.length} com FALTA/ERRO.`);
}

main().catch((err) => {
  console.error('Erro:', err.message);
  process.exitCode = 1;
});
