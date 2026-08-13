// Popula o schema do Supabase (supabase/migrations/) com os dados atuais de
// src/mock/index.ts, para o app não abrir vazio depois que AssetContext passar
// a ler do banco. Roda uma vez (ou toda vez que você quiser resetar os dados de
// demonstração — reexecutar limpa as tabelas antes de inserir de novo).
//
// Uso: npx tsx scripts/seed-supabase.ts
//
// Ids: a mock usa ids string arbitrários (ex.: "asset_01"). O banco gera uuid
// de verdade — este script mantém um Map<idAntigo, uuidNovo> por coleção e
// resolve todas as referências (clientId, unitId, assetId, driverId, etc.)
// antes de cada insert, respeitando a ordem de dependência das FKs.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Client } from 'pg';
import {
  MOCK_CLIENTS,
  MOCK_UNITS,
  MOCK_USERS,
  MOCK_GEOFENCES,
  MOCK_ASSETS,
  MOCK_DRIVERS,
  MOCK_MAINTENANCE,
  MOCK_ROUTE_TEMPLATES,
  MOCK_TRIPS,
  MOCK_ALERTS,
  MOCK_CARGO_SHIPMENTS,
  MOCK_RECOVERIES,
  MOCK_INTEGRATIONS,
  MOCK_WORK_ORDERS,
  MOCK_GREYLIST,
  MOCK_RECOVERY_CASES,
  MOCK_ASSET_PAIRINGS,
  MOCK_TRAFFIC_SEGMENTS,
  MOCK_POIS,
} from '../src/mock/index';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, '..');

function loadEnv(): Record<string, string> {
  const envContent = readFileSync(path.join(projectDir, '.env'), 'utf-8');
  return Object.fromEntries(
    envContent
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => {
        const idx = l.indexOf('=');
        const key = l.slice(0, idx);
        let val = l.slice(idx + 1);
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        return [key, val];
      })
  );
}

const jsonb = (value: unknown) => (value === undefined || value === null ? null : JSON.stringify(value));
const newId = () => crypto.randomUUID();

async function seed() {
  const env = loadEnv();
  const client = new Client({ connectionString: env.DIRECT_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to Supabase Postgres.');

  const TABLES_IN_DELETE_ORDER = [
    'asset_pairings', 'asset_recovery_cases', 'greylist_entries', 'work_orders',
    'system_integrations', 'cart_recoveries', 'cargo_shipments', 'system_alerts',
    'asset_route_points', 'trip_records', 'route_templates', 'maintenance_records',
    'drivers', 'assets', 'geofences', 'user_profiles', 'company_units', 'company_clients',
    'traffic_segments', 'points_of_interest',
  ];

  try {
    await client.query('begin');

    console.log('Clearing existing rows (idempotent reseed)...');
    for (const t of TABLES_IN_DELETE_ORDER) {
      await client.query(`delete from ${t}`);
    }

    const clientIdMap = new Map<string, string>();
    const unitIdMap = new Map<string, string>();
    const geofenceIdMap = new Map<string, string>();
    const assetIdMap = new Map<string, string>();
    const driverIdMap = new Map<string, string>();
    const routeTemplateIdMap = new Map<string, string>();
    const alertIdMap = new Map<string, string>();

    // 1. company_clients
    for (const c of MOCK_CLIENTS) {
      const id = newId();
      clientIdMap.set(c.id, id);
      await client.query(
        `insert into company_clients (id, name, code, cnpj, units_count, assets_count, status, service_expire_date)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [id, c.name, c.code, c.cnpj, c.unitsCount, c.assetsCount, c.status, c.serviceExpireDate ?? null]
      );
    }
    console.log(`  company_clients: ${MOCK_CLIENTS.length}`);

    // 2. company_units
    for (const u of MOCK_UNITS) {
      const id = newId();
      unitIdMap.set(u.id, id);
      await client.query(
        `insert into company_units (id, client_id, name, city, state, address, assets_count, status)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [id, clientIdMap.get(u.clientId), u.name, u.city, u.state, u.address, u.assetsCount, u.status]
      );
    }
    console.log(`  company_units: ${MOCK_UNITS.length}`);

    // 3. user_profiles
    for (const usr of MOCK_USERS) {
      await client.query(
        `insert into user_profiles (id, name, email, role, avatar_url, client_id, unit_id)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [
          newId(), usr.name, usr.email, usr.role, usr.avatarUrl ?? null,
          usr.clientId ? clientIdMap.get(usr.clientId) ?? null : null,
          usr.unitId ? unitIdMap.get(usr.unitId) ?? null : null,
        ]
      );
    }
    console.log(`  user_profiles: ${MOCK_USERS.length}`);

    // 4. geofences
    for (const g of MOCK_GEOFENCES) {
      const id = newId();
      geofenceIdMap.set(g.id, id);
      await client.query(
        `insert into geofences (
           id, name, client_id, unit_id, type, coordinates, radius, color,
           entry_alert, exit_alert, stay_alert, max_speed, assigned_assets_count,
           target_category, is_high_risk_zone
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          id, g.name, clientIdMap.get(g.clientId), unitIdMap.get(g.unitId), g.type,
          jsonb(g.coordinates), g.radius ?? null, g.color,
          g.rules.entryAlert, g.rules.exitAlert, g.rules.stayAlert, g.rules.maxSpeed ?? null,
          g.assignedAssetsCount, g.targetCategory ?? null, g.isHighRiskZone ?? false,
        ]
      );
    }
    console.log(`  geofences: ${MOCK_GEOFENCES.length}`);

    // 5. assets (assigned_driver_id fica null por ora — backfill depois de criar drivers)
    for (const a of MOCK_ASSETS) {
      const id = newId();
      assetIdMap.set(a.id, id);
      const t = a.telemetry;
      await client.query(
        `insert into assets (
           id, name, code, imei, category, subcategory, client_id, unit_id, unit_name, status, protocol,
           responsible_name, driver_name, model, plate_number, geofence_id, geofence_name, last_movement,
           is_blocked, is_door_locked, speed_limit_kmh, camera_channels_count,
           last_maintenance_date, next_maintenance_due, positioning_priority,
           door_lock_card_id, door_lock_card_bound_at, auto_unlock_on_geofence_entry,
           scheduled_unlock_windows, tire_positions, service_expire_date,
           last_remote_command, offline_whitelist_synced_at, scheduled_photo_capture,
           telemetry_latitude, telemetry_longitude, telemetry_speed, telemetry_battery_level,
           telemetry_signal_strength, telemetry_last_communication, telemetry_ignition,
           telemetry_odometer, telemetry_operating_hours, telemetry_temperature,
           telemetry_heading, telemetry_gps_accuracy, telemetry_position_source,
           telemetry_packet_timestamp, telemetry_fuel_percent, telemetry_fuel_volume_liters,
           telemetry_fuel_tank_capacity_liters, telemetry_possible_fuel_theft,
           telemetry_can_bus_connected, telemetry_obd_error_codes, telemetry_fuel_tanks,
           telemetry_rpm, telemetry_engine_temperature, telemetry_idling_minutes_today
         ) values (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,
           $23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,
           $35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49,$50,$51,$52,
           $53,$54,$55,$56,$57,$58
         )`,
        [
          id, a.name, a.code, a.imei, a.category, a.subcategory ?? null,
          clientIdMap.get(a.clientId), unitIdMap.get(a.unitId), a.unitName, a.status, a.protocol,
          a.responsibleName ?? null, a.driverName ?? null, a.model ?? null, a.plateNumber ?? null,
          a.geofenceId ? geofenceIdMap.get(a.geofenceId) ?? null : null, a.geofenceName ?? null,
          a.lastMovement,
          a.isBlocked ?? false, a.isDoorLocked ?? false, a.speedLimitKmh ?? null,
          a.cameraChannelsCount ?? 0, a.lastMaintenanceDate ?? null, a.nextMaintenanceDue ?? null,
          a.positioningPriority ?? null, a.doorLockCardId ?? null, a.doorLockCardBoundAt ?? null,
          a.autoUnlockOnGeofenceEntry ?? false, jsonb(a.scheduledUnlockWindows ?? []),
          jsonb(a.tirePositions ?? []), a.serviceExpireDate ?? null,
          jsonb(a.lastRemoteCommand), a.offlineWhitelistSyncedAt ?? null,
          jsonb(a.scheduledPhotoCapture),
          t.latitude, t.longitude, t.speed, t.batteryLevel, t.signalStrength,
          t.lastCommunication, t.ignition ?? null, t.odometer ?? null, t.operatingHours ?? null,
          t.temperature ?? null, t.heading ?? null, t.gpsAccuracy ?? null,
          t.positionSource ?? null, t.packetTimestamp ?? null, t.fuelPercent ?? null,
          t.fuelVolumeLiters ?? null, t.fuelTankCapacityLiters ?? null,
          t.possibleFuelTheft ?? false, t.canBusConnected ?? null, t.obdErrorCodes ?? null,
          jsonb(t.fuelTanks ?? []), t.rpm ?? null, t.engineTemperature ?? null,
          t.idlingMinutesToday ?? null,
        ]
      );
    }
    console.log(`  assets: ${MOCK_ASSETS.length}`);

    // 6. drivers
    for (const d of MOCK_DRIVERS) {
      const id = newId();
      driverIdMap.set(d.id, id);
      await client.query(
        `insert into drivers (
           id, name, cnh_number, cnh_category, cnh_expiry, phone, client_id, unit_id, status,
           assigned_vehicle_id, assigned_vehicle_plate, fatigue_score, fatigue_status,
           last_fatigue_check, continuous_driving_hours, driving_hours_today, driving_score,
           harsh_events_today
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
        [
          id, d.name, d.cnhNumber, d.cnhCategory, d.cnhExpiry, d.phone,
          clientIdMap.get(d.clientId), unitIdMap.get(d.unitId), d.status,
          d.assignedVehicleId ? assetIdMap.get(d.assignedVehicleId) ?? null : null,
          d.assignedVehiclePlate ?? null, d.fatigueScore, d.fatigueStatus, d.lastFatigueCheck,
          d.continuousDrivingHours, d.drivingHoursToday, d.drivingScore ?? null,
          jsonb(d.harshEventsToday),
        ]
      );
    }
    console.log(`  drivers: ${MOCK_DRIVERS.length}`);

    // Backfill assets.assigned_driver_id agora que drivers existem
    for (const a of MOCK_ASSETS) {
      if (!a.assignedDriverId) continue;
      const driverId = driverIdMap.get(a.assignedDriverId);
      if (!driverId) continue;
      await client.query(`update assets set assigned_driver_id = $1 where id = $2`, [
        driverId,
        assetIdMap.get(a.id),
      ]);
    }

    // 7. maintenance_records
    for (const m of MOCK_MAINTENANCE) {
      await client.query(
        `insert into maintenance_records (
           id, vehicle_id, vehicle_plate, vehicle_name, type, description, status,
           scheduled_date, completed_date, odometer_at_service, cost, workshop
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          newId(), assetIdMap.get(m.vehicleId), m.vehiclePlate, m.vehicleName, m.type,
          m.description, m.status, m.scheduledDate, m.completedDate ?? null,
          m.odometerAtService ?? null, m.cost ?? null, m.workshop ?? null,
        ]
      );
    }
    console.log(`  maintenance_records: ${MOCK_MAINTENANCE.length}`);

    // 8. route_templates
    for (const rt of MOCK_ROUTE_TEMPLATES) {
      const id = newId();
      routeTemplateIdMap.set(rt.id, id);
      await client.query(
        `insert into route_templates (
           id, name, client_id, unit_id, origin, destination, waypoints, est_distance_km, est_duration_min
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          id, rt.name, clientIdMap.get(rt.clientId), unitIdMap.get(rt.unitId), rt.origin,
          rt.destination, jsonb(rt.waypoints), rt.estDistanceKm, rt.estDurationMin,
        ]
      );
    }
    console.log(`  route_templates: ${MOCK_ROUTE_TEMPLATES.length}`);

    // 9. trip_records
    for (const trip of MOCK_TRIPS) {
      await client.query(
        `insert into trip_records (
           id, vehicle_id, vehicle_plate, vehicle_name, driver_id, driver_name, origin,
           destination, start_time, end_time, distance_km, avg_speed_kmh, max_speed_kmh,
           status, route_template_id, deviation_detected
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
          newId(), assetIdMap.get(trip.vehicleId), trip.vehiclePlate, trip.vehicleName,
          trip.driverId ? driverIdMap.get(trip.driverId) ?? null : null, trip.driverName,
          trip.origin, trip.destination, trip.startTime, trip.endTime ?? null,
          trip.distanceKm, trip.avgSpeedKmh, trip.maxSpeedKmh, trip.status,
          trip.routeTemplateId ? routeTemplateIdMap.get(trip.routeTemplateId) ?? null : null,
          trip.deviationDetected ?? false,
        ]
      );
    }
    console.log(`  trip_records: ${MOCK_TRIPS.length}`);

    // 10. system_alerts
    for (const al of MOCK_ALERTS) {
      const id = newId();
      alertIdMap.set(al.id, id);
      await client.query(
        `insert into system_alerts (
           id, asset_id, asset_name, category, unit_name, type, title, message,
           severity, "timestamp", acknowledged, latitude, longitude
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          id, assetIdMap.get(al.assetId) ?? null, al.assetName, al.category, al.unitName,
          al.type, al.title, al.message, al.severity, al.timestamp, al.acknowledged,
          al.latitude, al.longitude,
        ]
      );
    }
    console.log(`  system_alerts: ${MOCK_ALERTS.length}`);

    // 11. cargo_shipments
    for (const s of MOCK_CARGO_SHIPMENTS) {
      await client.query(
        `insert into cargo_shipments (
           id, code, cargo_description, origin, destination, carrier, vehicle_plate,
           driver_name, tag_id, status, eta, temperature_target, current_location,
           latitude, longitude, progress_percent, events_count, seal_status,
           seal_last_trigger, seal_last_event_time
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
        [
          newId(), s.code, s.cargoDescription, s.origin, s.destination, s.carrier,
          s.vehiclePlate, s.driverName, s.tagId, s.status, s.eta ?? null,
          s.temperatureTarget ?? null, s.currentLocation, s.latitude, s.longitude,
          s.progressPercent, s.eventsCount, s.sealStatus ?? null, s.sealLastTrigger ?? null,
          s.sealLastEventTime ?? null,
        ]
      );
    }
    console.log(`  cargo_shipments: ${MOCK_CARGO_SHIPMENTS.length}`);

    // 12. cart_recoveries
    for (const r of MOCK_RECOVERIES) {
      await client.query(
        `insert into cart_recoveries (
           id, asset_id, asset_name, asset_code, unit_name, recovered_by, signature_name,
           notes, photo_data_url, related_alert_id, "timestamp"
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          newId(), assetIdMap.get(r.assetId), r.assetName, r.assetCode, r.unitName,
          r.recoveredBy, r.signatureName, r.notes ?? null, r.photoDataUrl ?? null,
          r.relatedAlertId ? alertIdMap.get(r.relatedAlertId) ?? null : null, r.timestamp,
        ]
      );
    }
    console.log(`  cart_recoveries: ${MOCK_RECOVERIES.length}`);

    // 13. system_integrations
    for (const i of MOCK_INTEGRATIONS) {
      await client.query(
        `insert into system_integrations (
           id, name, type, status, last_ping, active_devices_count, endpoint_url, api_key
         ) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [newId(), i.name, i.type, i.status, i.lastPing, i.activeDevicesCount, i.endpointUrl ?? null, i.apiKey ?? null]
      );
    }
    console.log(`  system_integrations: ${MOCK_INTEGRATIONS.length}`);

    // 14. work_orders
    for (const w of MOCK_WORK_ORDERS) {
      await client.query(
        `insert into work_orders (
           id, code, type, asset_id, asset_name, vehicle_plate, client_id, unit_id, unit_name,
           technician_name, status, scheduled_date, completed_date, install_point_id,
           install_photo_data_url, notes
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
          newId(), w.code, w.type, w.assetId ? assetIdMap.get(w.assetId) ?? null : null,
          w.assetName ?? null, w.vehiclePlate ?? null, clientIdMap.get(w.clientId),
          unitIdMap.get(w.unitId), w.unitName, w.technicianName, w.status, w.scheduledDate,
          w.completedDate ?? null, w.installPointId ?? null, w.installPhotoDataUrl ?? null,
          w.notes ?? null,
        ]
      );
    }
    console.log(`  work_orders: ${MOCK_WORK_ORDERS.length}`);

    // 15. greylist_entries
    for (const g of MOCK_GREYLIST) {
      await client.query(
        `insert into greylist_entries (
           id, type, label, description, latitude, longitude, radius_meters, client_id, added_at
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          newId(), g.type, g.label, g.description ?? null, g.latitude ?? null, g.longitude ?? null,
          g.radiusMeters ?? null, clientIdMap.get(g.clientId), g.addedAt,
        ]
      );
    }
    console.log(`  greylist_entries: ${MOCK_GREYLIST.length}`);

    // 16. asset_recovery_cases
    for (const rc of MOCK_RECOVERY_CASES) {
      await client.query(
        `insert into asset_recovery_cases (
           id, asset_id, asset_name, asset_code, plate_number, client_id, unit_name, reason,
           status, opened_at, responsible_name, last_known_latitude, last_known_longitude,
           frequent_stop_points, notes
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          newId(), assetIdMap.get(rc.assetId), rc.assetName, rc.assetCode, rc.plateNumber ?? null,
          clientIdMap.get(rc.clientId), rc.unitName, rc.reason, rc.status, rc.openedAt,
          rc.responsibleName, rc.lastKnownLatitude ?? null, rc.lastKnownLongitude ?? null,
          jsonb(rc.frequentStopPoints ?? []), rc.notes ?? null,
        ]
      );
    }
    console.log(`  asset_recovery_cases: ${MOCK_RECOVERY_CASES.length}`);

    // 17. asset_pairings
    for (const p of MOCK_ASSET_PAIRINGS) {
      await client.query(
        `insert into asset_pairings (
           id, label, client_id, primary_asset_id, primary_asset_name,
           secondary_asset_id, secondary_asset_name, max_distance_meters, active
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          newId(), p.label, clientIdMap.get(p.clientId), assetIdMap.get(p.primaryAssetId),
          p.primaryAssetName, assetIdMap.get(p.secondaryAssetId), p.secondaryAssetName,
          p.maxDistanceMeters, p.active,
        ]
      );
    }
    console.log(`  asset_pairings: ${MOCK_ASSET_PAIRINGS.length}`);

    // 18. traffic_segments
    for (const t of MOCK_TRAFFIC_SEGMENTS) {
      await client.query(
        `insert into traffic_segments (id, road_name, coordinates, congestion_level, avg_speed_kmh, updated_at)
         values ($1,$2,$3,$4,$5,$6)`,
        [newId(), t.roadName, jsonb(t.coordinates), t.congestionLevel, t.avgSpeedKmh, t.updatedAt]
      );
    }
    console.log(`  traffic_segments: ${MOCK_TRAFFIC_SEGMENTS.length}`);

    // 19. points_of_interest
    for (const poi of MOCK_POIS) {
      await client.query(
        `insert into points_of_interest (id, name, category, latitude, longitude, address)
         values ($1,$2,$3,$4,$5,$6)`,
        [newId(), poi.name, poi.category, poi.latitude, poi.longitude, poi.address ?? null]
      );
    }
    console.log(`  points_of_interest: ${MOCK_POIS.length}`);

    await client.query('commit');
    console.log('\nSeed completed successfully.');
  } catch (err) {
    await client.query('rollback').catch(() => {});
    console.error('SEED FAILED:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

seed();
