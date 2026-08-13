import React, { useState } from 'react';
import { Play, Pause, Calendar, Clock, MapPin, Navigation, Filter } from 'lucide-react';
import { useAssets } from '../context/AssetContext';
import { AssetMap } from '../components/map/AssetMap';
import { RoutePoint } from '../types';

export const HistoryPage: React.FC = () => {
  const { assets } = useAssets();
  const [selectedAssetId, setSelectedAssetId] = useState(assets[0]?.id || '');
  const [startDate, setStartDate] = useState('2026-08-10');
  const [endDate, setEndDate] = useState('2026-08-10');

  const targetAsset = assets.find((a) => a.id === selectedAssetId) || assets[0];

  // Base lat/lng from target asset
  const baseLat = targetAsset?.telemetry.latitude || -23.641414;
  const baseLng = targetAsset?.telemetry.longitude || -46.644827;

  // Mock route points array for replay
  const mockRoutePoints: RoutePoint[] = [
    { latitude: baseLat - 0.02, longitude: baseLng - 0.02, speed: 0, timestamp: '08:00:00', event: 'Ignição' },
    { latitude: baseLat - 0.015, longitude: baseLng - 0.018, speed: 35, timestamp: '08:05:00' },
    { latitude: baseLat - 0.01, longitude: baseLng - 0.012, speed: 64, timestamp: '08:12:00' },
    { latitude: baseLat - 0.005, longitude: baseLng - 0.008, speed: 72, timestamp: '08:20:00' },
    { latitude: baseLat, longitude: baseLng, speed: 45, timestamp: '08:30:00' },
    { latitude: baseLat + 0.005, longitude: baseLng + 0.005, speed: 0, timestamp: '09:00:00', event: 'Parada Doca' },
    { latitude: baseLat + 0.01, longitude: baseLng + 0.01, speed: 58, timestamp: '09:45:00' },
    { latitude: baseLat + 0.015, longitude: baseLng + 0.012, speed: 82, timestamp: '10:15:00' },
    { latitude: baseLat + 0.02, longitude: baseLng + 0.015, speed: 0, timestamp: '11:00:00', event: 'Chegada Final' },
  ];

  const mockStoppages = [
    {
      latitude: baseLat + 0.005,
      longitude: baseLng + 0.005,
      durationMin: 45,
      startTime: '09:00:00',
      endTime: '09:45:00',
      locationName: 'Centro de Distribuição Cajamar Doca 04',
    },
  ];

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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-end shadow-sm">
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

      {/* Main Grid: Universal AssetMap with Replay Overlay */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm min-h-[500px] relative">
          <AssetMap
            heightClass="h-[500px]"
            selectedAssetOverride={targetAsset}
            routeHistory={mockRoutePoints}
            stoppagesList={mockStoppages}
          />
        </div>

        {/* Timeline Checkpoints Side List */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 pb-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span>Pontos de Registro no Trajeto</span>
            <span className="text-xs font-mono text-cyan-600 dark:text-cyan-400 font-bold">{mockRoutePoints.length} Registros</span>
          </h3>

          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {mockRoutePoints.map((pt, idx) => (
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
