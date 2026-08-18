-- Chaves de API emitidas pela plataforma para terceiros autenticarem contra
-- a API própria (server/api) — distinto do token JWT de sessão de usuário.
-- A chave em texto puro só existe no momento da criação (resposta HTTP);
-- daí em diante só o hash bcrypt fica no banco.
create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key_prefix text not null,
  key_hash text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
