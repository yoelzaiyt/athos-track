import React, { useEffect, useState } from 'react';
import { X, Save, UserCircle, Mail, ShieldCheck } from 'lucide-react';
import { UserProfile, UserRole } from '../../types';
import { useAuth } from '../../context/AuthContext';

export interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (user: Omit<UserProfile, 'id'>) => void;
  editingUser?: UserProfile | null;
}

const ROLE_OPTIONS: UserRole[] = [
  'ATHOS_ADMIN', 'CLIENT_ADMIN', 'FLEET_MANAGER', 'CART_MANAGER', 'ASSET_MANAGER', 'OPERATOR', 'VIEWER',
];

function emptyUser(): Omit<UserProfile, 'id'> {
  return { name: '', email: '', role: 'VIEWER', clientId: undefined, unitId: undefined };
}

export const UserFormModal: React.FC<UserFormModalProps> = ({ isOpen, onClose, onSave, editingUser }) => {
  const { availableClients, availableUnits } = useAuth();
  const [form, setForm] = useState<Omit<UserProfile, 'id'>>(emptyUser());
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    setForm(editingUser ? editingUser : emptyUser());
    setErrors({});
  }, [isOpen, editingUser]);

  if (!isOpen) return null;

  const clientUnits = availableUnits.filter((u) => u.clientId === form.clientId);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Informe o nome do usuário.';
    if (!form.email.trim()) errs.email = 'Informe o e-mail de acesso.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'E-mail inválido.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <UserCircle className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>{editingUser ? 'Editar Usuário' : 'Cadastrar Novo Usuário'}</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5 text-xs">
          {!editingUser && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 rounded-xl leading-snug">
              Este cadastro cria o <strong>perfil e as permissões</strong> do usuário na plataforma. Para liberar o
              login, rode no servidor:{' '}
              <code className="font-mono bg-amber-500/10 px-1 rounded">
                npm run user:set-password -- {'<email>'} {'<senha>'}
              </code>
            </div>
          )}

          <div className="space-y-3">
            <div className="text-[10px] font-mono uppercase font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <UserCircle className="w-3.5 h-3.5 text-cyan-500" /> Identificação
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Ana Paula Ribeiro"
                  className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500/50 ${
                    errors.name ? 'border-rose-500/60' : 'border-slate-200 dark:border-slate-800'
                  }`}
                />
                {errors.name && <p className="text-rose-500 mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <Mail className="w-3 h-3" /> E-mail de Acesso *
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="usuario@empresa.com"
                  className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:border-cyan-500/50 ${
                    errors.email ? 'border-rose-500/60' : 'border-slate-200 dark:border-slate-800'
                  }`}
                />
                {errors.email && <p className="text-rose-500 mt-1">{errors.email}</p>}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-[10px] font-mono uppercase font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" /> Permissões &amp; Escopo
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Papel RBAC</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Cliente</label>
                <select
                  value={form.clientId || ''}
                  onChange={(e) => {
                    const clientId = e.target.value || undefined;
                    setForm({ ...form, clientId, unitId: undefined });
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none"
                >
                  <option value="">Todos os clientes</option>
                  {availableClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Unidade</label>
                <select
                  value={form.unitId || ''}
                  onChange={(e) => setForm({ ...form, unitId: e.target.value || undefined })}
                  disabled={!form.clientId}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none disabled:opacity-50"
                >
                  <option value="">Todas as unidades</option>
                  {clientUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl shadow-md shadow-cyan-600/20 flex items-center gap-2 transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>{editingUser ? 'Salvar Alterações' : 'Cadastrar Usuário'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
