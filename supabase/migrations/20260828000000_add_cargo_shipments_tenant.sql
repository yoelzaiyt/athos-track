-- SEC-002 follow-up (ver SECURITY-GATE-REPORT.md): cargo_shipments é dado de
-- negócio por cliente (cada empresa tem suas próprias cargas em trânsito),
-- mas nunca ganhou client_id/unit_id na migration inicial — ficou de fora do
-- escopo de tenant que server/api/rest.ts agora impõe pras demais tabelas.
-- Nullable de propósito: sem forma de inferir o tenant certo pra linhas
-- antigas (não há client_id/asset_id pra derivar); linha com client_id nulo
-- fica visível só pra ATHOS_ADMIN (rest.ts trata null como "tenant
-- desconhecido", não como "público").
alter table cargo_shipments
  add column client_id uuid references company_clients(id) on delete cascade,
  add column unit_id uuid references company_units(id) on delete set null;

create index idx_cargo_shipments_client on cargo_shipments(client_id);
