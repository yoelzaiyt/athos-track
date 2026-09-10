-- Transferência administrativa de tag entre tenants (seção 9 do brief):
-- CAR-01 (1603000067) e CAR-03 (3092524777) estavam no tenant DEMO-01
-- ("ATHOS Track Demo") — usadas em 2026-09-04/06 pra homologar o pipeline
-- técnico BRGPS (ver docs/HARDWARE-CATALOG.md, docs/integrations/BRGPS.md).
-- O usuário confirmou em 2026-09-10 que essas são as 2 tags físicas do
-- cliente São João (os dois únicos IDs reais com histórico de posição no
-- projeto), então elas migram de DEMO-01 -> SAO-JOAO agora.
--
-- Nunca um "update assets set client_id" isolado: registra rastreabilidade
-- completa (tag, tenant antigo, tenant novo, quem, por quê, quando) numa
-- tabela própria, igual audit_logs em espírito mas com o schema específico
-- que a seção 9 pediu (old_tenant/new_tenant/old_asset/new_asset) — e
-- também grava em audit_logs, que já é o audit trail genérico do resto do
-- sistema, pra aparecer nas mesmas telas/consultas que qualquer outra ação
-- administrativa.
--
-- Isolamento do histórico ANTERIOR à transferência já resolvido na migration
-- anterior (asset_route_points.client_id próprio, não o do asset atual) —
-- aqui só muda o "dono atual" do asset (assets.client_id/unit_id), pontos
-- futuros do BrGpsRepository.applyPosition já gravam com o client_id certo
-- (código atualizado junto, server/integrations/brgps/db.ts).

create table if not exists tag_tenant_transfers (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id) on delete restrict,
  tag_imei text not null,
  old_client_id uuid references company_clients(id),
  new_client_id uuid not null references company_clients(id),
  old_unit_id uuid references company_units(id),
  new_unit_id uuid references company_units(id),
  performed_by text not null, -- email do admin, ou 'system:migration:<arquivo>' quando via migration
  reason text not null,
  transferred_at timestamptz not null default now()
);
create index if not exists idx_tag_tenant_transfers_asset on tag_tenant_transfers(asset_id);

-- Sem coluna de tenant própria (é meta-dado ATHOS sobre uma transferência
-- ENTRE tenants, não pertence a nenhum dos dois) — mesmo padrão de
-- homologation_*/traffic_segments (20260828030000): RLS só garante conexão
-- pela role da API, ADMIN_ONLY_ALL_TABLES em server/api/rest.ts decide quem
-- lê/escreve (só ATHOS_SUPER_ADMIN, seção 14 do brief).
alter table tag_tenant_transfers enable row level security;
create policy tag_tenant_transfers_app_role on tag_tenant_transfers for all using (true) with check (true);

do $$
declare
  v_sao_joao_client_id uuid;
  v_sao_joao_unit_id uuid;
  v_demo_client_id uuid;
  v_asset record;
begin
  select id into v_sao_joao_client_id from company_clients where code = 'SAO-JOAO';
  select id into v_sao_joao_unit_id from company_units where client_id = v_sao_joao_client_id and name = 'Matriz';
  select id into v_demo_client_id from company_clients where code = 'DEMO-01';

  if v_sao_joao_client_id is null or v_sao_joao_unit_id is null then
    raise exception 'Tenant SAO-JOAO ou unidade Matriz não encontrados — abortando transferência.';
  end if;

  for v_asset in
    select id, imei, client_id, unit_id from assets where imei in ('1603000067', '3092524777')
  loop
    if v_asset.client_id = v_sao_joao_client_id then
      continue; -- idempotente: já transferido numa execução anterior desta migration
    end if;

    insert into tag_tenant_transfers
      (asset_id, tag_imei, old_client_id, new_client_id, old_unit_id, new_unit_id, performed_by, reason)
    values
      (v_asset.id, v_asset.imei, v_asset.client_id, v_sao_joao_client_id, v_asset.unit_id, v_sao_joao_unit_id,
       'system:migration:20260910100100_transfer_car01_car03_to_sao_joao.sql',
       'Reclassificação: tag usada para homologação técnica do pipeline BRGPS sob tenant demo; confirmada pelo usuário (dono do produto) em 2026-09-10 como tag física real do cliente São João.');

    insert into audit_logs (actor_email, client_id, action, entity_type, entity_id, result, detail)
    values (
      'system:migration', v_sao_joao_client_id, 'TAG_TENANT_TRANSFER', 'asset', v_asset.id::text, 'success',
      jsonb_build_object(
        'tag_imei', v_asset.imei,
        'old_client_id', v_asset.client_id,
        'new_client_id', v_sao_joao_client_id,
        'migration', '20260910100100_transfer_car01_car03_to_sao_joao.sql'
      )
    );

    update assets
    set client_id = v_sao_joao_client_id, unit_id = v_sao_joao_unit_id, unit_name = 'Matriz', updated_at = now()
    where id = v_asset.id;
  end loop;
end $$;
