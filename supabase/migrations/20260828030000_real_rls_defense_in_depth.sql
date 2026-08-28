-- Fecha o "RLS morto" documentado em SECURITY-GATE-REPORT.md (Banco de
-- Dados — FAIL): a API conecta hoje via DATABASE_URL/DIRECT_URL como
-- postgres.<projeto>, role com BYPASSRLS, então nenhuma policy de RLS
-- tinha efeito real — todo o isolamento de tenant vivia só em
-- server/api/rest.ts.
--
-- Esta migration cria um SEGUNDO papel Postgres, sem BYPASSRLS, que a API
-- passa a usar pras queries de dado de tenant (server/api/db.ts,
-- withTenantContext). As policies abaixo leem duas GUCs de sessão que a API
-- define via set_config() dentro da mesma transação de cada requisição:
--   app.client_id  — client_id do usuário autenticado (vazio pra ATHOS_ADMIN)
--   app.is_admin   — 'true' quando role = ATHOS_ADMIN
--
-- Isso é DEFESA EM PROFUNDIDADE, não substitui rest.ts: se um bug futuro no
-- filtro da aplicação deixar passar uma query sem escopo de tenant, o banco
-- ainda recusa devolver/gravar linha de outro cliente. As duas camadas
-- espelham a mesma lógica (DIRECT_TENANT_COLUMN / ASSET_LINKED_COLUMN /
-- OCCURRENCE_LINKED_COLUMN de server/api/rest.ts), mas RLS aqui fica só no
-- nível de client_id — não reproduz o escopo por unit_id do app (SEC-006);
-- isso é aceitável pra uma segunda camada cujo objetivo é impedir o
-- vazamento mais grave (entre EMPRESAS diferentes), não ser uma cópia 1:1.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'athos_app_rw') then
    -- Senha NÃO fica neste arquivo (versionado no Git) — é substituída em
    -- tempo de aplicação a partir de ATHOS_APP_RW_PASSWORD (.env, não
    -- commitado). Ver scripts/apply-migration.ts / instruções de deploy.
    create role athos_app_rw login password '__ATHOS_APP_RW_PASSWORD__' noinherit;
  end if;
end $$;

alter role athos_app_rw set statement_timeout = '30s';

grant usage on schema public to athos_app_rw;
grant select, insert, update, delete on all tables in schema public to athos_app_rw;
-- Tabelas criadas depois desta migration também recebem grant automaticamente.
alter default privileges in schema public grant select, insert, update, delete on tables to athos_app_rw;

-- ===================== Tabelas com client_id direto =====================
do $$
declare
  t text;
  tables text[] := array[
    'assets', 'geofences', 'drivers', 'animals',
    'work_orders', 'greylist_entries', 'asset_recovery_cases', 'route_templates',
    'asset_pairings', 'recovery_occurrences',
    'cargo_shipments', 'user_profiles', 'company_units'
  ];
begin
  foreach t in array tables loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_authenticated_only', t);
    execute format('drop policy if exists %I on %I', t || '_authenticated_all', t);
    execute format('drop policy if exists %I on %I', t || '_tenant_scoped', t);
    execute format(
      $f$create policy %I on %I for all
         using (
           current_setting('app.is_admin', true) = 'true'
           or (
             coalesce(current_setting('app.client_id', true), '') <> ''
             and client_id::text = current_setting('app.client_id', true)
           )
         )
         with check (
           current_setting('app.is_admin', true) = 'true'
           or (
             coalesce(current_setting('app.client_id', true), '') <> ''
             and client_id::text = current_setting('app.client_id', true)
           )
         )$f$,
      t || '_tenant_scoped', t
    );
  end loop;
end $$;

-- ===================== company_clients: o tenant é a própria linha =====================
alter table company_clients enable row level security;
drop policy if exists company_clients_authenticated_only on company_clients;
drop policy if exists company_clients_tenant_scoped on company_clients;
create policy company_clients_tenant_scoped on company_clients for all
  using (
    current_setting('app.is_admin', true) = 'true'
    or (
      coalesce(current_setting('app.client_id', true), '') <> ''
      and id::text = current_setting('app.client_id', true)
    )
  )
  with check (
    current_setting('app.is_admin', true) = 'true'
    or (
      coalesce(current_setting('app.client_id', true), '') <> ''
      and id::text = current_setting('app.client_id', true)
    )
  );

-- ===================== Ligadas a assets via asset_id/vehicle_id =====================
do $$
declare
  rec record;
  mapping text[][] := array[
    array['system_alerts', 'asset_id'],
    array['cart_recoveries', 'asset_id'],
    array['provider_devices', 'asset_id'],
    array['asset_route_points', 'asset_id'],
    array['trip_records', 'vehicle_id'],
    array['maintenance_records', 'vehicle_id']
  ];
  i int;
  t text;
  col text;
begin
  for i in 1 .. array_length(mapping, 1) loop
    t := mapping[i][1];
    col := mapping[i][2];
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_authenticated_only', t);
    execute format('drop policy if exists %I on %I', t || '_authenticated_all', t);
    execute format('drop policy if exists %I on %I', t || '_tenant_scoped', t);
    execute format(
      $f$create policy %I on %I for all
         using (
           current_setting('app.is_admin', true) = 'true'
           or (
             coalesce(current_setting('app.client_id', true), '') <> ''
             and %I in (select id from assets where client_id::text = current_setting('app.client_id', true))
           )
         )
         with check (
           current_setting('app.is_admin', true) = 'true'
           or (
             coalesce(current_setting('app.client_id', true), '') <> ''
             and %I in (select id from assets where client_id::text = current_setting('app.client_id', true))
           )
         )$f$,
      t || '_tenant_scoped', t, col, col
    );
  end loop;
end $$;

-- ===================== recovery_timeline_events (via recovery_occurrences) =====================
alter table recovery_timeline_events enable row level security;
drop policy if exists recovery_timeline_events_authenticated_all on recovery_timeline_events;
drop policy if exists recovery_timeline_events_tenant_scoped on recovery_timeline_events;
create policy recovery_timeline_events_tenant_scoped on recovery_timeline_events for all
  using (
    current_setting('app.is_admin', true) = 'true'
    or (
      coalesce(current_setting('app.client_id', true), '') <> ''
      and occurrence_id in (select id from recovery_occurrences where client_id::text = current_setting('app.client_id', true))
    )
  )
  with check (
    current_setting('app.is_admin', true) = 'true'
    or (
      coalesce(current_setting('app.client_id', true), '') <> ''
      and occurrence_id in (select id from recovery_occurrences where client_id::text = current_setting('app.client_id', true))
    )
  );

-- ===================== Sem vínculo de tenant (referência compartilhada / fluxo ATHOS) =====================
-- traffic_segments, points_of_interest, provider_health, homologation_* — sem
-- coluna de tenant (ver SEC-002/011). RLS aqui só garante que a conexão é a
-- role dedicada da API (não anon/public direto); quem decide admin-only pra
-- homologation_*/escrita de referência continua sendo server/api/rest.ts.
do $$
declare
  t text;
  tables text[] := array[
    'traffic_segments', 'points_of_interest', 'provider_health',
    'homologation_requests', 'homologation_devices', 'homologation_events', 'homologation_reports',
    -- system_integrations não tem client_id/unit_id no schema real (confirmado
    -- ao vivo — correção de um erro da rodada anterior de SEC-002, que tinha
    -- assumido por engano que essa tabela era tenant-scoped). Guarda api_key
    -- de integrações; rest.ts trata como ADMIN_ONLY_READ_TABLES (bloqueia
    -- leitura e escrita pra não-admin) — aqui no banco fica só "role da API",
    -- igual às demais tabelas de referência sem tenant.
    'system_integrations'
  ];
begin
  foreach t in array tables loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_authenticated_only', t);
    execute format('drop policy if exists %I on %I', t || '_authenticated_all', t);
    execute format('drop policy if exists %I on %I', t || '_authenticated_select', t);
    execute format('drop policy if exists %I on %I', t || '_anon_insert', t);
    execute format('drop policy if exists %I on %I', t || '_app_role', t);
    execute format('create policy %I on %I for all using (true) with check (true)', t || '_app_role', t);
  end loop;
end $$;
