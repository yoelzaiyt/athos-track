-- ATHOS AGRO TRACK — Animal como entidade separada do dispositivo/coleira.
-- Mesmo padrão de `drivers` (20260813120000_init_schema.sql): entidade própria
-- com FK opcional pro asset (aqui, a coleira/rastreador). Trocar a coleira de
-- um animal não cria um Animal novo — só atualiza assigned_device_id, então o
-- histórico do animal (que vive em asset_route_points/system_alerts, ligado
-- ao asset) precisa ser lido pela cadeia animal -> device atual, não por um
-- vínculo fixo e permanente a um único device.

create table animals (
  id uuid primary key default gen_random_uuid(),
  athos_tag_code text not null,
  ear_tag_id text,
  name text,
  species text not null check (species in ('bovino', 'ovino', 'caprino', 'equino', 'outro')),
  breed text,
  sex text not null check (sex in ('macho', 'femea')),
  birth_date date,
  weight_kg numeric,
  batch_name text,
  client_id uuid not null references company_clients(id) on delete cascade,
  unit_id uuid not null references company_units(id) on delete cascade,
  unit_name text not null,
  owner_name text,
  status text not null default 'active' check (status in ('active', 'sold', 'deceased', 'transferred')),
  assigned_device_id uuid references assets(id) on delete set null,
  assigned_device_code text,
  current_geofence_id uuid references geofences(id) on delete set null,
  current_geofence_name text,
  created_at timestamptz not null default now(),
  unique (client_id, athos_tag_code)
);
create index idx_animals_unit on animals(unit_id);
create index idx_animals_device on animals(assigned_device_id);

-- ===================== RLS =====================
-- Mesmo padrão do restante do schema (20260813150000_require_authenticated_rls.sql).

alter table animals enable row level security;
create policy animals_authenticated_all on animals
  for all to authenticated using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
