import React, { useEffect, useState } from 'react';
import { Globe, Radio, Server, Wifi, Key, CheckCircle2, Shield, Code2, Plus, X, Copy, Ban } from 'lucide-react';
import { useAssets } from '../../context/AssetContext';
import { SystemIntegration } from '../../types';
import { apiFetch } from '../../lib/supabaseClient';

interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

const INTEGRATION_TYPES: SystemIntegration['type'][] = ['GT06', 'REST API', 'WebSocket', 'MQTT', 'Webhooks', 'BLE Gateway'];

const INTEGRATION_STATUSES: SystemIntegration['status'][] = ['active', 'testing', 'inactive'];
const STATUS_LABEL: Record<SystemIntegration['status'], string> = { active: 'Ativa', testing: 'Em Teste', inactive: 'Inativa' };

const IntegrationFormModal: React.FC<{ onClose: () => void; editing?: SystemIntegration | null }> = ({ onClose, editing }) => {
  const { addIntegration, updateIntegration } = useAssets();
  const [name, setName] = useState(editing?.name ?? '');
  const [type, setType] = useState<SystemIntegration['type']>(editing?.type ?? 'REST API');
  const [status, setStatus] = useState<SystemIntegration['status']>(editing?.status ?? 'testing');
  const [endpointUrl, setEndpointUrl] = useState(editing?.endpointUrl ?? '');
  const [apiKey, setApiKey] = useState(editing?.apiKey ?? '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await updateIntegration(editing.id, {
          name: name.trim(),
          type,
          status,
          endpointUrl: endpointUrl.trim() || undefined,
          apiKey: apiKey.trim() || undefined,
        });
      } else {
        await addIntegration({
          name: name.trim(),
          type,
          status: 'testing',
          lastPing: new Date().toISOString(),
          activeDevicesCount: 0,
          endpointUrl: endpointUrl.trim() || undefined,
          apiKey: apiKey.trim() || undefined,
        });
      }
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
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{editing ? 'Editar Integração / API' : 'Nova Integração / API'}</h3>
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

        {editing && (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as SystemIntegration['status'])}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500/40"
            >
              {INTEGRATION_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
        )}

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
            {saving ? 'Salvando...' : editing ? 'Salvar Alterações' : 'Salvar Integração'}
          </button>
        </div>
      </form>
    </div>
  );
};

const NewApiKeyModal: React.FC<{ onClose: () => void; onCreated: (key: string) => void }> = ({ onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const { data, error } = await apiFetch<{ apiKey: string }>('/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      });
      if (error || !data) {
        setError(error?.message ?? 'Falha ao gerar a chave.');
        return;
      }
      onCreated(data.apiKey);
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
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Nova Chave de API</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Nome / Descrição</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Ex: Integração ERP Cliente X"
            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/40"
          />
        </div>

        {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

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
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            {saving ? 'Gerando...' : 'Gerar Chave'}
          </button>
        </div>
      </form>
    </div>
  );
};

const RevealApiKeyModal: React.FC<{ apiKey: string; onClose: () => void }> = ({ apiKey, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Chave Gerada</h3>
        <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
          Copie agora — por segurança, essa chave não pode ser exibida de novo depois de fechar esta janela.
        </p>
        <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-700 dark:text-slate-200 break-all">
          {apiKey}
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
};

const ApiKeysSection: React.FC = () => {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewKey, setShowNewKey] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const loadKeys = async () => {
    setLoading(true);
    const { data } = await apiFetch<ApiKeyRow[]>('/api-keys');
    setKeys(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadKeys();
  }, []);

  const handleRevoke = async (id: string) => {
    if (!window.confirm('Revogar esta chave de API? Qualquer integração usando-a para de funcionar imediatamente.')) return;
    await apiFetch(`/api-keys/${id}`, { method: 'DELETE' });
    loadKeys();
  };

  return (
    <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-3">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Key className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>Chaves de API REST & Ingestão de Telemetria</span>
        </h3>
        <button
          onClick={() => setShowNewKey(true)}
          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors"
        >
          Gerar Nova Chave API
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">Carregando...</p>
      ) : keys.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">Nenhuma chave de API gerada ainda.</p>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div
              key={k.id}
              className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{k.name}</div>
                <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate">{k.key_prefix}…</div>
              </div>
              {k.revoked_at ? (
                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 shrink-0">REVOGADA</span>
              ) : (
                <button
                  onClick={() => handleRevoke(k.id)}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors shrink-0"
                  title="Revogar chave"
                >
                  <Ban className="w-3 h-3" /> Revogar
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showNewKey && (
        <NewApiKeyModal
          onClose={() => setShowNewKey(false)}
          onCreated={(key) => {
            setShowNewKey(false);
            setRevealedKey(key);
            loadKeys();
          }}
        />
      )}
      {revealedKey && <RevealApiKeyModal apiKey={revealedKey} onClose={() => setRevealedKey(null)} />}
    </div>
  );
};

export const IntegrationsPage: React.FC = () => {
  const { integrations, deleteIntegration } = useAssets();
  const [showNewIntegration, setShowNewIntegration] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<SystemIntegration | null>(null);

  const handleDelete = (integration: SystemIntegration) => {
    if (window.confirm(`Remover a integração "${integration.name}"? Esta ação não pode ser desfeita.`)) {
      deleteIntegration(integration.id);
    }
  };

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

      {showNewIntegration && <IntegrationFormModal onClose={() => setShowNewIntegration(false)} />}
      {editingIntegration && (
        <IntegrationFormModal editing={editingIntegration} onClose={() => setEditingIntegration(null)} />
      )}

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

            <div className="flex items-center justify-end gap-1.5 pt-1">
              <button
                onClick={() => setEditingIntegration(int)}
                className="px-2 py-1 text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors"
              >
                Editar
              </button>
              <button
                onClick={() => handleDelete(int)}
                className="px-2 py-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>

      <ApiKeysSection />
    </div>
  );
};
