-- SEC-010 (SECURITY-GATE-REPORT.md) — fase 2: até aqui o "Recuperar senha"
-- da tela de login era honesto ("entre em contato com o administrador"), mas
-- não existia fluxo nenhum: redefinir senha exigia um humano rodando
-- scripts/provision-user-password.ts. Esta tabela é o lastro do fluxo real
-- (POST /auth/password-reset/request|confirm em server/api/routes-auth.ts).
--
-- Regras de segurança embutidas no desenho:
--   * token_hash: guardamos só o SHA-256 do token, NUNCA o token em claro —
--     quem lê o banco (dump, backup, DBA) não consegue redefinir a senha de
--     ninguém. O valor em claro só existe no e-mail enviado ao dono da conta.
--   * expires_at: validade curta (30min por padrão, PASSWORD_RESET_TTL_MINUTES).
--   * used_at: uso único — depois de redefinir, o mesmo link não funciona de
--     novo (nem se o e-mail vazar depois).
--   * consumed_reason: por que o token deixou de valer ('used' quando a
--     senha foi trocada com ele, 'superseded' quando o usuário pediu outro
--     link e este foi invalidado). Mantemos a linha em vez de deletar pra
--     trilha de auditoria continuar reconstruível.
create table if not exists password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  consumed_reason text check (consumed_reason in ('used', 'superseded')),
  requested_ip text,
  created_at timestamptz not null default now()
);

create index if not exists idx_password_reset_tokens_user on password_reset_tokens (user_id);
create index if not exists idx_password_reset_tokens_expires on password_reset_tokens (expires_at);

-- Esta tabela NÃO entra em ALLOWED_TABLES de server/api/rest.ts (o proxy
-- genérico de tabela) — nenhuma requisição de usuário chega até ela; só o
-- pool superusuário, dentro de routes-auth.ts. O bloco abaixo é defesa em
-- profundidade contra um erro futuro: a migration
-- 20260828030000_real_rls_defense_in_depth.sql tem um
-- `alter default privileges ... grant ... on tables to athos_app_rw`, então
-- sem o revoke explícito a role de aplicação ganharia acesso automático a
-- uma tabela que ela nunca deve enxergar. O `if exists` existe porque esta
-- migration também roda em bancos onde aquela role nunca foi criada
-- (server/db/migrate.ts contra um Postgres cru).
do $reset_tokens_grants$
declare
  r text;
begin
  -- athos_app_rw: pega grant automático pelo `alter default privileges` da
  -- migration de RLS. anon/authenticated: pegam grant automático do próprio
  -- Supabase (default privileges do projeto), herança de quando o app ainda
  -- falava com o PostgREST. Nenhuma das três tem motivo pra enxergar token
  -- de redefinição de senha.
  foreach r in array array['athos_app_rw', 'anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on password_reset_tokens from %I', r);
    end if;
  end loop;
end
$reset_tokens_grants$;

alter table password_reset_tokens enable row level security;
-- Sem policy nenhuma de propósito: com RLS ligada e zero policies, qualquer
-- role SEM bypassrls (athos_app_rw) enxerga zero linhas, mesmo que um grant
-- futuro reapareça por engano.
