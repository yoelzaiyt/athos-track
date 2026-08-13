-- Alguns campos do mock nunca foram timestamps reais — são rótulos relativos
-- gerados para exibição (ex.: "Agora", "Há 12s", "Hoje às 18:30", "Ontem, 18:42",
-- "Doca 04 - liberado para coleta", "Sem registros"). A migration inicial os
-- criou como timestamptz por engano; forçar esses valores num tipo de data
-- real perderia texto e exigiria um parser de linguagem natural em pt-BR que
-- ninguém pediu. Aqui eles viram text, que é o que de fato são hoje.
-- Campos que já são datas/timestamps reais na mock (lastMovement, scheduledDate,
-- cnhExpiry, addedAt, openedAt, startTime/endTime de viagem etc.) permanecem
-- com o tipo original.

alter table assets
  alter column telemetry_last_communication type text using telemetry_last_communication::text;

alter table system_alerts
  alter column "timestamp" type text using "timestamp"::text;

alter table cart_recoveries
  alter column "timestamp" type text using "timestamp"::text;

alter table cargo_shipments
  alter column eta type text using eta::text,
  alter column seal_last_event_time type text using seal_last_event_time::text;

alter table traffic_segments
  alter column updated_at type text using updated_at::text;

alter table system_integrations
  alter column last_ping type text using last_ping::text;

alter table drivers
  alter column last_fatigue_check type text using last_fatigue_check::text;
