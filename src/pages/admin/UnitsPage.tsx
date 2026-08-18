import React, { useState } from 'react';
import { MapPin, Plus, Building2, X } from 'lucide-react';
import { DataTable, Column } from '../../components/common/DataTable';
import { useAuth } from '../../context/AuthContext';
import { CompanyUnit } from '../../types';

const BRAZIL_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

const NewUnitModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { addUnit, availableClients } = useAuth();
  const [clientId, setClientId] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('SP');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  const canSubmit = clientId && name.trim() && city.trim() && address.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      await addUnit({
        clientId,
        name: name.trim(),
        city: city.trim(),
        state,
        address: address.trim(),
        assetsCount: 0,
        status: 'active',
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
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Nova Unidade</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Cliente</label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            <option value="">Selecione...</option>
            {availableClients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {availableClients.length === 0 && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">Cadastre um cliente antes de criar uma unidade.</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Nome da Unidade</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Ex: Garagem Matriz"
            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 space-y-1">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Cidade</label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
              placeholder="Ex: São Paulo"
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">UF</label>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              {BRAZIL_STATES.map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Endereço</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            placeholder="Rua, número, bairro"
            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/40"
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
            disabled={saving || !canSubmit}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            {saving ? 'Salvando...' : 'Salvar Unidade'}
          </button>
        </div>
      </form>
    </div>
  );
};

export const UnitsPage: React.FC = () => {
  const { availableUnits } = useAuth();
  const [showNewUnit, setShowNewUnit] = useState(false);
  const columns: Column<CompanyUnit>[] = [
    {
      header: 'Nome da Unidade',
      accessor: (row) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{row.name}</span>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">{row.address}</div>
        </div>
      ),
    },
    {
      header: 'Cidade / UF',
      accessor: (row) => (
        <span className="font-mono text-slate-600 dark:text-slate-300">
          {row.city} / {row.state}
        </span>
      ),
    },
    {
      header: 'Ativos em Telemetria',
      accessor: (row) => <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">{row.assetsCount}</span>,
    },
    {
      header: 'Status',
      accessor: (row) => (
        <span className="px-2 py-0.5 text-[10px] font-bold font-mono rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase">
          {row.status}
        </span>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100 transition-colors">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400 uppercase tracking-widest font-bold flex items-center gap-1">
            <MapPin className="w-4 h-4" /> Gestão de Instalações
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Unidades, Filiais e Centros de Distribuição
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Mapeamento hierárquico de lojas, garagens e centros logísticos.
          </p>
        </div>

        <button
          onClick={() => setShowNewUnit(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Nova Unidade</span>
        </button>
      </div>

      {showNewUnit && <NewUnitModal onClose={() => setShowNewUnit(false)} />}

      <DataTable
        title="Unidades de Operação Registradas"
        data={availableUnits}
        columns={columns}
        keyExtractor={(item) => item.id}
      />
    </div>
  );
};
