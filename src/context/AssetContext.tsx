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
} from '../types';
import {
  MOCK_ASSETS,
  MOCK_ALERTS,
  MOCK_GEOFENCES,
  MOCK_CARGO_SHIPMENTS,
  MOCK_DRIVERS,
  MOCK_MAINTENANCE,
  MOCK_TRIPS,
  MOCK_RECOVERIES,
} from '../mock';

interface AssetContextType {
  assets: AssetDevice[];
  alerts: SystemAlert[];
  geofences: Geofence[];
  shipments: CargoShipment[];
  drivers: Driver[];
  maintenanceRecords: MaintenanceRecord[];
  trips: TripRecord[];
  recoveries: CartRecovery[];
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
  addMaintenanceRecord: (record: MaintenanceRecord) => void;
  updateMaintenanceRecord: (recordId: string, updates: Partial<MaintenanceRecord>) => void;
  deleteMaintenanceRecord: (recordId: string) => void;
  addTrip: (trip: TripRecord) => void;
  updateTrip: (tripId: string, updates: Partial<TripRecord>) => void;
  deleteTrip: (tripId: string) => void;
  recoverAsset: (assetId: string, recovery: Omit<CartRecovery, 'id' | 'assetId' | 'assetName' | 'assetCode' | 'unitName' | 'timestamp'>) => void;
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

export const AssetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [assets, setAssets] = useState<AssetDevice[]>(MOCK_ASSETS);
  const [alerts, setAlerts] = useState<SystemAlert[]>(MOCK_ALERTS);
  const [geofences, setGeofences] = useState<Geofence[]>(MOCK_GEOFENCES);
  const [shipments, setShipments] = useState<CargoShipment[]>(MOCK_CARGO_SHIPMENTS);
  const [drivers, setDrivers] = useState<Driver[]>(MOCK_DRIVERS);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>(MOCK_MAINTENANCE);
  const [trips, setTrips] = useState<TripRecord[]>(MOCK_TRIPS);
  const [recoveries, setRecoveries] = useState<CartRecovery[]>(MOCK_RECOVERIES);
  const [selectedAsset, setSelectedAsset] = useState<AssetDevice | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<AssetCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AssetStatus | 'all'>('all');
  const [activeTabModule, setActiveTabModule] = useState<string>('dashboard');
  const [isLiveSimulationActive, setIsLiveSimulationActive] = useState<boolean>(true);

  // Live simulation tick every 4 seconds to show live telemetry updates
  useEffect(() => {
    if (!isLiveSimulationActive) return;

    const interval = setInterval(() => {
      setAssets((prevAssets) =>
        prevAssets.map((asset) => {
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

  const acknowledgeAlert = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((alt) => (alt.id === alertId ? { ...alt, acknowledged: true } : alt))
    );
  };

  const addGeofence = (geofence: Geofence) => {
    setGeofences((prev) => [geofence, ...prev]);
  };

  const updateGeofence = (geofenceId: string, updates: Partial<Geofence>) => {
    setGeofences((prev) => prev.map((g) => (g.id === geofenceId ? { ...g, ...updates } : g)));
  };

  const deleteGeofence = (geofenceId: string) => {
    setGeofences((prev) => prev.filter((g) => g.id !== geofenceId));
  };

  const addAsset = (asset: AssetDevice) => {
    setAssets((prev) => [asset, ...prev]);
  };

  const updateAsset = (assetId: string, updates: Partial<AssetDevice>) => {
    setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, ...updates } : a)));
  };

  const deleteAsset = (assetId: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== assetId));
    if (selectedAsset?.id === assetId) setSelectedAsset(null);
  };

  const toggleVehicleBlock = (assetId: string) => {
    setAssets((prev) =>
      prev.map((a) => {
        if (a.id !== assetId) return a;
        const nextBlocked = !a.isBlocked;
        return {
          ...a,
          isBlocked: nextBlocked,
          telemetry: { ...a.telemetry, ignition: nextBlocked ? false : a.telemetry.ignition },
          status: nextBlocked ? 'maintenance' : a.status,
        };
      })
    );
  };

  const toggleDoorLock = (assetId: string) => {
    setAssets((prev) =>
      prev.map((a) => (a.id === assetId ? { ...a, isDoorLocked: !a.isDoorLocked } : a))
    );
  };

  const registerSealEvent = (shipmentId: string, status: SealStatus, trigger: SealTriggerMethod) => {
    setShipments((prev) =>
      prev.map((s) =>
        s.id === shipmentId
          ? { ...s, sealStatus: status, sealLastTrigger: trigger, sealLastEventTime: 'Agora' }
          : s
      )
    );
  };

  const addDriver = (driver: Driver) => {
    setDrivers((prev) => [driver, ...prev]);
  };

  const updateDriver = (driverId: string, updates: Partial<Driver>) => {
    setDrivers((prev) => prev.map((d) => (d.id === driverId ? { ...d, ...updates } : d)));
  };

  const deleteDriver = (driverId: string) => {
    setDrivers((prev) => prev.filter((d) => d.id !== driverId));
  };

  const addMaintenanceRecord = (record: MaintenanceRecord) => {
    setMaintenanceRecords((prev) => [record, ...prev]);
  };

  const updateMaintenanceRecord = (recordId: string, updates: Partial<MaintenanceRecord>) => {
    setMaintenanceRecords((prev) => prev.map((m) => (m.id === recordId ? { ...m, ...updates } : m)));
  };

  const deleteMaintenanceRecord = (recordId: string) => {
    setMaintenanceRecords((prev) => prev.filter((m) => m.id !== recordId));
  };

  const addTrip = (trip: TripRecord) => {
    setTrips((prev) => [trip, ...prev]);
  };

  const updateTrip = (tripId: string, updates: Partial<TripRecord>) => {
    setTrips((prev) => prev.map((t) => (t.id === tripId ? { ...t, ...updates } : t)));
  };

  const deleteTrip = (tripId: string) => {
    setTrips((prev) => prev.filter((t) => t.id !== tripId));
  };

  const recoverAsset = (
    assetId: string,
    recovery: Omit<CartRecovery, 'id' | 'assetId' | 'assetName' | 'assetCode' | 'unitName' | 'timestamp'>
  ) => {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;

    const record: CartRecovery = {
      ...recovery,
      id: `rec_${Date.now()}`,
      assetId: asset.id,
      assetName: asset.name,
      assetCode: asset.code,
      unitName: asset.unitName,
      timestamp: 'Agora',
    };
    setRecoveries((prev) => [record, ...prev]);

    // Ativo volta ao estado normal dentro do perímetro
    setAssets((prev) =>
      prev.map((a) => (a.id === assetId ? { ...a, status: 'available', geofenceName: undefined } : a))
    );

    // Fecha automaticamente qualquer alerta em aberto vinculado a este ativo
    setAlerts((prev) =>
      prev.map((alt) => (alt.assetId === assetId && !alt.acknowledged ? { ...alt, acknowledged: true } : alt))
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
        addMaintenanceRecord,
        updateMaintenanceRecord,
        deleteMaintenanceRecord,
        addTrip,
        updateTrip,
        deleteTrip,
        recoverAsset,
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
