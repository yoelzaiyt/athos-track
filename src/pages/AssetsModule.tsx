import React, { useState } from 'react';
import { Box, Tag, BatteryCharging, Radio, CheckCircle2, AlertTriangle, Shield, Layers, Map as MapIcon } from 'lucide-react';
import { StatCard } from '../components/common/StatCard';
import { DataTable } from '../components/common/DataTable';
import { LiveMap } from '../components/map/LiveMap';
import { useAssets } from '../context/AssetContext';
import { useAuth } from '../context/AuthContext';
import { AssetDevice } from '../types';
import { assetColumns } from './columns/assetColumns';

export const AssetsModule: React.FC = () => {
  const { selectedClientId, selectedUnitId } = useAuth();
  const { getFilteredAssets, setSelectedAsset } = useAssets();
  const [showMap, setShowMap] = useState(false);

  const assets = getFilteredAssets(selectedClientId, selectedUnitId).filter(
    (a) => a.category === 'asset' || a.category === 'tag'
  );

  const inOperationCount = assets.filter((a) => a.status === 'in_use' || a.status === 'moving' || a.status === 'online').length;
  const movementAlertsCount = assets.filter((a) => a.status === 'out_of_geofence' || a.status === 'low_battery').length;

  const columns = assetColumns;

  return (
    <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100 transition-colors">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs font-mono text-indigo-600 dark:text-indigo-400 uppercase tracking-widest font-bold flex items-center gap-1">
            <Box className="w-4 h-4" /> Gestão de Patrimônio
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Módulo de Ativos, Máquinas e Equipamentos Especializados
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Rastreamento de ferramentas calibradas, geradores, malas técnicas e caixas industriais.
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
            assetsList={assets}
            heightClass="h-[420px]"
            specializedTitle="Ativos e Equipamentos"
            showClustering={assets.length > 25}
          />
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard title="Ativos Monitorados" value={String(assets.length)} icon={Box} variant="indigo" />
        <StatCard title="Em Operação" value={String(inOperationCount)} icon={CheckCircle2} variant="emerald" />
        <StatCard title="Tags Associadas" value={String(assets.filter((a) => a.category === 'tag').length)} icon={Tag} variant="cyan" />
        <StatCard title="Alertas de Movimentação" value={String(movementAlertsCount)} icon={AlertTriangle} variant="amber" />
      </div>

      <DataTable
        title="Catálogo de Ativos Rastreáveis"
        data={assets}
        columns={columns}
        keyExtractor={(item) => item.id}
        onRowClick={(item) => setSelectedAsset(item)}
      />
    </div>
  );
};
