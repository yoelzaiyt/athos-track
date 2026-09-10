-- Dois ajustes pedidos após validar o pipeline BRGPS -> Asset (ver
-- docs/HARDWARE-CATALOG.md):
--
-- 1) CAR-01 (1603000067) e CAR-03 (3092524777) já recebem posição real via
--    BRGPS mas ficavam presos em status='offline' — bug real corrigido em
--    server/integrations/brgps/db.ts (applyPosition só promovia status em
--    trânsito de geofence, e nenhum dos dois tem geofence configurada).
--    Aplica aqui o efeito retroativo pros dois já sincronizados; daqui pra
--    frente o próprio sync mantém isso sozinho.
--
-- 2) CAR-02 (3092660181) nunca recebeu nenhuma comunicação real (é a tag em
--    homologação via GT06 bruto, não via BRGPS — ver fly.gt06-homolog.toml)
--    e foi removida da lista de assets ativos a pedido do usuário. A tabela
--    gt06_homolog_devices (que rastreia essa tag de fato) não é afetada.

update assets
set status = 'online', updated_at = now()
where imei in ('1603000067', '3092524777')
  and status = 'offline'
  and telemetry_last_communication is not null;

delete from assets where imei = '3092660181' and provider is null;
