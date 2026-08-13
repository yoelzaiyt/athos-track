// Camada de tradução entre as linhas do Supabase (snake_case, colunas planas)
// e os tipos do app em src/types/index.ts (camelCase, com TelemetryData/rules
// aninhados). Cada entidade tem três funções:
//   rowToX      — linha do banco -> tipo do app (usado após select)
//   xToInsertRow — tipo do app -> payload de insert (sem id; o banco gera)
//   xUpdatesToRow — Partial<tipo do app> -> payload de update (só campos presentes)

import type {
  AssetDevice,
  SystemAlert,
  Geofence,
  CargoShipment,
  Driver,
  MaintenanceRecord,
  TripRecord,
  CartRecovery,
  WorkOrder,
  GreylistEntry,
  AssetRecoveryCase,
  RouteTemplate,
  AssetPairing,
  TrafficSegment,
  PointOfInterest,
  CompanyClient,
  CompanyUnit,
} from '../types';

type Row = Record<string, any>;
type FieldMap = [string, string][];

function toRow(obj: Row, map: FieldMap): Row {
  const out: Row = {};
  for (const [appKey, dbKey] of map) out[dbKey] = obj[appKey];
  return out;
}

function toRowPartial(updates: Row, map: FieldMap): Row {
  const out: Row = {};
  for (const [appKey, dbKey] of map) {
    if (appKey in updates) out[dbKey] = updates[appKey];
  }
  return out;
}

function fromRow(row: Row, map: FieldMap): Row {
  const out: Row = {};
  for (const [appKey, dbKey] of map) out[appKey] = row[dbKey];
  return out;
}

// ===================== Assets (AssetDevice + TelemetryData embutida) =====================

const ASSET_FIELDS: FieldMap = [
  ['name', 'name'], ['code', 'code'], ['imei', 'imei'], ['category', 'category'],
  ['subcategory', 'subcategory'], ['clientId', 'client_id'], ['unitId', 'unit_id'],
  ['unitName', 'unit_name'], ['status', 'status'], ['protocol', 'protocol'],
  ['responsibleName', 'responsible_name'], ['driverName', 'driver_name'], ['model', 'model'],
  ['plateNumber', 'plate_number'], ['geofenceId', 'geofence_id'], ['geofenceName', 'geofence_name'],
  ['lastMovement', 'last_movement'], ['isBlocked', 'is_blocked'], ['isDoorLocked', 'is_door_locked'],
  ['speedLimitKmh', 'speed_limit_kmh'], ['cameraChannelsCount', 'camera_channels_count'],
  ['assignedDriverId', 'assigned_driver_id'], ['lastMaintenanceDate', 'last_maintenance_date'],
  ['nextMaintenanceDue', 'next_maintenance_due'], ['positioningPriority', 'positioning_priority'],
  ['doorLockCardId', 'door_lock_card_id'], ['doorLockCardBoundAt', 'door_lock_card_bound_at'],
  ['autoUnlockOnGeofenceEntry', 'auto_unlock_on_geofence_entry'],
  ['scheduledUnlockWindows', 'scheduled_unlock_windows'], ['tirePositions', 'tire_positions'],
  ['serviceExpireDate', 'service_expire_date'], ['lastRemoteCommand', 'last_remote_command'],
  ['offlineWhitelistSyncedAt', 'offline_whitelist_synced_at'],
  ['scheduledPhotoCapture', 'scheduled_photo_capture'],
];

const TELEMETRY_FIELDS: FieldMap = [
  ['latitude', 'telemetry_latitude'], ['longitude', 'telemetry_longitude'],
  ['speed', 'telemetry_speed'], ['batteryLevel', 'telemetry_battery_level'],
  ['signalStrength', 'telemetry_signal_strength'], ['lastCommunication', 'telemetry_last_communication'],
  ['ignition', 'telemetry_ignition'], ['odometer', 'telemetry_odometer'],
  ['operatingHours', 'telemetry_operating_hours'], ['temperature', 'telemetry_temperature'],
  ['heading', 'telemetry_heading'], ['gpsAccuracy', 'telemetry_gps_accuracy'],
  ['positionSource', 'telemetry_position_source'], ['packetTimestamp', 'telemetry_packet_timestamp'],
  ['fuelPercent', 'telemetry_fuel_percent'], ['fuelVolumeLiters', 'telemetry_fuel_volume_liters'],
  ['fuelTankCapacityLiters', 'telemetry_fuel_tank_capacity_liters'],
  ['possibleFuelTheft', 'telemetry_possible_fuel_theft'],
  ['canBusConnected', 'telemetry_can_bus_connected'], ['obdErrorCodes', 'telemetry_obd_error_codes'],
  ['fuelTanks', 'telemetry_fuel_tanks'], ['rpm', 'telemetry_rpm'],
  ['engineTemperature', 'telemetry_engine_temperature'],
  ['idlingMinutesToday', 'telemetry_idling_minutes_today'],
];

export function rowToAsset(row: Row): AssetDevice {
  return {
    id: row.id,
    ...fromRow(row, ASSET_FIELDS),
    telemetry: fromRow(row, TELEMETRY_FIELDS) as AssetDevice['telemetry'],
  } as AssetDevice;
}

export function assetToInsertRow(asset: AssetDevice): Row {
  return {
    ...toRow(asset, ASSET_FIELDS),
    ...toRow(asset.telemetry, TELEMETRY_FIELDS),
  };
}

export function assetUpdatesToRow(updates: Partial<AssetDevice>): Row {
  const row = toRowPartial(updates, ASSET_FIELDS);
  if (updates.telemetry) Object.assign(row, toRow(updates.telemetry, TELEMETRY_FIELDS));
  return row;
}

// ===================== Geofences =====================

const GEOFENCE_FIELDS: FieldMap = [
  ['name', 'name'], ['clientId', 'client_id'], ['unitId', 'unit_id'], ['type', 'type'],
  ['coordinates', 'coordinates'], ['radius', 'radius'], ['color', 'color'],
  ['assignedAssetsCount', 'assigned_assets_count'], ['targetCategory', 'target_category'],
  ['isHighRiskZone', 'is_high_risk_zone'],
];

export function rowToGeofence(row: Row): Geofence {
  return {
    id: row.id,
    ...fromRow(row, GEOFENCE_FIELDS),
    rules: {
      entryAlert: row.entry_alert,
      exitAlert: row.exit_alert,
      stayAlert: row.stay_alert,
      maxSpeed: row.max_speed ?? undefined,
    },
  } as Geofence;
}

export function geofenceToInsertRow(g: Geofence): Row {
  return {
    ...toRow(g, GEOFENCE_FIELDS),
    entry_alert: g.rules.entryAlert,
    exit_alert: g.rules.exitAlert,
    stay_alert: g.rules.stayAlert,
    max_speed: g.rules.maxSpeed ?? null,
  };
}

export function geofenceUpdatesToRow(updates: Partial<Geofence>): Row {
  const row = toRowPartial(updates, GEOFENCE_FIELDS);
  if (updates.rules) {
    if ('entryAlert' in updates.rules) row.entry_alert = updates.rules.entryAlert;
    if ('exitAlert' in updates.rules) row.exit_alert = updates.rules.exitAlert;
    if ('stayAlert' in updates.rules) row.stay_alert = updates.rules.stayAlert;
    if ('maxSpeed' in updates.rules) row.max_speed = updates.rules.maxSpeed ?? null;
  }
  return row;
}

// ===================== Drivers =====================

const DRIVER_FIELDS: FieldMap = [
  ['name', 'name'], ['cnhNumber', 'cnh_number'], ['cnhCategory', 'cnh_category'],
  ['cnhExpiry', 'cnh_expiry'], ['phone', 'phone'], ['clientId', 'client_id'],
  ['unitId', 'unit_id'], ['status', 'status'], ['assignedVehicleId', 'assigned_vehicle_id'],
  ['assignedVehiclePlate', 'assigned_vehicle_plate'], ['fatigueScore', 'fatigue_score'],
  ['fatigueStatus', 'fatigue_status'], ['lastFatigueCheck', 'last_fatigue_check'],
  ['continuousDrivingHours', 'continuous_driving_hours'], ['drivingHoursToday', 'driving_hours_today'],
  ['drivingScore', 'driving_score'], ['harshEventsToday', 'harsh_events_today'],
];

export const rowToDriver = (row: Row): Driver => ({ id: row.id, ...fromRow(row, DRIVER_FIELDS) } as Driver);
export const driverToInsertRow = (d: Driver): Row => toRow(d, DRIVER_FIELDS);
export const driverUpdatesToRow = (updates: Partial<Driver>): Row => toRowPartial(updates, DRIVER_FIELDS);

// ===================== Maintenance Records =====================

const MAINTENANCE_FIELDS: FieldMap = [
  ['vehicleId', 'vehicle_id'], ['vehiclePlate', 'vehicle_plate'], ['vehicleName', 'vehicle_name'],
  ['type', 'type'], ['description', 'description'], ['status', 'status'],
  ['scheduledDate', 'scheduled_date'], ['completedDate', 'completed_date'],
  ['odometerAtService', 'odometer_at_service'], ['cost', 'cost'], ['workshop', 'workshop'],
];

export const rowToMaintenance = (row: Row): MaintenanceRecord =>
  ({ id: row.id, ...fromRow(row, MAINTENANCE_FIELDS) } as MaintenanceRecord);
export const maintenanceToInsertRow = (m: MaintenanceRecord): Row => toRow(m, MAINTENANCE_FIELDS);
export const maintenanceUpdatesToRow = (updates: Partial<MaintenanceRecord>): Row =>
  toRowPartial(updates, MAINTENANCE_FIELDS);

// ===================== Route Templates =====================

const ROUTE_TEMPLATE_FIELDS: FieldMap = [
  ['name', 'name'], ['clientId', 'client_id'], ['unitId', 'unit_id'], ['origin', 'origin'],
  ['destination', 'destination'], ['waypoints', 'waypoints'],
  ['estDistanceKm', 'est_distance_km'], ['estDurationMin', 'est_duration_min'],
];

export const rowToRouteTemplate = (row: Row): RouteTemplate =>
  ({ id: row.id, ...fromRow(row, ROUTE_TEMPLATE_FIELDS) } as RouteTemplate);
export const routeTemplateToInsertRow = (r: RouteTemplate): Row => toRow(r, ROUTE_TEMPLATE_FIELDS);

// ===================== Trip Records =====================

const TRIP_FIELDS: FieldMap = [
  ['vehicleId', 'vehicle_id'], ['vehiclePlate', 'vehicle_plate'], ['vehicleName', 'vehicle_name'],
  ['driverId', 'driver_id'], ['driverName', 'driver_name'], ['origin', 'origin'],
  ['destination', 'destination'], ['startTime', 'start_time'], ['endTime', 'end_time'],
  ['distanceKm', 'distance_km'], ['avgSpeedKmh', 'avg_speed_kmh'], ['maxSpeedKmh', 'max_speed_kmh'],
  ['status', 'status'], ['routeTemplateId', 'route_template_id'],
  ['deviationDetected', 'deviation_detected'],
];

export const rowToTrip = (row: Row): TripRecord => ({ id: row.id, ...fromRow(row, TRIP_FIELDS) } as TripRecord);
export const tripToInsertRow = (t: TripRecord): Row => toRow(t, TRIP_FIELDS);
export const tripUpdatesToRow = (updates: Partial<TripRecord>): Row => toRowPartial(updates, TRIP_FIELDS);

// ===================== System Alerts =====================

const ALERT_FIELDS: FieldMap = [
  ['assetId', 'asset_id'], ['assetName', 'asset_name'], ['category', 'category'],
  ['unitName', 'unit_name'], ['type', 'type'], ['title', 'title'], ['message', 'message'],
  ['severity', 'severity'], ['timestamp', 'timestamp'], ['acknowledged', 'acknowledged'],
  ['latitude', 'latitude'], ['longitude', 'longitude'],
];

export const rowToAlert = (row: Row): SystemAlert => ({ id: row.id, ...fromRow(row, ALERT_FIELDS) } as SystemAlert);
export const alertToInsertRow = (a: SystemAlert): Row => toRow(a, ALERT_FIELDS);

// ===================== Cargo Shipments =====================

const SHIPMENT_FIELDS: FieldMap = [
  ['code', 'code'], ['cargoDescription', 'cargo_description'], ['origin', 'origin'],
  ['destination', 'destination'], ['carrier', 'carrier'], ['vehiclePlate', 'vehicle_plate'],
  ['driverName', 'driver_name'], ['tagId', 'tag_id'], ['status', 'status'], ['eta', 'eta'],
  ['temperatureTarget', 'temperature_target'], ['currentLocation', 'current_location'],
  ['latitude', 'latitude'], ['longitude', 'longitude'], ['progressPercent', 'progress_percent'],
  ['eventsCount', 'events_count'], ['sealStatus', 'seal_status'],
  ['sealLastTrigger', 'seal_last_trigger'], ['sealLastEventTime', 'seal_last_event_time'],
];

export const rowToShipment = (row: Row): CargoShipment =>
  ({ id: row.id, ...fromRow(row, SHIPMENT_FIELDS) } as CargoShipment);
export const shipmentUpdatesToRow = (updates: Partial<CargoShipment>): Row =>
  toRowPartial(updates, SHIPMENT_FIELDS);

// ===================== Cart Recoveries =====================

const RECOVERY_FIELDS: FieldMap = [
  ['assetId', 'asset_id'], ['assetName', 'asset_name'], ['assetCode', 'asset_code'],
  ['unitName', 'unit_name'], ['recoveredBy', 'recovered_by'], ['signatureName', 'signature_name'],
  ['notes', 'notes'], ['photoDataUrl', 'photo_data_url'], ['relatedAlertId', 'related_alert_id'],
  ['timestamp', 'timestamp'],
];

export const rowToRecovery = (row: Row): CartRecovery =>
  ({ id: row.id, ...fromRow(row, RECOVERY_FIELDS) } as CartRecovery);
export const recoveryToInsertRow = (r: Omit<CartRecovery, 'id'>): Row => toRow(r, RECOVERY_FIELDS);

// ===================== Work Orders =====================

const WORK_ORDER_FIELDS: FieldMap = [
  ['code', 'code'], ['type', 'type'], ['assetId', 'asset_id'], ['assetName', 'asset_name'],
  ['vehiclePlate', 'vehicle_plate'], ['clientId', 'client_id'], ['unitId', 'unit_id'],
  ['unitName', 'unit_name'], ['technicianName', 'technician_name'], ['status', 'status'],
  ['scheduledDate', 'scheduled_date'], ['completedDate', 'completed_date'],
  ['installPointId', 'install_point_id'], ['installPhotoDataUrl', 'install_photo_data_url'],
  ['notes', 'notes'],
];

export const rowToWorkOrder = (row: Row): WorkOrder => ({ id: row.id, ...fromRow(row, WORK_ORDER_FIELDS) } as WorkOrder);
export const workOrderToInsertRow = (w: WorkOrder): Row => toRow(w, WORK_ORDER_FIELDS);
export const workOrderUpdatesToRow = (updates: Partial<WorkOrder>): Row =>
  toRowPartial(updates, WORK_ORDER_FIELDS);

// ===================== Greylist Entries =====================

const GREYLIST_FIELDS: FieldMap = [
  ['type', 'type'], ['label', 'label'], ['description', 'description'],
  ['latitude', 'latitude'], ['longitude', 'longitude'], ['radiusMeters', 'radius_meters'],
  ['clientId', 'client_id'], ['addedAt', 'added_at'],
];

export const rowToGreylistEntry = (row: Row): GreylistEntry =>
  ({ id: row.id, ...fromRow(row, GREYLIST_FIELDS) } as GreylistEntry);
export const greylistEntryToInsertRow = (g: GreylistEntry): Row => toRow(g, GREYLIST_FIELDS);

// ===================== Asset Recovery Cases =====================

const RECOVERY_CASE_FIELDS: FieldMap = [
  ['assetId', 'asset_id'], ['assetName', 'asset_name'], ['assetCode', 'asset_code'],
  ['plateNumber', 'plate_number'], ['clientId', 'client_id'], ['unitName', 'unit_name'],
  ['reason', 'reason'], ['status', 'status'], ['openedAt', 'opened_at'],
  ['responsibleName', 'responsible_name'], ['lastKnownLatitude', 'last_known_latitude'],
  ['lastKnownLongitude', 'last_known_longitude'], ['frequentStopPoints', 'frequent_stop_points'],
  ['notes', 'notes'],
];

export const rowToRecoveryCase = (row: Row): AssetRecoveryCase =>
  ({ id: row.id, ...fromRow(row, RECOVERY_CASE_FIELDS) } as AssetRecoveryCase);
export const recoveryCaseToInsertRow = (c: AssetRecoveryCase): Row => toRow(c, RECOVERY_CASE_FIELDS);
export const recoveryCaseUpdatesToRow = (updates: Partial<AssetRecoveryCase>): Row =>
  toRowPartial(updates, RECOVERY_CASE_FIELDS);

// ===================== Asset Pairings =====================

const PAIRING_FIELDS: FieldMap = [
  ['label', 'label'], ['clientId', 'client_id'], ['primaryAssetId', 'primary_asset_id'],
  ['primaryAssetName', 'primary_asset_name'], ['secondaryAssetId', 'secondary_asset_id'],
  ['secondaryAssetName', 'secondary_asset_name'], ['maxDistanceMeters', 'max_distance_meters'],
  ['active', 'active'],
];

export const rowToPairing = (row: Row): AssetPairing => ({ id: row.id, ...fromRow(row, PAIRING_FIELDS) } as AssetPairing);
export const pairingToInsertRow = (p: AssetPairing): Row => toRow(p, PAIRING_FIELDS);
export const pairingUpdatesToRow = (updates: Partial<AssetPairing>): Row =>
  toRowPartial(updates, PAIRING_FIELDS);

// ===================== Traffic Segments & POIs (somente leitura pelo app) =====================

const TRAFFIC_FIELDS: FieldMap = [
  ['roadName', 'road_name'], ['coordinates', 'coordinates'],
  ['congestionLevel', 'congestion_level'], ['avgSpeedKmh', 'avg_speed_kmh'], ['updatedAt', 'updated_at'],
];

export const rowToTrafficSegment = (row: Row): TrafficSegment =>
  ({ id: row.id, ...fromRow(row, TRAFFIC_FIELDS) } as TrafficSegment);

const POI_FIELDS: FieldMap = [
  ['name', 'name'], ['category', 'category'], ['latitude', 'latitude'],
  ['longitude', 'longitude'], ['address', 'address'],
];

export const rowToPoi = (row: Row): PointOfInterest => ({ id: row.id, ...fromRow(row, POI_FIELDS) } as PointOfInterest);

// ===================== Clientes & Unidades (lidos por AuthContext p/ os seletores) =====================

const CLIENT_FIELDS: FieldMap = [
  ['name', 'name'], ['code', 'code'], ['cnpj', 'cnpj'], ['unitsCount', 'units_count'],
  ['assetsCount', 'assets_count'], ['status', 'status'], ['serviceExpireDate', 'service_expire_date'],
];

export const rowToClient = (row: Row): CompanyClient => ({ id: row.id, ...fromRow(row, CLIENT_FIELDS) } as CompanyClient);

const UNIT_FIELDS: FieldMap = [
  ['clientId', 'client_id'], ['name', 'name'], ['city', 'city'], ['state', 'state'],
  ['address', 'address'], ['assetsCount', 'assets_count'], ['status', 'status'],
];

export const rowToUnit = (row: Row): CompanyUnit => ({ id: row.id, ...fromRow(row, UNIT_FIELDS) } as CompanyUnit);
