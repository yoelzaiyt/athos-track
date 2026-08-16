-- Substitui o Supabase Realtime (assinaturas postgres_changes) por
-- LISTEN/NOTIFY nativo do Postgres. A API (server/api/realtime.ts) mantém
-- uma conexão dedicada com "LISTEN table_changes" e repassa cada evento pros
-- clientes conectados via Socket.io.
--
-- Cobre as duas assinaturas que o app já tinha em AssetContext.tsx: UPDATE em
-- assets e INSERT em system_alerts. Ambas mandam a linha inteira (row_to_json)
-- no payload — atenção ao limite de 8000 bytes do NOTIFY do Postgres, que é
-- confortável pro tamanho dessas linhas.

create or replace function notify_table_change() returns trigger
  language plpgsql
  as $$
declare
  payload json;
begin
  payload := json_build_object(
    'table', TG_TABLE_NAME,
    'eventType', TG_OP,
    'new', case when TG_OP in ('INSERT', 'UPDATE') then row_to_json(NEW) else null end,
    'old', case when TG_OP = 'DELETE' then row_to_json(OLD) else null end
  );
  perform pg_notify('table_changes', payload::text);
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists assets_notify_update on assets;
create trigger assets_notify_update
  after update on assets
  for each row execute function notify_table_change();

drop trigger if exists system_alerts_notify_insert on system_alerts;
create trigger system_alerts_notify_insert
  after insert on system_alerts
  for each row execute function notify_table_change();
