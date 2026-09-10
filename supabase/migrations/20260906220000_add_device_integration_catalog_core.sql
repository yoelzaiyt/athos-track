-- Catálogo multi-dispositivo/multi-protocolo/multi-fornecedor (ver
-- docs/device-integration-catalog.md). Objetivo: parar de hard-codar
-- modelo/protocolo/fornecedor/tipo de ativo em CHECK constraints espalhadas
-- e ter um catálogo real, mesmo que a maioria dos itens ainda não tenha
-- integração funcional (ver `status`, enum de maturidade abaixo).
--
-- NÃO substitui nada que já existe: `assets.category`/`protocol`
-- continuam sendo a fonte de verdade operacional (CHECK constraints da
-- migration inicial, 20260813120000_init_schema.sql) — as tabelas daqui são
-- metadado adicional (ver migration seguinte, que só ADICIONA
-- assets.device_model_id nullable, sem tocar nas colunas existentes).
--
-- `provider_devices`/`gt06_homolog_devices` (identidade real de um
-- dispositivo já visto pelo sistema) também não são substituídos — ver
-- device_identifiers na próxima migration.

-- Enum de maturidade usado em vendors/protocol_families/device_models —
-- status HONESTO de cada peça do catálogo (pedido explícito do usuário:
-- "não inventar comportamento que não esteja documentado").
create type integration_maturity_status as enum (
  'DOCUMENTED', 'PARTIALLY_MAPPED', 'ADAPTER_PENDING', 'IMPLEMENTED',
  'TEST_PENDING', 'VALIDATED', 'BLOCKED', 'DEPRECATED'
);

create table vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  status integration_maturity_status not null default 'DOCUMENTED',
  created_at timestamptz not null default now()
);

create table protocol_families (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  transport text, -- ex.: 'TCP', 'HTTP', 'BLE' — texto livre, não é canal de integração (ver integration_channels)
  description text,
  status integration_maturity_status not null default 'DOCUMENTED',
  created_at timestamptz not null default now()
);

-- Canal de integração é ORTOGONAL a protocolo: um mesmo protocolo pode
-- chegar por mais de um canal (ex.: GT06 hoje só chega por DIRECT_TCP, mas
-- nada impede um fornecedor futuro expor o mesmo protocolo via VENDOR_API).
create table integration_channels (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null
);

create table asset_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text
);

create table device_models (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete restrict,
  model_code text not null,
  name text not null,
  asset_type_id uuid references asset_types(id) on delete set null,
  protocol_family_id uuid references protocol_families(id) on delete set null,
  default_integration_channel_id uuid references integration_channels(id) on delete set null,
  -- Capabilities declaradas pelo modelo (seção 8 do pedido) — jsonb pra não
  -- hard-codar a lista em CHECK constraint; catálogo de valores conhecidos
  -- documentado em docs/device-integration-catalog.md, não aqui.
  capabilities_json jsonb not null default '[]'::jsonb,
  status integration_maturity_status not null default 'DOCUMENTED',
  created_at timestamptz not null default now(),
  unique (vendor_id, model_code)
);
create index idx_device_models_asset_type on device_models(asset_type_id);
create index idx_device_models_protocol_family on device_models(protocol_family_id);

-- ===================== RLS =====================
-- Mesmo padrão de provider_devices/provider_health: RLS só exige sessão
-- autenticada; a distinção ATHOS_ADMIN-only pra escrita fica no proxy REST
-- (server/api/rest.ts, ADMIN_ONLY_WRITE_TABLES) — não duplicar a regra aqui.

alter table vendors enable row level security;
create policy vendors_authenticated_all on vendors
  for all to authenticated using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table protocol_families enable row level security;
create policy protocol_families_authenticated_all on protocol_families
  for all to authenticated using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table integration_channels enable row level security;
create policy integration_channels_authenticated_all on integration_channels
  for all to authenticated using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table asset_types enable row level security;
create policy asset_types_authenticated_all on asset_types
  for all to authenticated using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table device_models enable row level security;
create policy device_models_authenticated_all on device_models
  for all to authenticated using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

insert into integration_channels (code, name) values
  ('DIRECT_TCP', 'Conexão TCP direta com o servidor'),
  ('VENDOR_API', 'API REST do fornecedor'),
  ('VENDOR_WEBHOOK', 'Webhook (push HTTP) do fornecedor'),
  ('BLE_CROWDSOURCED', 'Rede BLE crowdsourced (ex.: Apple Find My)'),
  ('SMS_CONFIGURATION', 'Configuração via comando SMS')
on conflict (code) do nothing;

insert into asset_types (code, name, description) values
  ('shopping_cart', 'Carrinho de compras', 'Carrinho de supermercado/varejo'),
  ('vehicle', 'Veículo', 'Frota — carro, caminhão, moto'),
  ('livestock', 'Rebanho', 'Gado, ovelhas, cavalos, camelos'),
  ('pet', 'Pet', 'Cães, gatos e outros animais domésticos'),
  ('equipment', 'Equipamento', 'Equipamento industrial/operacional genérico'),
  ('portable_asset', 'Ativo portátil', 'Mochila, bagagem, item pessoal'),
  ('pallet_jack', 'Paleteira', 'Paleteira/transpaleteira'),
  ('forklift', 'Empilhadeira', 'Empilhadeira')
on conflict (code) do nothing;
