-- Adiciona coluna de observabilidade pra medir latência real do dispositivo ao
-- nosso servidor (T3). Additiva e nullable — não quebra nada que já existe.
--
-- Para o caminho DIRETO (GT06/TCP): server_received_at = instante em que o
-- listener TCP recebeu o chunk de bytes (capturado em socket.on('data')),
-- NÃO o timestamp do GPS do dispositivo (que vai pra packet_timestamp).
-- Permite calcular device→server latency = server_received_at - packet_timestamp.
--
-- Para o caminho VENDOR (BRGPS API polling): server_received_at = now() no
-- momento do sync tick (BrGpsService.runSyncTick), que é ~T3 do ciclo de
-- polling. Menos preciso que o direto (polling adiciona 0~BRGPS_SYNC_INTERVAL
-- segundos de imprecisão), mas suficiente pra comparar paths.
--
-- Rollback: alter table assets drop column telemetry_server_received_at;

alter table assets add column telemetry_server_received_at timestamptz;

comment on column assets.telemetry_server_received_at is 'T3: instante em que nosso servidor recebeu/recolheu a posição — capturado no momento do TCP data (direto) ou do sync tick (vendor polling). Diferente de packet_timestamp (T1: timestamp do GPS no dispositivo).';

-- Índice parcial pra queries de latência (só linhas que têm o campo).
create index idx_assets_server_received_at on assets (telemetry_server_received_at)
  where telemetry_server_received_at is not null;
