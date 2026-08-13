import React from 'react';
import { Building2, Plus, CheckCircle2, Shield, Radio } from 'lucide-react';
import { DataTable, Column } from '../../components/common/DataTable';
import { MOCK_CLIENTS } from '../../mock';
import { CompanyClient } from '../../types';

export const ClientsPage: React.FC = () => {
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
          onClick={() => alert('Novo cliente cadastrado na plataforma.')}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Novo Cliente</span>
        </button>
      </div>

      <DataTable
        title="Clientes Licenciados ATHOS TRACK"
        data={MOCK_CLIENTS}
        columns={columns}
        keyExtractor={(item) => item.id}
      />
    </div>
  );
};
