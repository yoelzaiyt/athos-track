-- Correção de categoria pedida no prompt de validação ao vivo (2026-09-10):
-- as 2 tags do São João (CAR-01/1603000067, CAR-03/3092524777) foram
-- cadastradas como 'cart' (herdado do teste de homologação original, quando
-- ainda eram usadas só pra validar o pipeline técnico BRGPS — ver
-- docs/HARDWARE-CATALOG.md). O tipo de ativo real do cliente São João é
-- CAIXA, não carrinho.
--
-- Efeito direto: src/pages/CartsModule.tsx filtra `category === 'cart'` e
-- src/pages/BoxesModule.tsx filtra `category === 'box'` — com as 2 tags
-- como 'cart', "Carrinhos" mostrava 12 (10 Zaffari + 2 São João) e "Caixas"
-- mostrava 0. Causa raiz: dado errado no banco, não bug de query/filtro (o
-- filtro em si já está correto e não muda nesta migration).
--
-- 'box' já é valor válido em assets_category_check desde 20260828020000.
-- Preserva id/histórico/posições/eventos/tenant/datas — só muda
-- category/subcategory/name (que citava "Carrinho" no texto, agora
-- desatualizado); code (CAR-01/CAR-03) mantido de propósito, é só um
-- identificador interno já referenciado em relatórios anteriores.

update assets
set category = 'box', subcategory = 'box',
    name = replace(name, 'Carrinho BRGPS', 'Caixa BRGPS'),
    updated_at = now()
where imei in ('1603000067', '3092524777') and category <> 'box';
