import React, { useMemo, useState } from 'react';
import {
  Radio,
  Wifi,
  WifiOff,
  Navigation,
  PauseCircle,
  BatteryLow,
  AlertTriangle,
  ChevronRight,
  Activity,
  Layers,
  TimerReset,
} from 'lucide-react';
import { StatCard } from '../components/common/StatCard';
import { LiveMap } from '../components/map/LiveMap';
import { useAssets } from '../context/AssetContext';
import { useAuth } from '../context/AuthContext';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { STATUS_META, type DerivedStatusKey } from '../lib/deviceStatus';
import { formatLatencyMs } from '../lib/latency';
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

const STATUS_ORDER: DerivedStatusKey[] = ['moving', 'stopped', 'online', 'stale', 'offline', 'alert'];

function hourLabel(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:00`;
}

function relativeLabel(tsMs: number | null): string {
  if (!tsMs) return '—';
  const s = Math.max(0, Math.round((Date.now() - tsMs) / 1000));
  if (s < 5) return 'agora';
  if (s < 60) return `${s}s atrás`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min}min atrás`;
  return `${Math.round(min / 60)}h atrás`;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { selectedClientId, selectedUnitId, theme } = useAuth();
  const { lastUiRefreshLatencyMs } = useAssets();
  const [hoveredStatusIndex, setHoveredStatusIndex] = useState<number | null>(null);

  const {
    statusBundle,
    statusCounts,
    statusLoading,
    statusError,
    lastStatusUpdateAt,
    eventsBuckets,
    eventsLoading,
    eventsError,
    lastEventsUpdateAt,
    realtimeStatus,
  } = useDashboardStats({ clientId: selectedClientId, unitId: selectedUnitId });

  const gridStroke = theme === 'light' ? '#e2e8f0' : '#1e293b';
  const tooltipStyle = {
    backgroundColor: theme === 'light' ? 'rgba(255,255,255,0.98)' : 'rgba(15, 23, 42, 0.95)',
    borderColor: theme === 'light' ? '#e2e8f0' : '#334155',
    borderRadius: '10px',
    fontSize: '12px',
    color: theme === 'light' ? '#0f172a' : '#fff',
  };

  // ---- Status derivado (FASE 4/5/6): contagens 100% baseadas em
  //      timestamps reais + velocidade/deslocamento + alertas não reconhecidos.
  const totalScoped = useMemo(() => {
    if (!statusCounts) return null;
    return STATUS_ORDER.reduce((s, k) => s + statusCounts[k], 0);
  }, [statusCounts]);

  const statusChartData = useMemo(
    () => STATUS_ORDER.map((k) => ({ name: STATUS_META[k].label, value: statusCounts?.[k] ?? 0, color: STATUS_META[k].color, key: k })),
    [statusCounts]
  );

  const lowBatteryCount = useMemo(() => {
    if (!statusBundle) return null;
    return statusBundle.assets.filter(
      (a) =>
        a.status === 'low_battery' ||
        a.batteryCategory === 'CRITICAL' ||
        a.batteryCategory === 'LOW' ||
        (a.batteryLevel ?? 100) < 20
    ).length;
  }, [statusBundle]);

  const criticalAlertAssets = useMemo(() => {
    if (!statusBundle) return null;
    return statusBundle.assets.filter((a) => (a.unackedCritical ?? 0) > 0).length;
  }, [statusBundle]);

  const onlineNow = totalScoped == null ? null : (statusCounts!.online + statusCounts!.moving + statusCounts!.stopped);
  const eventsEmpty = eventsBuckets.length > 0 && eventsBuckets.every((b) => b.telemetry === 0 && b.alerts === 0);

  const realtimeMeta = {
    CONNECTED: { label: 'Conectado', cls: 'bg-emerald-500', ping: true, text: 'text-emerald-600 dark:text-emerald-400' },
    RECONNECTING: { label: 'Reconectando', cls: 'bg-amber-500', ping: true, text: 'text-amber-600 dark:text-amber-400' },
    OFFLINE: { label: 'Offline', cls: 'bg-rose-500', ping: false, text: 'text-rose-600 dark:text-rose-400' },
  } as const;
  const rt = realtimeMeta[realtimeStatus];

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
              {/* FASE 13: badge de realtime com estado REAL da conexão (não é
                  mais um decore fixo "Ao Vivo" — reflete Socket.IO/Supabase
                  realtime). */}
              <span className={`px-2 py-0.5 text-[10px] font-mono border rounded-lg font-semibold uppercase flex items-center gap-1.5 ${rt.text} ${
                realtimeStatus === 'CONNECTED'
                  ? 'bg-emerald-500/10 border-emerald-500/20'
                  : realtimeStatus === 'RECONNECTING'
                    ? 'bg-amber-500/10 border-amber-500/20'
                    : 'bg-rose-500/10 border-rose-500/20'
              }`}>
                {rt.ping && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${rt.cls} opacity-75`} />
                    <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${rt.cls}`} />
                  </span>
                )}
                Realtime: {rt.label}
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Visão consolidada do parque de ativos, saúde de telemetria e cercas virtuais. Dados reais — mostra &quot;sem dados&quot; quando não há.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
              <TimerReset className="w-3.5 h-3.5" />
              <span>UI refresh: <strong>{formatLatencyMs(lastUiRefreshLatencyMs)}</strong></span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span>Status: {relativeLabel(lastStatusUpdateAt)}</span>
            </div>
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

      {/* 8 Primary Metric KPI Cards — todas com fonte real (status derivado + telemetria) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <StatCard title="Total Ativos" value={totalScoped ?? '…'} icon={Radio} variant="cyan" onClick={() => onNavigate('dispositivos')} />
        <StatCard title="Comunicando" value={onlineNow ?? '…'} icon={Wifi} variant="emerald" onClick={() => onNavigate('dispositivos')} />
        <StatCard title="Em Movimento" value={statusCounts?.moving ?? '…'} icon={Navigation} variant="cyan" onClick={() => onNavigate('mapa')} />
        <StatCard title="Parados" value={statusCounts?.stopped ?? '…'} icon={PauseCircle} variant="indigo" onClick={() => onNavigate('mapa')} />
        <StatCard title="Posição Antiga" value={statusCounts?.stale ?? '…'} icon={TimerReset} variant="amber" onClick={() => onNavigate('dispositivos')} />
        <StatCard title="Offline" value={statusCounts?.offline ?? '…'} icon={WifiOff} variant="slate" onClick={() => onNavigate('dispositivos')} />
        <StatCard title="Bateria Baixa" value={lowBatteryCount ?? '…'} icon={BatteryLow} variant="amber" onClick={() => onNavigate('carrinhos')} />
        <StatCard title="Alerta Crítico" value={criticalAlertAssets ?? '…'} icon={AlertTriangle} variant="rose" onClick={() => onNavigate('alertas')} />
      </div>

      {/* Mapa Consolidado */}
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
        {/* Events/Telcometry Bar Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>Volume de Eventos por Hora</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Telemetria real (leituras dos dispositivos) e alertas nas últimas 6 horas — polling da API não é contado
              </p>
            </div>
          </div>
          {eventsLoading ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-400">Carregando dados reais…</div>
          ) : eventsError ? (
            <div className="h-64 flex items-center justify-center text-xs text-rose-500">Falha ao buscar: {eventsError}</div>
          ) : eventsEmpty ? (
            <div className="h-64 flex flex-col items-center justify-center gap-1 text-center px-6">
              <Activity className="w-8 h-8 text-slate-300 dark:text-slate-600" />
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Sem dados nas últimas 6 horas</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Nenhuma telemetria ou alerta real registrado no período (fonte: asset_route_points + system_alerts).
              </p>
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={eventsBuckets.map((b) => ({ hora: hourLabel(b.hour), Telemetria: b.telemetry, Alertas: b.alerts }))} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="hora" stroke="#94a3b8" fontSize={11} />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    allowDecimals={false}
                    label={{ value: 'Telemetria / Alertas', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#94a3b8' }}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="Telemetria" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Telemetria" />
                  <Bar dataKey="Alertas" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Alertas" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-2 text-[11px] font-mono text-slate-400 dark:text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
            <span>Refresca a cada 60s • último: {relativeLabel(lastEventsUpdateAt)}</span>
            {statusError && <span className="text-rose-500">status basis: {statusError}</span>}
          </div>
        </div>

        {/* Donut Chart: Distributed Device Status (derivado) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200 mb-1">
              Distribuição de Status de Ativos
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Derivado de timestamps reais + deslocamento + alertas (janelas configuráveis)
            </p>
          </div>

          <div className="relative h-56 my-2">
            {statusLoading ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">Carregando status real…</div>
            ) : totalScoped === null ? (
              <div className="h-full flex flex-col items-center justify-center gap-1 text-center px-6">
                <span className="text-xs font-semibold text-rose-500">Sem dados suficientes</span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  Status não carregado ainda. Se nenhum ativo real responder, nada é exibido como se estivesse online.
                </span>
              </div>
            ) : totalScoped === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-1 text-center px-6">
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Nenhum ativo neste escopo</span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  Fonte real: /stats/status-basis (timestamps, velocidade/deslocamento, alertas não reconhecidos).
                </span>
              </div>
            ) : (
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
                      `${value} (${totalScoped > 0 ? Math.round((value / totalScoped) * 100) : 0}%)`,
                      name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}

            {/* Center readout */}
            {totalScoped !== null && !statusLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums">
                  {hoveredStatusIndex !== null ? statusChartData[hoveredStatusIndex].value : totalScoped}
                </span>
                <span className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 tracking-wide text-center px-4">
                  {hoveredStatusIndex !== null ? statusChartData[hoveredStatusIndex].name : 'Ativos Totais'}
                </span>
              </div>
            )}
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
            <span className="col-span-2 text-[11px] font-mono text-slate-400 dark:text-slate-500 pt-1">
              Base: {relativeLabel(lastStatusUpdateAt)} • {statusError ? <span className="text-rose-500">{statusError}</span> : 'dados reais'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};