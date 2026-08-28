-- RBAC + Security Hardening (rodada "ATHOS TRACK — RBAC + SECURITY HARDENING").
-- Ver RBAC-SECURITY-GATE.md pro relatório completo desta rodada.

-- ===================== P0 — bypass total via PostgREST nativo do Supabase =====================
-- Achado ao vivo (não estava documentado antes, só suspeitado em
-- ATTACK-SURFACE.md linha ~157 como "a confirmar"): o projeto Supabase por
-- trás do DATABASE_URL ainda tem seu PostgREST/GoTrue próprios expostos em
-- https://<projeto>.supabase.co, e os papéis `anon`/`authenticated` (usados
-- por esse PostgREST, não pela nossa API) tinham GRANT de
-- SELECT/INSERT/UPDATE/DELETE/TRUNCATE em TODAS as tabelas — herdado de
-- quando o app usava Supabase Auth/PostgREST de verdade (commit a58fb36),
-- nunca revogado na migração pra API própria (c981b79).
--
-- Confirmado ao vivo com a anon key pública (VITE_SUPABASE_ANON_KEY no
-- .env). Checado no bundle de produção gerado nesta rodada: essa env var
-- não é mais referenciada em src/ (o app fala só com a API própria — ver
-- src/lib/supabaseClient.ts), então o Vite nem embute o valor no JS final
-- — não está "vazando pelo bundle" hoje. Mas isso não muda a severidade:
-- anon key do Supabase é pública POR DESIGN (é assim que o modelo inteiro
-- funciona — quem protege dado é RLS/grant, nunca o sigilo da key), e este
-- valor específico é descobrível por quem tiver acesso ao projeto Supabase
-- (dashboard, um build antigo, histórico de commit, etc.) sem precisar de
-- login nenhum na nossa API:
--   - `company_clients`/`user_profiles`/`assets`/`audit_logs` via PostgREST:
--     protegidos por acidente feliz — a policy de RLS "tenant_scoped" da
--     migration 20260828030000 não tem `TO athos_app_rw`, então também vale
--     pra `anon`/`authenticated` (roles sem BYPASSRLS); como a sessão do
--     PostgREST nunca seta as GUCs app.client_id/app.is_admin, a policy
--     nega tudo → 200 com `[]`. Não foi desenhado assim de propósito, mas
--     funciona.
--   - `provider_health`/`system_integrations`/`traffic_segments`/
--     `points_of_interest`/`homologation_*`: a policy dessas tabelas
--     ("tabelas de referência sem tenant", mesma migration 030000) é
--     `using (true) with check (true)` — SEM restrição de role nenhuma,
--     apesar do comentário da migration dizer "só a role da API". Testado
--     ao vivo: `GET .../rest/v1/provider_health` com a anon key devolveu os
--     dados reais (200, JSON populado). `system_integrations` (guarda
--     `api_key` de integrações GT06/REST/MQTT/Webhooks/BLE) está vazia
--     hoje, mas teria o mesmo vazamento no dia em que alguém popular essa
--     tabela — e leitura/escrita nela nunca passaria pelo ADMIN_ONLY_READ_TABLES
--     do server/api/rest.ts, porque isso é acesso direto ao Postgres, fora
--     da nossa API inteira.
--
-- Fix: revoga tudo de `anon`/`authenticated` — nenhum dos dois é usado pela
-- aplicação (Auth e Realtime já são próprios, ver server/api/routes-auth.ts
-- e server/api/realtime.ts; PostgREST nunca é chamado pelo frontend, ver
-- src/lib/supabaseClient.ts). Isso não quebra nada em uso real, só fecha o
-- caminho paralelo que ninguém deveria estar usando.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
revoke usage on schema public from anon, authenticated;

-- Nota honesta: isso fecha o buraco para as tabelas e sequences que já
-- existem HOJE. Uma tabela nova criada depois desta migration, se receber
-- grant automático de `anon`/`authenticated` de novo (ex.: via dashboard do
-- Supabase, fora deste repositório), reabriria o mesmo problema — não há
-- `alter default privileges` daqui pra frente que garanta isso contra ações
-- feitas fora das migrations. Ver Pendências em RBAC-SECURITY-GATE.md.

-- ===================== audit_logs sem RLS =====================
-- A migration 20260828030000 (RLS real) rodou antes de audit_logs existir
-- (criada em 20260828040000) — nunca ganhou RLS. Com o REVOKE acima isso já
-- não seria mais alcançável via anon/authenticated, mas a segunda camada de
-- defesa (athos_app_rw, sem BYPASSRLS, usada por server/api/rest.ts) também
-- não tinha proteção de banco pra esta tabela — dependia 100% do filtro em
-- rest.ts (tenantScopeClause). Mesmo padrão da migration anterior:
-- client_id nullable, linha sem tenant só visível pro ATHOS_ADMIN.
alter table audit_logs enable row level security;
drop policy if exists audit_logs_tenant_scoped on audit_logs;
create policy audit_logs_tenant_scoped on audit_logs for all
  using (
    current_setting('app.is_admin', true) = 'true'
    or (
      coalesce(current_setting('app.client_id', true), '') <> ''
      and client_id::text = current_setting('app.client_id', true)
    )
  )
  with check (
    current_setting('app.is_admin', true) = 'true'
    or (
      coalesce(current_setting('app.client_id', true), '') <> ''
      and client_id::text = current_setting('app.client_id', true)
    )
  );
