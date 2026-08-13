import React from 'react';
import { MapPin, Plus, Building2 } from 'lucide-react';
import { DataTable, Column } from '../../components/common/DataTable';
import { MOCK_UNITS } from '../../mock';
import { CompanyUnit } from '../../types';

export const UnitsPage: React.FC = () => {
  const columns: Column<CompanyUnit>[] = [
    {
      header: 'Nome da Unidade',
      accessor: (row) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{row.name}</span>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">{row.address}</div>
        </div>
      ),
    },
    {
      header: 'Cidade / UF',
      accessor: (row) => (
        <span className="font-mono text-slate-600 dark:text-slate-300">
          {row.city} / {row.state}
        </span>
      ),
    },
    {
      header: 'Ativos em Telemetria',
      accessor: (row) => <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">{row.assetsCount}</span>,
    },
    {
      header: 'Status',
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
          <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400 uppercase tracking-widest font-bold flex items-center gap-1">
            <MapPin className="w-4 h-4" /> Gestão de Instalações
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Unidades, Filiais e Centros de Distribuição
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Mapeamento hierárquico de lojas, garagens e centros logísticos.
          </p>
        </div>

        <button
          onClick={() => alert('Nova unidade cadastrada com sucesso.')}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Nova Unidade</span>
        </button>
      </div>

      <DataTable
        title="Unidades de Operação Registradas"
        data={MOCK_UNITS}
        columns={columns}
        keyExtractor={(item) => item.id}
      />
    </div>
  );
};
