import React, { useState, useEffect } from 'react';
import { Play, Pause, Calendar, Clock, MapPin, Navigation, Filter } from 'lucide-react';
import { useAssets } from '../context/AssetContext';
import { AssetMap } from '../components/map/AssetMap';
import { RoutePoint } from '../types';
import { supabase } from '../lib/supabaseClient';
import { rowToRoutePoint } from '../lib/mappers';

type RangePreset = 'today' | '24h' | '7d' | '30d' | 'custom';

const PRESET_OPTIONS: { value: RangePreset; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: '24h', label: 'Últimas 24h' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'custom', label: 'Personalizado' },
];

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

// Resolve o preset em timestamps ISO reais (não só data) para a query — "24h"
// e "hoje" só se distinguem de verdade se a query trabalhar com hora exata,
// não com o intervalo de dia inteiro usado pelo modo "Personalizado".
function resolvePresetRange(preset: RangePreset, startDate: string, endDate: string): { fromIso: string; toIso: string } {
  const now = new Date();
  if (preset === '24h') return { fromIso: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(), toIso: now.toISOString() };
  if (preset === '7d') return { fromIso: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), toIso: now.toISOString() };
  if (preset === '30d') return { fromIso: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(), toIso: now.toISOString() };
  if (preset === 'today') {
    const today = todayDateString();
    return { fromIso: `${today}T00:00:00`, toIso: `${today}T23:59:59` };
  }
  return { fromIso: `${startDate}T00:00:00`, toIso: `${endDate}T23:59:59` };
}

export const HistoryPage: React.FC = () => {
  const { assets } = useAssets();
  const [selectedAssetId, setSelectedAssetId] = useState(assets[0]?.id || '');
  const [preset, setPreset] = useState<RangePreset>('today');
  const [startDate, setStartDate] = useState(todayDateString());
  const [endDate, setEndDate] = useState(todayDateString());
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);

  const targetAsset = assets.find((a) => a.id === selectedAssetId) || assets[0];
  const { fromIso, toIso } = resolvePresetRange(preset, startDate, endDate);

  // Breadcrumb real de asset_route_points, filtrado pelo intervalo selecionado
  // (preset ou datas customizadas — ver resolvePresetRange acima).
  useEffect(() => {
    if (!targetAsset) {
      setRoutePoints([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('asset_route_points')
        .select('*')
        .eq('asset_id', targetAsset.id)
        .gte('recorded_at', fromIso)
        .lte('recorded_at', toIso)
        .order('recorded_at', { ascending: true });
      if (cancelled) return;
      if (error) console.error('[HistoryPage] Failed to load route points:', error.message);
      setRoutePoints((data ?? []).map(rowToRoutePoint));
    })();
    return () => {
      cancelled = true;
    };
  }, [targetAsset?.id, fromIso, toIso]);

  // Paradas derivadas dos pontos com velocidade 0 marcados com evento (não há
  // tabela dedicada de paradas — cada trecho parado vira um marcador no mapa).
  const stoppages = routePoints
    .filter((p) => p.speed === 0 && p.event)
    .map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
      durationMin: 0,
      startTime: p.timestamp,
      endTime: p.timestamp,
      locationName: p.event as string,
    }));

  return (
    <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100 transition-colors">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs font-mono text-cyan-600 dark:text-cyan-400 uppercase tracking-widest font-bold flex items-center gap-1">
            <Clock className="w-4 h-4" /> Telemetria Histórica & Replay Universal
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Histórico de Percurso e Reprodução de Trajeto
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Análise retroativa de paradas, velocidade, eventos e cerca virtual com o novo motor de mapas ATHOS TRACK.
          </p>
        </div>
      </div>

      {/* Selector and Date Controls Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Selecione o Dispositivo</label>
            <select
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500/50"
            >
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Período</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_OPTIONS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPreset(p.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                    preset === p.value
                      ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/40'
                      : 'bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {preset === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Data Inicial</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Data Final</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Grid: Universal AssetMap with Replay Overlay */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm min-h-[500px] relative">
          <AssetMap
            heightClass="h-[500px]"
            selectedAssetOverride={targetAsset}
            routeHistory={routePoints}
            stoppagesList={stoppages}
          />
        </div>

        {/* Timeline Checkpoints Side List */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 pb-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span>Pontos de Registro no Trajeto</span>
            <span className="text-xs font-mono text-cyan-600 dark:text-cyan-400 font-bold">{routePoints.length} Registros</span>
          </h3>

          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {routePoints.length === 0 && (
              <div className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">
                Nenhum registro de trajeto para o período selecionado.
              </div>
            )}
            {routePoints.map((pt, idx) => (
              <div
                key={idx}
                className="p-3 bg-slate-50 dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800/80 text-xs space-y-1 hover:border-cyan-500/30 transition-colors"
              >
                <div className="flex items-center justify-between text-cyan-600 dark:text-cyan-400 font-mono font-bold">
                  <span>{pt.timestamp}</span>
                  <span className="text-slate-500 dark:text-slate-400">{pt.speed} km/h</span>
                </div>
                <div className="font-semibold text-slate-700 dark:text-slate-200">{pt.event || 'Ponto de Posição GPS'}</div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  Lat: {pt.latitude.toFixed(4)}, Long: {pt.longitude.toFixed(4)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
