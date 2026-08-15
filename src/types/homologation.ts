export type HomologationProtocol =
  | 'GT06'
  | 'GT06N'
  | 'GT06E'
  | 'H02'
  | 'JT/T808'
  | 'TK103'
  | 'Protocolo proprietário'
  | 'Outro';

export type HomologationTransport = 'TCP' | 'UDP' | 'HTTP' | 'HTTPS' | 'MQTT' | 'Outro';

export type HomologationStatus = 'pending_review' | 'in_progress' | 'completed';

export type HomologationResult = 'COMPATIVEL' | 'PENDENTE';

export interface HomologationRequest {
  id: string;
  sessionToken: string;
  // Empresa
  companyLegalName: string;
  companyTradeName?: string;
  technicalContactName: string;
  technicalContactEmail: string;
  technicalContactPhone: string;
  // Equipamento
  manufacturer: string;
  model: string;
  firmwareVersion?: string;
  testImei: string;
  estimatedDeviceCount?: number;
  // Comunicação / Transporte
  protocol: HomologationProtocol;
  transport: HomologationTransport;
  // Informações técnicas (capacidades de configuração do dispositivo)
  supportsDnsConfig: boolean;
  supportsIpConfig: boolean;
  supportsPortConfig: boolean;
  supportsApnConfig: boolean;
  supportsTransmissionIntervalConfig: boolean;
  supportsHeartbeatConfig: boolean;
  supportsTimezoneConfig: boolean;
  supportsPrimaryServerConfig: boolean;
  supportsSecondaryServerConfig: boolean;
  // Documentação (texto/links nesta entrega — sem upload de arquivo)
  manualUrl?: string;
  protocolDocUrl?: string;
  commandTableUrl?: string;
  firmwareDocUrl?: string;
  payloadSampleText?: string;
  configDocUrl?: string;
  // Integração
  canTransmitToThirdPartyServer: boolean;
  supportsDnsResolution: boolean;
  hasManufacturerApi: boolean;
  manufacturerApiType?: 'REST' | 'SOAP' | 'WebSocket' | 'MQTT' | 'Outra';
  hasForwardingMirroring: boolean;
  forwardingDescription?: string;
  status: HomologationStatus;
  adminNotes?: string;
  createdAt: string;
}

export interface HomologationDevice {
  id: string;
  requestId: string;
  imei: string;
  manufacturer?: string;
  model?: string;
  firmwareVersion?: string;
  demoMode: boolean;
  createdAt: string;
}

export type HomologationStep =
  | 'awaiting_connection'
  | 'device_connected'
  | 'handshake_received'
  | 'imei_identified'
  | 'location_packet_received'
  | 'heartbeat_received'
  | 'protocol_identified'
  | 'homologation_completed';

export type HomologationEventStatus = 'pending' | 'success' | 'error';

export interface HomologationEvent {
  id: string;
  requestId: string;
  deviceId?: string;
  sessionToken: string;
  imeiMasked: string;
  protocol: string;
  packetType: string;
  step: HomologationStep;
  status: HomologationEventStatus;
  latencyMs?: number;
  createdAt: string;
}

export interface HomologationReport {
  id: string;
  requestId: string;
  deviceId?: string;
  protocol: string;
  transport: string;
  dnsCompatible: boolean;
  connectionOk: boolean;
  loginPacketOk: boolean;
  heartbeatOk: boolean;
  locationPacketOk: boolean;
  result: HomologationResult;
  createdAt: string;
}
