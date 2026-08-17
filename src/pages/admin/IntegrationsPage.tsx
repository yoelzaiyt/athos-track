import React, { useState } from 'react';
import { Globe, Radio, Server, Wifi, Key, CheckCircle2, Shield, Code2, Plus, X } from 'lucide-react';
import { useAssets } from '../../context/AssetContext';
import { SystemIntegration } from '../../types';

const INTEGRATION_TYPES: SystemIntegration['type'][] = ['GT06', 'REST API', 'WebSocket', 'MQTT', 'Webhooks', 'BLE Gateway'];

const NewIntegrationModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { addIntegration } = useAssets();
  const [name, setName] = useState('');
  const [type, setType] = useState<SystemIntegration['type']>('REST API');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await addIntegration({
        name: name.trim(),
        type,
        status: 'testing',
        lastPing: new Date().toISOString(),
        activeDevicesCount: 0,
        endpointUrl: endpointUrl.trim() || undefined,
        apiKey: apiKey.trim() || undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Nova Integração / API</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Nome</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Ex: Gateway BLE Frota Sul"
            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500/40"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Protocolo / Tipo</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as SystemIntegration['type'])}
            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500/40"
          >
            {INTEGRATION_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Endpoint / URL do Broker</label>
          <input
            value={endpointUrl}
            onChange={(e) => setEndpointUrl(e.target.value)}
            placeholder="Ex: mqtt://broker.athostrack.io:1883"
            className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500/40"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Chave de API (opcional)</label>
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Cole a chave de API fornecida pelo provedor"
            className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500/40"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            {saving ? 'Salvando...' : 'Salvar Integração'}
          </button>
        </div>
      </form>
    </div>
  );
};

export const IntegrationsPage: React.FC = () => {
  const { integrations } = useAssets();
  const [showNewIntegration, setShowNewIntegration] = useState(false);
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
        <button
          onClick={() => setShowNewIntegration(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          Inserir API / Integração
        </button>
      </div>

      {showNewIntegration && <NewIntegrationModal onClose={() => setShowNewIntegration(false)} />}

      {/* Grid of Integration Protocol Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map((int) => (
          <div
            key={int.id}
            className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-3 hover:border-cyan-500/30 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 rounded-lg">
                {int.type}
              </span>
              <span
                className={`flex items-center gap-1.5 text-xs font-mono font-semibold ${
                  int.status === 'active'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : int.status === 'testing'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    int.status === 'active' ? 'bg-emerald-400 animate-pulse' : int.status === 'testing' ? 'bg-amber-400' : 'bg-slate-400'
                  }`}
                />
                <span>{int.status === 'active' ? 'ATIVA' : int.status === 'testing' ? 'EM TESTE' : 'INATIVA'}</span>
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
