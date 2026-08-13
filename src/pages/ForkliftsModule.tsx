import React, { useState } from 'react';
import { Forklift, User, Clock, Wrench, Shield, CheckCircle2, AlertTriangle, Radio, Map as MapIcon } from 'lucide-react';
import { StatCard } from '../components/common/StatCard';
import { DataTable, Column } from '../components/common/DataTable';
import { LiveMap } from '../components/map/LiveMap';
import { useAssets } from '../context/AssetContext';
import { useAuth } from '../context/AuthContext';
import { AssetDevice } from '../types';
import { AssetIcon } from '../components/common/AssetIconRegistry';

export const ForkliftsModule: React.FC = () => {
  const { selectedClientId, selectedUnitId } = useAuth();
  const { getFilteredAssets, setSelectedAsset } = useAssets();
  const [showMap, setShowMap] = useState(false);

  const forklifts = getFilteredAssets(selectedClientId, selectedUnitId).filter(
    (a) => a.category === 'forklift'
  );

  const columns: Column<AssetDevice>[] = [
    {
      header: 'Empilhadeira',
      accessor: (row) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 font-mono">
            <div className="p-1 rounded bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 dark:text-yellow-400">
              <AssetIcon category="forklift" subcategory={row.subcategory} className="w-4 h-4" />
            </div>
            <span>{row.code}</span>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{row.name}</div>
        </div>
      ),
    },
    {
      header: 'Operador Logado',
      accessor: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200">
          <User className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
          <span>{row.responsibleName || 'Operador de Galpão'}</span>
        </div>
      ),
    },
    {
      header: 'Horas Trabalhadas (Horímetro)',
      accessor: (row) => (
        <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">
          {row.telemetry.operatingHours || 1840}h
        </span>
      ),
    },
    {
      header: 'Unidade / Galpão',
      accessor: 'unitName',
    },
    {
      header: 'Bateria Bateria / Carga',
      accessor: (row) => (
        <span
          className={`font-mono font-bold ${
            row.telemetry.batteryLevel < 35 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
          }`}
        >
          {row.telemetry.batteryLevel}%
        </span>
      ),
    },
    {
      header: 'Status Operacional',
      accessor: (row) => (
        <span
          className={`px-2 py-0.5 text-[10px] font-bold font-mono rounded uppercase ${
            row.status === 'maintenance'
              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
          }`}
        >
          {row.status === 'maintenance' ? 'EM MANUTENÇÃO' : 'EM OPERAÇÃO'}
        </span>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100 transition-colors">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs font-mono text-yellow-600 dark:text-yellow-400 uppercase tracking-widest font-bold flex items-center gap-1">
            <Forklift className="w-4 h-4" /> Telemetria Intralogística
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Módulo de Empilhadeiras e Maquinário Interno
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Monitoramento de horímetro, impactos de colisão, login de operador e telemetria de bateria.
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
            assetsList={forklifts}
            heightClass="h-[420px]"
            specializedTitle="Empilhadeiras"
            showClustering={false}
          />
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard title="Empilhadeiras" value="18" icon={Forklift} variant="indigo" />
        <StatCard title="Em Operação" value="14" icon={CheckCircle2} variant="emerald" />
        <StatCard title="Paradas" value="2" icon={Clock} variant="slate" />
        <StatCard title="Em Manutenção" value="1" icon={Wrench} variant="rose" />
        <StatCard title="Impactos Detectados" value="0 Hoje" icon={Shield} variant="cyan" />
      </div>

      <DataTable
        title="Frota de Empilhadeiras Industriais"
        data={forklifts}
        columns={columns}
        keyExtractor={(item) => item.id}
        onRowClick={(item) => setSelectedAsset(item)}
      />
    </div>
  );
};
