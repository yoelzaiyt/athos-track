-- Pré-cadastro das 10 tags físicas do tenant ZAFFARI (seção 5 do brief) —
-- cadastradas ANTES de qualquer sinal real, prontas pra reconhecimento
-- automático quando a tag for ligada fisicamente e descoberta via
-- BRGPS GET /tag/all (npm run brgps:discover). Vínculo Device -> Asset
-- (provider/provider_device_id) continua manual via TagsModule.tsx — mesmo
-- padrão de segurança já existente pra CAR-01/CAR-03 (nunca criar/ativar
-- automaticamente um dispositivo desconhecido, seção 7/12 do brief); o que
-- muda aqui é que o Asset já existe de antemão, então ligar a tag não exige
-- recadastro, só a vinculação de um dispositivo já descoberto a um asset já
-- existente.
--
-- Nenhuma das 10 IDs apareceu no catálogo do fornecedor na consulta real
-- feita nesta sessão (`npm run brgps:discover`, 2026-09-10 — 1 dispositivo
-- só no catálogo desta conta BRGPS). Não é bloqueio: a seção 5 pede pra
-- cadastrar já, sem esperar a tag ser ligada.
--
-- 'awaiting_first_signal': status novo (não existia) pra representar
-- exatamente o estado pedido — physical_status=AWAITING_FIRST_SIGNAL +
-- connection_status=OFFLINE ao mesmo tempo, sem posição/coordenada
-- fabricada. Quando a primeira posição real chegar, BrGpsRepository.
-- applyPosition (server/integrations/brgps/db.ts) já promove pra 'online'
-- automaticamente (correção aplicada nesta sessão, commit 3516bf9).

alter table assets drop constraint if exists assets_status_check;
alter table assets add constraint assets_status_check check (status in (
  'online', 'offline', 'moving', 'stopped', 'out_of_geofence',
  'low_battery', 'maintenance', 'available', 'in_use', 'awaiting_first_signal'
));

do $$
declare
  v_zaffari_client_id uuid;
  v_zaffari_unit_id uuid;
  v_tag_ids text[] := array[
    '3092524960','3092524712','3092533124','3092524666','3092533106',
    '3092524840','3092524939','3092533107','3092524906','3092533120'
  ];
  v_tag_id text;
  v_seq int := 1;
begin
  select id into v_zaffari_client_id from company_clients where code = 'ZAFFARI';
  select id into v_zaffari_unit_id from company_units where client_id = v_zaffari_client_id and name = 'Matriz';

  if v_zaffari_client_id is null or v_zaffari_unit_id is null then
    raise exception 'Tenant ZAFFARI ou unidade Matriz não encontrados — abortando pré-cadastro.';
  end if;

  foreach v_tag_id in array v_tag_ids loop
    if not exists (select 1 from assets where imei = v_tag_id) then
      insert into assets
        (name, code, imei, category, subcategory, client_id, unit_id, unit_name, status, protocol)
      values (
        'Carrinho BRGPS ' || v_tag_id,
        'ZAF-CART-' || lpad(v_seq::text, 2, '0'),
        v_tag_id,
        'cart',
        'supermarket_cart',
        v_zaffari_client_id,
        v_zaffari_unit_id,
        'Matriz',
        'awaiting_first_signal',
        'BLE Gateway'
      );

      insert into audit_logs (actor_email, client_id, action, entity_type, entity_id, result, detail)
      values (
        'system:migration', v_zaffari_client_id, 'TAG_PRE_REGISTERED', 'asset',
        (select id::text from assets where imei = v_tag_id), 'success',
        jsonb_build_object(
          'tag_imei', v_tag_id,
          'client_code', 'ZAFFARI',
          'category', 'cart',
          'migration', '20260910100200_register_zaffari_tags.sql'
        )
      );
    end if;

    v_seq := v_seq + 1;
  end loop;
end $$;
