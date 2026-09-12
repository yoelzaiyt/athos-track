-- Amarra uma integração (system_integrations) ao valor livre usado em
-- assets.provider (ex: 'BRGPS'), permitindo calcular "Dispositivos
-- Conectados" a partir dos ativos reais em vez de um contador estático
-- que nunca era atualizado.
alter table system_integrations add column if not exists provider text;
