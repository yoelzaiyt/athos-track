-- Novos tipos de alerta vindos do pacote de Alarm do protocolo GT06 (0x16,
-- seção 5.3 da doc do fabricante): SOS, corte de energia e remoção do
-- rastreador não tinham equivalente no vocabulário existente (os demais
-- códigos de alarme do GT06 já mapeiam para tipos existentes — ver
-- mapAlarmCode em server/gt06-listener/protocol.ts).

alter table system_alerts drop constraint system_alerts_type_check;
alter table system_alerts add constraint system_alerts_type_check check (type in (
  'geofence_exit', 'geofence_entry', 'low_battery', 'offline_device', 'movement',
  'speeding', 'extended_stop', 'route_diverted', 'impact', 'fall_detected',
  'fuel_theft', 'seal_tampered', 'high_risk_zone_entry', 'tire_pressure',
  'harsh_driving', 'pairing_separation', 'sos', 'power_cut', 'device_removed'
));
