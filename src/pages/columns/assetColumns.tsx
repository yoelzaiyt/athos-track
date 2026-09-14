// Definição das colunas da tabela de Ativos.
//
// Módulo próprio pelo mesmo motivo de columns/cartColumns.tsx: o teste do CSV
// importa as colunas REAIS sem arrastar o mapa/Leaflet (que exige `window`),
// e a regra de exportação fica ao lado da regra de exibição.

import React from 'react';
import { User } from 'lucide-react';
import { Column } from '../../components/common/DataTable';
import { AssetDevice } from '../../types';
import { AssetIcon } from '../../components/common/AssetIconRegistry';
export const assetColumns: Column<AssetDevice>[] = [
  {
    header: 'Ativo / Equipamento',
    // Tela: nome em cima, "Patrimônio: <código>" embaixo. CSV: um campo só.
    exportAccessor: (row) => `${row.name} (${row.code})`,
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
    exportAccessor: (row) => (row.category === 'asset' ? 'Equipamento Especial' : 'Tag de Ativo'),
    accessor: (row) => (
      <span className="px-2 py-0.5 text-[10px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 rounded font-medium uppercase">
        {row.category === 'asset' ? 'Equipamento Especial' : 'Tag de Ativo'}
      </span>
    ),
  },
  {
    header: 'Responsável',
    // Na tela, sem responsável vira travessão; no CSV vira célula vazia — um
    // "—" numa planilha é dado falso, atrapalha filtro e contagem.
    exportAccessor: (row) => row.responsibleName || '',
    accessor: (row) => (
      <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
        <User className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
        <span>{row.responsibleName || '—'}</span>
      </div>
    ),
  },
  {
    header: 'Localização / Unidade',
    exportAccessor: (row) => (row.geofenceName ? `${row.unitName} / ${row.geofenceName}` : row.unitName),
    accessor: (row) => (
      <div>
        <div className="text-slate-700 dark:text-slate-200 font-medium">{row.unitName}</div>
        <div className="text-[10px] text-slate-500 dark:text-slate-400">{row.geofenceName || '—'}</div>
      </div>
    ),
  },
  {
    header: 'Tag / Protocolo',
    exportAccessor: (row) => row.protocol,
    accessor: (row) => (
      <span className="font-mono text-cyan-600 dark:text-cyan-400 text-[11px]">{row.protocol}</span>
    ),
  },
  {
    header: 'Bateria',
    // Número puro: numa planilha, "85" soma e ordena; "85%" é texto.
    exportAccessor: (row) => row.telemetry.batteryLevel,
    accessor: (row) => (
      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{row.telemetry.batteryLevel}%</span>
    ),
  },
  {
    header: 'Status',
    exportAccessor: (row) => row.status,
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
