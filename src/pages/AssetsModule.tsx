import React, { useState } from 'react';
import { Box, Tag, User, MapPin, BatteryCharging, Radio, CheckCircle2, AlertTriangle, Shield, Layers, Map as MapIcon } from 'lucide-react';
import { StatCard } from '../components/common/StatCard';
import { DataTable, Column } from '../components/common/DataTable';
import { LiveMap } from '../components/map/LiveMap';
import { useAssets } from '../context/AssetContext';
import { useAuth } from '../context/AuthContext';
import { AssetDevice } from '../types';
import { AssetIcon } from '../components/common/AssetIconRegistry';

export const AssetsModule: React.FC = () => {
  const { selectedClientId, selectedUnitId } = useAuth();
  const { getFilteredAssets, setSelectedAsset } = useAssets();
  const [showMap, setShowMap] = useState(false);

  const assets = getFilteredAssets(selectedClientId, selectedUnitId).filter(
    (a) => a.category === 'asset' || a.category === 'tag'
  );

  const columns: Column<AssetDevice>[] = [
    {
      header: 'Ativo / Equipamento',
      accessor: (row) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 font-mono">
            <div className="p-1 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400">
              <AssetIcon category={row.category} subcategory={row.subcategory} className="w-4 h-4" />
            </div>
            <span>{row.name}</span>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">Patrimônio: {row.code}</div>
        </div>
      ),
    },
    {
      header: 'Categoria',
      accessor: (row) => (
        <span className="px-2 py-0.5 text-[10px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 rounded font-medium uppercase">
          {row.category === 'asset' ? 'Equipamento Especial' : 'Tag de Ativo'}
        </span>
      ),
    },
    {
      header: 'Responsável',
      accessor: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
          <User className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
          <span>{row.responsibleName || 'Engenharia de Manutenção'}</span>
        </div>
      ),
    },
    {
      header: 'Localização / Unidade',
      accessor: (row) => (
        <div>
          <div className="text-slate-700 dark:text-slate-200 font-medium">{row.unitName}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">{row.geofenceName || 'Galpão Principal'}</div>
        </div>
      ),
    },
    {
      header: 'Tag / Protocolo',
      accessor: (row) => (
        <span className="font-mono text-cyan-600 dark:text-cyan-400 text-[11px]">{row.protocol}</span>
      ),
    },
    {
      header: 'Bateria',
      accessor: (row) => (
        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{row.telemetry.batteryLevel}%</span>
      ),
    },
    {
      header: 'Status',
      accessor: (row) => (
        <span className="px-2 py-0.5 text-[10px] font-bold font-mono rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase">
          {row.status}
        </span>
      ),
    },
    {
      header: 'Última Movimentação',
      accessor: 'lastMovement',
    },
  ];

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
        <StatCard title="Ativos Monitorados" value="120" icon={Box} variant="indigo" />
        <StatCard title="Em Operação" value="112" icon={CheckCircle2} variant="emerald" />
        <StatCard title="Tags Associadas" value="500+" icon={Tag} variant="cyan" />
        <StatCard title="Alertas de Movimentação" value="2" icon={AlertTriangle} variant="amber" />
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
