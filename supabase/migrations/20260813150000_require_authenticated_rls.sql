-- Fecha o buraco de segurança temporário da migration inicial: troca a policy
-- "allow all" (qualquer um com a anon key, logado ou não, lia/escrevia tudo)
-- por uma que exige sessão autenticada de verdade via Supabase Auth. Só faz
-- sentido agora porque AuthContext passou a usar supabase.auth de verdade
-- (login/logout reais) em vez do mock anterior.
--
-- Ainda não diferencia por role (ATHOS_ADMIN vs VIEWER etc.) nem por
-- clientId/unitId (multi-tenancy real) — qualquer usuário autenticado continua
-- vendo/editando os dados de todos os clientes. Isso é o próximo nível de
-- granularidade, não pedido ainda.

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'company_clients', 'company_units', 'user_profiles', 'geofences', 'assets',
      'drivers', 'maintenance_records', 'route_templates', 'trip_records',
      'asset_route_points', 'system_alerts', 'cargo_shipments', 'cart_recoveries',
      'system_integrations', 'work_orders', 'greylist_entries', 'asset_recovery_cases',
      'asset_pairings', 'traffic_segments', 'points_of_interest'
    ])
  loop
    execute format('drop policy if exists %I on %I', t || '_allow_all_temp', t);
    execute format(
      'create policy %I on %I for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')',
      t || '_authenticated_only', t
    );
  end loop;
end $$;
