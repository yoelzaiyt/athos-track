-- Módulo de Recuperação de Ativos + ATHOS Field PWA. Distinto de
-- recovery_cases (cobrança/inadimplência) e cart_recoveries (registro simples
-- de "recuperado") — este é o ciclo "ativo saiu da cerca virtual →
-- colaborador de campo é acionado → busca → recuperação", com estados
-- intermediários e uma missão acessível sem login via token opaco (QR/link).

create table recovery_occurrences (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id) on delete cascade,
  asset_name text not null,
  asset_code text not null,
  category text not null,
  subcategory text,
  client_id uuid not null references company_clients(id) on delete cascade,
  unit_id uuid not null references company_units(id) on delete cascade,
  unit_name text not null,
  geofence_id uuid references geofences(id) on delete set null,
  geofence_name text,
  status text not null default 'detectado' check (status in (
    'detectado', 'aguardando_atendimento', 'atribuido', 'em_deslocamento', 'proximo_ao_ativo',
    'localizado', 'recuperado', 'nao_localizado', 'cancelado'
  )),
  priority text not null default 'normal' check (priority in ('baixa', 'normal', 'alta', 'critica')),
  exit_detected_at timestamptz not null default now(),
  last_asset_lat double precision not null,
  last_asset_lng double precision not null,
  last_asset_accuracy_meters numeric,
  last_asset_source text,
  last_asset_timestamp timestamptz not null default now(),
  battery_level integer,
  assigned_user_id uuid,
  assigned_user_name text,
  assigned_at timestamptz,
  collaborator_lat double precision,
  collaborator_lng double precision,
  collaborator_accuracy_meters numeric,
  collaborator_timestamp timestamptz,
  navigation_mode text,
  located_at timestamptz,
  recovered_at timestamptz,
  recovery_notes text,
  recovery_photo_data_url text,
  qr_asset_confirmed boolean not null default false,
  returned_to_unit_at timestamptz,
  auto_resolved_at timestamptz,
  not_located_reason text,
  cancel_reason text,
  secure_token uuid not null default gen_random_uuid(),
  token_expires_at timestamptz not null default (now() + interval '24 hours'),
  token_revoked boolean not null default false,
  -- Protótipo: toda ocorrência criada nesta entrega é simulada por padrão
  -- (seção 29 do brief — nunca apresentar dado simulado como "Ao Vivo").
  -- Passa a false quando a detecção real de saída de cerca for integrada.
  is_simulated boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index idx_recovery_occurrences_token on recovery_occurrences(secure_token);
create index idx_recovery_occurrences_status on recovery_occurrences(status);
create index idx_recovery_occurrences_client on recovery_occurrences(client_id, unit_id);

create table recovery_timeline_events (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references recovery_occurrences(id) on delete cascade,
  step text not null check (step in (
    'exit_detectado', 'alerta_criado', 'ocorrencia_criada', 'atribuido', 'busca_iniciada',
    'rota_iniciada', 'ativo_atualizado', 'colaborador_chegou', 'ativo_localizado', 'qr_confirmado',
    'recuperado', 'retornou_unidade', 'nao_localizado', 'ocorrencia_encerrada'
  )),
  user_name text,
  note text,
  created_at timestamptz not null default now()
);

create index idx_recovery_timeline_occurrence on recovery_timeline_events(occurrence_id);

alter table recovery_occurrences enable row level security;
alter table recovery_timeline_events enable row level security;

-- authenticated (equipe ATHOS/cliente logada na Central de Recuperação de Campo) tem
-- acesso completo — mesmo padrão do restante do schema (ver
-- 20260813150000_require_authenticated_rls.sql). anon (o colaborador de campo no
-- ATHOS Field, sem login) NÃO recebe nenhuma policy direta nessas duas tabelas —
-- o acesso dele é só através das duas funções security definer abaixo, que resolvem
-- o token e devolvem/gravam só os campos necessários pra missão, nunca IMEI/MAC/
-- device secret/tenantId ou a tabela inteira (ver seção 10 do brief de recuperação).
create policy recovery_occurrences_authenticated_all on recovery_occurrences
  for all to authenticated using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy recovery_timeline_events_authenticated_all on recovery_timeline_events
  for all to authenticated using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ===================== Acesso do ATHOS Field (anon, via token opaco) =====================

-- Resolve o token pra dados da missão — nunca IMEI/MAC/device secret/tenantId.
create or replace function resolve_recovery_mission(p_token uuid)
returns table (
  id uuid,
  asset_name text,
  asset_code text,
  category text,
  subcategory text,
  unit_name text,
  geofence_name text,
  status text,
  priority text,
  exit_detected_at timestamptz,
  last_asset_lat double precision,
  last_asset_lng double precision,
  last_asset_accuracy_meters numeric,
  last_asset_source text,
  last_asset_timestamp timestamptz,
  battery_level integer,
  collaborator_lat double precision,
  collaborator_lng double precision,
  navigation_mode text,
  qr_asset_confirmed boolean,
  is_simulated boolean,
  token_expires_at timestamptz,
  token_revoked boolean
)
language sql
security definer
set search_path = public
as $$
  select
    id, asset_name, asset_code, category, subcategory, unit_name, geofence_name,
    status, priority, exit_detected_at, last_asset_lat, last_asset_lng,
    last_asset_accuracy_meters, last_asset_source, last_asset_timestamp, battery_level,
    collaborator_lat, collaborator_lng, navigation_mode, qr_asset_confirmed, is_simulated,
    token_expires_at, token_revoked
  from recovery_occurrences
  where secure_token = p_token
    and token_revoked = false
    and token_expires_at > now();
$$;

revoke all on function resolve_recovery_mission(uuid) from public;
grant execute on function resolve_recovery_mission(uuid) to anon, authenticated;

-- Grava atualizações da missão vindas do ATHOS Field (posição do colaborador, status,
-- notas, confirmação do QR do ativo) e registra evento na timeline — tudo escopado ao
-- token, sem exigir login e sem expor a tabela inteira ao cliente anônimo.
create or replace function field_update_mission_status(
  p_token uuid,
  p_status text default null,
  p_collaborator_lat double precision default null,
  p_collaborator_lng double precision default null,
  p_collaborator_accuracy numeric default null,
  p_navigation_mode text default null,
  p_recovery_notes text default null,
  p_qr_asset_confirmed boolean default null,
  p_not_located_reason text default null,
  p_timeline_step text default null,
  p_user_name text default 'Colaborador de Campo'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_occurrence_id uuid;
begin
  select id into v_occurrence_id
  from recovery_occurrences
  where secure_token = p_token and token_revoked = false and token_expires_at > now();

  if v_occurrence_id is null then
    return false;
  end if;

  update recovery_occurrences set
    status = coalesce(p_status, status),
    collaborator_lat = coalesce(p_collaborator_lat, collaborator_lat),
    collaborator_lng = coalesce(p_collaborator_lng, collaborator_lng),
    collaborator_accuracy_meters = coalesce(p_collaborator_accuracy, collaborator_accuracy_meters),
    collaborator_timestamp = case when p_collaborator_lat is not null then now() else collaborator_timestamp end,
    navigation_mode = coalesce(p_navigation_mode, navigation_mode),
    recovery_notes = coalesce(p_recovery_notes, recovery_notes),
    qr_asset_confirmed = coalesce(p_qr_asset_confirmed, qr_asset_confirmed),
    not_located_reason = coalesce(p_not_located_reason, not_located_reason),
    located_at = case when p_status = 'localizado' then now() else located_at end,
    recovered_at = case when p_status = 'recuperado' then now() else recovered_at end,
    assigned_at = case when p_status = 'atribuido' and assigned_at is null then now() else assigned_at end
  where id = v_occurrence_id;

  if p_timeline_step is not null then
    insert into recovery_timeline_events (occurrence_id, step, user_name)
    values (v_occurrence_id, p_timeline_step, p_user_name);
  end if;

  return true;
end;
$$;

revoke all on function field_update_mission_status(
  uuid, text, double precision, double precision, numeric, text, text, boolean, text, text, text
) from public;
grant execute on function field_update_mission_status(
  uuid, text, double precision, double precision, numeric, text, text, boolean, text, text, text
) to anon, authenticated;
