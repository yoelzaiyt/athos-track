import React, { useMemo } from 'react';
import { Activity, Radar, Server, ArrowDownToLine, ArrowUpFromLine, Wifi, Rss } from 'lucide-react';
import { useAssets } from '../../context/AssetContext';
import { buildLatencyMetrics, formatLatencyMs } from '../../lib/latency';
import type { AssetDevice } from '../../types';

interface RowData {
  asset: AssetDevice;
  m: ReturnType<typeof buildLatencyMetrics>;
}

function medianMs(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export const LatencyDiagnosticsPage: React.FC = () => {
  const { assets } = useAssets();

  const rows = useMemo<RowData[]>(() => {
    return assets
      .filter((a) => a.provider !== undefined && a.provider !== null && a.provider !== '')
      .map((asset) => {
        const m = buildLatencyMetrics(asset);
        return { asset, m: m as NonNullable<ReturnType<typeof buildLatencyMetrics>> };
      })
      .sort((a, b) => (b.m.deviceToUiMs ?? -Infinity) - (a.m.deviceToUiMs ?? -Infinity));
  }, [assets]);

  const stats = useMemo(() => {
    const summary = {
      total: rows.length,
      vendor: 0,
      direct: 0,
      deviceToServerRx: [] as number[],
      serverRxToUi: [] as number[],
      deviceToUi: [] as number[],
      unknown: 0,
    };
    for (const r of rows) {
      if (r.asset.provider === 'GT06') {
        summary.direct += 1;
      } else {
        summary.vendor += 1;
      }
      if (r.m.deviceToServerRxMs != null) summary.deviceToServerRx.push(r.m.deviceToServerRxMs);
      if (r.m.serverRxToUiMs != null) summary.serverRxToUi.push(r.m.serverRxToUiMs);
      if (r.m.deviceToUiMs != null) summary.deviceToUi.push(r.m.deviceToUiMs);
      if (r.m.deviceTs == null && r.m.serverRxTs == null && r.m.uiTs == null) summary.unknown += 1;
    }
    return summary;
  }, [rows]);

  return (
    <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100 transition-colors">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs font-mono text-cyan-600 dark:text-cyan-400 uppercase tracking-widest font-bold flex items-center gap-1">
            <Radar className="w-4 h-4" /> Diagnóstico de Latência — DEV
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Cadeia Tag → Servidor → Banco → UI
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Medição honesta baseada em telemetry_server_received_at (migration 20260911010000). Nenhum timestamp fabricado.
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1">
            <Activity className="w-3 h-3" /> Ativos com provider
          </div>
          <div className="text-2xl font-bold mt-1">{stats.total}</div>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1">
            <Rss className="w-3 h-3" /> Via fornecedor (BRGPS)
          </div>
          <div className="text-2xl font-bold mt-1">{stats.vendor}</div>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1">
            <Server className="w-3 h-3" /> Direto (GT06/TCP)
          </div>
          <div className="text-2xl font-bold mt-1">{stats.direct}</div>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1">
            <Wifi className="w-3 h-3" /> Sem timestamp usável
          </div>
          <div className="text-2xl font-bold mt-1">{stats.unknown}</div>
        </div>
      </div>

      {/* Median pipeline values */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1">
            <ArrowDownToLine className="w-3 h-3" /> Mediana device → servidor (T3-T1)
          </div>
          <div className="text-2xl font-bold mt-1">{formatLatencyMs(medianMs(stats.deviceToServerRx))}</div>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1">
            <ArrowUpFromLine className="w-3 h-3" /> Mediana servidor → UI
          </div>
          <div className="text-2xl font-bold mt-1">{formatLatencyMs(medianMs(stats.serverRxToUi))}</div>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1">
            <Activity className="w-3 h-3" /> Mediana device → UI total
          </div>
          <div className="text-2xl font-bold mt-1">{formatLatencyMs(medianMs(stats.deviceToUi))}</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-500 dark:text-slate-400">
          Ativos por cadeia & data dos timestamps
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="px-4 py-2">Ativo</th>
                <th className="px-4 py-2">Cadeia</th>
                <th className="px-4 py-2">Packet (T1)</th>
                <th className="px-4 py-2">Vendor (T2)</th>
                <th className="px-4 py-2">Server RX (T3)</th>
                <th className="px-4 py-2">UI (T4)</th>
                <th className="px-4 py-2">T3−T1</th>
                <th className="px-4 py-2">T4−T3</th>
                <th className="px-4 py-2">T4−T1</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400 dark:text-slate-600">
                    Nenhum ativo com provider configurado ainda — cadastre/vincule um dispositivo em Dispositivos/BGPS.
                  </td>
                </tr>
              )}
              {rows.map(({ asset, m }) => (
                <tr key={asset.id} className="border-b border-slate-100 dark:border-slate-800/60">
                  <td className="px-4 py-2 font-semibold text-slate-800 dark:text-slate-200">{asset.name}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`font-mono font-bold text-[10px] px-2 py-1 rounded-lg border ${
                        asset.provider === 'GT06'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'
                      }`}
                    >
                      {asset.provider === 'GT06' ? 'DIRETO · GT06/TCP' : `VENDOR · ${asset.provider}`}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-slate-500 dark:text-slate-400">
                    {m.deviceTs != null ? new Date(m.deviceTs).toISOString().slice(11, 19) : '—'}
                  </td>
                  <td className="px-4 py-2 font-mono text-slate-500 dark:text-slate-400">
                    {m.vendorTs != null ? new Date(m.vendorTs).toISOString().slice(11, 19) : '—'}
                  </td>
                  <td className="px-4 py-2 font-mono text-slate-500 dark:text-slate-400">
                    {m.serverRxTs != null ? new Date(m.serverRxTs).toISOString().slice(11, 19) : '—'}
                  </td>
                  <td className="px-4 py-2 font-mono text-slate-500 dark:text-slate-400">
                    {m.uiTs != null ? new Date(m.uiTs).toISOString().slice(11, 19) : '—'}
                  </td>
                  <td className="px-4 py-2 font-mono">{formatLatencyMs(m.deviceToServerRxMs)}</td>
                  <td className="px-4 py-2 font-mono">{formatLatencyMs(m.serverRxToUiMs)}</td>
                  <td className="px-4 py-2 font-mono font-semibold text-slate-800 dark:text-slate-200">{formatLatencyMs(m.deviceToUiMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="p-4 bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-2xl text-xs text-amber-800 dark:text-amber-300">
        <strong>Caminho direto (GT06/TCP):</strong> nenhum ativo aparece como <code>DIRETO</code> enquanto não houver
        dispositivo SIM-based falando GT06 direto no listener (porta 5023) e vinculado a um asset com IMEI. Hoje os tags
        "Air Tag" em posse são BLE (sem modem celular) — nesse hardware, o transporte é a nuvem do fornecedor (BRGPS),
        então <code>T3</code> é o instante do sync tick, impreciso em até <code>BRGPS_SYNC_INTERVAL_SECONDS</code>. A
        comparação real VENDOR vs DIRECT só é conclusiva com um GT06 físico (modelo TJ02/GX03 ou similar) em teste.
      </div>
    </div>
  );
};