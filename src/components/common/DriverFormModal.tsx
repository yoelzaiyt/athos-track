import React, { useEffect, useState } from 'react';
import { X, Save, User, Phone, IdCard, Gauge } from 'lucide-react';
import { Driver, DriverStatus, FatigueStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';

export interface DriverFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (driver: Driver) => void;
  editingDriver?: Driver | null;
}

const CNH_CATEGORIES: Driver['cnhCategory'][] = ['A', 'B', 'AB', 'C', 'D', 'E'];
const STATUS_OPTIONS: DriverStatus[] = ['active', 'inactive', 'suspended'];
const FATIGUE_OPTIONS: FatigueStatus[] = ['normal', 'attention', 'critical'];

function emptyDriver(clientId: string, unitId: string, unitName: string): Driver {
  return {
    id: `drv_${Date.now()}`,
    name: '',
    cnhNumber: '',
    cnhCategory: 'B',
    cnhExpiry: '',
    phone: '',
    clientId,
    unitId,
    unitName,
    status: 'active',
    fatigueScore: 0,
    fatigueStatus: 'normal',
    lastFatigueCheck: 'Sem registros',
    continuousDrivingHours: 0,
    drivingHoursToday: 0,
  };
}

export const DriverFormModal: React.FC<DriverFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingDriver,
}) => {
  const { availableClients, availableUnits } = useAuth();
  const [form, setForm] = useState<Driver>(() =>
    emptyDriver(availableClients[0]?.id || 'cli_1', availableUnits[0]?.id || 'unit_1', availableUnits[0]?.name || '')
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    if (editingDriver) {
      setForm(editingDriver);
    } else {
      setForm(
        emptyDriver(availableClients[0]?.id || 'cli_1', availableUnits[0]?.id || 'unit_1', availableUnits[0]?.name || '')
      );
    }
    setErrors({});
  }, [isOpen, editingDriver]);

  if (!isOpen) return null;

  const clientUnits = availableUnits.filter((u) => u.clientId === form.clientId);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Informe o nome do motorista.';
    if (!form.cnhNumber.trim()) errs.cnhNumber = 'Informe o número da CNH.';
    if (!form.cnhExpiry.trim()) errs.cnhExpiry = 'Informe a validade da CNH.';
    if (!form.phone.trim()) errs.phone = 'Informe o telefone de contato.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const unit = availableUnits.find((u) => u.id === form.unitId);
    onSave({ ...form, unitName: unit?.name || form.unitName });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <User className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>{editingDriver ? 'Editar Motorista' : 'Cadastrar Novo Motorista'}</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5 text-xs">
          <div className="space-y-3">
            <div className="text-[10px] font-mono uppercase font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-cyan-500" /> Identificação
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Carlos Eduardo Silva"
                  className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500/50 ${
                    errors.name ? 'border-rose-500/60' : 'border-slate-200 dark:border-slate-800'
                  }`}
                />
                {errors.name && <p className="text-rose-500 mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Telefone *</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="(11) 90000-0000"
                  className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:border-cyan-500/50 ${
                    errors.phone ? 'border-rose-500/60' : 'border-slate-200 dark:border-slate-800'
                  }`}
                />
                {errors.phone && <p className="text-rose-500 mt-1">{errors.phone}</p>}
              </div>

              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as DriverStatus })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s === 'active' ? 'Ativo' : s === 'inactive' ? 'Inativo' : 'Suspenso'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-[10px] font-mono uppercase font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <IdCard className="w-3.5 h-3.5 text-indigo-500" /> Habilitação (CNH)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Número CNH *</label>
                <input
                  type="text"
                  value={form.cnhNumber}
                  onChange={(e) => setForm({ ...form, cnhNumber: e.target.value })}
                  className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:border-cyan-500/50 ${
                    errors.cnhNumber ? 'border-rose-500/60' : 'border-slate-200 dark:border-slate-800'
                  }`}
                />
                {errors.cnhNumber && <p className="text-rose-500 mt-1">{errors.cnhNumber}</p>}
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Categoria</label>
                <select
                  value={form.cnhCategory}
                  onChange={(e) => setForm({ ...form, cnhCategory: e.target.value as Driver['cnhCategory'] })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none"
                >
                  {CNH_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Validade *</label>
                <input
                  type="date"
                  value={form.cnhExpiry}
                  onChange={(e) => setForm({ ...form, cnhExpiry: e.target.value })}
                  className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:border-cyan-500/50 ${
                    errors.cnhExpiry ? 'border-rose-500/60' : 'border-slate-200 dark:border-slate-800'
                  }`}
                />
                {errors.cnhExpiry && <p className="text-rose-500 mt-1">{errors.cnhExpiry}</p>}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-[10px] font-mono uppercase font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-amber-500" /> Unidade &amp; Controle de Fadiga (Sono)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Cliente</label>
                <select
                  value={form.clientId}
                  onChange={(e) => {
                    const clientId = e.target.value;
                    const firstUnit = availableUnits.find((u) => u.clientId === clientId);
                    setForm({ ...form, clientId, unitId: firstUnit?.id || '', unitName: firstUnit?.name || '' });
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none"
                >
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
                  value={form.unitId}
                  onChange={(e) => {
                    const unit = availableUnits.find((u) => u.id === e.target.value);
                    setForm({ ...form, unitId: e.target.value, unitName: unit?.name || '' });
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none"
                >
                  <option value="">Selecione...</option>
                  {clientUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Nível de Fadiga (0-100)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.fatigueScore}
                  onChange={(e) => setForm({ ...form, fatigueScore: Number(e.target.value) })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 font-mono focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Status de Fadiga</label>
                <select
                  value={form.fatigueStatus}
                  onChange={(e) => setForm({ ...form, fatigueStatus: e.target.value as FatigueStatus })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none"
                >
                  {FATIGUE_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {f === 'normal' ? 'Normal' : f === 'attention' ? 'Atenção' : 'Crítico'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Horas Contínuas de Direção
                </label>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  value={form.continuousDrivingHours}
                  onChange={(e) => setForm({ ...form, continuousDrivingHours: Number(e.target.value) })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 font-mono focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Horas no Dia</label>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  value={form.drivingHoursToday}
                  onChange={(e) => setForm({ ...form, drivingHoursToday: Number(e.target.value) })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 font-mono focus:outline-none"
                />
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
              <span>{editingDriver ? 'Salvar Alterações' : 'Cadastrar Motorista'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
