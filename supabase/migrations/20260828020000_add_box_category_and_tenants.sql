-- Multi-tenant/multi-provider (prompt "ZAFARI + SÃO JOÃO + HEILE/JASON"):
--
-- 1. Categoria 'box' (Caixa) em assets — distinta de 'cargo' (que já existia
--    e é o domínio de frete/lacre eletrônico em cargo_shipments, um conceito
--    de negócio diferente). "Caixa" é um ativo rastreável genérico, como
--    'cart' já é pra carrinho.
-- 2. Tenants iniciais Zafari e São João, reaproveitando company_clients/
--    company_units (o "tenant" do prompt novo já é o client_id que toda a
--    correção de isolamento desta sessão — SEC-002/006/011 — já impõe em
--    server/api/rest.ts). Não criamos uma tabela "tenants" nova.

alter table assets drop constraint if exists assets_category_check;
alter table assets add constraint assets_category_check check (category in (
  'cart', 'vehicle', 'truck', 'forklift', 'asset', 'bike', 'cargo', 'box', 'tag', 'agro'
));

-- company_clients não tem hoje uma coluna de "módulos habilitados" — o menu
-- lateral do frontend decide o que mostrar hoje por role, não por tenant.
-- Adiciona isso de forma genérica (jsonb), sem acoplar a Zafari/São João
-- especificamente, pra caber futuros tenants/módulos sem migration nova.
alter table company_clients add column if not exists enabled_modules jsonb not null default '["assets"]'::jsonb;

insert into company_clients (name, code, cnpj, status, enabled_modules)
values
  ('Zafari', 'ZAFARI', '00.000.000/0002-00', 'active', '["carts", "assets"]'::jsonb),
  ('São João', 'SAO-JOAO', '00.000.000/0003-00', 'active', '["boxes", "assets"]'::jsonb)
on conflict (code) do nothing;

insert into company_units (client_id, name, city, state, address, status)
select id, 'Matriz', 'São Paulo', 'SP', 'Sede', 'active'
from company_clients
where code in ('ZAFARI', 'SAO-JOAO')
  and not exists (
    select 1 from company_units u where u.client_id = company_clients.id
  );
