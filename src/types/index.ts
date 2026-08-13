export type ThemeMode = 'light' | 'dark';
export type MapViewMode = '2D' | 'SATELLITE' | 'HYBRID' | 'STREETS' | 'TERRAIN' | 'NIGHT' | 'TRAFFIC';
export type PositionSource = 'GPS' | 'GPS Satellite' | 'LBS' | 'Wi-Fi' | 'BLE Gateway' | 'Manual';

export type UserRole =
  | 'ATHOS_ADMIN'
  | 'CLIENT_ADMIN'
  | 'FLEET_MANAGER'
  | 'CART_MANAGER'
  | 'ASSET_MANAGER'
  | 'OPERATOR'
  | 'VIEWER';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  clientId?: string;
  unitId?: string;
}

export interface CompanyClient {
  id: string;
  name: string;
  code: string;
  cnpj: string;
  unitsCount: number;
  assetsCount: number;
  status: 'active' | 'inactive';
  // Expiração de serviço em nível de conta/empresa (revenda white-label)
  serviceExpireDate?: string;
}

export interface CompanyUnit {
  id: string;
  clientId: string;
  name: string;
  city: string;
  state: string;
  address: string;
  assetsCount: number;
  status: 'active' | 'inactive';
}

export type AssetCategory =
  | 'cart'
  | 'vehicle'
  | 'truck'
  | 'forklift'
  | 'asset'
  | 'bike'
  | 'cargo'
  | 'tag'
  | 'agro';

export type AssetSubcategory =
  | 'supermarket_cart'
  | 'pcd_cart'
  | 'car'
  | 'truck'
  | 'van'
  | 'pickup'
  | 'motorcycle'
  | 'forklift'
  | 'reach_truck'
  | 'bike'
  | 'cargo_box'
  | 'cattle'
  | 'horse'
  | 'sheep'
  | 'tractor'
  | 'notebook'
  | 'generator'
  | 'freezer'
  | 'tool'
  | 'machine'
  | 'tag';

export type AssetStatus =
  | 'online'
  | 'offline'
  | 'moving'
  | 'stopped'
  | 'out_of_geofence'
  | 'low_battery'
  | 'maintenance'
  | 'available'
  | 'in_use';

export interface TelemetryData {
  latitude: number;
  longitude: number;
  speed: number; // km/h
  batteryLevel: number; // percentage 0-100
  signalStrength: number; // percentage 0-100
  lastCommunication: string;
  ignition?: boolean;
  odometer?: number;
  operatingHours?: number;
  temperature?: number;
  heading?: number; // 0-360 degrees
  gpsAccuracy?: number; // e.g. 8 (meters)
  positionSource?: PositionSource;
  packetTimestamp?: string;
  // Sensor de combustível calibrado (percentual + volume, com capacidade do tanque)
  fuelPercent?: number; // 0-100
  fuelVolumeLiters?: number;
  fuelTankCapacityLiters?: number;
  possibleFuelTheft?: boolean; // queda abrupta de volume fora de reabastecimento
  // Diagnóstico de motor via OBD-II / barramento CAN
  canBusConnected?: boolean;
  obdErrorCodes?: string[];
  // Calibração multi-tanque (curva AD por fração de volume, veículos com 2 tanques)
  fuelTanks?: FuelTankCalibration[];
  // Sinais estendidos do barramento CAN usados na pontuação de condução
  rpm?: number;
  engineTemperature?: number; // ECT em °C
  idlingMinutesToday?: number;
}

export type TireStatus = 'normal' | 'low_pressure' | 'high_pressure' | 'fault';

export interface TirePosition {
  position: string; // ex.: "FL", "FR", "RL1", "RL2", "RR1", "RR2"
  pressureKpa: number;
  temperatureC: number;
  status: TireStatus;
}

export interface FuelTankAdPoint {
  fraction: '1/4' | '1/2' | '3/4' | 'cheio';
  adValue: number; // leitura bruta do sensor analógico (AD) naquela fração do tanque
}

export interface FuelTankCalibration {
  tankNumber: 1 | 2;
  capacityLiters: number;
  volumeLiters: number;
  percent: number;
  adCurve: FuelTankAdPoint[];
}

export interface ScheduledUnlockWindow {
  id: string;
  startTime: string; // "08:00"
  endTime: string; // "18:00"
  daysOfWeek: number[]; // 0 (domingo) - 6 (sábado)
}

export interface AssetDevice {
  id: string;
  name: string;
  code: string; // Heritage or Tag ID
  imei: string;
  category: AssetCategory;
  subcategory?: AssetSubcategory;
  clientId: string;
  unitId: string;
  unitName: string;
  status: AssetStatus;
  telemetry: TelemetryData;
  protocol:
    | 'GT06'
    | 'Traccar Compatible'
    | 'Wialon IPS'
    | 'JT/T808'
    | 'Suntech'
    | 'Queclink'
    | 'MQTT'
    | 'HTTP'
    | 'BLE Gateway'
    | 'RFID'
    | 'NFC'
    | 'Custom';
  responsibleName?: string;
  driverName?: string;
  model?: string;
  plateNumber?: string;
  geofenceId?: string;
  geofenceName?: string;
  lastMovement: string;
  // Fleet control extensions
  isBlocked?: boolean; // remote ignition immobilization (bloqueio de veículo)
  isDoorLocked?: boolean; // trava elétrica remota de porta (independente do bloqueio de ignição)
  speedLimitKmh?: number; // per-vehicle speed monitoring threshold
  cameraChannelsCount?: number; // nº de câmeras embarcadas disponíveis para snapshot remoto (0 = sem câmera)
  assignedDriverId?: string;
  lastMaintenanceDate?: string;
  nextMaintenanceDue?: string;
  // Cascata de prioridade de posicionamento (fallback quando o sinal principal falha)
  positioningPriority?: PositionSource[]; // ex.: ['GPS', 'Wi-Fi', 'LBS']
  // Cartão IC de proximidade vinculado à trava elétrica de porta (distinto da tag RFID/NFC de identificação)
  doorLockCardId?: string;
  doorLockCardBoundAt?: string;
  // Automação de trava: destrava automática ao entrar em cerca virtual + janelas de horário programadas
  autoUnlockOnGeofenceEntry?: boolean;
  scheduledUnlockWindows?: ScheduledUnlockWindow[];
  // TPMS - monitoramento de pressão dos pneus por posição
  tirePositions?: TirePosition[];
  // Expiração de serviço em nível de dispositivo (revenda white-label)
  serviceExpireDate?: string;
  // Último comando remoto operacional enviado (feedback de UI)
  lastRemoteCommand?: { command: string; label: string; sentAt: string };
  // Sincronização de whitelist offline de motoristas para o imobilizador (funciona sem rede)
  offlineWhitelistSyncedAt?: string;
  // Captura de foto agendada (diferente de snapshot único via câmera)
  scheduledPhotoCapture?: {
    enabled: boolean;
    intervalMinutes: number;
    onlyWhenIgnitionOn: boolean;
    fromTime: string;
    toTime: string;
  };
}

export type DriverStatus = 'active' | 'inactive' | 'suspended';
export type FatigueStatus = 'normal' | 'attention' | 'critical';

export interface Driver {
  id: string;
  name: string;
  cnhNumber: string; // Carteira Nacional de Habilitação
  cnhCategory: 'A' | 'B' | 'AB' | 'C' | 'D' | 'E';
  cnhExpiry: string;
  phone: string;
  clientId: string;
  unitId: string;
  unitName: string;
  status: DriverStatus;
  assignedVehicleId?: string;
  assignedVehiclePlate?: string;
  fatigueScore: number; // 0 (alerta/descansado) - 100 (fadiga crítica)
  fatigueStatus: FatigueStatus;
  lastFatigueCheck: string;
  continuousDrivingHours: number; // horas de condução contínua desde a última parada
  drivingHoursToday: number;
  // Pontuação de condução via eventos CAN/OBD (100 = condução exemplar, 0 = crítica)
  drivingScore?: number;
  harshEventsToday?: {
    suddenAcceleration: number;
    suddenBraking: number;
    sharpTurn: number;
    excessiveIdlingMinutes: number;
  };
}

export type MaintenanceType = 'preventiva' | 'corretiva' | 'revisao' | 'pneus' | 'oleo';
export type MaintenanceStatus = 'agendada' | 'em_andamento' | 'concluida' | 'atrasada';

export interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  vehicleName: string;
  type: MaintenanceType;
  description: string;
  status: MaintenanceStatus;
  scheduledDate: string;
  completedDate?: string;
  odometerAtService?: number;
  cost?: number;
  workshop?: string;
}

export type TripStatus = 'planejada' | 'em_andamento' | 'concluida';

export interface TripRecord {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  vehicleName: string;
  driverId?: string;
  driverName: string;
  origin: string;
  destination: string;
  startTime: string;
  endTime?: string;
  distanceKm: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  status: TripStatus;
  // Vínculo com modelo de rota reutilizável (Yaw/YawTrip) + detecção de desvio
  routeTemplateId?: string;
  deviationDetected?: boolean;
}

export interface RouteTemplate {
  id: string;
  name: string;
  clientId: string;
  unitId: string;
  origin: string;
  destination: string;
  waypoints: [number, number][];
  estDistanceKm: number;
  estDurationMin: number;
}

export type AlertSeverity = 'info' | 'warning' | 'critical';

export type AlertType =
  | 'geofence_exit'
  | 'geofence_entry'
  | 'low_battery'
  | 'offline_device'
  | 'movement'
  | 'speeding'
  | 'extended_stop'
  | 'route_diverted'
  | 'impact'
  | 'fall_detected'
  | 'fuel_theft'
  | 'seal_tampered'
  | 'high_risk_zone_entry'
  | 'tire_pressure'
  | 'harsh_driving'
  | 'pairing_separation';

export interface SystemAlert {
  id: string;
  assetId: string;
  assetName: string;
  category: AssetCategory;
  unitName: string;
  type: AlertType;
  title: string;
  message: string;
  severity: AlertSeverity;
  timestamp: string;
  acknowledged: boolean;
  latitude: number;
  longitude: number;
}

export interface Geofence {
  id: string;
  name: string;
  clientId: string;
  unitId: string;
  type: 'circle' | 'polygon';
  coordinates: [number, number][]; // Lat, Lng pairs
  radius?: number; // for circles in meters
  color: string;
  rules: {
    entryAlert: boolean;
    exitAlert: boolean;
    stayAlert: boolean;
    maxSpeed?: number;
  };
  assignedAssetsCount: number;
  /** Tipo de ativo monitorado por esta cerca (carrinhos, frota, empilhadeiras, agro, etc.) */
  targetCategory?: AssetCategory | 'all';
  /** Zona de alto risco (ex.: pátio de penhor/desmanche) usada pelo módulo de Recuperação de Ativos */
  isHighRiskZone?: boolean;
}

export type SealStatus = 'sealed' | 'open' | 'tampered';

export type SealTriggerMethod =
  | 'button'
  | 'rfid'
  | 'nfc'
  | 'registered_card'
  | 'unregistered_card'
  | 'sms'
  | 'platform';

export interface CargoShipment {
  id: string;
  code: string;
  cargoDescription: string;
  origin: string;
  destination: string;
  carrier: string;
  vehiclePlate: string;
  driverName: string;
  tagId: string;
  status: 'origem' | 'coleta' | 'em_transito' | 'parada' | 'destino' | 'entregue';
  eta: string;
  temperatureTarget?: string;
  currentLocation: string;
  latitude: number;
  longitude: number;
  progressPercent: number;
  eventsCount: number;
  // Lacre eletrônico (electronic seal)
  sealStatus?: SealStatus;
  sealLastTrigger?: SealTriggerMethod;
  sealLastEventTime?: string;
}

export interface FleetVehicle {
  id: string;
  plate: string;
  model: string;
  type: 'car' | 'truck' | 'van' | 'motorcycle';
  driver: string;
  status: AssetStatus;
  mileage: number; // km
  fuelLevel: number; // %
  lastMaintenance: string;
  nextMaintenanceDue: string;
  unitName: string;
  telemetry: TelemetryData;
}

export interface RoutePoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  speed: number;
  event?: string;
}

// ===================== Camada de Trânsito em Tempo Real (mock) =====================

export type TrafficCongestionLevel = 'free' | 'moderate' | 'heavy' | 'stopped';

export interface TrafficSegment {
  id: string;
  roadName: string;
  coordinates: [number, number][];
  congestionLevel: TrafficCongestionLevel;
  avgSpeedKmh: number;
  updatedAt: string;
}

export interface CartRecovery {
  id: string;
  assetId: string;
  assetName: string;
  assetCode: string;
  unitName: string;
  recoveredBy: string;
  signatureName: string;
  notes?: string;
  photoDataUrl?: string;
  relatedAlertId?: string;
  timestamp: string;
}

export interface SystemIntegration {
  id: string;
  name: string;
  type: 'GT06' | 'REST API' | 'WebSocket' | 'MQTT' | 'Webhooks' | 'BLE Gateway';
  status: 'active' | 'inactive' | 'testing';
  lastPing: string;
  activeDevicesCount: number;
  endpointUrl?: string;
  apiKey?: string;
}

// ===================== Ordens de Serviço (Instalação/Manutenção Técnica) =====================

export type WorkOrderType = 'instalacao' | 'manutencao' | 'desinstalacao' | 'auditoria';
export type WorkOrderStatus = 'pendente' | 'agendada' | 'em_andamento' | 'concluida' | 'cancelada';

/** Ponto de referência marcável no diagrama da carroceria do veículo (onde o rastreador foi instalado/escondido). */
export interface InstallationPoint {
  id: string;
  pointCode: string; // número exibido no diagrama, ex.: "17"
  label: string; // ex.: "Para-choque dianteiro"
  xPercent: number; // posição horizontal no diagrama (0-100)
  yPercent: number; // posição vertical no diagrama (0-100)
}

export interface WorkOrder {
  id: string;
  code: string;
  type: WorkOrderType;
  assetId?: string;
  assetName?: string;
  vehiclePlate?: string;
  clientId: string;
  unitId: string;
  unitName: string;
  technicianName: string;
  status: WorkOrderStatus;
  scheduledDate: string;
  completedDate?: string;
  installPointId?: string; // referência a InstallationPoint.id escolhido pelo técnico
  installPhotoDataUrl?: string;
  notes?: string;
}

// ===================== Recuperação de Ativos (Zona de Risco / Greylist) =====================

export type GreylistEntryType = 'endereco' | 'pessoa' | 'local_penhora';

export interface GreylistEntry {
  id: string;
  type: GreylistEntryType;
  label: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  clientId: string;
  addedAt: string;
}

export type RecoveryCaseStatus = 'aberto' | 'em_negociacao' | 'localizado' | 'recuperado' | 'encerrado';

export interface FrequentStopPoint {
  latitude: number;
  longitude: number;
  label: string;
  visitCount: number;
  lastVisit: string;
}

export interface AssetRecoveryCase {
  id: string;
  assetId: string;
  assetName: string;
  assetCode: string;
  plateNumber?: string;
  clientId: string;
  unitName: string;
  reason: string; // ex.: inadimplência, furto
  status: RecoveryCaseStatus;
  openedAt: string;
  responsibleName: string;
  lastKnownLatitude?: number;
  lastKnownLongitude?: number;
  frequentStopPoints: FrequentStopPoint[];
  notes?: string;
}

// ===================== Pareamento & Alerta de Proximidade (comboio/escolta) =====================

export interface AssetPairing {
  id: string;
  label: string;
  clientId: string;
  primaryAssetId: string;
  primaryAssetName: string;
  secondaryAssetId: string;
  secondaryAssetName: string;
  maxDistanceMeters: number;
  active: boolean;
}
