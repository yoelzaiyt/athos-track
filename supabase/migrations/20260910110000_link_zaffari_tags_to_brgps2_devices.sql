-- Vincula as 10 tags Zaffari (pré-cadastradas em 20260910100200) aos
-- dispositivos reais descobertos na SEGUNDA conta BRGPS (provider='BRGPS_2',
-- endpoint China http://brseek.39gps.com/open, credencial confirmada pelo
-- fornecedor via WhatsApp 2026-09-10 para a conta "athostrack" — ver
-- docs/HARDWARE-CATALOG.md "Hipótese forte 2026-09-06", que já previa essa
-- possibilidade e deixava BRGPS2_* pronto, mas desativado até confirmação).
--
-- npx tsx server/brgps-sync/index.ts discover --account=2 (rodado nesta
-- sessão) confirmou exatamente as 10 IDs esperadas no catálogo desta conta —
-- match 100%, nenhuma sobrando, nenhuma faltando. Mesmo padrão de vínculo
-- manual/idempotente já usado pro CAR-03 (20260906200000), só que em lote.
--
-- Não ativa no fornecedor aqui (PATCH /tag é side-effect externo real —
-- feito depois, via server/brgps-sync/index.ts activate --account=2, fora de
-- uma migration SQL).

do $$
declare
  v_tag_id text;
  v_tag_ids text[] := array[
    '3092524960','3092524712','3092533124','3092524666','3092533106',
    '3092524840','3092524939','3092533107','3092524906','3092533120'
  ];
  v_provider_device_id uuid;
  v_asset_id uuid;
begin
  foreach v_tag_id in array v_tag_ids loop
    select id into v_provider_device_id
    from provider_devices
    where provider = 'BRGPS_2' and external_device_id = v_tag_id;

    if v_provider_device_id is null then
      raise notice 'provider_devices BRGPS_2 para % não encontrado — pulei (rode discover --account=2 antes).', v_tag_id;
      continue;
    end if;

    select id into v_asset_id from assets where imei = v_tag_id;

    if v_asset_id is null then
      raise notice 'asset para % não encontrado — pulei (rode 20260910100200 antes).', v_tag_id;
      continue;
    end if;

    update assets
    set provider = 'BRGPS_2', provider_device_id = v_provider_device_id, updated_at = now()
    where id = v_asset_id and provider is distinct from 'BRGPS_2';

    update provider_devices
    set asset_id = v_asset_id, status = 'ASSIGNED'
    where id = v_provider_device_id and (asset_id is distinct from v_asset_id or status <> 'ASSIGNED');
  end loop;
end $$;
