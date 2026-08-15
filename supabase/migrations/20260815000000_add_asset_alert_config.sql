-- Atalhos de alertas/notificações por dispositivo (painel "Atalhos de Alertas"
-- no DeviceFormModal, inspirado no painel de configuração de rastreadores
-- GT06 white-label). Fica em jsonb (mesmo padrão de scheduled_photo_capture)
-- em vez de uma coluna por alerta — é um bloco de preferências, não dado
-- consultado/filtrado em queries.
alter table assets add column if not exists alert_config jsonb;
