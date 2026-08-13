export type ThemeMode = 'light' | 'dark';
export type MapViewMode = '2D' | 'SATELLITE' | 'HYBRID';
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
  speedLimitKmh?: number; // per-vehicle speed monitoring threshold
  assignedDriverId?: string;
  lastMaintenanceDate?: string;
  nextMaintenanceDue?: string;
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
  | 'impact';

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
}

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
