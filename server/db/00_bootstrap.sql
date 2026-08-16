-- Roda ANTES de supabase/migrations/*.sql num Postgres puro (Railway), pra
-- deixar essas migrations (escritas originalmente pro Supabase) aplicarem sem
-- modificação nenhuma.
--
-- Por quê: as migrations em supabase/migrations referenciam gen_random_uuid()
-- (extensão pgcrypto, que o Supabase já vem com ela ligada) e uma FK pra
-- auth.users(id) — schema que só existe dentro do Supabase (parte do GoTrue).
-- Fora do Supabase isso não existe, então criamos aqui uma versão mínima só
-- com o suficiente pra satisfazer as mesmas referências: extensão pgcrypto e
-- um schema auth com uma tabela users simples (sem toda a lógica de GoTrue,
-- que a gente não precisa mais — a autenticação real agora é feita pela API
-- em server/api, com senha própria em user_profiles.password_hash).
--
-- As RLS policies das migrations usam auth.role() = 'authenticated'; como
-- não existe sessão de Postgres autenticada por usuário final aqui (a API é
-- quem fala com o banco, sempre com o mesmo usuário de aplicação), a função
-- auth.role() abaixo sempre retorna 'authenticated' — efeito prático: RLS
-- sempre libera. A autorização de verdade agora mora na API (server/api),
-- não no banco. Isso não é uma regressão: a policy original já não
-- diferenciava por role nenhuma (ver comentário em
-- 20260813150000_require_authenticated_rls.sql).

create extension if not exists pgcrypto;

-- Papéis padrão do Supabase que várias migrations referenciam em `grant ...
-- to anon/authenticated` e `create policy ... to anon`. Aqui são só papéis
-- sem login (a API sempre conecta como o usuário de aplicação do Railway,
-- nunca como esses papéis) — existem só pra essas declarações não falharem.
do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end
$$;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique
);

create or replace function auth.role() returns text
  language sql stable
  as $$ select 'authenticated'::text $$;

create or replace function auth.uid() returns uuid
  language sql stable
  as $$ select null::uuid $$;

-- Publication que o Supabase usa internamente pro Realtime (algumas
-- migrations fazem `alter publication supabase_realtime add table ...`).
-- Fora do Supabase ninguém assina essa publication — o realtime de verdade
-- agora é via LISTEN/NOTIFY (server/db/02_realtime_notify.sql) — mas ela
-- precisa existir pra essas linhas históricas não falharem.
do $$
begin
  if not exists (select from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end
$$;
