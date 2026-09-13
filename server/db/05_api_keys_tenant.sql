-- Chave de API passa a pertencer a uma empresa (card #8 do Trello).
--
-- Até aqui api_keys não tinha dono: qualquer usuário logado listava, criava
-- e revogava as chaves de TODAS as empresas, e uma chave não tinha como
-- limitar o que enxergava. Agora:
--   - client_id: empresa dona. É o escopo de tudo que a chave consulta em
--     /v1. Chaves antigas ficam com client_id nulo e são recusadas em /v1
--     (só ATHOS_ADMIN as vê em /api-keys, para revogar).
--   - created_by: quem gerou, para auditoria.
--
-- Fica em server/db (e não em supabase/migrations) porque api_keys nasce em
-- 03_api_keys.sql, que o migrate.ts roda DEPOIS das migrations do Supabase.
--
-- Sem RLS de propósito: api_keys só é lida pelo pool de servidor
-- (server/api/apiKeys.ts e apiKeyAuth.ts), nunca pela role athos_app_rw.
alter table api_keys
  add column if not exists client_id uuid references company_clients(id) on delete cascade,
  add column if not exists created_by uuid references user_profiles(id) on delete set null;

create index if not exists idx_api_keys_client on api_keys (client_id);
create index if not exists idx_api_keys_active_prefix on api_keys (key_prefix) where revoked_at is null;
