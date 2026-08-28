-- Fechamento do Gerenciador de Tenants: campos que a tela administrativa
-- (src/pages/admin/ClientsPage.tsx, evoluída nesta rodada) precisa pra
-- identificador amigável, identidade visual e provider padrão por tenant.
-- Reaproveita company_clients (já é o "tenant" desde a rodada anterior —
-- ver docs/MULTI-TENANT-ARCHITECTURE.md) em vez de criar tabela nova.

alter table company_clients
  add column if not exists slug text,
  add column if not exists default_provider_id text not null default 'brgps',
  add column if not exists brand_color text,
  add column if not exists logo_url text;

create unique index if not exists idx_company_clients_slug on company_clients(slug) where slug is not null;

-- Backfill dos tenants já existentes.
update company_clients set slug = 'sao-joao' where code = 'SAO-JOAO' and slug is null;
update company_clients set slug = 'athos-track-demo' where code = 'DEMO-01' and slug is null;

-- TENANT 2 é o Grupo Zaffari (mesmos módulos de carrinhos+ativos que já
-- estavam configurados como "Zafari" — nome/grafia informal da rodada
-- anterior) — mesma entidade, corrigida pro nome real do cliente, não um
-- tenant novo (evita duplicar/misturar dado). Confirmado pelo usuário
-- 2026-08-28 (uma rodada anterior tinha inferido erradamente "Afrin").
update company_clients
  set name = 'Grupo Zaffari', code = 'ZAFFARI', slug = 'grupo-zaffari'
  where code in ('ZAFARI', 'AFRIN');
