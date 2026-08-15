-- Seção 21 do brief de Recuperação de Ativos ("Retornar à Unidade"): ponto de
-- destino pra rota de volta depois de recuperar o ativo (normalmente o centro
-- da própria cerca virtual de onde ele saiu). Opcional — nem toda ocorrência
-- tem uma cerca com coordenada conhecida.
alter table recovery_occurrences add column if not exists return_destination_lat double precision;
alter table recovery_occurrences add column if not exists return_destination_lng double precision;

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
  token_revoked boolean,
  return_destination_lat double precision,
  return_destination_lng double precision
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
    token_expires_at, token_revoked, return_destination_lat, return_destination_lng
  from recovery_occurrences
  where secure_token = p_token
    and token_revoked = false
    and token_expires_at > now();
$$;

revoke all on function resolve_recovery_mission(uuid) from public;
grant execute on function resolve_recovery_mission(uuid) to anon, authenticated;
