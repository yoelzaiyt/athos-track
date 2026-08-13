-- AssetDevice.unitName (obrigatório) e AssetDevice.geofenceName (opcional) são
-- campos denominalizados no tipo do app (evitam join a cada render de lista/mapa),
-- mas a migration inicial esqueceu de criar as colunas correspondentes em assets
-- — só ficou o unit_id/geofence_id (FK). Corrige e faz backfill a partir das
-- tabelas relacionadas para as linhas já semeadas.

alter table assets
  add column unit_name text,
  add column geofence_name text;

update assets a
set unit_name = u.name
from company_units u
where u.id = a.unit_id and a.unit_name is null;

update assets a
set geofence_name = g.name
from geofences g
where g.id = a.geofence_id and a.geofence_name is null;

alter table assets alter column unit_name set not null;
