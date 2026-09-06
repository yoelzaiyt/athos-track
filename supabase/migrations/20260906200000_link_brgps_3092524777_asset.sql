-- Vincula a tag BRGPS 3092524777 (já descoberta no catálogo do fornecedor
-- desde 2026-08-15, via provider_devices) a um Asset novo, pra teste do
-- pipeline BRGPS -> Asset -> banco (mesmo padrão do CAR-01, o Carrinho
-- BRGPS 1603000067 — ver supabase/migrations/20260815060000_add_brgps_
-- provider_integration.sql e docs/HARDWARE-CATALOG.md).
--
-- ATENÇÃO (docs/HARDWARE-CATALOG.md, "Hipótese forte 2026-09-06"): a posição
-- retornada por essa tag é consistente com dado de demonstração do
-- fornecedor (mesma cidade — Bangkok — em testes ao vivo repetidos), não
-- confirmada como unidade física real em uso. Serve pra validar o pipeline
-- técnico, não pra decisão operacional sobre um carrinho real.
--
-- Idempotente: não faz nada se já existir um asset com este imei (ex: já
-- rodado manualmente nesta sessão antes desta migration existir).

do $$
declare
  v_client_id uuid := 'b49d650e-e744-4b34-b1d2-0c39095a0dc4'; -- mesmo tenant do CAR-01
  v_unit_id uuid := '64da3196-0d85-40c9-9c9d-60f9f817fcfd';   -- unidade "Matriz"
  v_provider_device_id uuid;
  v_asset_id uuid;
begin
  select id into v_provider_device_id
  from provider_devices
  where provider = 'BRGPS' and external_device_id = '3092524777';

  if v_provider_device_id is null then
    raise notice 'provider_devices para 3092524777 não encontrado — pulei esta migration (rode brgps:discover antes).';
    return;
  end if;

  select id into v_asset_id from assets where imei = '3092524777';

  if v_asset_id is null then
    insert into assets
      (name, code, imei, category, subcategory, client_id, unit_id, unit_name, status, protocol, provider, provider_device_id)
    values
      ('Carrinho BRGPS 3092524777', 'CAR-03', '3092524777', 'cart', 'supermarket_cart',
       v_client_id, v_unit_id, 'Matriz', 'offline', 'BLE Gateway', 'BRGPS', v_provider_device_id)
    returning id into v_asset_id;
  end if;

  update provider_devices
  set asset_id = v_asset_id, status = 'ASSIGNED'
  where id = v_provider_device_id and (asset_id is distinct from v_asset_id or status <> 'ASSIGNED');
end $$;
