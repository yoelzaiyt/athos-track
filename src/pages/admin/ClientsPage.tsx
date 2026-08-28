import React, { useState } from 'react';
import { Building2, Plus, Pencil, Power, PowerOff, X, Palette, Cable, Image } from 'lucide-react';
import { DataTable, Column } from '../../components/common/DataTable';
import { useAuth } from '../../context/AuthContext';
import { CompanyClient } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import { clientToInsertRow, clientUpdatesToRow } from '../../lib/mappers';

// Único provider real registrado hoje (server/integrations/shared/ProviderRegistry.ts)
// — "Heile" e "Jason" são aliases do mesmo backend BRGPS, não integrações
// separadas (ver docs/PROVIDER-ARCHITECTURE.md). O select já vem pronto pra
// crescer quando um provider de verdade diferente existir.
const PROVIDER_OPTIONS: { value: string; label: string }[] = [
  { value: 'brgps', label: 'BRGPS (aliases: Heile / Jason)' },
];

const MODULE_OPTIONS: { value: string; label: string }[] = [
  { value: 'carts', label: 'Carrinhos' },
  { value: 'boxes', label: 'Caixas' },
  { value: 'assets', label: 'Ativos' },
];

type TenantFormState = {
  name: string;
  code: string;
  slug: string;
  cnpj: string;
  status: 'active' | 'inactive';
  defaultProviderId: string;
  brandColor: string;
  logoUrl: string;
  enabledModules: string[];
};

function emptyForm(): TenantFormState {
  return {
    name: '',
    code: '',
    slug: '',
    cnpj: '',
    status: 'active',
    defaultProviderId: 'brgps',
    brandColor: '#06b6d4',
    logoUrl: '',
    enabledModules: ['assets'],
  };
}

function formFromClient(c: CompanyClient): TenantFormState {
  return {
    name: c.name,
    code: c.code,
    slug: c.slug ?? '',
    cnpj: c.cnpj,
    status: c.status,
    defaultProviderId: c.defaultProviderId ?? 'brgps',
    brandColor: c.brandColor ?? '#06b6d4',
    logoUrl: c.logoUrl ?? '',
    enabledModules: c.enabledModules ?? ['assets'],
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface TenantFormModalProps {
  editing: CompanyClient | null;
  onClose: () => void;
  onSaved: () => void;
}

const TenantFormModal: React.FC<TenantFormModalProps> = ({ editing, onClose, onSaved }) => {
  const [form, setForm] = useState<TenantFormState>(editing ? formFromClient(editing) : emptyForm());
  const [slugTouched, setSlugTouched] = useState(Boolean(editing?.slug));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleModule = (mod: string) => {
    setForm((f) => ({
      ...f,
      enabledModules: f.enabledModules.includes(mod)
        ? f.enabledModules.filter((m) => m !== mod)
        : [...f.enabledModules, mod],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.code.trim()) {
      setError('Nome e código são obrigatórios.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const { error: updateError } = await supabase
          .from('company_clients')
          .update(clientUpdatesToRow(form))
          .eq('id', editing.id);
        if (updateError) throw new Error(updateError.message);
      } else {
        const { error: insertError } = await supabase
          .from('company_clients')
          .insert(clientToInsertRow({ ...form, cnpj: form.cnpj || '00.000.000/0001-00' }));
        if (insertError) throw new Error(insertError.message);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar tenant.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>{editing ? `Editar Tenant — ${editing.name}` : 'Novo Tenant'}</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5 text-xs">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Nome *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) }));
                }}
                placeholder="Ex: Grupo Zaffari"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Código *</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="Ex: ZAFFARI"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500/50 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Identificador (slug)
              </label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setForm({ ...form, slug: slugify(e.target.value) });
                }}
                placeholder="Ex: afrin"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500/50 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">CNPJ</label>
              <input
                type="text"
                value={form.cnpj}
                onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                placeholder="00.000.000/0001-00"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500/50 font-mono"
              />
            </div>
          </div>

          <div>
            <div className="text-[10px] font-mono uppercase font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5 mb-2">
              <Cable className="w-3.5 h-3.5 text-cyan-500" /> Módulos habilitados
            </div>
            <div className="flex flex-wrap gap-2">
              {MODULE_OPTIONS.map((m) => (
                <label
                  key={m.value}
                  className={`px-3 py-1.5 rounded-xl border cursor-pointer text-[11px] font-semibold transition-colors ${
                    form.enabledModules.includes(m.value)
                      ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-700 dark:text-cyan-300'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.enabledModules.includes(m.value)}
                    onChange={() => toggleModule(m.value)}
                    className="hidden"
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Provider de rastreamento
              </label>
              <select
                value={form.defaultProviderId}
                onChange={(e) => setForm({ ...form, defaultProviderId: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500/50"
              >
                {PROVIDER_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                <Palette className="w-3.5 h-3.5" /> Cor da marca
              </label>
              <input
                type="color"
                value={form.brandColor}
                onChange={(e) => setForm({ ...form, brandColor: e.target.value })}
                className="w-full h-[38px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Image className="w-3.5 h-3.5" /> URL do logo
            </label>
            <input
              type="url"
              value={form.logoUrl}
              onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
              placeholder="https://..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500/50 font-mono"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.status === 'active'}
                onChange={(e) => setForm({ ...form, status: e.target.checked ? 'active' : 'inactive' })}
                className="rounded border-slate-300 dark:border-slate-700"
              />
              <span className="font-semibold text-slate-600 dark:text-slate-400">Tenant ativo</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-bold rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-lg transition-colors"
            >
              {saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Criar tenant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const ClientsPage: React.FC = () => {
  const { user, availableClients, refreshClients } = useAuth();
  const isAdmin = user?.role === 'ATHOS_ADMIN';
  const [modalState, setModalState] = useState<{ open: boolean; editing: CompanyClient | null }>({
    open: false,
    editing: null,
  });
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const toggleStatus = async (client: CompanyClient) => {
    setTogglingId(client.id);
    try {
      const nextStatus = client.status === 'active' ? 'inactive' : 'active';
      const { error } = await supabase.from('company_clients').update({ status: nextStatus }).eq('id', client.id);
      if (!error) await refreshClients();
    } finally {
      setTogglingId(null);
    }
  };

  const columns: Column<CompanyClient>[] = [
    {
      header: 'Cliente / Tenant',
      accessor: (row) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 font-mono">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: row.brandColor || '#06b6d4' }}
            />
            <Building2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>{row.name}</span>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
            {row.code} · {row.slug ?? '—'}
          </div>
        </div>
      ),
    },
    {
      header: 'Módulos',
      accessor: (row) => (
        <div className="flex flex-wrap gap-1">
          {(row.enabledModules ?? []).map((m) => (
            <span
              key={m}
              className="px-1.5 py-0.5 text-[9px] font-bold font-mono rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 uppercase"
            >
              {MODULE_OPTIONS.find((o) => o.value === m)?.label ?? m}
            </span>
          ))}
        </div>
      ),
    },
    {
      header: 'Provider',
      accessor: (row) => (
        <span className="font-mono text-slate-600 dark:text-slate-300 uppercase text-[10px]">
          {row.defaultProviderId ?? 'brgps'}
        </span>
      ),
    },
    {
      header: 'Unidades',
      accessor: (row) => <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">{row.unitsCount}</span>,
    },
    {
      header: 'Ativos',
      accessor: (row) => <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{row.assetsCount}</span>,
    },
    {
      header: 'Status',
      accessor: (row) => (
        <span
          className={`px-2 py-0.5 text-[10px] font-bold font-mono rounded uppercase border ${
            row.status === 'active'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              : 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20'
          }`}
        >
          {row.status === 'active' ? 'Ativo' : 'Inativo'}
        </span>
      ),
    },
    ...(isAdmin
      ? [
          {
            header: 'Ações',
            accessor: (row: CompanyClient) => (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setModalState({ open: true, editing: row })}
                  title="Editar"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => toggleStatus(row)}
                  disabled={togglingId === row.id}
                  title={row.status === 'active' ? 'Desativar' : 'Ativar'}
                  className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                    row.status === 'active'
                      ? 'text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      : 'text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {row.status === 'active' ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                </button>
              </div>
            ),
          } satisfies Column<CompanyClient>,
        ]
      : []),
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100 transition-colors">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs font-mono text-cyan-600 dark:text-cyan-400 uppercase tracking-widest font-bold flex items-center gap-1">
            <Building2 className="w-4 h-4" /> Gestão Multiempresa
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Gerenciador de Tenants
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Isolamento de dados, módulos habilitados e provider de rastreamento por cliente ATHOS TRACK.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setModalState({ open: true, editing: null })}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Tenant</span>
          </button>
        )}
      </div>

      <DataTable
        title="Tenants ATHOS TRACK"
        data={availableClients}
        columns={columns}
        keyExtractor={(item) => item.id}
      />

      {modalState.open && (
        <TenantFormModal
          editing={modalState.editing}
          onClose={() => setModalState({ open: false, editing: null })}
          onSaved={refreshClients}
        />
      )}
    </div>
  );
};
