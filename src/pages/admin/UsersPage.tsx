import React, { useState } from 'react';
import { Users, Plus, ShieldCheck, Pencil, Trash2 } from 'lucide-react';
import { DataTable, Column } from '../../components/common/DataTable';
import { UserFormModal } from '../../components/common/UserFormModal';
import { useAssets } from '../../context/AssetContext';
import { useAuth } from '../../context/AuthContext';
import { UserProfile } from '../../types';

export const UsersPage: React.FC = () => {
  const { users, addUserProfile, updateUserProfile, deleteUserProfile } = useAssets();
  const { user: currentUser } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  const columns: Column<UserProfile>[] = [
    {
      header: 'Usuário',
      accessor: (row) => (
        <div className="flex items-center gap-2.5">
          {row.avatarUrl ? (
            <img src={row.avatarUrl} alt={row.name} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 bg-cyan-600/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 rounded-full flex items-center justify-center font-bold text-xs">
              {row.name.substring(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="font-bold text-slate-900 dark:text-slate-100">{row.name}</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{row.email}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Papel RBAC',
      accessor: (row) => (
        <span className="px-2.5 py-1 text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 rounded-lg uppercase">
          {row.role.replace('_', ' ')}
        </span>
      ),
    },
    {
      header: 'Permissões do Papel',
      accessor: (row) => (
        <span className="text-xs text-slate-600 dark:text-slate-300">
          {row.role === 'ATHOS_ADMIN'
            ? 'Acesso Global Total'
            : row.role === 'FLEET_MANAGER'
            ? 'Frotas + Cargas + Mapas'
            : row.role === 'CART_MANAGER'
            ? 'Carrinhos + Tags + Mapas'
            : row.role === 'ASSET_MANAGER'
            ? 'Ativos + Tags + Mapas'
            : row.role === 'CLIENT_ADMIN'
            ? 'Administração do Cliente'
            : row.role === 'OPERATOR'
            ? 'Operação do Dia a Dia'
            : 'Somente Visualização'}
        </span>
      ),
    },
    {
      header: 'Escopo',
      accessor: (row) => (
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {row.clientId ? (row.unitId ? 'Cliente + Unidade' : 'Cliente') : 'Todos os clientes'}
        </span>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100 transition-colors">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs font-mono text-cyan-600 dark:text-cyan-400 uppercase tracking-widest font-bold flex items-center gap-1">
            <Users className="w-4 h-4" /> Controle de Acesso RBAC
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Usuários e Matriz de Permissões
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Definição de acesso granular por módulo (Gestor de Frota, Gestor de Carrinhos, Operador).
          </p>
        </div>

        <button
          onClick={() => {
            setEditingUser(null);
            setIsModalOpen(true);
          }}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Usuário</span>
        </button>
      </div>

      {/* RBAC Visual Matrix Explanation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs shadow-sm">
        <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="font-bold text-cyan-600 dark:text-cyan-400 mb-1 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" /> Gestor de Frota
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-[11px]">
            Visualiza somente Módulo Frotas, Cargas, Mapa e Relatórios. Módulos de Carrinhos e Patrimônio ocultos.
          </p>
        </div>
        <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="font-bold text-emerald-600 dark:text-emerald-400 mb-1 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" /> Gestor de Carrinhos
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-[11px]">
            Acesso focado em Carrinhos de Supermercado, Alertas de Evasão e Tags BLE.
          </p>
        </div>
        <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="font-bold text-indigo-600 dark:text-indigo-400 mb-1 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" /> Gestor de Patrimônio
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-[11px]">
            Acesso exclusivo para Ativos Industriais, Equipamentos, Empilhadeiras e Relatórios.
          </p>
        </div>
      </div>

      <DataTable
        title="Usuários e Perfis Cadastrados"
        data={users}
        columns={columns}
        keyExtractor={(item) => item.id}
        actions={(item) => (
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={() => {
                setEditingUser(item);
                setIsModalOpen(true);
              }}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-cyan-500/15 text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
              title="Editar usuário"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                if (item.id === currentUser?.id) {
                  alert('Você não pode remover o próprio usuário logado.');
                  return;
                }
                if (window.confirm(`Remover o usuário "${item.name}"?`)) {
                  deleteUserProfile(item.id);
                }
              }}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-500/15 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
              title="Remover usuário"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      />

      <UserFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingUser(null);
        }}
        editingUser={editingUser}
        onSave={(userData) => {
          if (editingUser) {
            updateUserProfile(editingUser.id, userData);
          } else {
            addUserProfile(userData);
          }
          setIsModalOpen(false);
          setEditingUser(null);
        }}
      />
    </div>
  );
};
