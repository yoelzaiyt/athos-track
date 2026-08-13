import React, { useState } from 'react';
import {
  Truck,
  User,
  Navigation,
  Wrench,
  Shield,
  MapPin,
  Gauge,
  Clock,
  Plus,
  Pencil,
  Trash2,
  Lock,
  Unlock,
  Gauge as SpeedIcon,
  BatteryLow,
  ShieldAlert,
  Route,
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  BedDouble,
  IdCard,
  Map as MapIcon,
  Fuel,
  DoorOpen,
  DoorClosed,
  Cpu,
  Camera,
  AlertOctagon,
} from 'lucide-react';
import { StatCard } from '../components/common/StatCard';
import { DataTable, Column } from '../components/common/DataTable';
import { DeviceFormModal } from '../components/common/DeviceFormModal';
import { DriverFormModal } from '../components/common/DriverFormModal';
import { MaintenanceFormModal } from '../components/common/MaintenanceFormModal';
import { TripFormModal } from '../components/common/TripFormModal';
import { CameraViewerModal } from '../components/common/CameraViewerModal';
import { LiveMap } from '../components/map/LiveMap';
import { useAssets } from '../context/AssetContext';
import { useAuth } from '../context/AuthContext';
import { AssetDevice, Driver, MaintenanceRecord, TripRecord } from '../types';
import { AssetIcon } from '../components/common/AssetIconRegistry';

export const FleetModule: React.FC = () => {
  const { selectedClientId, selectedUnitId } = useAuth();
  const {
    getFilteredAssets,
    setSelectedAsset,
    addAsset,
    updateAsset,
    deleteAsset,
    toggleVehicleBlock,
    toggleDoorLock,
    shipments,
    drivers,
    addDriver,
    updateDriver,
    deleteDriver,
    maintenanceRecords,
    addMaintenanceRecord,
    updateMaintenanceRecord,
    deleteMaintenanceRecord,
    trips,
    addTrip,
    updateTrip,
    deleteTrip,
  } = useAssets();

  const [activeSubTab, setActiveSubTab] = useState<'veiculos' | 'motoristas' | 'rotas' | 'manutencao'>('veiculos');
  const [showMap, setShowMap] = useState(false);
  const [cameraAsset, setCameraAsset] = useState<AssetDevice | null>(null);

  // Modal state por aba
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<AssetDevice | null>(null);
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [isMaintModalOpen, setIsMaintModalOpen] = useState(false);
  const [editingMaint, setEditingMaint] = useState<MaintenanceRecord | null>(null);
  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<TripRecord | null>(null);

  const fleetAssets = getFilteredAssets(selectedClientId, selectedUnitId).filter(
    (a) => a.category === 'truck' || a.category === 'vehicle'
  );

  const findCargoForPlate = (plate?: string) =>
    plate ? shipments.find((s) => s.vehiclePlate === plate) : undefined;

  // ----- Veículos -----
  const speedingVehicles = fleetAssets.filter(
    (v) => v.speedLimitKmh && v.telemetry.speed > v.speedLimitKmh
  );
  const blockedVehicles = fleetAssets.filter((v) => v.isBlocked);
  const movingVehicles = fleetAssets.filter((v) => v.status === 'moving');

  const vehicleColumns: Column<AssetDevice>[] = [
    {
      header: 'Placa / Veículo',
      accessor: (row) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 font-mono">
            <div className="p-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
              <AssetIcon category={row.category} subcategory={row.subcategory} className="w-4 h-4" />
            </div>
            <span>{row.plateNumber || row.code}</span>
            {row.isBlocked && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-rose-500/15 text-rose-600 dark:text-rose-400 rounded border border-rose-500/30">
                Bloqueado
              </span>
            )}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{row.model || row.name}</div>
        </div>
      ),
    },
    {
      header: 'Motorista / Autorização',
      accessor: (row) => {
        const cargo = findCargoForPlate(row.plateNumber);
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200">
              <User className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>{row.driverName || 'Motorista de Plantão'}</span>
            </div>
            {cargo && (
              <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 flex items-center gap-1">
                <Shield className="w-3 h-3" /> Carga {cargo.code}
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: 'Velocidade / Limite',
      accessor: (row) => {
        const exceeding = row.speedLimitKmh !== undefined && row.telemetry.speed > row.speedLimitKmh;
        return (
          <div className="flex flex-col">
            <span
              className={`font-mono font-bold flex items-center gap-1 ${
                exceeding ? 'text-rose-600 dark:text-rose-400' : 'text-cyan-600 dark:text-cyan-400'
              }`}
            >
              {exceeding && <AlertTriangle className="w-3.5 h-3.5" />}
              {row.telemetry.speed} km/h
            </span>
            {row.speedLimitKmh !== undefined && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                limite {row.speedLimitKmh} km/h
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: 'Hodômetro / KM',
      accessor: (row) => (
        <span className="font-mono text-slate-600 dark:text-slate-300">
          {row.telemetry.odometer ? `${row.telemetry.odometer.toLocaleString()} km` : '—'}
        </span>
      ),
    },
    {
      header: 'Ignição',
      accessor: (row) => (
        <span
          className={`px-2 py-0.5 text-[10px] font-bold font-mono rounded-full uppercase ${
            row.telemetry.ignition !== false
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
          }`}
        >
          {row.telemetry.ignition !== false ? 'LIGADA' : 'DESLIGADA'}
        </span>
      ),
    },
    {
      header: 'Combustível',
      accessor: (row) => {
        if (row.telemetry.fuelPercent === undefined) return <span className="text-slate-400 dark:text-slate-600">—</span>;
        return (
          <div className="flex flex-col gap-0.5 min-w-[90px]">
            <div className="flex items-center gap-1.5">
              <Fuel
                className={`w-3.5 h-3.5 ${
                  row.telemetry.possibleFuelTheft
                    ? 'text-rose-600 dark:text-rose-400'
                    : row.telemetry.fuelPercent < 25
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              />
              <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{row.telemetry.fuelPercent}%</span>
              {row.telemetry.possibleFuelTheft && (
                <span title="Possível furto de combustível">
                  <AlertOctagon className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                </span>
              )}
            </div>
            {row.telemetry.fuelVolumeLiters !== undefined && row.telemetry.fuelTankCapacityLiters !== undefined && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                {row.telemetry.fuelVolumeLiters}L / {row.telemetry.fuelTankCapacityLiters}L
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: 'Diagnóstico OBD/CAN',
      accessor: (row) => {
        const codes = row.telemetry.obdErrorCodes || [];
        if (!row.telemetry.canBusConnected) return <span className="text-slate-400 dark:text-slate-600">Sem leitor CAN</span>;
        return codes.length > 0 ? (
          <span
            title={codes.join('\n')}
            className="px-2 py-0.5 text-[10px] font-bold font-mono rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1 w-fit"
          >
            <AlertOctagon className="w-3 h-3" /> {codes.length} código{codes.length > 1 ? 's' : ''}
          </span>
        ) : (
          <span className="px-2 py-0.5 text-[10px] font-bold font-mono rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1 w-fit">
            <Cpu className="w-3 h-3" /> OK
          </span>
        );
      },
    },
    {
      header: 'Último Ping',
      accessor: (row) => <span className="font-mono text-slate-500 dark:text-slate-400">{row.telemetry.lastCommunication}</span>,
    },
  ];

  // ----- Motoristas -----
  const criticalFatigueDrivers = drivers.filter((d) => d.fatigueStatus === 'critical');
  const expiringCnh = drivers.filter((d) => {
    const days = (new Date(d.cnhExpiry).getTime() - Date.now()) / 86400000;
    return days <= 60 && days >= 0;
  });

  const fatigueBadge = (status: Driver['fatigueStatus']) => {
    if (status === 'critical')
      return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30';
    if (status === 'attention')
      return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
    return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
  };

  const driverColumns: Column<Driver>[] = [
    {
      header: 'Motorista',
      accessor: (row) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>{row.name}</span>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{row.phone}</div>
        </div>
      ),
    },
    {
      header: 'CNH',
      accessor: (row) => {
        const daysToExpire = Math.floor((new Date(row.cnhExpiry).getTime() - Date.now()) / 86400000);
        const expiringSoon = daysToExpire <= 60;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <IdCard className="w-3 h-3 text-indigo-500" /> {row.cnhNumber} ({row.cnhCategory})
            </span>
            <span className={`text-[10px] font-mono ${expiringSoon ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-400 dark:text-slate-500'}`}>
              válida até {row.cnhExpiry} {expiringSoon && '⚠'}
            </span>
          </div>
        );
      },
    },
    {
      header: 'Veículo Atribuído',
      accessor: (row) => (
        <span className="font-mono text-slate-600 dark:text-slate-300">
          {row.assignedVehiclePlate || 'Sem veículo'}
        </span>
      ),
    },
    {
      header: 'Controle de Sono (Fadiga)',
      accessor: (row) => (
        <div className="flex flex-col gap-1 min-w-[140px]">
          <div className="flex items-center justify-between">
            <span className={`px-2 py-0.5 text-[10px] font-bold font-mono rounded-full uppercase border ${fatigueBadge(row.fatigueStatus)}`}>
              {row.fatigueStatus === 'critical' ? 'Crítico' : row.fatigueStatus === 'attention' ? 'Atenção' : 'Normal'}
            </span>
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{row.fatigueScore}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                row.fatigueStatus === 'critical' ? 'bg-rose-500' : row.fatigueStatus === 'attention' ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${row.fatigueScore}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
            {row.continuousDrivingHours}h contínuas · {row.drivingHoursToday}h hoje
          </span>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (row) => (
        <span
          className={`px-2 py-0.5 text-[10px] font-bold font-mono rounded-full uppercase ${
            row.status === 'active'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              : row.status === 'suspended'
              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
          }`}
        >
          {row.status === 'active' ? 'Ativo' : row.status === 'suspended' ? 'Suspenso' : 'Inativo'}
        </span>
      ),
    },
  ];

  // ----- Rotas & Viagens -----
  const activeTrips = trips.filter((t) => t.status === 'em_andamento');
  const completedTrips = trips.filter((t) => t.status === 'concluida');

  const tripColumns: Column<TripRecord>[] = [
    {
      header: 'Veículo / Motorista',
      accessor: (row) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-slate-100 font-mono flex items-center gap-1.5">
            <Route className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            {row.vehiclePlate}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{row.driverName}</div>
        </div>
      ),
    },
    {
      header: 'Trajeto',
      accessor: (row) => (
        <div className="text-xs text-slate-600 dark:text-slate-300">
          <div>{row.origin}</div>
          <div className="text-slate-400 dark:text-slate-500">→ {row.destination}</div>
        </div>
      ),
    },
    {
      header: 'Distância',
      accessor: (row) => <span className="font-mono text-slate-600 dark:text-slate-300">{row.distanceKm} km</span>,
    },
    {
      header: 'Vel. Média / Máx',
      accessor: (row) => {
        const vehicle = fleetAssets.find((v) => v.id === row.vehicleId);
        const overLimit = vehicle?.speedLimitKmh !== undefined && row.maxSpeedKmh > vehicle.speedLimitKmh;
        return (
          <span className={`font-mono ${overLimit ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-600 dark:text-slate-300'}`}>
            {row.avgSpeedKmh} / {row.maxSpeedKmh} km/h {overLimit && '⚠'}
          </span>
        );
      },
    },
    {
      header: 'Status',
      accessor: (row) => (
        <span
          className={`px-2 py-0.5 text-[10px] font-bold font-mono rounded-full uppercase ${
            row.status === 'em_andamento'
              ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20'
              : row.status === 'concluida'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
          }`}
        >
          {row.status === 'em_andamento' ? 'Em Andamento' : row.status === 'concluida' ? 'Concluída' : 'Planejada'}
        </span>
      ),
    },
    {
      header: 'Início',
      accessor: (row) => <span className="font-mono text-slate-500 dark:text-slate-400 text-[11px]">{row.startTime}</span>,
    },
  ];

  // ----- Manutenção -----
  const scheduledMaint = maintenanceRecords.filter((m) => m.status === 'agendada');
  const lateMaint = maintenanceRecords.filter((m) => m.status === 'atrasada');
  const completedMaint = maintenanceRecords.filter((m) => m.status === 'concluida');

  const maintStatusBadge = (status: MaintenanceRecord['status']) => {
    switch (status) {
      case 'concluida':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'atrasada':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
      case 'em_andamento':
        return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20';
      default:
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    }
  };

  const maintColumns: Column<MaintenanceRecord>[] = [
    {
      header: 'Veículo',
      accessor: (row) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-slate-100 font-mono">{row.vehiclePlate}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{row.vehicleName}</div>
        </div>
      ),
    },
    {
      header: 'Tipo / Descrição',
      accessor: (row) => (
        <div className="text-xs text-slate-600 dark:text-slate-300">
          <span className="capitalize font-semibold text-slate-800 dark:text-slate-200">{row.type}</span>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{row.description}</div>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (row) => (
        <span className={`px-2 py-0.5 text-[10px] font-bold font-mono rounded-full uppercase border ${maintStatusBadge(row.status)}`}>
          {row.status.replace('_', ' ')}
        </span>
      ),
    },
    {
      header: 'Data',
      accessor: (row) => (
        <span className="font-mono text-slate-500 dark:text-slate-400 text-[11px]">
          {row.completedDate ? `Concluída em ${row.completedDate}` : `Agendada para ${row.scheduledDate}`}
        </span>
      ),
    },
    {
      header: 'Oficina / Custo',
      accessor: (row) => (
        <div className="text-[11px] text-slate-500 dark:text-slate-400">
          <div>{row.workshop || '—'}</div>
          {row.cost !== undefined && <div className="font-mono text-slate-700 dark:text-slate-300">R$ {row.cost.toFixed(2)}</div>}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100 transition-colors">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs font-mono text-amber-600 dark:text-amber-400 uppercase tracking-widest font-bold flex items-center gap-1">
            <Truck className="w-4 h-4" /> Gestão Corporativa de Frotas
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Módulo de Frotas, Veículos e Viagens
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Cadastro de veículos, motoristas, rotas, manutenção, bloqueio remoto e controle de fadiga.
          </p>
        </div>

        {/* Sub-Tabs Nav */}
        <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl text-xs shadow-sm">
          <button
            onClick={() => setActiveSubTab('veiculos')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeSubTab === 'veiculos' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Veículos ({fleetAssets.length})
          </button>
          <button
            onClick={() => setActiveSubTab('motoristas')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeSubTab === 'motoristas' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Motoristas ({drivers.length})
          </button>
          <button
            onClick={() => setActiveSubTab('rotas')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeSubTab === 'rotas' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Rotas &amp; Viagens ({trips.length})
          </button>
          <button
            onClick={() => setActiveSubTab('manutencao')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeSubTab === 'manutencao' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Manutenção ({maintenanceRecords.length})
          </button>
        </div>
      </div>

      {/* ===================== VEÍCULOS ===================== */}
      {activeSubTab === 'veiculos' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            <StatCard title="Veículos na Frota" value={fleetAssets.length} icon={Truck} variant="amber" />
            <StatCard title="Em Movimento" value={movingVehicles.length} icon={Navigation} variant="emerald" />
            <StatCard title="Excesso de Velocidade" value={speedingVehicles.length} icon={SpeedIcon} variant="rose" />
            <StatCard title="Bloqueados (RF)" value={blockedVehicles.length} icon={Lock} variant="indigo" />
            <StatCard title="Cargas Vinculadas" value={shipments.length} icon={Shield} variant="cyan" />
            <StatCard title="Manutenções Pendentes" value={scheduledMaint.length + lateMaint.length} icon={Wrench} variant="slate" />
            <StatCard
              title="Alertas de Combustível"
              value={fleetAssets.filter((v) => v.telemetry.possibleFuelTheft).length}
              icon={Fuel}
              variant="rose"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowMap(!showMap)}
              className={`px-3.5 py-2 font-semibold text-xs rounded-xl shadow-md hover:-translate-y-0.5 flex items-center gap-2 transition-all border ${
                showMap
                  ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/40'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
              }`}
            >
              <MapIcon className="w-4 h-4" />
              <span>{showMap ? 'Ocultar Mapa' : 'Ver no Mapa'}</span>
            </button>
            <button
              onClick={() => {
                setEditingVehicle(null);
                setIsVehicleModalOpen(true);
              }}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-xl shadow-md shadow-amber-500/20 hover:-translate-y-0.5 flex items-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Veículo</span>
            </button>
          </div>

          {showMap && (
            <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
              <LiveMap
                assetsList={fleetAssets}
                heightClass="h-[420px]"
                specializedTitle="Frota de Veículos"
                showClustering={false}
              />
            </div>
          )}

          <DataTable
            title="Frota de Veículos e Caminhões Rastreados"
            data={fleetAssets}
            columns={vehicleColumns}
            keyExtractor={(item) => item.id}
            onRowClick={(item) => setSelectedAsset(item)}
            actions={(item) => (
              <div className="flex items-center justify-end gap-1.5">
                <button
                  onClick={() => toggleVehicleBlock(item.id)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    item.isBlocked
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20'
                  }`}
                  title={item.isBlocked ? 'Desbloquear ignição remotamente' : 'Bloquear ignição remotamente (RF)'}
                >
                  {item.isBlocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => toggleDoorLock(item.id)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    item.isDoorLocked
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-cyan-500/15 hover:text-cyan-600 dark:hover:text-cyan-400'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                  }`}
                  title={item.isDoorLocked ? 'Destravar porta remotamente' : 'Travar porta remotamente'}
                >
                  {item.isDoorLocked ? <DoorClosed className="w-3.5 h-3.5" /> : <DoorOpen className="w-3.5 h-3.5" />}
                </button>
                {!!item.cameraChannelsCount && (
                  <button
                    onClick={() => setCameraAsset(item)}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-500/15 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    title="Ver câmeras embarcadas"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => {
                    setEditingVehicle(item);
                    setIsVehicleModalOpen(true);
                  }}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-cyan-500/15 text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                  title="Editar veículo"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Remover o veículo "${item.name}" (${item.plateNumber || item.code})?`)) {
                      deleteAsset(item.id);
                    }
                  }}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-500/15 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                  title="Remover veículo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          />
        </>
      )}

      {/* ===================== MOTORISTAS ===================== */}
      {activeSubTab === 'motoristas' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard title="Total de Motoristas" value={drivers.length} icon={User} variant="cyan" />
            <StatCard title="Ativos" value={drivers.filter((d) => d.status === 'active').length} icon={CheckCircle2} variant="emerald" />
            <StatCard title="Fadiga Crítica (Sono)" value={criticalFatigueDrivers.length} icon={BedDouble} variant="rose" />
            <StatCard title="CNH Vencendo (60d)" value={expiringCnh.length} icon={CalendarClock} variant="amber" />
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => {
                setEditingDriver(null);
                setIsDriverModalOpen(true);
              }}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-xl shadow-md shadow-amber-500/20 hover:-translate-y-0.5 flex items-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Motorista</span>
            </button>
          </div>

          <DataTable
            title="Motoristas Cadastrados e Controle de Fadiga"
            data={drivers}
            columns={driverColumns}
            keyExtractor={(item) => item.id}
            actions={(item) => (
              <div className="flex items-center justify-end gap-1.5">
                <button
                  onClick={() => {
                    setEditingDriver(item);
                    setIsDriverModalOpen(true);
                  }}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-cyan-500/15 text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                  title="Editar motorista"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Remover o motorista "${item.name}"?`)) {
                      deleteDriver(item.id);
                    }
                  }}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-500/15 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                  title="Remover motorista"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          />
        </>
      )}

      {/* ===================== ROTAS & VIAGENS ===================== */}
      {activeSubTab === 'rotas' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard title="Viagens em Andamento" value={activeTrips.length} icon={Navigation} variant="cyan" />
            <StatCard title="Concluídas" value={completedTrips.length} icon={CheckCircle2} variant="emerald" />
            <StatCard
              title="Distância Total"
              value={`${trips.reduce((sum, t) => sum + t.distanceKm, 0)} km`}
              icon={Route}
              variant="indigo"
            />
            <StatCard title="Total de Viagens" value={trips.length} icon={MapPin} variant="amber" />
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => {
                setEditingTrip(null);
                setIsTripModalOpen(true);
              }}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-xl shadow-md shadow-amber-500/20 hover:-translate-y-0.5 flex items-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Viagem</span>
            </button>
          </div>

          <DataTable
            title="Rotas e Viagens Registradas"
            data={trips}
            columns={tripColumns}
            keyExtractor={(item) => item.id}
            actions={(item) => (
              <div className="flex items-center justify-end gap-1.5">
                <button
                  onClick={() => {
                    setEditingTrip(item);
                    setIsTripModalOpen(true);
                  }}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-cyan-500/15 text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                  title="Editar viagem"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Remover o registro de viagem ${item.vehiclePlate}?`)) {
                      deleteTrip(item.id);
                    }
                  }}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-500/15 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                  title="Remover viagem"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          />
        </>
      )}

      {/* ===================== MANUTENÇÃO ===================== */}
      {activeSubTab === 'manutencao' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard title="Agendadas" value={scheduledMaint.length} icon={CalendarClock} variant="amber" />
            <StatCard title="Atrasadas" value={lateMaint.length} icon={AlertTriangle} variant="rose" />
            <StatCard title="Concluídas" value={completedMaint.length} icon={CheckCircle2} variant="emerald" />
            <StatCard title="Total de Registros" value={maintenanceRecords.length} icon={Wrench} variant="slate" />
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => {
                setEditingMaint(null);
                setIsMaintModalOpen(true);
              }}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-xl shadow-md shadow-amber-500/20 hover:-translate-y-0.5 flex items-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Agendar Manutenção</span>
            </button>
          </div>

          <DataTable
            title="Registros de Manutenção da Frota"
            data={maintenanceRecords}
            columns={maintColumns}
            keyExtractor={(item) => item.id}
            actions={(item) => (
              <div className="flex items-center justify-end gap-1.5">
                <button
                  onClick={() => {
                    setEditingMaint(item);
                    setIsMaintModalOpen(true);
                  }}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-cyan-500/15 text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                  title="Editar manutenção"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Remover o registro de manutenção de ${item.vehiclePlate}?`)) {
                      deleteMaintenanceRecord(item.id);
                    }
                  }}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-500/15 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                  title="Remover manutenção"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          />
        </>
      )}

      {/* ===================== MODAIS DE CADASTRO ===================== */}
      <DeviceFormModal
        isOpen={isVehicleModalOpen}
        onClose={() => {
          setIsVehicleModalOpen(false);
          setEditingVehicle(null);
        }}
        onSave={(device) => {
          if (editingVehicle) {
            updateAsset(editingVehicle.id, device);
          } else {
            addAsset(device);
          }
          setIsVehicleModalOpen(false);
          setEditingVehicle(null);
        }}
        editingDevice={editingVehicle}
        defaultCategory="vehicle"
      />

      <DriverFormModal
        isOpen={isDriverModalOpen}
        onClose={() => {
          setIsDriverModalOpen(false);
          setEditingDriver(null);
        }}
        onSave={(driver) => {
          if (editingDriver) {
            updateDriver(editingDriver.id, driver);
          } else {
            addDriver(driver);
          }
          setIsDriverModalOpen(false);
          setEditingDriver(null);
        }}
        editingDriver={editingDriver}
      />

      <MaintenanceFormModal
        isOpen={isMaintModalOpen}
        onClose={() => {
          setIsMaintModalOpen(false);
          setEditingMaint(null);
        }}
        onSave={(record) => {
          if (editingMaint) {
            updateMaintenanceRecord(editingMaint.id, record);
          } else {
            addMaintenanceRecord(record);
          }
          setIsMaintModalOpen(false);
          setEditingMaint(null);
        }}
        editingRecord={editingMaint}
        vehicles={fleetAssets}
      />

      <TripFormModal
        isOpen={isTripModalOpen}
        onClose={() => {
          setIsTripModalOpen(false);
          setEditingTrip(null);
        }}
        onSave={(trip) => {
          if (editingTrip) {
            updateTrip(editingTrip.id, trip);
          } else {
            addTrip(trip);
          }
          setIsTripModalOpen(false);
          setEditingTrip(null);
        }}
        editingTrip={editingTrip}
        vehicles={fleetAssets}
        drivers={drivers}
      />

      <CameraViewerModal isOpen={!!cameraAsset} onClose={() => setCameraAsset(null)} asset={cameraAsset} />
    </div>
  );
};
