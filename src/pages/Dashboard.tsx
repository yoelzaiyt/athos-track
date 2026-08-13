import React, { useState } from 'react';
import {
  Radio,
  Wifi,
  WifiOff,
  Navigation,
  PauseCircle,
  ShieldAlert,
  BatteryLow,
  AlertTriangle,
  ArrowUpRight,
  ChevronRight,
  Activity,
  Layers,
} from 'lucide-react';
import { StatCard } from '../components/common/StatCard';
import { LiveMap } from '../components/map/LiveMap';
import { useAssets } from '../context/AssetContext';
import { useAuth } from '../context/AuthContext';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';

interface DashboardProps {
  onNavigate: (module: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { selectedClientId, selectedUnitId, theme } = useAuth();
  const { getStats, getFilteredAssets, alerts, setSelectedAsset } = useAssets();
  const [hoveredStatusIndex, setHoveredStatusIndex] = useState<number | null>(null);

  const stats = getStats(selectedClientId, selectedUnitId);
  const scopedAssets = getFilteredAssets(selectedClientId, selectedUnitId);
  const gridStroke = theme === 'light' ? '#e2e8f0' : '#1e293b';
  const tooltipStyle = {
    backgroundColor: theme === 'light' ? 'rgba(255,255,255,0.98)' : 'rgba(15, 23, 42, 0.95)',
    borderColor: theme === 'light' ? '#e2e8f0' : '#334155',
    borderRadius: '10px',
    fontSize: '12px',
    color: theme === 'light' ? '#0f172a' : '#fff',
  };

  // Chart Data: Online vs Offline
  const statusChartData = [
    { name: 'Online / Movimento', value: stats.online, color: '#10b981' },
    { name: 'Parados', value: stats.stopped, color: '#3b82f6' },
    { name: 'Offline', value: stats.offline, color: '#64748b' },
    { name: 'Fora de Cerca', value: stats.outOfGeofence, color: '#f43f5e' },
  ];

  // Chart Data: Hourly Events Timeline
  const eventsTimelineData = [
    { hora: '08:00', cercas: 12, alertas: 2, pings: 480 },
    { hora: '09:00', cercas: 24, alertas: 5, pings: 720 },
    { hora: '10:00', cercas: 45, alertas: 8, pings: 910 },
    { hora: '11:00', cercas: 38, alertas: 3, pings: 840 },
    { hora: '12:00', cercas: 19, alertas: 1, pings: 650 },
    { hora: '13:00', cercas: 52, alertas: 6, pings: 980 },
  ];

  const lowBatteryAssets = scopedAssets.filter(
    (a) => a.telemetry.batteryLevel < 25 || a.status === 'low_battery'
  );

  return (
    <div className="p-6 space-y-6 bg-gradient-to-b from-slate-50 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 min-h-screen text-slate-900 dark:text-slate-100 transition-colors">
      {/* Executive Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white via-slate-50 to-cyan-50/60 dark:from-slate-900 dark:via-slate-900 dark:to-cyan-950/20 p-5 shadow-sm">
        <div className="absolute -right-16 -top-20 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-16 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <span>Dashboard Executivo de Telemetria</span>
              <span className="px-2 py-0.5 text-[10px] font-mono bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 rounded font-semibold uppercase flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-500" />
                </span>
                Ao Vivo
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Visão consolidada do parque de ativos, saúde de telemetria e cercas virtuais.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('mapa')}
              className="px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-cyan-600/20 hover:shadow-xl hover:shadow-cyan-600/30 hover:-translate-y-0.5 flex items-center gap-2 transition-all"
            >
              <Navigation className="w-4 h-4" />
              <span>Abrir Mapa em Tela Cheia</span>
            </button>
          </div>
        </div>
      </div>

      {/* 8 Primary Metric KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <StatCard
          title="Total Ativos"
          value={stats.total}
          icon={Radio}
          variant="cyan"
          onClick={() => onNavigate('dispositivos')}
        />
        <StatCard
          title="Online"
          value={stats.online}
          icon={Wifi}
          variant="emerald"
          onClick={() => onNavigate('dispositivos')}
        />
        <StatCard
          title="Offline"
          value={stats.offline}
          icon={WifiOff}
          variant="slate"
          onClick={() => onNavigate('dispositivos')}
        />
        <StatCard
          title="Em Movimento"
          value={stats.moving}
          icon={Navigation}
          variant="cyan"
          onClick={() => onNavigate('mapa')}
        />
        <StatCard
          title="Parados"
          value={stats.stopped}
          icon={PauseCircle}
          variant="indigo"
          onClick={() => onNavigate('mapa')}
        />
        <StatCard
          title="Fora da Cerca"
          value={stats.outOfGeofence}
          icon={ShieldAlert}
          variant="rose"
          onClick={() => onNavigate('mapa')}
        />
        <StatCard
          title="Bateria Baixa"
          value={stats.lowBattery}
          icon={BatteryLow}
          variant="amber"
          onClick={() => onNavigate('carrinhos')}
        />
        <StatCard
          title="Alertas Críticos"
          value={stats.criticalAlertsCount}
          icon={AlertTriangle}
          variant="rose"
          onClick={() => onNavigate('alertas')}
        />
      </div>

      {/* Main Grid: Live Map & Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Resumed Map (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span>Mapa Consolidado de Dispositivos</span>
            </h3>
            <button
              onClick={() => onNavigate('mapa')}
              className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 font-medium"
            >
              <span>Ver Detalhes</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 min-h-[380px]">
            <LiveMap heightClass="h-[380px]" />
          </div>
        </div>

        {/* Donut Chart: Device Status */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200 mb-1">
              Distribuição de Status de Ativos
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Proporção operacional em tempo real</p>
          </div>

          <div className="relative h-56 my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={82}
                  paddingAngle={4}
                  dataKey="value"
                  onMouseEnter={(_, index) => setHoveredStatusIndex(index)}
                  onMouseLeave={() => setHoveredStatusIndex(null)}
                  onClick={() => onNavigate('mapa')}
                >
                  {statusChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      opacity={hoveredStatusIndex === null || hoveredStatusIndex === index ? 1 : 0.35}
                      style={{ cursor: 'pointer', transition: 'opacity 0.2s ease' }}
                      stroke="none"
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number, name: string) => [
                    `${value} (${stats.total > 0 ? Math.round((value / stats.total) * 100) : 0}%)`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Center readout: total ativos, ou detalhe do status em hover */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums">
                {hoveredStatusIndex !== null ? statusChartData[hoveredStatusIndex].value : stats.total}
              </span>
              <span className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 tracking-wide text-center px-4">
                {hoveredStatusIndex !== null ? statusChartData[hoveredStatusIndex].name : 'Ativos Totais'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1 text-xs pt-2 border-t border-slate-200 dark:border-slate-800">
            {statusChartData.map((st, idx) => (
              <button
                key={st.name}
                onClick={() => onNavigate('mapa')}
                onMouseEnter={() => setHoveredStatusIndex(idx)}
                onMouseLeave={() => setHoveredStatusIndex(null)}
                className="flex items-center gap-2 text-left rounded-lg px-1.5 py-1 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: st.color }} />
                <span className="text-slate-500 dark:text-slate-400 truncate">{st.name}:</span>
                <strong className="text-slate-900 dark:text-slate-200 font-mono">{st.value}</strong>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Grid: Events Chart, Recent Alarms, Low Battery Assets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Events Bar Chart */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>Volume de Eventos por Hora</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cercas cruzadas, alertas e pings de telemetria registrados hoje
              </p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={eventsTimelineData} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="hora" stroke="#94a3b8" fontSize={11} />
                <YAxis
                  yAxisId="left"
                  stroke="#94a3b8"
                  fontSize={11}
                  label={{ value: 'Cercas / Alertas', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#94a3b8' }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#a855f7"
                  fontSize={11}
                  label={{ value: 'Pings', angle: 90, position: 'insideRight', fontSize: 10, fill: '#a855f7' }}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar yAxisId="left" dataKey="cercas" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Cercas Cruzadas" />
                <Bar yAxisId="left" dataKey="alertas" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Alertas" />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="pings"
                  stroke="#a855f7"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#a855f7' }}
                  activeDot={{ r: 5 }}
                  name="Pings de Telemetria"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Alarms List */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <span>Alertas Recentes</span>
              </h3>
              <button
                onClick={() => onNavigate('alertas')}
                className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline font-medium"
              >
                Ver Todos
              </button>
            </div>

            <div className="space-y-2.5">
              {alerts.slice(0, 3).map((alt) => (
                <div
                  key={alt.id}
                  onClick={() => onNavigate('alertas')}
                  className="p-3 bg-slate-50 dark:bg-slate-950/80 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-800/80 text-xs flex items-start justify-between gap-2 cursor-pointer transition-colors"
                >
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-200">{alt.title}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{alt.assetName}</div>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded ${
                      alt.severity === 'critical'
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {alt.severity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Low Battery Devices Warning List */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                <BatteryLow className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                <span>Bateria Baixa (&lt; 25%)</span>
              </h3>
              <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
                {lowBatteryAssets.length} Dispositivos
              </span>
            </div>

            <div className="space-y-2">
              {lowBatteryAssets.length === 0 ? (
                <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-xs">
                  Nenhum dispositivo com bateria baixa.
                </div>
              ) : (
                lowBatteryAssets.map((asset) => (
                  <div
                    key={asset.id}
                    onClick={() => {
                      setSelectedAsset(asset);
                      onNavigate('mapa');
                    }}
                    className="p-2.5 bg-slate-50 dark:bg-slate-950/80 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="font-medium text-slate-900 dark:text-slate-200">{asset.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{asset.code} • {asset.unitName}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold font-mono text-rose-600 dark:text-rose-400">
                        {asset.telemetry.batteryLevel}%
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
