import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, CheckCircle2, Volume2, VolumeX, Filter, Search } from 'lucide-react';
import { StatCard } from '../components/common/StatCard';
import { useAssets } from '../context/AssetContext';
import { AlertSeverity } from '../types';

export const AlertsPage: React.FC = () => {
  const { alerts, acknowledgeAlert } = useAssets();
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'all'>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [query, setQuery] = useState('');

  const filtered = alerts.filter((a) => {
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      return (
        a.title.toLowerCase().includes(q) ||
        a.assetName.toLowerCase().includes(q) ||
        a.message.toLowerCase().includes(q) ||
        a.unitName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const criticalCount = alerts.filter((a) => a.severity === 'critical' && !a.acknowledged).length;
  const warningCount = alerts.filter((a) => a.severity === 'warning' && !a.acknowledged).length;
  const infoCount = alerts.filter((a) => a.severity === 'info' && !a.acknowledged).length;

  const severityStyles: Record<AlertSeverity, { card: string; icon: string; }> = {
    critical: {
      card: 'bg-white dark:bg-slate-900/70 border-rose-200 dark:border-rose-500/20',
      icon: 'bg-rose-500/10 text-rose-600 dark:text-rose-300 ring-1 ring-rose-500/25',
    },
    warning: {
      card: 'bg-white dark:bg-slate-900/70 border-amber-200 dark:border-amber-500/20',
      icon: 'bg-amber-500/10 text-amber-600 dark:text-amber-300 ring-1 ring-amber-500/25',
    },
    info: {
      card: 'bg-white dark:bg-slate-900/70 border-slate-200 dark:border-slate-800/80',
      icon: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 ring-1 ring-cyan-500/25',
    },
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100 transition-colors">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs font-mono text-rose-600 dark:text-rose-400 uppercase tracking-widest font-bold flex items-center gap-1">
            <ShieldAlert className="w-4 h-4" /> Central Crítica de Monitoramento
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Central de Alertas e Notificações de Segurança
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Auditoria em tempo real de violação de cercas, excesso de velocidade e descarga de bateria.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors border ${
              soundEnabled
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-600 dark:text-cyan-400'
                : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span>{soundEnabled ? 'Alarme Sonoro Ativo' : 'Alarme Mudo'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard title="Alertas Críticos Pendentes" value={criticalCount} icon={ShieldAlert} variant="rose" />
        <StatCard title="Alertas de Atenção" value={warningCount} icon={AlertTriangle} variant="amber" />
        <StatCard title="Notificações Informativas" value={infoCount} icon={CheckCircle2} variant="cyan" />
        <StatCard title="Total Registrado" value={alerts.length} icon={Filter} variant="slate" />
      </div>

      {/* Filter controls */}
      <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar alertas por ativo ou mensagem..."
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        <div className="flex items-center gap-2">
          {['all', 'critical', 'warning', 'info'].map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase font-mono transition-colors border ${
                severityFilter === sev
                  ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/40 font-bold'
                  : 'bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {sev === 'all' ? 'Todos' : sev}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts Feed List */}
      <div className="space-y-3">
        {filtered.map((alt) => {
          const style = severityStyles[alt.severity];
          return (
            <div
              key={alt.id}
              className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm hover:shadow-md ${style.card}`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${style.icon}`}>
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{alt.title}</h4>
                    <span className="text-xs font-mono text-cyan-600 dark:text-cyan-400 font-semibold">
                      • {alt.assetName}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{alt.message}</p>
                  <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-3">
                    <span>Unidade: {alt.unitName}</span>
                    <span>Hora: {alt.timestamp}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-end">
                {alt.acknowledged ? (
                  <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-semibold rounded-lg font-mono">
                    ✓ Reconhecido
                  </span>
                ) : (
                  <button
                    onClick={() => acknowledgeAlert(alt.id)}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-md transition-colors"
                  >
                    Marcar Visto
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
