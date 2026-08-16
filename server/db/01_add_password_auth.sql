-- Roda DEPOIS de supabase/migrations/*.sql. Adiciona o hash de senha em
-- user_profiles — a nova API (server/api) autentica direto contra essa
-- coluna com bcrypt, sem depender do GoTrue do Supabase.
alter table user_profiles add column if not exists password_hash text;
