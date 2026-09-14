// Definição das colunas da tabela de Carrinhos.
//
// Fica num módulo próprio (e não dentro de CartsModule.tsx) por dois motivos:
// o teste do CSV importa as colunas REAIS sem arrastar junto o mapa/Leaflet,
// que precisa de `window` e não roda em ambiente Node; e a regra de "o que
// esta coluna vale no CSV" (exportAccessor) fica ao lado da regra de "o que
// esta coluna mostra na tela", sem risco de uma mudar sem a outra.

import React from 'react';
import { MapPin, Satellite } from 'lucide-react';
import { Column } from '../../components/common/DataTable';
import { AssetDevice } from '../../types';
import { AssetIcon } from '../../components/common/AssetIconRegistry';
import { formatRelativeTimePtBr } from '../../lib/format';
const BATTERY_LABEL: Record<string, string> = {
  UNKNOWN: 'Desconhecida',
  CRITICAL: 'Crítica',
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
};

/** Rótulo do status de perímetro — mesma frase na tela e no CSV. */
export function cartPerimeterLabel(status: AssetDevice['status']): string {
  if (status === 'out_of_geofence') return 'Fora da Loja';
  if (status === 'low_battery') return 'Bateria Baixa';
  return 'Dentro do Perímetro';
}

/** Bateria pro CSV. Provider real (BRGPS) só informa faixa -1..3, nunca
 *  porcentagem — manter a mesma regra do visual (seção 34 do brief) em vez de
 *  inventar um "%" que o fornecedor não manda. */
export function cartBatteryExportValue(row: AssetDevice): string {
  if (row.provider && row.telemetry.batteryLevelCategory) {
    return BATTERY_LABEL[row.telemetry.batteryLevelCategory] ?? row.telemetry.batteryLevelCategory;
  }
  return row.telemetry.batteryLevel === null || row.telemetry.batteryLevel === undefined
    ? ''
    : `${row.telemetry.batteryLevel}%`;
}

/** Localização pro CSV: coordenada real quando existe; senão o mesmo texto
 *  honesto da tela — nunca uma coordenada inventada. */
export function cartLocationExportValue(row: AssetDevice): string {
  if (row.telemetry.latitude && row.telemetry.longitude) {
    return `${row.telemetry.latitude.toFixed(5)}, ${row.telemetry.longitude.toFixed(5)}`;
  }
  if (row.provider) return 'Aguardando primeira localização real';
  return row.geofenceName || '';
}

// Colunas em escopo de módulo (dependem só de `row`) pra poderem ser
// exercitadas pelo teste do CSV com as definições REAIS — ver
// src/lib/csvExport.test.ts.
export const cartColumns: Column<AssetDevice>[] = [
  {
    header: 'ID / Patrimônio',
    // Na tela são duas linhas (código em cima, nome embaixo); no CSV vira um
    // campo só, explícito.
    exportAccessor: (row) => `${row.code} — ${row.name}`,
    accessor: (row) => (
      <div>
        <div className="font-bold text-slate-100 flex items-center gap-2 font-mono">
          <div className="p-1 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <AssetIcon category="cart" subcategory={row.subcategory} className="w-4 h-4" />
          </div>
          <span>{row.code}</span>
        </div>
        <div className="text-[10px] text-slate-400 mt-0.5">{row.name}</div>
      </div>
    ),
  },
  {
    header: 'Unidade',
    accessor: 'unitName',
  },
  {
    header: 'Tag BLE / IMEI',
    exportAccessor: (row) => row.imei,
    accessor: (row) => (
      <span className="font-mono text-cyan-400 text-[11px]">{row.imei}</span>
    ),
  },
  {
    header: 'Status Perímetro',
    exportAccessor: (row) => cartPerimeterLabel(row.status),
    accessor: (row) => (
      <span
        className={`px-2 py-0.5 text-[10px] font-bold font-mono rounded-full uppercase ${
          row.status === 'out_of_geofence'
            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
            : row.status === 'low_battery'
            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
        }`}
      >
        {cartPerimeterLabel(row.status)}
      </span>
    ),
  },
  {
    header: 'Bateria',
    exportAccessor: (row) => cartBatteryExportValue(row),
    accessor: (row) => {
      // Provider real (BRGPS) só informa faixa -1..3, não porcentagem —
      // nunca inventar "%" pra esses; mostrar a categoria (seção 34 do brief).
      if (row.provider && row.telemetry.batteryLevelCategory) {
        const cat = row.telemetry.batteryLevelCategory;
        const color =
          cat === 'CRITICAL' ? 'text-rose-400' : cat === 'LOW' ? 'text-amber-400' : cat === 'UNKNOWN' ? 'text-slate-400' : 'text-emerald-400';
        return <span className={`font-mono font-bold ${color}`}>{BATTERY_LABEL[cat]}</span>;
      }
      return (
        <span className={`font-mono font-bold ${row.telemetry.batteryLevel < 20 ? 'text-rose-400' : 'text-emerald-400'}`}>
          {row.telemetry.batteryLevel}%
        </span>
      );
    },
  },
  {
    // geofenceName é o nome da cerca virtual (quando o asset tem uma
    // configurada), não a localização em si — pra um provider real
    // (BRGPS/BRGPS_2), mostrar a coordenada real recebida. Sem posição
    // real ainda, nunca inventar coordenada (seção "MAPA" do brief) — só
    // "Aguardando primeira localização real".
    header: 'Última Localização',
    exportAccessor: (row) => cartLocationExportValue(row),
    accessor: (row) => (
      <div className="text-[11px] text-slate-300 flex items-center gap-1">
        <MapPin className="w-3 h-3 text-cyan-400" />
        <span>
          {row.telemetry.latitude && row.telemetry.longitude
            ? `${row.telemetry.latitude.toFixed(5)}, ${row.telemetry.longitude.toFixed(5)}`
            : row.provider
              ? 'Aguardando primeira localização real'
              : row.geofenceName || '—'}
        </span>
      </div>
    ),
  },
  {
    // provider truthy = veio de um fornecedor real (BRGPS ou BRGPS_2, a
    // segunda conta ativada em 2026-09-10 — ver docs/HARDWARE-CATALOG.md).
    // Comparar com a string literal 'BRGPS' excluía BRGPS_2 e mostrava
    // "Simulado" pra tags com posição real de verdade (achado ao vivo
    // nesta sessão, com as 10 tags Zaffari).
    header: 'Origem',
    // No CSV o identificador cru do provider serve melhor pra cruzar dados do
    // que o rótulo visual com ícone.
    exportAccessor: (row) => (row.provider ? `API ${row.provider}` : 'Simulado'),
    accessor: (row) =>
      row.provider ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 border border-cyan-500/20 rounded">
          <Satellite className="w-3 h-3" /> API {row.provider.replace('_2', ' (conta 2)')}
        </span>
      ) : (
        <span className="text-[10px] text-slate-400 dark:text-slate-600 font-mono">Simulado</span>
      ),
  },
  {
    header: 'Última Comunicação',
    // A tela mostra tempo relativo ("há 5 min") pro provider real; o CSV leva o
    // carimbo bruto, que é o que dá pra ordenar e cruzar numa planilha.
    exportAccessor: (row) => row.telemetry.lastCommunication,
    accessor: (row) => (
      <span className="font-mono text-slate-400">
        {row.provider ? formatRelativeTimePtBr(row.telemetry.lastCommunication) : row.telemetry.lastCommunication}
      </span>
    ),
  },
];
