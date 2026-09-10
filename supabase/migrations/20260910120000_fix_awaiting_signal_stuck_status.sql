-- Efeito retroativo da correção em server/integrations/brgps/db.ts
-- (applyPosition promovia 'offline' -> 'online' em posição nova real, mas
-- não promovia o status 'awaiting_first_signal' introduzido na sessão
-- anterior — as 10 tags Zaffari receberam posição real via BRGPS_2
-- (sync-once, 2026-09-10, aplicadas=10) mas ficaram presas mostrando
-- "aguardando primeiro sinal" mesmo já tendo sinal real).
--
-- Daqui pra frente o próprio sync mantém isso sozinho (código já corrigido).
-- Escopo estreito de propósito: só assets que realmente têm telemetria
-- (telemetry_packet_timestamp não nulo) e ainda estão no status inicial —
-- nunca promove um asset que segue genuinamente sem sinal nenhum.

update assets
set status = 'online', updated_at = now()
where status = 'awaiting_first_signal'
  and telemetry_packet_timestamp is not null;
