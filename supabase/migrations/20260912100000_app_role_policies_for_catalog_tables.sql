-- Fecha um buraco aberto pela consolidação de 12/09/2026.
--
-- 20260828030000_real_rls_defense_in_depth ligou RLS e criou, para cada
-- tabela, uma policy que a role athos_app_rw (a que serve toda query de
-- usuário via withTenantContext) consegue usar. Mas ela só cobriu as tabelas
-- que existiam naquele momento.
--
-- As tabelas de catálogo criadas DEPOIS (20260904120000, 20260906220000,
-- 20260906220100 e as de integração) nasceram com RLS ligada e policy
-- restrita à role `authenticated` — herança da era Supabase, que a
-- athos_app_rw não alcança. Efeito: com RLS ativa e nenhuma policy aplicável,
-- o Postgres devolve ZERO linhas, sem erro nenhum.
--
-- Medido em produção antes desta correção, servindo pela API:
--   asset_types            8 linhas -> 0 visíveis
--   integration_channels   5 linhas -> 0 visíveis
--   gt06_homolog_devices   1 linha  -> 0 visíveis
--
-- Ou seja: catálogo de tipos de ativo, canais de integração e o cadastro de
-- homologação sumiriam da UI silenciosamente.
--
-- São tabelas de referência compartilhada (não têm client_id, valem para
-- todos os tenants), então recebem o mesmo tratamento que traffic_segments e
-- points_of_interest já receberam em 20260828030000: policy permissiva para a
-- role da aplicação. O isolamento por tenant continua valendo nas tabelas que
-- de fato têm dono.
--
-- Rollback: drop policy <tabela>_app_role on <tabela>;

do $$
declare
  t text;
  catalogo text[] := array[
    'asset_types',
    'device_identifiers',
    'device_models',
    'gt06_homolog_devices',
    'integration_channels',
    'protocol_families',
    'vendors'
  ];
begin
  foreach t in array catalogo loop
    -- Tabela pode não existir num banco mais novo/antigo que este ponto.
    if to_regclass('public.' || t) is null then
      raise notice 'tabela % ausente — pulando', t;
      continue;
    end if;

    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_app_role', t);
    execute format(
      'create policy %I on %I for all using (true) with check (true)',
      t || '_app_role', t
    );
  end loop;
end $$;
