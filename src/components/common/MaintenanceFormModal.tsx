import React, { useEffect, useState } from 'react';
import { X, Save, Wrench } from 'lucide-react';
import { MaintenanceRecord, MaintenanceType, MaintenanceStatus, AssetDevice } from '../../types';

export interface MaintenanceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: MaintenanceRecord) => void;
  editingRecord?: MaintenanceRecord | null;
  vehicles: AssetDevice[];
}

const TYPE_OPTIONS: { value: MaintenanceType; label: string }[] = [
  { value: 'preventiva', label: 'Preventiva' },
  { value: 'corretiva', label: 'Corretiva' },
  { value: 'revisao', label: 'Revisão' },
  { value: 'pneus', label: 'Pneus' },
  { value: 'oleo', label: 'Óleo / Fluidos' },
];

const STATUS_OPTIONS: { value: MaintenanceStatus; label: string }[] = [
  { value: 'agendada', label: 'Agendada' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'atrasada', label: 'Atrasada' },
];

function emptyRecord(vehicle?: AssetDevice): MaintenanceRecord {
  return {
    id: `mnt_${Date.now()}`,
    vehicleId: vehicle?.id || '',
    vehiclePlate: vehicle?.plateNumber || vehicle?.code || '',
    vehicleName: vehicle?.name || '',
    type: 'preventiva',
    description: '',
    status: 'agendada',
    scheduledDate: new Date().toISOString().slice(0, 10),
  };
}

export const MaintenanceFormModal: React.FC<MaintenanceFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingRecord,
  vehicles,
}) => {
  const [form, setForm] = useState<MaintenanceRecord>(() => emptyRecord(vehicles[0]));
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    setForm(editingRecord || emptyRecord(vehicles[0]));
    setErrors({});
  }, [isOpen, editingRecord]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.vehicleId) errs.vehicleId = 'Selecione o veículo.';
    if (!form.description.trim()) errs.description = 'Descreva o serviço.';
    if (!form.scheduledDate) errs.scheduledDate = 'Informe a data.';
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
            <Wrench className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>{editingRecord ? 'Editar Manutenção' : 'Agendar Nova Manutenção'}</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Veículo *</label>
            <select
              value={form.vehicleId}
              onChange={(e) => {
                const v = vehicles.find((veh) => veh.id === e.target.value);
                setForm({
                  ...form,
                  vehicleId: e.target.value,
                  vehiclePlate: v?.plateNumber || v?.code || '',
                  vehicleName: v?.name || '',
                });
              }}
              className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none ${
                errors.vehicleId ? 'border-rose-500/60' : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <option value="">Selecione...</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plateNumber || v.code} — {v.name}
                </option>
              ))}
            </select>
            {errors.vehicleId && <p className="text-rose-500 mt-1">{errors.vehicleId}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Tipo de Serviço</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as MaintenanceType })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none"
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as MaintenanceStatus })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Descrição do Serviço *</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              placeholder="Ex: Troca de óleo e filtros"
              className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none resize-none ${
                errors.description ? 'border-rose-500/60' : 'border-slate-200 dark:border-slate-800'
              }`}
            />
            {errors.description && <p className="text-rose-500 mt-1">{errors.description}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Data Agendada *</label>
              <input
                type="date"
                value={form.scheduledDate}
                onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
                className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 font-mono focus:outline-none ${
                  errors.scheduledDate ? 'border-rose-500/60' : 'border-slate-200 dark:border-slate-800'
                }`}
              />
              {errors.scheduledDate && <p className="text-rose-500 mt-1">{errors.scheduledDate}</p>}
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Oficina</label>
              <input
                type="text"
                value={form.workshop || ''}
                onChange={(e) => setForm({ ...form, workshop: e.target.value })}
                placeholder="Opcional"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Custo (R$)</label>
              <input
                type="number"
                step="0.01"
                value={form.cost ?? ''}
                onChange={(e) => setForm({ ...form, cost: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="Opcional"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 font-mono focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Odômetro (km)</label>
              <input
                type="number"
                value={form.odometerAtService ?? ''}
                onChange={(e) =>
                  setForm({ ...form, odometerAtService: e.target.value ? Number(e.target.value) : undefined })
                }
                placeholder="Opcional"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 font-mono focus:outline-none"
              />
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
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl shadow-md shadow-amber-600/20 flex items-center gap-2 transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>{editingRecord ? 'Salvar Alterações' : 'Agendar Manutenção'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
