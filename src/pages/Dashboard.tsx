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
  const { getStats, alerts } = useAssets();
  const [hoveredStatusIndex, setHoveredStatusIndex] = useState<number | null>(null);

  const stats = getStats(selectedClientId, selectedUnitId);
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

  // Chart Data: Hourly Events Timeline — achado do FINAL-PRE-PRODUCTION-GATE.md
  // (mock ativo em produção): antes era um array fixo hardcoded (mesmos 6
  // números sempre, pra qualquer tenant, qualquer dia), rotulado como
  // "registrados hoje" sem ter relação nenhuma com dado real. Agora deriva
  // de `alerts` (já vem escopado por tenant do AssetContext — mesmo padrão
  // usado em AlertsPage.tsx), nas últimas 6 horas de verdade. Sem fonte de
  // "pings de telemetria" carregada neste componente (exigiria buscar
  // asset_route_points, que só HistoryPage.tsx carrega hoje) — a série foi
  // removida em vez de inventar um número; ver comentário do gráfico abaixo.
  const now = new Date();
  const eventsTimelineData = Array.from({ length: 6 }, (_, i) => {
    const hourStart = new Date(now);
    hourStart.setMinutes(0, 0, 0);
    hourStart.setHours(now.getHours() - (5 - i));
    const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
    const inBucket = alerts.filter((a) => {
      const t = new Date(a.timestamp).getTime();
      return t >= hourStart.getTime() && t < hourEnd.getTime();
    });
    return {
      hora: `${String(hourStart.getHours()).padStart(2, '0')}:00`,
      cercas: inBucket.filter((a) => a.type === 'geofence_entry' || a.type === 'geofence_exit').length,
      alertas: inBucket.filter((a) => a.type !== 'geofence_entry' && a.type !== 'geofence_exit').length,
    };
  });

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

      {/* Mapa Consolidado — largura total, ampliado para melhor visibilidade do operador.
          "Alertas Recentes" foi incorporado à Central de Alertas e Notificações de
          Segurança (AlertsPage), que já tem os mesmos dados com filtro, busca e
          reconhecimento — sem necessidade de um preview duplicado aqui. */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col">
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
        <div className="flex-1 min-h-[600px]">
          <LiveMap heightClass="h-[600px]" />
        </div>
      </div>

      {/* Bottom Grid: Events Chart & Device Status Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Events Bar Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>Volume de Eventos por Hora</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cercas cruzadas e alertas registrados nas últimas 6 horas
              </p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={eventsTimelineData} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="hora" stroke="#94a3b8" fontSize={11} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  allowDecimals={false}
                  label={{ value: 'Cercas / Alertas', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#94a3b8' }}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="cercas" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Cercas Cruzadas" />
                <Bar dataKey="alertas" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Alertas" />
              </ComposedChart>
            </ResponsiveContainer>
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
    </div>
  );
};
