-- Integração com o provedor real de tags BRGPS (fabricante chinês). Não cria
-- um sistema de posição paralelo: current position continua em
-- assets.telemetry_*, histórico continua em asset_route_points (tabela que já
-- existia, criada para "quando a tela de histórico passasse a ler dados
-- reais" — ver comentário original na migration 20260813120000). Aqui só
-- adicionamos as colunas que faltavam para acomodar dados reais do fornecedor
-- e o registro de dispositivos externos (provider_devices).

-- ===================== Registro de dispositivos do provedor =====================
-- Um dispositivo BRGPS aparece aqui assim que descoberto via GET /tag/all,
-- como UNASSIGNED. Um admin ATHOS vincula manualmente a um asset (seção 12 do
-- brief — nunca criar Asset comercial automaticamente).

create table provider_devices (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'BRGPS',
  external_device_id text not null,
  mac text,
  is_actived boolean not null default false, -- ativação no FORNECEDOR (PATCH /tag), distinto de "online"
  status text not null default 'UNASSIGNED' check (status in ('UNASSIGNED', 'ASSIGNED')),
  asset_id uuid references assets(id) on delete set null,
  discovered_at timestamptz not null default now(),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, external_device_id)
);
create index idx_provider_devices_asset on provider_devices(asset_id);
create index idx_provider_devices_status on provider_devices(provider, status);

-- ===================== Extensões em assets =====================

alter table assets
  add column provider text, -- 'BRGPS' quando a posição vem do provedor real; null = ainda simulado/mock
  add column provider_device_id uuid references provider_devices(id) on delete set null,
  add column mac text, -- seção 32: não exibir cheio no frontend padrão
  add column telemetry_battery_raw smallint, -- -1..3, valor cru do fornecedor (seção 9)
  add column telemetry_battery_level_category text check (telemetry_battery_level_category in (
    'UNKNOWN', 'CRITICAL', 'LOW', 'MEDIUM', 'HIGH'
  )),
  add column telemetry_provider_published_at timestamptz; -- publishTime do fornecedor (seção 10)

create index idx_assets_provider_device on assets(provider_device_id);

-- ===================== Extensões em asset_route_points (histórico/breadcrumb) =====================

alter table asset_route_points
  add column provider text,
  add column provider_published_at timestamptz,
  add column distance_raw numeric, -- seção 14: unidade não confirmada pelo fornecedor, guardado cru
  add column battery_raw smallint,
  add column fingerprint text; -- seção 19: dedup (provider|externalId|timestamp|lat|lng)

create unique index idx_route_points_fingerprint on asset_route_points(fingerprint) where fingerprint is not null;

-- ===================== Health do provider (seção 38) =====================

create table provider_health (
  provider text primary key,
  status text not null default 'UNAVAILABLE' check (status in ('HEALTHY', 'DEGRADED', 'UNAVAILABLE')),
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error_message text,
  requests_total bigint not null default 0,
  requests_failed bigint not null default 0,
  rate_limited_total bigint not null default 0,
  positions_received_total bigint not null default 0,
  positions_deduplicated_total bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- ===================== RLS =====================
-- Mesmo padrão do restante do schema (20260813150000_require_authenticated_rls.sql):
-- só usuário autenticado lê/escreve. O processo de sync (server/brgps-sync) conecta
-- via DIRECT_URL como gateway confiável e ignora RLS, igual ao gt06-listener.

alter table provider_devices enable row level security;
create policy provider_devices_authenticated_all on provider_devices
  for all to authenticated using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table provider_health enable row level security;
create policy provider_health_authenticated_select on provider_health
  for select to authenticated using (auth.role() = 'authenticated');

-- ===================== Realtime (seção 30) =====================
-- Sem WebSocket customizado: o frontend assina mudanças via Supabase Realtime
-- (AssetContext.tsx) para receber device.position.updated / battery / status.

alter publication supabase_realtime add table assets;
alter publication supabase_realtime add table system_alerts;
