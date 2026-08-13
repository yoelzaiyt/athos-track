-- ATHOS TRACK — schema inicial, derivado de src/types/index.ts e das coleções
-- MOCK_* em src/mock/index.ts. Cobre todas as entidades hoje mockadas no app;
-- não migra dados (isso fica para uma etapa seguinte, quando o AssetContext
-- passar a ler/escrever do Supabase em vez de MOCK_ASSETS etc.).
--
-- Convenções:
--   * ids uuid gerados pelo banco (gen_random_uuid())
--   * colunas em snake_case, tipos TS em camelCase
--   * campos com formato livre / listas aninhadas viram jsonb
--   * RLS habilitado em todas as tabelas com uma policy "allow all" temporária
--     (ver bloco final) — trocar por policies reais quando a autenticação
--     (hoje mock em AuthContext) for ligada ao Supabase Auth.

create extension if not exists pgcrypto;

-- ===================== Núcleo: Clientes, Unidades, Usuários =====================

create table company_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  cnpj text not null,
  units_count integer not null default 0,
  assets_count integer not null default 0,
  status text not null default 'active' check (status in ('active', 'inactive')),
  service_expire_date date,
  created_at timestamptz not null default now()
);

create table company_units (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references company_clients(id) on delete cascade,
  name text not null,
  city text not null,
  state text not null,
  address text not null,
  assets_count integer not null default 0,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);
create index idx_company_units_client on company_units(client_id);

create table user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null check (role in (
    'ATHOS_ADMIN', 'CLIENT_ADMIN', 'FLEET_MANAGER', 'CART_MANAGER',
    'ASSET_MANAGER', 'OPERATOR', 'VIEWER'
  )),
  avatar_url text,
  client_id uuid references company_clients(id) on delete set null,
  unit_id uuid references company_units(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_user_profiles_client on user_profiles(client_id);

-- ===================== Cercas Virtuais (definidas antes de assets) =====================

create table geofences (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_id uuid not null references company_clients(id) on delete cascade,
  unit_id uuid not null references company_units(id) on delete cascade,
  type text not null check (type in ('circle', 'polygon')),
  coordinates jsonb not null, -- [ [lat, lng], ... ]
  radius numeric, -- metros, para type = 'circle'
  color text not null default '#3b82f6',
  entry_alert boolean not null default true,
  exit_alert boolean not null default true,
  stay_alert boolean not null default false,
  max_speed numeric,
  assigned_assets_count integer not null default 0,
  target_category text,
  is_high_risk_zone boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_geofences_unit on geofences(unit_id);

-- ===================== Ativos Rastreados (AssetDevice + TelemetryData embutida) =====================

create table assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  imei text not null unique,
  category text not null check (category in (
    'cart', 'vehicle', 'truck', 'forklift', 'asset', 'bike', 'cargo', 'tag', 'agro'
  )),
  subcategory text,
  client_id uuid not null references company_clients(id) on delete cascade,
  unit_id uuid not null references company_units(id) on delete cascade,
  status text not null check (status in (
    'online', 'offline', 'moving', 'stopped', 'out_of_geofence',
    'low_battery', 'maintenance', 'available', 'in_use'
  )),
  protocol text not null check (protocol in (
    'GT06', 'Traccar Compatible', 'Wialon IPS', 'JT/T808', 'Suntech',
    'Queclink', 'MQTT', 'HTTP', 'BLE Gateway', 'RFID', 'NFC', 'Custom'
  )),
  responsible_name text,
  driver_name text,
  model text,
  plate_number text,
  geofence_id uuid references geofences(id) on delete set null,
  last_movement timestamptz,

  -- Fleet control extensions
  is_blocked boolean not null default false,
  is_door_locked boolean not null default false,
  speed_limit_kmh numeric,
  camera_channels_count integer not null default 0,
  assigned_driver_id uuid, -- FK para drivers adicionada depois (referência circular)
  last_maintenance_date date,
  next_maintenance_due date,
  positioning_priority text[],
  door_lock_card_id text,
  door_lock_card_bound_at timestamptz,
  auto_unlock_on_geofence_entry boolean not null default false,
  scheduled_unlock_windows jsonb not null default '[]',
  tire_positions jsonb not null default '[]',
  service_expire_date date,
  last_remote_command jsonb,
  offline_whitelist_synced_at timestamptz,
  scheduled_photo_capture jsonb,

  -- TelemetryData (1:1, embutida por ser atualizada em alta frequência junto com o ativo)
  telemetry_latitude double precision,
  telemetry_longitude double precision,
  telemetry_speed numeric not null default 0,
  telemetry_battery_level numeric,
  telemetry_signal_strength numeric,
  telemetry_last_communication timestamptz,
  telemetry_ignition boolean,
  telemetry_odometer numeric,
  telemetry_operating_hours numeric,
  telemetry_temperature numeric,
  telemetry_heading numeric,
  telemetry_gps_accuracy numeric,
  telemetry_position_source text check (telemetry_position_source in (
    'GPS', 'GPS Satellite', 'LBS', 'Wi-Fi', 'BLE Gateway', 'Manual'
  )),
  telemetry_packet_timestamp timestamptz,
  telemetry_fuel_percent numeric,
  telemetry_fuel_volume_liters numeric,
  telemetry_fuel_tank_capacity_liters numeric,
  telemetry_possible_fuel_theft boolean not null default false,
  telemetry_can_bus_connected boolean,
  telemetry_obd_error_codes text[],
  telemetry_fuel_tanks jsonb not null default '[]',
  telemetry_rpm numeric,
  telemetry_engine_temperature numeric,
  telemetry_idling_minutes_today numeric,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_assets_client on assets(client_id);
create index idx_assets_unit on assets(unit_id);
create index idx_assets_category on assets(category);
create index idx_assets_geofence on assets(geofence_id);

-- ===================== Motoristas (referência circular com assets resolvida abaixo) =====================

create table drivers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cnh_number text not null,
  cnh_category text not null check (cnh_category in ('A', 'B', 'AB', 'C', 'D', 'E')),
  cnh_expiry date not null,
  phone text not null,
  client_id uuid not null references company_clients(id) on delete cascade,
  unit_id uuid not null references company_units(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'inactive', 'suspended')),
  assigned_vehicle_id uuid references assets(id) on delete set null,
  assigned_vehicle_plate text,
  fatigue_score numeric not null default 0,
  fatigue_status text not null default 'normal' check (fatigue_status in ('normal', 'attention', 'critical')),
  last_fatigue_check timestamptz,
  continuous_driving_hours numeric not null default 0,
  driving_hours_today numeric not null default 0,
  driving_score numeric,
  harsh_events_today jsonb,
  created_at timestamptz not null default now()
);
create index idx_drivers_unit on drivers(unit_id);

alter table assets
  add constraint fk_assets_assigned_driver
  foreign key (assigned_driver_id) references drivers(id) on delete set null;

-- ===================== Manutenção, Viagens e Modelos de Rota =====================

create table maintenance_records (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references assets(id) on delete cascade,
  vehicle_plate text,
  vehicle_name text,
  type text not null check (type in ('preventiva', 'corretiva', 'revisao', 'pneus', 'oleo')),
  description text not null,
  status text not null default 'agendada' check (status in ('agendada', 'em_andamento', 'concluida', 'atrasada')),
  scheduled_date date not null,
  completed_date date,
  odometer_at_service numeric,
  cost numeric,
  workshop text,
  created_at timestamptz not null default now()
);
create index idx_maintenance_vehicle on maintenance_records(vehicle_id);

create table route_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_id uuid not null references company_clients(id) on delete cascade,
  unit_id uuid not null references company_units(id) on delete cascade,
  origin text not null,
  destination text not null,
  waypoints jsonb not null default '[]', -- [ [lat, lng], ... ]
  est_distance_km numeric not null,
  est_duration_min numeric not null,
  created_at timestamptz not null default now()
);

create table trip_records (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references assets(id) on delete cascade,
  vehicle_plate text,
  vehicle_name text,
  driver_id uuid references drivers(id) on delete set null,
  driver_name text,
  origin text not null,
  destination text not null,
  start_time timestamptz not null,
  end_time timestamptz,
  distance_km numeric not null default 0,
  avg_speed_kmh numeric not null default 0,
  max_speed_kmh numeric not null default 0,
  status text not null default 'planejada' check (status in ('planejada', 'em_andamento', 'concluida')),
  route_template_id uuid references route_templates(id) on delete set null,
  deviation_detected boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_trips_vehicle on trip_records(vehicle_id);

-- Histórico de posições (breadcrumb de GPS) por ativo — hoje gerado em memória em
-- HistoryPage.tsx; tabela criada para quando essa tela passar a ler dados reais.
create table asset_route_points (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  speed numeric not null default 0,
  event text,
  recorded_at timestamptz not null default now()
);
create index idx_route_points_asset_time on asset_route_points(asset_id, recorded_at desc);

-- ===================== Alertas =====================

create table system_alerts (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references assets(id) on delete cascade,
  asset_name text,
  category text,
  unit_name text,
  type text not null check (type in (
    'geofence_exit', 'geofence_entry', 'low_battery', 'offline_device', 'movement',
    'speeding', 'extended_stop', 'route_diverted', 'impact', 'fall_detected',
    'fuel_theft', 'seal_tampered', 'high_risk_zone_entry', 'tire_pressure',
    'harsh_driving', 'pairing_separation'
  )),
  title text not null,
  message text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  timestamp timestamptz not null default now(),
  acknowledged boolean not null default false,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);
create index idx_alerts_asset on system_alerts(asset_id);
create index idx_alerts_unacknowledged on system_alerts(acknowledged) where acknowledged = false;

-- ===================== Cargas (lacre eletrônico) =====================

create table cargo_shipments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  cargo_description text not null,
  origin text not null,
  destination text not null,
  carrier text not null,
  vehicle_plate text,
  driver_name text,
  tag_id text,
  status text not null check (status in ('origem', 'coleta', 'em_transito', 'parada', 'destino', 'entregue')),
  eta timestamptz,
  temperature_target text,
  current_location text,
  latitude double precision,
  longitude double precision,
  progress_percent numeric not null default 0,
  events_count integer not null default 0,
  seal_status text check (seal_status in ('sealed', 'open', 'tampered')),
  seal_last_trigger text check (seal_last_trigger in (
    'button', 'rfid', 'nfc', 'registered_card', 'unregistered_card', 'sms', 'platform'
  )),
  seal_last_event_time timestamptz,
  created_at timestamptz not null default now()
);

-- ===================== Recuperação de Carrinhos =====================

create table cart_recoveries (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id) on delete cascade,
  asset_name text,
  asset_code text,
  unit_name text,
  recovered_by text not null,
  signature_name text not null,
  notes text,
  photo_data_url text,
  related_alert_id uuid references system_alerts(id) on delete set null,
  timestamp timestamptz not null default now()
);
create index idx_recoveries_asset on cart_recoveries(asset_id);

-- ===================== Integrações de Sistema =====================

create table system_integrations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('GT06', 'REST API', 'WebSocket', 'MQTT', 'Webhooks', 'BLE Gateway')),
  status text not null default 'inactive' check (status in ('active', 'inactive', 'testing')),
  last_ping timestamptz,
  active_devices_count integer not null default 0,
  endpoint_url text,
  api_key text,
  created_at timestamptz not null default now()
);

-- ===================== Ordens de Serviço (instalação/manutenção técnica) =====================

create table work_orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null check (type in ('instalacao', 'manutencao', 'desinstalacao', 'auditoria')),
  asset_id uuid references assets(id) on delete set null,
  asset_name text,
  vehicle_plate text,
  client_id uuid not null references company_clients(id) on delete cascade,
  unit_id uuid not null references company_units(id) on delete cascade,
  unit_name text,
  technician_name text not null,
  status text not null default 'pendente' check (status in (
    'pendente', 'agendada', 'em_andamento', 'concluida', 'cancelada'
  )),
  scheduled_date date not null,
  completed_date date,
  install_point_id text, -- referência ao ponto no diagrama de instalação (ver InstallationPoint no frontend)
  install_photo_data_url text,
  notes text,
  created_at timestamptz not null default now()
);
create index idx_work_orders_unit on work_orders(unit_id);

-- ===================== Recuperação de Ativos (zona de risco / greylist) =====================

create table greylist_entries (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('endereco', 'pessoa', 'local_penhora')),
  label text not null,
  description text,
  latitude double precision,
  longitude double precision,
  radius_meters numeric,
  client_id uuid not null references company_clients(id) on delete cascade,
  added_at timestamptz not null default now()
);

create table asset_recovery_cases (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id) on delete cascade,
  asset_name text,
  asset_code text,
  plate_number text,
  client_id uuid not null references company_clients(id) on delete cascade,
  unit_name text,
  reason text not null,
  status text not null default 'aberto' check (status in (
    'aberto', 'em_negociacao', 'localizado', 'recuperado', 'encerrado'
  )),
  opened_at timestamptz not null default now(),
  responsible_name text not null,
  last_known_latitude double precision,
  last_known_longitude double precision,
  frequent_stop_points jsonb not null default '[]', -- FrequentStopPoint[]
  notes text
);
create index idx_recovery_cases_asset on asset_recovery_cases(asset_id);

-- ===================== Pareamento & Alerta de Proximidade (comboio/escolta) =====================

create table asset_pairings (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  client_id uuid not null references company_clients(id) on delete cascade,
  primary_asset_id uuid not null references assets(id) on delete cascade,
  primary_asset_name text,
  secondary_asset_id uuid not null references assets(id) on delete cascade,
  secondary_asset_name text,
  max_distance_meters numeric not null,
  active boolean not null default true
);

-- ===================== Trânsito e Pontos de Interesse (camadas do mapa) =====================

create table traffic_segments (
  id uuid primary key default gen_random_uuid(),
  road_name text not null,
  coordinates jsonb not null, -- [ [lat, lng], ... ]
  congestion_level text not null check (congestion_level in ('free', 'moderate', 'heavy', 'stopped')),
  avg_speed_kmh numeric not null,
  updated_at timestamptz not null default now()
);

create table points_of_interest (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('fuel_station', 'workshop', 'yard', 'parking')),
  latitude double precision not null,
  longitude double precision not null,
  address text
);

-- ===================== Row Level Security =====================
-- Habilitado em todas as tabelas. Como a autenticação hoje é mock (AuthContext),
-- a policy abaixo libera leitura/escrita geral para não quebrar o app enquanto
-- o Supabase Auth não é ligado de verdade. TROCAR por policies com auth.uid()
-- quando isso acontecer — hoje qualquer pessoa com a anon key acessa tudo.

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
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I for all using (true) with check (true)',
      t || '_allow_all_temp', t
    );
  end loop;
end $$;
