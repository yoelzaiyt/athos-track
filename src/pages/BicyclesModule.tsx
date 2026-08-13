import React, { useState } from 'react';
import { Bike, CheckCircle2, Navigation, BatteryCharging, Wrench, ShieldAlert, Map as MapIcon } from 'lucide-react';
import { StatCard } from '../components/common/StatCard';
import { DataTable, Column } from '../components/common/DataTable';
import { LiveMap } from '../components/map/LiveMap';
import { useAssets } from '../context/AssetContext';
import { useAuth } from '../context/AuthContext';
import { AssetDevice } from '../types';
import { AssetIcon } from '../components/common/AssetIconRegistry';

export const BicyclesModule: React.FC = () => {
  const { selectedClientId, selectedUnitId } = useAuth();
  const { getFilteredAssets, setSelectedAsset } = useAssets();
  const [showMap, setShowMap] = useState(false);

  const bikes = getFilteredAssets(selectedClientId, selectedUnitId).filter(
    (a) => a.category === 'bike'
  );

  const columns: Column<AssetDevice>[] = [
    {
      header: 'Bicicleta',
      accessor: (row) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 font-mono">
            <div className="p-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
              <AssetIcon category="bike" subcategory={row.subcategory} className="w-4 h-4" />
            </div>
            <span>{row.code}</span>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{row.name}</div>
        </div>
      ),
    },
    {
      header: 'Unidade / Estação',
      accessor: 'unitName',
    },
    {
      header: 'Status Operacional',
      accessor: (row) => (
        <span
          className={`px-2 py-0.5 text-[10px] font-bold font-mono rounded uppercase ${
            row.status === 'in_use'
              ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20'
              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
          }`}
        >
          {row.status === 'in_use' ? 'EM UTILIZAÇÃO' : 'DISPONÍVEL'}
        </span>
      ),
    },
    {
      header: 'Bateria Elétrica',
      accessor: (row) => (
        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{row.telemetry.batteryLevel}%</span>
      ),
    },
    {
      header: 'Velocidade',
      accessor: (row) => <span className="font-mono text-slate-600 dark:text-slate-300">{row.telemetry.speed} km/h</span>,
    },
    {
      header: 'Última Comunicação',
      accessor: (row) => <span className="font-mono text-slate-500 dark:text-slate-400">{row.telemetry.lastCommunication}</span>,
    },
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100 transition-colors">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400 uppercase tracking-widest font-bold flex items-center gap-1">
            <Bike className="w-4 h-4" /> Mobilidade Urbana & Condomínios
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Módulo de Bicicletas Compartilhadas e Frotas Leves
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Monitoramento para parques, condomínios corporativos e campus universitários.
          </p>
        </div>

        <button
          onClick={() => setShowMap(!showMap)}
          className={`px-3.5 py-2 font-semibold text-xs rounded-xl shadow-md hover:-translate-y-0.5 flex items-center gap-2 transition-all border shrink-0 ${
            showMap
              ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/40'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
          }`}
        >
          <MapIcon className="w-4 h-4" />
          <span>{showMap ? 'Ocultar Mapa' : 'Ver no Mapa'}</span>
        </button>
      </div>

      {showMap && (
        <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
          <LiveMap
            assetsList={bikes}
            heightClass="h-[420px]"
            specializedTitle="Bicicletas Compartilhadas"
            showClustering={bikes.length > 25}
          />
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard title="Total Bicicletas" value="50" icon={Bike} variant="emerald" />
        <StatCard title="Disponíveis" value="38" icon={CheckCircle2} variant="emerald" />
        <StatCard title="Em Utilização" value="10" icon={Navigation} variant="cyan" />
        <StatCard title="Fora da Área" value="1" icon={ShieldAlert} variant="rose" />
        <StatCard title="Manutenção" value="1" icon={Wrench} variant="slate" />
      </div>

      <DataTable
        title="Frota de Bicicletas Elétricas"
        data={bikes}
        columns={columns}
        keyExtractor={(item) => item.id}
        onRowClick={(item) => setSelectedAsset(item)}
      />
    </div>
  );
};
