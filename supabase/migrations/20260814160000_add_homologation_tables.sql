-- Portal de Homologação de Dispositivos (GT06). Tabelas para receber
-- solicitações de fornecedores/fabricantes SEM exigir login (o formulário
-- público é preenchido por quem ainda não tem conta no ATHOS), e para o
-- painel interno ATHOS (autenticado) revisar/acompanhar essas homologações.
--
-- Diferente do resto do schema (que exige `authenticated` para tudo, ver
-- 20260813150000_require_authenticated_rls.sql), estas 4 tabelas dão à role
-- `anon` permissão de **apenas INSERT** — nunca SELECT/UPDATE/DELETE. Isso
-- segrega sessões de homologação por padrão: o fornecedor nunca consegue ler
-- de volta dados de outra solicitação (nem a própria, via banco — a UI usa o
-- retorno do próprio insert + o `session_token` guardado em memória). Só
-- `authenticated` (painel interno ATHOS) tem acesso total.
--
-- Gap conhecido e documentado (não resolvido aqui): rate limiting real por IP
-- e CORS restritivo exigem um componente de servidor (Edge Function ou
-- backend real) — RLS sozinho não alcança isso. Ver relatório de entrega.

create table homologation_requests (
  id uuid primary key default gen_random_uuid(),
  session_token uuid not null default gen_random_uuid(),
  -- Empresa
  company_legal_name text not null,
  company_trade_name text,
  technical_contact_name text not null,
  technical_contact_email text not null,
  technical_contact_phone text not null,
  -- Equipamento
  manufacturer text not null,
  model text not null,
  firmware_version text,
  test_imei text not null,
  estimated_device_count integer,
  -- Comunicação / Transporte
  protocol text not null check (protocol in (
    'GT06', 'GT06N', 'GT06E', 'H02', 'JT/T808', 'TK103', 'Protocolo proprietário', 'Outro'
  )),
  transport text not null check (transport in ('TCP', 'UDP', 'HTTP', 'HTTPS', 'MQTT', 'Outro')),
  -- Informações técnicas (capacidades de configuração do dispositivo)
  supports_dns_config boolean not null default false,
  supports_ip_config boolean not null default false,
  supports_port_config boolean not null default false,
  supports_apn_config boolean not null default false,
  supports_transmission_interval_config boolean not null default false,
  supports_heartbeat_config boolean not null default false,
  supports_timezone_config boolean not null default false,
  supports_primary_server_config boolean not null default false,
  supports_secondary_server_config boolean not null default false,
  -- Documentação (texto/links nesta entrega — sem upload de arquivo)
  manual_url text,
  protocol_doc_url text,
  command_table_url text,
  firmware_doc_url text,
  payload_sample_text text,
  config_doc_url text,
  -- Integração
  can_transmit_to_third_party_server boolean not null default false,
  supports_dns_resolution boolean not null default false,
  has_manufacturer_api boolean not null default false,
  manufacturer_api_type text check (manufacturer_api_type in ('REST', 'SOAP', 'WebSocket', 'MQTT', 'Outra')),
  has_forwarding_mirroring boolean not null default false,
  forwarding_description text,
  status text not null default 'pending_review' check (status in ('pending_review', 'in_progress', 'completed')),
  created_at timestamptz not null default now()
);

create table homologation_devices (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references homologation_requests(id) on delete cascade,
  imei text not null,
  manufacturer text,
  model text,
  firmware_version text,
  demo_mode boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_homologation_devices_request_id on homologation_devices(request_id);

create table homologation_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references homologation_requests(id) on delete cascade,
  device_id uuid references homologation_devices(id) on delete set null,
  session_token uuid not null,
  imei_masked text not null,
  protocol text not null,
  packet_type text not null,
  step text not null check (step in (
    'awaiting_connection', 'device_connected', 'handshake_received', 'imei_identified',
    'location_packet_received', 'heartbeat_received', 'protocol_identified', 'homologation_completed'
  )),
  status text not null check (status in ('pending', 'success', 'error')),
  latency_ms integer,
  created_at timestamptz not null default now()
);

create index idx_homologation_events_request_id on homologation_events(request_id);

create table homologation_reports (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references homologation_requests(id) on delete cascade,
  device_id uuid references homologation_devices(id) on delete set null,
  protocol text not null,
  transport text not null,
  dns_compatible boolean not null default false,
  connection_ok boolean not null default false,
  login_packet_ok boolean not null default false,
  heartbeat_ok boolean not null default false,
  location_packet_ok boolean not null default false,
  result text not null check (result in ('COMPATIVEL', 'PENDENTE')),
  created_at timestamptz not null default now()
);

create index idx_homologation_reports_request_id on homologation_reports(request_id);

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'homologation_requests', 'homologation_devices', 'homologation_events', 'homologation_reports'
    ])
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I for insert to anon with check (true)',
      t || '_anon_insert', t
    );
    execute format(
      'create policy %I on %I for all to authenticated using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')',
      t || '_authenticated_all', t
    );
  end loop;
end $$;
