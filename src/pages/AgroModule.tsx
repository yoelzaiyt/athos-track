import React, { useState } from 'react';
import { Sprout, CheckCircle2, Navigation, Layers, Map as MapIcon } from 'lucide-react';
import { StatCard } from '../components/common/StatCard';
import { DataTable, Column } from '../components/common/DataTable';
import { LiveMap } from '../components/map/LiveMap';
import { useAssets } from '../context/AssetContext';
import { useAuth } from '../context/AuthContext';
import { AssetDevice } from '../types';
import { AssetIcon } from '../components/common/AssetIconRegistry';

export const AgroModule: React.FC = () => {
  const { selectedClientId, selectedUnitId } = useAuth();
  const { getFilteredAssets, setSelectedAsset } = useAssets();
  const [showMap, setShowMap] = useState(false);

  const agroAssets = getFilteredAssets(selectedClientId, selectedUnitId).filter(
    (a) => a.category === 'agro'
  );

  const columns: Column<AssetDevice>[] = [
    {
      header: 'Ativo Agrícola / Animal',
      accessor: (row) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 font-mono">
            <div className="p-1 rounded bg-lime-500/10 border border-lime-500/30 text-lime-600 dark:text-lime-400">
              <AssetIcon category="agro" subcategory={row.subcategory} className="w-4 h-4" />
            </div>
            <span>{row.name}</span>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Código: {row.code}</div>
        </div>
      ),
    },
    {
      header: 'Fazenda / Talhão',
      accessor: (row) => (
        <div>
          <div className="text-slate-700 dark:text-slate-200 font-medium">{row.unitName}</div>
          <div className="text-[10px] text-lime-600 dark:text-lime-400 font-mono">{row.geofenceName || 'Talhão Geral'}</div>
        </div>
      ),
    },
    {
      header: 'Operador / Responsável',
      accessor: (row) => (
        <span className="text-slate-600 dark:text-slate-300 text-xs">{row.driverName || row.responsibleName || 'Manejo de Campo'}</span>
      ),
    },
    {
      header: 'Horímetro / Horas',
      accessor: (row) => (
        <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">{row.telemetry.operatingHours || 920}h</span>
      ),
    },
    {
      header: 'Status Telemetria',
      accessor: (row) => (
        <span className="px-2 py-0.5 text-[10px] font-bold font-mono rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase">
          {row.status}
        </span>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100 transition-colors">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs font-mono text-lime-600 dark:text-lime-400 uppercase tracking-widest font-bold flex items-center gap-1">
            <Sprout className="w-4 h-4" /> Telemetria do Agronegócio
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Módulo Agro, Máquinas Agrícolas e Rastreamento Pecuário
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Monitoramento de percurso em talhões, horímetro de colheitadeiras e rastreamento de gado via tags BLE.
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
            assetsList={agroAssets}
            heightClass="h-[420px]"
            specializedTitle="Ativos Agrícolas"
            showClustering={false}
          />
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard title="Ativos Agrícolas" value="140" icon={Sprout} variant="emerald" />
        <StatCard title="Tratores e Colheitadeiras" value="28" icon={Navigation} variant="amber" />
        <StatCard title="Tags Auriculares Pecuária" value="112" icon={Layers} variant="cyan" />
        <StatCard title="Talhões Monitorados" value="12" icon={CheckCircle2} variant="emerald" />
      </div>

      <DataTable
        title="Equipamentos e Lotes Agrícolas"
        data={agroAssets}
        columns={columns}
        keyExtractor={(item) => item.id}
        onRowClick={(item) => setSelectedAsset(item)}
      />
    </div>
  );
};
