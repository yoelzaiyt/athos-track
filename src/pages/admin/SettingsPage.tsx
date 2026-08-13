import React from 'react';
import { Settings, Sliders, Sun, Moon, Bell, ShieldCheck, Radio } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const SettingsPage: React.FC = () => {
  const { theme, toggleTheme } = useAuth();

  return (
    <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100 transition-colors">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs font-mono text-cyan-600 dark:text-cyan-400 uppercase tracking-widest font-bold flex items-center gap-1">
            <Settings className="w-4 h-4" /> Configurações Gerais
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Parâmetros da Plataforma ATHOS TRACK
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Personalização de interface visual, limites de timeout de telemetria e notificações.
          </p>
        </div>
      </div>

      <div className="max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
        {/* Theme Settings */}
        <div className="pb-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {theme === 'dark' ? <Moon className="w-4 h-4 text-cyan-600 dark:text-cyan-400" /> : <Sun className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
              <span>Tema Visual da Interface</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Escolha entre o tema escuro de monitoramento ou tema claro profissional. Afeta as páginas e módulos (não os tiles do mapa, que seguem o horário de Brasília automaticamente).
            </p>
          </div>
          <button
            onClick={toggleTheme}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors"
          >
            {theme === 'dark' ? 'Alternar para Light' : 'Alternar para Dark'}
          </button>
        </div>

        {/* Telemetry Ping Interval */}
        <div className="pb-4 border-b border-slate-200 dark:border-slate-800 space-y-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Intervalo Padrão de Ping Telemetria</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Frequência de atualização enviada pelos transmissores de campo.
          </p>
          <select className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none">
            <option>A cada 5 Segundos (Alta Precisão)</option>
            <option>A cada 30 Segundos (Equilibrado)</option>
            <option>A cada 5 Minutos (Economia de Bateria)</option>
          </select>
        </div>

        {/* System Sound Alarms */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Notificações Sonoras de Emergência</h3>
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 dark:text-slate-300">
            <input type="checkbox" defaultChecked className="rounded border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-cyan-600" />
            <span>Emitir alerta sonoro ao identificar evasão de cerca virtual</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 dark:text-slate-300">
            <input type="checkbox" defaultChecked className="rounded border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-cyan-600" />
            <span>Notificar falhas de bateria de tags BLE (&lt; 15%)</span>
          </label>
        </div>
      </div>
    </div>
  );
};
