-- Registra as 2 caixas do tenant SÃO JOÃO (CAR-01/1603000067,
-- CAR-03/3092524777) como schema, não como dado herdado.
--
-- Por que isso faltava: esses 2 assets existem no banco de produção desde a
-- homologação original do pipeline BRGPS, quando foram criados à mão no tenant
-- DEMO-01 e depois transferidos para SAO-JOAO (ver docs/TAG-INTEGRATION.md).
-- Nenhuma migration nunca os criou — a 20260910130000 só faz UPDATE de
-- category para 'box', o que em banco novo não encontra nada para atualizar.
--
-- Consequência prática, descoberta na primeira execução do CI (2026-09-12):
-- num Postgres recém-migrado o tenant SÃO JOÃO fica com 0 assets, e dois
-- testes de integração reais falham por ausência de dado, não por bug —
-- server/api/tag-classification.test.ts (espera 2 caixas) e
-- server/api/realtime.test.ts (dá UPDATE no imei 3092524777 para provar que
-- o evento chega ao tenant certo e não vaza para o outro).
--
-- Idempotente pela mesma guarda usada em 20260910100200_register_zaffari_tags:
-- só insere se o imei ainda não existir. Em produção, onde os 2 já estão
-- cadastrados, esta migration é no-op e não duplica nem sobrescreve nada.
--
-- Sem posição fabricada: entram com status 'awaiting_first_signal' e sem
-- coordenada. O vínculo com o dispositivo do fornecedor (provider/
-- provider_device_id) continua manual via TagsModule.tsx — nunca criar ou
-- ativar dispositivo automaticamente.

do $$
declare
  v_client_id uuid;
  v_unit_id uuid;
  v_boxes text[][] := array[
    array['1603000067', 'CAR-01'],
    array['3092524777', 'CAR-03']
  ];
  v_imei text;
  v_code text;
  i int;
begin
  select id into v_client_id from company_clients where code = 'SAO-JOAO';
  select id into v_unit_id from company_units
    where client_id = v_client_id and name = 'Matriz';

  if v_client_id is null or v_unit_id is null then
    raise exception 'Tenant SAO-JOAO ou unidade Matriz não encontrados — abortando cadastro das caixas.';
  end if;

  for i in 1 .. array_length(v_boxes, 1) loop
    v_imei := v_boxes[i][1];
    v_code := v_boxes[i][2];

    if not exists (select 1 from assets where imei = v_imei) then
      insert into assets
        (name, code, imei, category, subcategory, client_id, unit_id, unit_name, status, protocol)
      values (
        'Caixa BRGPS ' || v_imei,
        v_code,
        v_imei,
        'box',
        'box',
        v_client_id,
        v_unit_id,
        'Matriz',
        'awaiting_first_signal',
        'BLE Gateway'
      );

      insert into audit_logs (actor_email, client_id, action, entity_type, entity_id, result, detail)
      values (
        'system:migration', v_client_id, 'TAG_PRE_REGISTERED', 'asset',
        (select id::text from assets where imei = v_imei), 'success',
        jsonb_build_object(
          'tag_imei', v_imei,
          'client_code', 'SAO-JOAO',
          'category', 'box',
          'migration', '20260912000000_register_sao_joao_boxes.sql'
        )
      );
    end if;
  end loop;
end $$;
