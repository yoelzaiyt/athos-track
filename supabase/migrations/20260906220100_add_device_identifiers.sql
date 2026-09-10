-- Identificadores de dispositivo, com tipo explícito (seção 6 do pedido:
-- "NUNCA assumir tipo" — IMEI/ICCID/SERIAL/TAG_ID são conceitos diferentes,
-- não intercambiáveis; a API BRGPS, por exemplo, só expõe TAG_ID, nunca
-- IMEI real).
--
-- Sem FK real pra "o dispositivo": hoje existem DUAS tabelas de identidade
-- de dispositivo, independentes uma da outra —
-- provider_devices (fluxo API, ex.: BRGPS) e gt06_homolog_devices (fluxo
-- TCP bruto, GT06). Não existe uma tabela `devices` guarda-chuva, e criar
-- uma só pra isso seria invasivo demais pra zero consumidores novos hoje.
-- Usa um par polimórfico (source_table + source_id) com CHECK, integridade
-- garantida em nível de aplicação (Postgres não tem FK polimórfica nativa).
create table device_identifiers (
  id uuid primary key default gen_random_uuid(),
  source_table text not null check (source_table in ('provider_devices', 'gt06_homolog_devices')),
  source_id uuid not null,
  identifier_type text not null check (identifier_type in (
    'IMEI', 'ICCID', 'SERIAL', 'TAG_ID', 'DEVICE_ID', 'QR_CODE', 'VENDOR_ID', 'UNKNOWN'
  )),
  identifier_value text not null,
  source text, -- de onde veio esse identificador (ex.: 'foto da etiqueta', 'resposta da API', 'datasheet')
  verified boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source_table, source_id, identifier_type)
);
create index idx_device_identifiers_source on device_identifiers(source_table, source_id);
create index idx_device_identifiers_value on device_identifiers(identifier_value);

alter table device_identifiers enable row level security;
create policy device_identifiers_authenticated_all on device_identifiers
  for all to authenticated using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
