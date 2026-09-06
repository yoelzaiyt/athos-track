-- Correlação de dispositivos em teste de campo (tag física de terceiro,
-- identificada só por uma etiqueta/serial externo) com o IMEI real recebido
-- no login GT06 — fluxo diferente de homologation_requests (que exige um
-- fornecedor preencher o formulário público e já declarar o test_imei de
-- antemão). Aqui o IMEI é desconhecido até o primeiro pacote chegar.
--
-- Escrita exclusivamente pelo processo server/gt06-listener (conexão direta
-- via DIRECT_URL, mesmo padrão de server/integrations/gt06/db.ts) quando
-- GT06_HOMOLOG_MODE=true — nunca por cliente anônimo do navegador, então,
-- diferente de homologation_requests, esta tabela não tem policy pra `anon`.
create table gt06_homolog_devices (
  id uuid primary key default gen_random_uuid(),
  external_label_id text not null unique,
  imei text,
  protocol text not null default 'GT06',
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  last_ip text,
  last_port integer,
  last_packet_type text,
  last_raw_hex text,
  last_latitude double precision,
  last_longitude double precision,
  last_gps_at timestamptz,
  status text not null default 'WAITING_DEVICE' check (status in ('WAITING_DEVICE', 'CONNECTED', 'DISCONNECTED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_gt06_homolog_devices_imei on gt06_homolog_devices(imei);

alter table gt06_homolog_devices enable row level security;

create policy gt06_homolog_devices_authenticated_all on gt06_homolog_devices
  for all to authenticated
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Registro inicial da tag física em teste — status muda pra CONNECTED só
-- quando o listener receber o login real e extrair o IMEI (nunca inventado).
insert into gt06_homolog_devices (external_label_id, protocol, status)
values ('3092660181', 'GT06', 'WAITING_DEVICE')
on conflict (external_label_id) do nothing;
