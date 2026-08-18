import React, { useState } from 'react';
import { Building2, Plus, CheckCircle2, Shield, Radio, X } from 'lucide-react';
import { DataTable, Column } from '../../components/common/DataTable';
import { useAuth } from '../../context/AuthContext';
import { CompanyClient } from '../../types';

const NewClientModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { addClient } = useAuth();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim() || !cnpj.trim()) return;
    setSaving(true);
    try {
      await addClient({
        name: name.trim(),
        code: code.trim(),
        cnpj: cnpj.trim(),
        unitsCount: 0,
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
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Novo Cliente</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Nome da Empresa</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Ex: Transportadora Athos LTDA"
            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500/40"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Código</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            placeholder="Ex: ATHOS-01"
            className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500/40"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">CNPJ</label>
          <input
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            required
            placeholder="00.000.000/0001-00"
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
            disabled={saving || !name.trim() || !code.trim() || !cnpj.trim()}
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            {saving ? 'Salvando...' : 'Salvar Cliente'}
          </button>
        </div>
      </form>
    </div>
  );
};

export const ClientsPage: React.FC = () => {
  const { availableClients } = useAuth();
  const [showNewClient, setShowNewClient] = useState(false);
  const columns: Column<CompanyClient>[] = [
    {
      header: 'Cliente / Empresa',
      accessor: (row) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 font-mono">
            <Building2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>{row.name}</span>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Código: {row.code}</div>
        </div>
      ),
    },
    {
      header: 'CNPJ',
      accessor: (row) => <span className="font-mono text-slate-600 dark:text-slate-300">{row.cnpj}</span>,
    },
    {
      header: 'Unidades',
      accessor: (row) => <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">{row.unitsCount}</span>,
    },
    {
      header: 'Ativos Cadastrados',
      accessor: (row) => <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{row.assetsCount}</span>,
    },
    {
      header: 'Status',
      accessor: (row) => (
        <span className="px-2 py-0.5 text-[10px] font-bold font-mono rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase">
          {row.status}
        </span>
      ),
    },
    {
      header: 'Serviço (Conta) — CExpireDate',
      accessor: (row) => {
        if (!row.serviceExpireDate) return <span className="text-slate-400 dark:text-slate-600">Sem vencimento</span>;
        const expired = new Date(row.serviceExpireDate) < new Date();
        return (
          <span
            className={`px-2 py-0.5 text-[10px] font-bold font-mono rounded-full uppercase border ${
              expired
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
            }`}
          >
            {expired ? 'Vencido em' : 'Ativo até'} {row.serviceExpireDate}
          </span>
        );
      },
    },
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100 transition-colors">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs font-mono text-cyan-600 dark:text-cyan-400 uppercase tracking-widest font-bold flex items-center gap-1">
            <Building2 className="w-4 h-4" /> Gestão Multiempresa
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Clientes e Contas Empresariais
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Gerenciamento de tenancy, isolamento de dados e limites do contrato ATHOS TRACK.
          </p>
        </div>

        <button
          onClick={() => setShowNewClient(true)}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Novo Cliente</span>
        </button>
      </div>

      {showNewClient && <NewClientModal onClose={() => setShowNewClient(false)} />}

      <DataTable
        title="Clientes Licenciados ATHOS TRACK"
        data={availableClients}
        columns={columns}
        keyExtractor={(item) => item.id}
      />
    </div>
  );
};
