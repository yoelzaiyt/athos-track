import React, { useState } from 'react';
import { Archive, CheckCircle2, ShieldAlert, Wrench, Map as MapIcon } from 'lucide-react';
import { StatCard } from '../components/common/StatCard';
import { DataTable, Column } from '../components/common/DataTable';
import { LiveMap } from '../components/map/LiveMap';
import { useAssets } from '../context/AssetContext';
import { useAuth } from '../context/AuthContext';
import { AssetDevice } from '../types';
import { AssetIcon } from '../components/common/AssetIconRegistry';

export const BoxesModule: React.FC = () => {
  const { selectedClientId, selectedUnitId } = useAuth();
  const { getFilteredAssets, setSelectedAsset } = useAssets();
  const [showMap, setShowMap] = useState(false);

  const boxes = getFilteredAssets(selectedClientId, selectedUnitId).filter(
    (a) => a.category === 'box'
  );

  const insideUnit = boxes.filter((a) => a.status !== 'out_of_geofence').length;
  const outsideUnit = boxes.filter((a) => a.status === 'out_of_geofence').length;
  const maintenance = boxes.filter((a) => a.status === 'maintenance').length;

  const columns: Column<AssetDevice>[] = [
    {
      header: 'Caixa',
      accessor: (row) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 font-mono">
            <div className="p-1 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400">
              <AssetIcon category="box" subcategory={row.subcategory} className="w-4 h-4" />
            </div>
            <span>{row.code}</span>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{row.name}</div>
        </div>
      ),
    },
    {
      header: 'Unidade',
      accessor: 'unitName',
    },
    {
      header: 'Status Perímetro',
      accessor: (row) => (
        <span
          className={`px-2 py-0.5 text-[10px] font-bold font-mono rounded uppercase ${
            row.status === 'out_of_geofence'
              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
          }`}
        >
          {row.status === 'out_of_geofence' ? 'Fora da Unidade' : 'Dentro do Perímetro'}
        </span>
      ),
    },
    {
      header: 'Última Localização',
      accessor: (row) => (
        <span className="text-[11px] text-slate-600 dark:text-slate-300">{row.geofenceName || '—'}</span>
      ),
    },
    {
      header: 'Última Comunicação',
      accessor: (row) => (
        <span className="font-mono text-slate-500 dark:text-slate-400">{row.telemetry.lastCommunication}</span>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100 transition-colors">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs font-mono text-cyan-600 dark:text-cyan-400 uppercase tracking-widest font-bold flex items-center gap-1">
            <Archive className="w-4 h-4" /> Módulo Prioritário Operacional
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Gestão & Telemetria de Caixas
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Rastreamento de caixas como categoria de ativo — perímetro, status e última localização.
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
            assetsList={boxes}
            heightClass="h-[420px]"
            specializedTitle="Caixas"
            showClustering={boxes.length > 25}
          />
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard title="Total Caixas" value={String(boxes.length)} icon={Archive} variant="cyan" />
        <StatCard title="Dentro da Unidade" value={String(insideUnit)} icon={CheckCircle2} variant="emerald" />
        <StatCard title="Fora da Unidade" value={String(outsideUnit)} icon={ShieldAlert} variant="rose" />
        <StatCard title="Em Manutenção" value={String(maintenance)} icon={Wrench} variant="slate" />
      </div>

      <DataTable
        title="Listagem Geral de Caixas"
        data={boxes}
        columns={columns}
        keyExtractor={(item) => item.id}
        searchPlaceholder="Buscar por código ou unidade..."
        onRowClick={(item) => setSelectedAsset(item)}
      />
    </div>
  );
};
