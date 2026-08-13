import React from 'react';
import { Globe, Radio, Server, Wifi, Key, CheckCircle2, Shield, Code2 } from 'lucide-react';
import { MOCK_INTEGRATIONS } from '../../mock';

export const IntegrationsPage: React.FC = () => {
  return (
    <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100 transition-colors">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs font-mono text-cyan-600 dark:text-cyan-400 uppercase tracking-widest font-bold flex items-center gap-1">
            <Globe className="w-4 h-4" /> Central de Integrações & APIs
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Gateways, Brokering MQTT e Protocolos
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Endpoints de ingestão para rastreadores GT06, gateways BLE e webhooks em nuvem.
          </p>
        </div>
      </div>

      {/* Grid of Integration Protocol Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {MOCK_INTEGRATIONS.map((int) => (
          <div
            key={int.id}
            className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-3 hover:border-cyan-500/30 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 rounded-lg">
                {int.type}
              </span>
              <span className="flex items-center gap-1.5 text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>ONLINE</span>
              </span>
            </div>

            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{int.name}</h3>

            {int.endpointUrl && (
              <div className="p-2 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-cyan-700 dark:text-cyan-300 break-all">
                {int.endpointUrl}
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800/80">
              <span>Dispositivos Conectados:</span>
              <strong className="text-slate-700 dark:text-slate-200 font-mono">{int.activeDevicesCount}</strong>
            </div>
          </div>
        ))}
      </div>

      {/* API Key Developer Documentation Section */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Key className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Chaves de API REST & Ingestão de Telemetria</span>
          </h3>
          <button
            onClick={() => alert('Nova chave API gerada.')}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors"
          >
            Gerar Nova Chave API
          </button>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between">
          <span>athos_live_key_99812739182391xxxxxxxx</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">Ativa</span>
        </div>
      </div>
    </div>
  );
};
