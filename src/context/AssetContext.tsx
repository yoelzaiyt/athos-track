import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  AssetDevice,
  SystemAlert,
  Geofence,
  CargoShipment,
  AssetCategory,
  AssetStatus,
  Driver,
  MaintenanceRecord,
  TripRecord,
  CartRecovery,
  SealStatus,
  SealTriggerMethod,
  WorkOrder,
  GreylistEntry,
  AssetRecoveryCase,
  RouteTemplate,
  AssetPairing,
  TrafficSegment,
  PointOfInterest,
  ProviderDevice,
  ProviderHealth,
  SystemIntegration,
  UserProfile,
} from '../types';
import { supabase } from '../lib/supabaseClient';
import {
  rowToAsset, assetToInsertRow, assetUpdatesToRow,
  rowToGeofence, geofenceToInsertRow, geofenceUpdatesToRow,
  rowToDriver, driverToInsertRow, driverUpdatesToRow,
  rowToMaintenance, maintenanceToInsertRow, maintenanceUpdatesToRow,
  rowToRouteTemplate, routeTemplateToInsertRow,
  rowToTrip, tripToInsertRow, tripUpdatesToRow,
  rowToAlert,
  rowToShipment, shipmentUpdatesToRow,
  rowToRecovery, recoveryToInsertRow,
  rowToWorkOrder, workOrderToInsertRow, workOrderUpdatesToRow,
  rowToGreylistEntry, greylistEntryToInsertRow,
  rowToRecoveryCase, recoveryCaseToInsertRow, recoveryCaseUpdatesToRow,
  rowToPairing, pairingToInsertRow, pairingUpdatesToRow,
  rowToTrafficSegment,
  rowToPoi,
  rowToProviderDevice,
  rowToProviderHealth,
  rowToIntegration,
  rowToUserProfile, userProfileToInsertRow, userProfileUpdatesToRow,
} from '../lib/mappers';

interface AssetContextType {
  assets: AssetDevice[];
  alerts: SystemAlert[];
  geofences: Geofence[];
  shipments: CargoShipment[];
  drivers: Driver[];
  maintenanceRecords: MaintenanceRecord[];
  trips: TripRecord[];
  recoveries: CartRecovery[];
  workOrders: WorkOrder[];
  greylist: GreylistEntry[];
  recoveryCases: AssetRecoveryCase[];
  routeTemplates: RouteTemplate[];
  assetPairings: AssetPairing[];
  trafficSegments: TrafficSegment[];
  pois: PointOfInterest[];
  providerDevices: ProviderDevice[];
  providerHealth: ProviderHealth | null;
  integrations: SystemIntegration[];
  users: UserProfile[];
  isLoading: boolean;
  selectedAsset: AssetDevice | null;
  searchQuery: string;
  categoryFilter: AssetCategory | 'all';
  statusFilter: AssetStatus | 'all';
  isLiveSimulationActive: boolean;
  activeTabModule: string;
  setSelectedAsset: (asset: AssetDevice | null) => void;
  setSearchQuery: (query: string) => void;
  setCategoryFilter: (cat: AssetCategory | 'all') => void;
  setStatusFilter: (st: AssetStatus | 'all') => void;
  setActiveTabModule: (module: string) => void;
  toggleLiveSimulation: () => void;
  acknowledgeAlert: (alertId: string) => void;
  addGeofence: (geofence: Geofence) => void;
  updateGeofence: (geofenceId: string, updates: Partial<Geofence>) => void;
  deleteGeofence: (geofenceId: string) => void;
  addAsset: (asset: AssetDevice) => void;
  updateAsset: (assetId: string, updates: Partial<AssetDevice>) => void;
  deleteAsset: (assetId: string) => void;
  toggleVehicleBlock: (assetId: string) => void;
  toggleDoorLock: (assetId: string) => void;
  registerSealEvent: (shipmentId: string, status: SealStatus, trigger: SealTriggerMethod) => void;
  addDriver: (driver: Driver) => void;
  updateDriver: (driverId: string, updates: Partial<Driver>) => void;
  deleteDriver: (driverId: string) => void;
  addUserProfile: (user: Omit<UserProfile, 'id'>) => Promise<void>;
  updateUserProfile: (userId: string, updates: Partial<UserProfile>) => Promise<void>;
  deleteUserProfile: (userId: string) => Promise<void>;
  addMaintenanceRecord: (record: MaintenanceRecord) => void;
  updateMaintenanceRecord: (recordId: string, updates: Partial<MaintenanceRecord>) => void;
  deleteMaintenanceRecord: (recordId: string) => void;
  addTrip: (trip: TripRecord) => void;
  updateTrip: (tripId: string, updates: Partial<TripRecord>) => void;
  deleteTrip: (tripId: string) => void;
  recoverAsset: (assetId: string, recovery: Omit<CartRecovery, 'id' | 'assetId' | 'assetName' | 'assetCode' | 'unitName' | 'timestamp'>) => void;
  addWorkOrder: (order: WorkOrder) => void;
  updateWorkOrder: (orderId: string, updates: Partial<WorkOrder>) => void;
  deleteWorkOrder: (orderId: string) => void;
  addGreylistEntry: (entry: GreylistEntry) => void;
  deleteGreylistEntry: (entryId: string) => void;
  addRecoveryCase: (recoveryCase: AssetRecoveryCase) => void;
  updateRecoveryCase: (caseId: string, updates: Partial<AssetRecoveryCase>) => void;
  addRouteTemplate: (template: RouteTemplate) => void;
  deleteRouteTemplate: (templateId: string) => void;
  addAssetPairing: (pairing: AssetPairing) => void;
  updateAssetPairing: (pairingId: string, updates: Partial<AssetPairing>) => void;
  deleteAssetPairing: (pairingId: string) => void;
  sendRemoteCommand: (assetId: string, command: string, label: string) => void;
  calibrateOdometer: (assetId: string, newOdometer: number) => void;
  pushOfflineWhitelist: (assetId: string) => void;
  linkProviderDeviceToAsset: (providerDeviceId: string, assetId: string) => Promise<void>;
  unlinkProviderDevice: (providerDeviceId: string, assetId: string) => Promise<void>;
  getFilteredAssets: (clientId?: string, unitId?: string) => AssetDevice[];
  getStats: (clientId?: string, unitId?: string) => {
    total: number;
    online: number;
    offline: number;
    moving: number;
    stopped: number;
    outOfGeofence: number;
    lowBattery: number;
    criticalAlertsCount: number;
  };
}

const AssetContext = createContext<AssetContextType | undefined>(undefined);

function logError(label: string, error: { message: string } | null) {
  if (error) console.error(`[AssetContext] ${label}:`, error.message);
}

export const AssetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [assets, setAssets] = useState<AssetDevice[]>([]);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [shipments, setShipments] = useState<CargoShipment[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [recoveries, setRecoveries] = useState<CartRecovery[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [greylist, setGreylist] = useState<GreylistEntry[]>([]);
  const [recoveryCases, setRecoveryCases] = useState<AssetRecoveryCase[]>([]);
  const [routeTemplates, setRouteTemplates] = useState<RouteTemplate[]>([]);
  const [assetPairings, setAssetPairings] = useState<AssetPairing[]>([]);
  const [trafficSegments, setTrafficSegments] = useState<TrafficSegment[]>([]);
  const [pois, setPois] = useState<PointOfInterest[]>([]);
  const [providerDevices, setProviderDevices] = useState<ProviderDevice[]>([]);
  const [providerHealth, setProviderHealth] = useState<ProviderHealth | null>(null);
  const [integrations, setIntegrations] = useState<SystemIntegration[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedAsset, setSelectedAsset] = useState<AssetDevice | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<AssetCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AssetStatus | 'all'>('all');
  const [activeTabModule, setActiveTabModule] = useState<string>('dashboard');
  const [isLiveSimulationActive, setIsLiveSimulationActive] = useState<boolean>(true);

  // Carga inicial: busca todas as coleções do Supabase em paralelo.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [
        assetsRes, alertsRes, geofencesRes, shipmentsRes, driversRes, maintenanceRes,
        tripsRes, recoveriesRes, workOrdersRes, greylistRes, recoveryCasesRes,
        routeTemplatesRes, pairingsRes, trafficRes, poisRes, providerDevicesRes, providerHealthRes,
        integrationsRes, usersRes,
      ] = await Promise.all([
        supabase.from('assets').select('*').order('created_at', { ascending: false }),
        supabase.from('system_alerts').select('*').order('created_at', { ascending: false }),
        supabase.from('geofences').select('*').order('created_at', { ascending: false }),
        supabase.from('cargo_shipments').select('*').order('created_at', { ascending: false }),
        supabase.from('drivers').select('*').order('created_at', { ascending: false }),
        supabase.from('maintenance_records').select('*').order('created_at', { ascending: false }),
        supabase.from('trip_records').select('*').order('created_at', { ascending: false }),
        supabase.from('cart_recoveries').select('*').order('timestamp', { ascending: false }),
        supabase.from('work_orders').select('*').order('created_at', { ascending: false }),
        supabase.from('greylist_entries').select('*').order('added_at', { ascending: false }),
        supabase.from('asset_recovery_cases').select('*').order('opened_at', { ascending: false }),
        supabase.from('route_templates').select('*').order('created_at', { ascending: false }),
        supabase.from('asset_pairings').select('*'),
        supabase.from('traffic_segments').select('*'),
        supabase.from('points_of_interest').select('*'),
        supabase.from('provider_devices').select('*').order('discovered_at', { ascending: false }),
        supabase.from('provider_health').select('*').eq('provider', 'BRGPS').maybeSingle(),
        supabase.from('system_integrations').select('*').order('created_at', { ascending: false }),
        supabase.from('user_profiles').select('*').order('name'),
      ]);

      if (cancelled) return;

      logError('assets', assetsRes.error);
      logError('alerts', alertsRes.error);
      logError('geofences', geofencesRes.error);
      logError('shipments', shipmentsRes.error);
      logError('drivers', driversRes.error);
      logError('maintenanceRecords', maintenanceRes.error);
      logError('trips', tripsRes.error);
      logError('recoveries', recoveriesRes.error);
      logError('workOrders', workOrdersRes.error);
      logError('greylist', greylistRes.error);
      logError('recoveryCases', recoveryCasesRes.error);
      logError('routeTemplates', routeTemplatesRes.error);
      logError('assetPairings', pairingsRes.error);
      logError('trafficSegments', trafficRes.error);
      logError('pois', poisRes.error);
      logError('providerDevices', providerDevicesRes.error);
      logError('providerHealth', providerHealthRes.error);
      logError('integrations', integrationsRes.error);
      logError('users', usersRes.error);

      setAssets((assetsRes.data ?? []).map(rowToAsset));
      setAlerts((alertsRes.data ?? []).map(rowToAlert));
      setGeofences((geofencesRes.data ?? []).map(rowToGeofence));
      setShipments((shipmentsRes.data ?? []).map(rowToShipment));
      setDrivers((driversRes.data ?? []).map(rowToDriver));
      setMaintenanceRecords((maintenanceRes.data ?? []).map(rowToMaintenance));
      setTrips((tripsRes.data ?? []).map(rowToTrip));
      setRecoveries((recoveriesRes.data ?? []).map(rowToRecovery));
      setWorkOrders((workOrdersRes.data ?? []).map(rowToWorkOrder));
      setGreylist((greylistRes.data ?? []).map(rowToGreylistEntry));
      setRecoveryCases((recoveryCasesRes.data ?? []).map(rowToRecoveryCase));
      setRouteTemplates((routeTemplatesRes.data ?? []).map(rowToRouteTemplate));
      setAssetPairings((pairingsRes.data ?? []).map(rowToPairing));
      setTrafficSegments((trafficRes.data ?? []).map(rowToTrafficSegment));
      setPois((poisRes.data ?? []).map(rowToPoi));
      setProviderDevices((providerDevicesRes.data ?? []).map(rowToProviderDevice));
      setProviderHealth(providerHealthRes.data ? rowToProviderHealth(providerHealthRes.data) : null);
      setIntegrations((integrationsRes.data ?? []).map(rowToIntegration));
      setUsers((usersRes.data ?? []).map(rowToUserProfile));
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Realtime (seção 30 do brief BRGPS): sem WebSocket customizado — assina
  // mudanças via Supabase Realtime nas tabelas que o processo de sync
  // (server/brgps-sync) grava com dados reais, e funde no estado já
  // carregado. Ativos ainda simulados (provider null) não são afetados aqui,
  // continuam só na simulação client-side abaixo.
  useEffect(() => {
    const assetsChannel = supabase
      .channel('athos-assets-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'assets' }, (payload) => {
        const updated = rowToAsset(payload.new as Record<string, unknown>);
        setAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'system_alerts' }, (payload) => {
        const inserted = rowToAlert(payload.new as Record<string, unknown>);
        setAlerts((prev) => [inserted, ...prev]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(assetsChannel);
    };
  }, []);

  // Simulação de movimento a cada 4s: só client-side, sobre o estado já carregado
  // do Supabase — não grava de volta no banco (evita milhares de writes por uma
  // demo visual; um rastreador real enviaria telemetria real via um pipeline próprio).
  useEffect(() => {
    if (!isLiveSimulationActive) return;

    const interval = setInterval(() => {
      setAssets((prevAssets) =>
        prevAssets.map((asset) => {
          // Ativos com telemetria real de um provider externo (BRGPS) nunca
          // são simulados — a posição/bateria/status vêm do processo de sync
          // real e chegam via Realtime (efeito acima), não daqui.
          if (asset.provider) {
            return asset;
          }

          // Fixed assets do not move
          if (asset.category === 'asset' || asset.category === 'tag') {
            return {
              ...asset,
              telemetry: {
                ...asset.telemetry,
                lastCommunication: 'Agora',
              },
            };
          }

          // Carts: subtle micro movement if moving, stationary if stopped or low battery
          if (asset.category === 'cart') {
            if (asset.status === 'moving' || asset.status === 'out_of_geofence') {
              const deltaLat = (Math.random() - 0.5) * 0.00008;
              const deltaLng = (Math.random() - 0.5) * 0.00008;
              return {
                ...asset,
                telemetry: {
                  ...asset.telemetry,
                  latitude: asset.telemetry.latitude + deltaLat,
                  longitude: asset.telemetry.longitude + deltaLng,
                  lastCommunication: 'Agora',
                },
              };
            }
            return {
              ...asset,
              telemetry: { ...asset.telemetry, lastCommunication: 'Agora' },
            };
          }

          // Forklifts: small warehouse shifts
          if (asset.category === 'forklift') {
            if (asset.status === 'moving') {
              const deltaLat = (Math.random() - 0.5) * 0.0001;
              const deltaLng = (Math.random() - 0.5) * 0.0001;
              return {
                ...asset,
                telemetry: {
                  ...asset.telemetry,
                  latitude: asset.telemetry.latitude + deltaLat,
                  longitude: asset.telemetry.longitude + deltaLng,
                  lastCommunication: 'Agora',
                },
              };
            }
            return { ...asset, telemetry: { ...asset.telemetry, lastCommunication: 'Agora' } };
          }

          // Fleet Vehicles / Cargo: realistic movement on roads
          if (asset.status === 'moving' || asset.category === 'truck' || asset.category === 'vehicle' || asset.category === 'cargo') {
            const headingRad = ((asset.telemetry.heading || 90) * Math.PI) / 180;
            const speedKmH = asset.telemetry.speed || 40;
            const distanceKm = (speedKmH / 3600) * 4; // 4 seconds tick distance
            const deltaLat = (distanceKm / 111) * Math.cos(headingRad);
            const deltaLng = (distanceKm / (111 * Math.cos((asset.telemetry.latitude * Math.PI) / 180))) * Math.sin(headingRad);

            return {
              ...asset,
              telemetry: {
                ...asset.telemetry,
                latitude: asset.telemetry.latitude + deltaLat,
                longitude: asset.telemetry.longitude + deltaLng,
                signalStrength: Math.min(100, Math.max(65, asset.telemetry.signalStrength + Math.floor((Math.random() - 0.5) * 3))),
                lastCommunication: 'Agora',
              },
            };
          }

          return { ...asset, telemetry: { ...asset.telemetry, lastCommunication: 'Agora' } };
        })
      );
    }, 4000);

    return () => clearInterval(interval);
  }, [isLiveSimulationActive]);

  const toggleLiveSimulation = () => {
    setIsLiveSimulationActive((prev) => !prev);
  };

  const acknowledgeAlert = async (alertId: string) => {
    const { error } = await supabase.from('system_alerts').update({ acknowledged: true }).eq('id', alertId);
    logError('acknowledgeAlert', error);
    if (error) return;
    setAlerts((prev) => prev.map((alt) => (alt.id === alertId ? { ...alt, acknowledged: true } : alt)));
  };

  const addGeofence = async (geofence: Geofence) => {
    const { data, error } = await supabase
      .from('geofences')
      .insert(geofenceToInsertRow(geofence))
      .select()
      .single();
    logError('addGeofence', error);
    if (error || !data) return;
    setGeofences((prev) => [rowToGeofence(data), ...prev]);
  };

  const updateGeofence = async (geofenceId: string, updates: Partial<Geofence>) => {
    const { error } = await supabase.from('geofences').update(geofenceUpdatesToRow(updates)).eq('id', geofenceId);
    logError('updateGeofence', error);
    if (error) return;
    setGeofences((prev) => prev.map((g) => (g.id === geofenceId ? { ...g, ...updates } : g)));
  };

  const deleteGeofence = async (geofenceId: string) => {
    const { error } = await supabase.from('geofences').delete().eq('id', geofenceId);
    logError('deleteGeofence', error);
    if (error) return;
    setGeofences((prev) => prev.filter((g) => g.id !== geofenceId));
  };

  const addAsset = async (asset: AssetDevice) => {
    const { data, error } = await supabase.from('assets').insert(assetToInsertRow(asset)).select().single();
    logError('addAsset', error);
    if (error || !data) return;
    setAssets((prev) => [rowToAsset(data), ...prev]);
  };

  const updateAsset = async (assetId: string, updates: Partial<AssetDevice>) => {
    const { error } = await supabase.from('assets').update(assetUpdatesToRow(updates)).eq('id', assetId);
    logError('updateAsset', error);
    if (error) return;
    setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, ...updates } : a)));
  };

  const deleteAsset = async (assetId: string) => {
    const { error } = await supabase.from('assets').delete().eq('id', assetId);
    logError('deleteAsset', error);
    if (error) return;
    setAssets((prev) => prev.filter((a) => a.id !== assetId));
    if (selectedAsset?.id === assetId) setSelectedAsset(null);
  };

  const toggleVehicleBlock = async (assetId: string) => {
    const current = assets.find((a) => a.id === assetId);
    if (!current) return;
    const nextBlocked = !current.isBlocked;
    const patch: Partial<AssetDevice> = {
      isBlocked: nextBlocked,
      telemetry: { ...current.telemetry, ignition: nextBlocked ? false : current.telemetry.ignition },
      status: nextBlocked ? 'maintenance' : current.status,
    };
    const { error } = await supabase.from('assets').update(assetUpdatesToRow(patch)).eq('id', assetId);
    logError('toggleVehicleBlock', error);
    if (error) return;
    setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, ...patch } : a)));
  };

  const toggleDoorLock = async (assetId: string) => {
    const current = assets.find((a) => a.id === assetId);
    if (!current) return;
    const nextLocked = !current.isDoorLocked;
    const { error } = await supabase.from('assets').update({ is_door_locked: nextLocked }).eq('id', assetId);
    logError('toggleDoorLock', error);
    if (error) return;
    setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, isDoorLocked: nextLocked } : a)));
  };

  const registerSealEvent = async (shipmentId: string, status: SealStatus, trigger: SealTriggerMethod) => {
    const { error } = await supabase
      .from('cargo_shipments')
      .update({ seal_status: status, seal_last_trigger: trigger, seal_last_event_time: 'Agora' })
      .eq('id', shipmentId);
    logError('registerSealEvent', error);
    if (error) return;
    setShipments((prev) =>
      prev.map((s) =>
        s.id === shipmentId
          ? { ...s, sealStatus: status, sealLastTrigger: trigger, sealLastEventTime: 'Agora' }
          : s
      )
    );
  };

  const addDriver = async (driver: Driver) => {
    const { data, error } = await supabase.from('drivers').insert(driverToInsertRow(driver)).select().single();
    logError('addDriver', error);
    if (error || !data) return;
    setDrivers((prev) => [rowToDriver(data), ...prev]);
  };

  const updateDriver = async (driverId: string, updates: Partial<Driver>) => {
    const { error } = await supabase.from('drivers').update(driverUpdatesToRow(updates)).eq('id', driverId);
    logError('updateDriver', error);
    if (error) return;
    setDrivers((prev) => prev.map((d) => (d.id === driverId ? { ...d, ...updates } : d)));
  };

  const deleteDriver = async (driverId: string) => {
    const { error } = await supabase.from('drivers').delete().eq('id', driverId);
    logError('deleteDriver', error);
    if (error) return;
    setDrivers((prev) => prev.filter((d) => d.id !== driverId));
  };

  const addUserProfile = async (user: Omit<UserProfile, 'id'>) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .insert(userProfileToInsertRow(user))
      .select()
      .single();
    logError('addUserProfile', error);
    if (error || !data) return;
    setUsers((prev) => [...prev, rowToUserProfile(data)].sort((a, b) => a.name.localeCompare(b.name)));
  };

  const updateUserProfile = async (userId: string, updates: Partial<UserProfile>) => {
    const { error } = await supabase.from('user_profiles').update(userProfileUpdatesToRow(updates)).eq('id', userId);
    logError('updateUserProfile', error);
    if (error) return;
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...updates } : u)));
  };

  const deleteUserProfile = async (userId: string) => {
    const { error } = await supabase.from('user_profiles').delete().eq('id', userId);
    logError('deleteUserProfile', error);
    if (error) return;
    setUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  const addMaintenanceRecord = async (record: MaintenanceRecord) => {
    const { data, error } = await supabase
      .from('maintenance_records')
      .insert(maintenanceToInsertRow(record))
      .select()
      .single();
    logError('addMaintenanceRecord', error);
    if (error || !data) return;
    setMaintenanceRecords((prev) => [rowToMaintenance(data), ...prev]);
  };

  const updateMaintenanceRecord = async (recordId: string, updates: Partial<MaintenanceRecord>) => {
    const { error } = await supabase
      .from('maintenance_records')
      .update(maintenanceUpdatesToRow(updates))
      .eq('id', recordId);
    logError('updateMaintenanceRecord', error);
    if (error) return;
    setMaintenanceRecords((prev) => prev.map((m) => (m.id === recordId ? { ...m, ...updates } : m)));
  };

  const deleteMaintenanceRecord = async (recordId: string) => {
    const { error } = await supabase.from('maintenance_records').delete().eq('id', recordId);
    logError('deleteMaintenanceRecord', error);
    if (error) return;
    setMaintenanceRecords((prev) => prev.filter((m) => m.id !== recordId));
  };

  const addTrip = async (trip: TripRecord) => {
    const { data, error } = await supabase.from('trip_records').insert(tripToInsertRow(trip)).select().single();
    logError('addTrip', error);
    if (error || !data) return;
    setTrips((prev) => [rowToTrip(data), ...prev]);
  };

  const updateTrip = async (tripId: string, updates: Partial<TripRecord>) => {
    const { error } = await supabase.from('trip_records').update(tripUpdatesToRow(updates)).eq('id', tripId);
    logError('updateTrip', error);
    if (error) return;
    setTrips((prev) => prev.map((t) => (t.id === tripId ? { ...t, ...updates } : t)));
  };

  const deleteTrip = async (tripId: string) => {
    const { error } = await supabase.from('trip_records').delete().eq('id', tripId);
    logError('deleteTrip', error);
    if (error) return;
    setTrips((prev) => prev.filter((t) => t.id !== tripId));
  };

  const recoverAsset = async (
    assetId: string,
    recovery: Omit<CartRecovery, 'id' | 'assetId' | 'assetName' | 'assetCode' | 'unitName' | 'timestamp'>
  ) => {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;

    const recoveryRow: Omit<CartRecovery, 'id'> = {
      ...recovery,
      assetId: asset.id,
      assetName: asset.name,
      assetCode: asset.code,
      unitName: asset.unitName,
      timestamp: 'Agora',
    };

    const { data, error } = await supabase
      .from('cart_recoveries')
      .insert(recoveryToInsertRow(recoveryRow))
      .select()
      .single();
    logError('recoverAsset (insert)', error);
    if (error || !data) return;
    setRecoveries((prev) => [rowToRecovery(data), ...prev]);

    const { error: assetErr } = await supabase
      .from('assets')
      .update({ status: 'available', geofence_name: null })
      .eq('id', assetId);
    logError('recoverAsset (asset status)', assetErr);
    if (!assetErr) {
      setAssets((prev) =>
        prev.map((a) => (a.id === assetId ? { ...a, status: 'available', geofenceName: undefined } : a))
      );
    }

    const { error: alertErr } = await supabase
      .from('system_alerts')
      .update({ acknowledged: true })
      .eq('asset_id', assetId)
      .eq('acknowledged', false);
    logError('recoverAsset (close alerts)', alertErr);
    if (!alertErr) {
      setAlerts((prev) =>
        prev.map((alt) => (alt.assetId === assetId && !alt.acknowledged ? { ...alt, acknowledged: true } : alt))
      );
    }
  };

  const addWorkOrder = async (order: WorkOrder) => {
    const { data, error } = await supabase.from('work_orders').insert(workOrderToInsertRow(order)).select().single();
    logError('addWorkOrder', error);
    if (error || !data) return;
    setWorkOrders((prev) => [rowToWorkOrder(data), ...prev]);
  };

  const updateWorkOrder = async (orderId: string, updates: Partial<WorkOrder>) => {
    const { error } = await supabase.from('work_orders').update(workOrderUpdatesToRow(updates)).eq('id', orderId);
    logError('updateWorkOrder', error);
    if (error) return;
    setWorkOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updates } : o)));
  };

  const deleteWorkOrder = async (orderId: string) => {
    const { error } = await supabase.from('work_orders').delete().eq('id', orderId);
    logError('deleteWorkOrder', error);
    if (error) return;
    setWorkOrders((prev) => prev.filter((o) => o.id !== orderId));
  };

  const addGreylistEntry = async (entry: GreylistEntry) => {
    const { data, error } = await supabase
      .from('greylist_entries')
      .insert(greylistEntryToInsertRow(entry))
      .select()
      .single();
    logError('addGreylistEntry', error);
    if (error || !data) return;
    setGreylist((prev) => [rowToGreylistEntry(data), ...prev]);
  };

  const deleteGreylistEntry = async (entryId: string) => {
    const { error } = await supabase.from('greylist_entries').delete().eq('id', entryId);
    logError('deleteGreylistEntry', error);
    if (error) return;
    setGreylist((prev) => prev.filter((g) => g.id !== entryId));
  };

  const addRecoveryCase = async (recoveryCase: AssetRecoveryCase) => {
    const { data, error } = await supabase
      .from('asset_recovery_cases')
      .insert(recoveryCaseToInsertRow(recoveryCase))
      .select()
      .single();
    logError('addRecoveryCase', error);
    if (error || !data) return;
    setRecoveryCases((prev) => [rowToRecoveryCase(data), ...prev]);
  };

  const updateRecoveryCase = async (caseId: string, updates: Partial<AssetRecoveryCase>) => {
    const { error } = await supabase
      .from('asset_recovery_cases')
      .update(recoveryCaseUpdatesToRow(updates))
      .eq('id', caseId);
    logError('updateRecoveryCase', error);
    if (error) return;
    setRecoveryCases((prev) => prev.map((c) => (c.id === caseId ? { ...c, ...updates } : c)));
  };

  const addRouteTemplate = async (template: RouteTemplate) => {
    const { data, error } = await supabase
      .from('route_templates')
      .insert(routeTemplateToInsertRow(template))
      .select()
      .single();
    logError('addRouteTemplate', error);
    if (error || !data) return;
    setRouteTemplates((prev) => [rowToRouteTemplate(data), ...prev]);
  };

  const deleteRouteTemplate = async (templateId: string) => {
    const { error } = await supabase.from('route_templates').delete().eq('id', templateId);
    logError('deleteRouteTemplate', error);
    if (error) return;
    setRouteTemplates((prev) => prev.filter((t) => t.id !== templateId));
  };

  const addAssetPairing = async (pairing: AssetPairing) => {
    const { data, error } = await supabase
      .from('asset_pairings')
      .insert(pairingToInsertRow(pairing))
      .select()
      .single();
    logError('addAssetPairing', error);
    if (error || !data) return;
    setAssetPairings((prev) => [rowToPairing(data), ...prev]);
  };

  const updateAssetPairing = async (pairingId: string, updates: Partial<AssetPairing>) => {
    const { error } = await supabase
      .from('asset_pairings')
      .update(pairingUpdatesToRow(updates))
      .eq('id', pairingId);
    logError('updateAssetPairing', error);
    if (error) return;
    setAssetPairings((prev) => prev.map((p) => (p.id === pairingId ? { ...p, ...updates } : p)));
  };

  const deleteAssetPairing = async (pairingId: string) => {
    const { error } = await supabase.from('asset_pairings').delete().eq('id', pairingId);
    logError('deleteAssetPairing', error);
    if (error) return;
    setAssetPairings((prev) => prev.filter((p) => p.id !== pairingId));
  };

  const sendRemoteCommand = async (assetId: string, command: string, label: string) => {
    const lastRemoteCommand = { command, label, sentAt: 'Agora' };
    const { error } = await supabase.from('assets').update({ last_remote_command: lastRemoteCommand }).eq('id', assetId);
    logError('sendRemoteCommand', error);
    if (error) return;
    setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, lastRemoteCommand } : a)));
  };

  const calibrateOdometer = async (assetId: string, newOdometer: number) => {
    const lastRemoteCommand = { command: '6B', label: 'Calibração de Odômetro', sentAt: 'Agora' };
    const { error } = await supabase
      .from('assets')
      .update({ telemetry_odometer: newOdometer, last_remote_command: lastRemoteCommand })
      .eq('id', assetId);
    logError('calibrateOdometer', error);
    if (error) return;
    setAssets((prev) =>
      prev.map((a) =>
        a.id === assetId ? { ...a, telemetry: { ...a.telemetry, odometer: newOdometer }, lastRemoteCommand } : a
      )
    );
  };

  const pushOfflineWhitelist = async (assetId: string) => {
    const syncedAt = new Date().toISOString();
    const lastRemoteCommand = { command: '94Down', label: 'Sincronização de Whitelist Offline', sentAt: 'Agora' };
    const { error } = await supabase
      .from('assets')
      .update({ offline_whitelist_synced_at: syncedAt, last_remote_command: lastRemoteCommand })
      .eq('id', assetId);
    logError('pushOfflineWhitelist', error);
    if (error) return;
    setAssets((prev) =>
      prev.map((a) =>
        a.id === assetId ? { ...a, offlineWhitelistSyncedAt: syncedAt, lastRemoteCommand } : a
      )
    );
  };

  // Vinculação Device (BRGPS) -> Asset. Não toca no fornecedor (isso é
  // exclusividade do processo server/brgps-sync, que tem o api_token) — é só
  // uma escrita normal no Supabase, igual a qualquer outro mutator deste
  // contexto (seção 12 do brief: nunca criar Asset automaticamente, só ligar
  // manualmente um dispositivo já descoberto a um asset já existente).
  const linkProviderDeviceToAsset = async (providerDeviceId: string, assetId: string) => {
    const device = providerDevices.find((d) => d.id === providerDeviceId);
    if (!device) return;

    const { error: deviceError } = await supabase
      .from('provider_devices')
      .update({ asset_id: assetId, status: 'ASSIGNED' })
      .eq('id', providerDeviceId);
    logError('linkProviderDeviceToAsset (provider_devices)', deviceError);
    if (deviceError) return;

    const { error: assetError } = await supabase
      .from('assets')
      .update({ provider: device.provider, provider_device_id: providerDeviceId, mac: device.mac ?? null })
      .eq('id', assetId);
    logError('linkProviderDeviceToAsset (assets)', assetError);
    if (assetError) return;

    setProviderDevices((prev) =>
      prev.map((d) => (d.id === providerDeviceId ? { ...d, assetId, status: 'ASSIGNED' } : d))
    );
    setAssets((prev) =>
      prev.map((a) => (a.id === assetId ? { ...a, provider: device.provider, providerDeviceId, mac: device.mac } : a))
    );
  };

  const unlinkProviderDevice = async (providerDeviceId: string, assetId: string) => {
    const { error: deviceError } = await supabase
      .from('provider_devices')
      .update({ asset_id: null, status: 'UNASSIGNED' })
      .eq('id', providerDeviceId);
    logError('unlinkProviderDevice (provider_devices)', deviceError);
    if (deviceError) return;

    const { error: assetError } = await supabase
      .from('assets')
      .update({ provider: null, provider_device_id: null })
      .eq('id', assetId);
    logError('unlinkProviderDevice (assets)', assetError);
    if (assetError) return;

    setProviderDevices((prev) =>
      prev.map((d) => (d.id === providerDeviceId ? { ...d, assetId: undefined, status: 'UNASSIGNED' } : d))
    );
    setAssets((prev) =>
      prev.map((a) => (a.id === assetId ? { ...a, provider: undefined, providerDeviceId: undefined } : a))
    );
  };

  const getFilteredAssets = (clientId = 'all', unitId = 'all'): AssetDevice[] => {
    return assets.filter((asset) => {
      if (clientId !== 'all' && asset.clientId !== clientId) return false;
      if (unitId !== 'all' && asset.unitId !== unitId) return false;
      if (categoryFilter !== 'all' && asset.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && asset.status !== statusFilter) return false;
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase();
        const matchName = asset.name.toLowerCase().includes(query);
        const matchCode = asset.code.toLowerCase().includes(query);
        const matchImei = asset.imei.toLowerCase().includes(query);
        const matchUnit = asset.unitName.toLowerCase().includes(query);
        const matchDriver = asset.driverName?.toLowerCase().includes(query);
        if (!matchName && !matchCode && !matchImei && !matchUnit && !matchDriver) return false;
      }
      return true;
    });
  };

  const getStats = (clientId = 'all', unitId = 'all') => {
    const scoped = assets.filter((a) => {
      if (clientId !== 'all' && a.clientId !== clientId) return false;
      if (unitId !== 'all' && a.unitId !== unitId) return false;
      return true;
    });

    const total = scoped.length;
    const online = scoped.filter((a) => a.status !== 'offline').length;
    const offline = scoped.filter((a) => a.status === 'offline').length;
    const moving = scoped.filter((a) => a.status === 'moving').length;
    const stopped = scoped.filter((a) => a.status === 'stopped' || a.status === 'online').length;
    const outOfGeofence = scoped.filter((a) => a.status === 'out_of_geofence').length;
    const lowBattery = scoped.filter((a) => a.status === 'low_battery' || a.telemetry.batteryLevel < 20).length;
    const criticalAlertsCount = alerts.filter((a) => !a.acknowledged && a.severity === 'critical').length;

    return {
      total,
      online,
      offline,
      moving,
      stopped,
      outOfGeofence,
      lowBattery,
      criticalAlertsCount,
    };
  };

  return (
    <AssetContext.Provider
      value={{
        assets,
        alerts,
        geofences,
        shipments,
        drivers,
        maintenanceRecords,
        trips,
        recoveries,
        workOrders,
        greylist,
        recoveryCases,
        routeTemplates,
        assetPairings,
        trafficSegments,
        pois,
        providerDevices,
        providerHealth,
        integrations,
        users,
        isLoading,
        selectedAsset,
        searchQuery,
        categoryFilter,
        statusFilter,
        isLiveSimulationActive,
        activeTabModule,
        setSelectedAsset,
        setSearchQuery,
        setCategoryFilter,
        setStatusFilter,
        setActiveTabModule,
        toggleLiveSimulation,
        acknowledgeAlert,
        addGeofence,
        updateGeofence,
        deleteGeofence,
        addAsset,
        updateAsset,
        deleteAsset,
        toggleVehicleBlock,
        toggleDoorLock,
        registerSealEvent,
        addDriver,
        updateDriver,
        deleteDriver,
        addUserProfile,
        updateUserProfile,
        deleteUserProfile,
        addMaintenanceRecord,
        updateMaintenanceRecord,
        deleteMaintenanceRecord,
        addTrip,
        updateTrip,
        deleteTrip,
        recoverAsset,
        addWorkOrder,
        updateWorkOrder,
        deleteWorkOrder,
        addGreylistEntry,
        deleteGreylistEntry,
        addRecoveryCase,
        updateRecoveryCase,
        addRouteTemplate,
        deleteRouteTemplate,
        addAssetPairing,
        updateAssetPairing,
        deleteAssetPairing,
        sendRemoteCommand,
        calibrateOdometer,
        pushOfflineWhitelist,
        linkProviderDeviceToAsset,
        unlinkProviderDevice,
        getFilteredAssets,
        getStats,
      }}
    >
      {children}
    </AssetContext.Provider>
  );
};

export const useAssets = () => {
  const context = useContext(AssetContext);
  if (!context) throw new Error('useAssets must be used within an AssetProvider');
  return context;
};
