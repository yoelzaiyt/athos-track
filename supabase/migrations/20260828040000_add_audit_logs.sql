-- LOGS/AUDITORIA (seção 21 do brief multi-tenant): até aqui, eventos
-- administrativos só iam pro console.error do processo — não persistidos,
-- não consultáveis depois de um restart/redeploy. Esta migration cria uma
-- trilha real, append-only (sem UPDATE/DELETE via API — ver server/api/rest.ts).
--
-- client_id nullable: ações de escopo puramente ATHOS (ex.: nenhuma ainda,
-- mas a coluna existe pra não travar isso no futuro) ficam visíveis só pro
-- ATHOS_ADMIN, igual ao padrão já usado em cargo_shipments (SEC-011).
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references user_profiles(id) on delete set null,
  actor_email text not null,
  client_id uuid references company_clients(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  result text not null check (result in ('success', 'error')),
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_logs_client on audit_logs(client_id);
create index if not exists idx_audit_logs_created on audit_logs(created_at desc);
