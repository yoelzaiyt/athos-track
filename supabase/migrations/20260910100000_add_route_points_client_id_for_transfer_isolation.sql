-- Pré-requisito pra transferência de tag entre tenants preservar isolamento
-- histórico (seção 9 do brief "TAG INTEGRATION + ZAFFARI + SÃO JOÃO"): "a
-- nova empresa não deverá automaticamente enxergar histórico pertencente ao
-- tenant anterior".
--
-- Hoje asset_route_points não tem client_id próprio — RLS/rest.ts escopam
-- por "asset_id in (select id from assets where client_id = tenant atual)"
-- (20260828030000_real_rls_defense_in_depth.sql, ASSET_LINKED_COLUMN em
-- server/api/rest.ts). Isso usa o client_id ATUAL do asset, não o de quando
-- o ponto foi gravado — então mudar assets.client_id (próxima migration)
-- reclassificaria retroativamente TODO o histórico antigo pro tenant novo.
-- No caso concreto (CAR-01/CAR-03, únicos 2 assets com histórico real hoje —
-- confirmado ao vivo, 20 linhas no total), esse histórico antigo é dado de
-- demonstração do fornecedor (docs/HARDWARE-CATALOG.md) gravado sob o tenant
-- demo — não pode "virar" histórico do São João só por causa da mudança de
-- tenant do asset.
--
-- Cada ponto passa a carregar o client_id vigente NO MOMENTO em que foi
-- gravado. Não apaga nem move nenhuma linha — só corrige o escopo de
-- visibilidade por tenant, preservando os pontos antigos como pertencentes
-- ao tenant de origem.

alter table asset_route_points add column if not exists client_id uuid references company_clients(id);

update asset_route_points rp
set client_id = a.client_id
from assets a
where rp.asset_id = a.id and rp.client_id is null;

alter table asset_route_points alter column client_id set not null;

create index if not exists idx_route_points_client on asset_route_points(client_id);

-- Substitui a policy criada em 20260828030000 (via ASSET_LINKED_COLUMN) por
-- uma baseada na coluna própria da linha, não no client_id atual do asset.
drop policy if exists asset_route_points_tenant_scoped on asset_route_points;
create policy asset_route_points_tenant_scoped on asset_route_points for all
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
  );
