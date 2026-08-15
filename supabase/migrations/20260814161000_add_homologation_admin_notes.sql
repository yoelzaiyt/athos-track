-- Campo de observações do painel interno ATHOS (item 14 do pedido de
-- homologação) — só authenticated escreve aqui (RLS já herdado da tabela).
alter table homologation_requests add column admin_notes text;
