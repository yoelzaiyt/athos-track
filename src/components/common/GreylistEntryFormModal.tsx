import React, { useEffect, useState } from 'react';
import { X, Save, UserX } from 'lucide-react';
import { GreylistEntry, GreylistEntryType } from '../../types';

export interface GreylistEntryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: GreylistEntry) => void;
  clientId: string;
}

const TYPE_OPTIONS: { value: GreylistEntryType; label: string }[] = [
  { value: 'endereco', label: 'Endereço Suspeito' },
  { value: 'local_penhora', label: 'Local de Penhora / Desmanche' },
  { value: 'pessoa', label: 'Pessoa com Restrição' },
];

function emptyEntry(clientId: string): GreylistEntry {
  return {
    id: `grey_${Date.now()}`,
    type: 'endereco',
    label: '',
    clientId,
    addedAt: new Date().toISOString().slice(0, 10),
  };
}

export const GreylistEntryFormModal: React.FC<GreylistEntryFormModalProps> = ({ isOpen, onClose, onSave, clientId }) => {
  const [form, setForm] = useState<GreylistEntry>(() => emptyEntry(clientId));
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    setForm(emptyEntry(clientId));
    setErrors({});
  }, [isOpen, clientId]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.label.trim()) errs.label = 'Informe uma identificação para o item.';
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
            <UserX className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <span>Novo Item de Greylist</span>
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
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Tipo</label>
            <div className="flex flex-wrap gap-1.5">
              {TYPE_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm({ ...form, type: t.value })}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors border ${
                    form.type === t.value
                      ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40'
                      : 'bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Identificação *</label>
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="Ex: Depósito não cadastrado - Zona Norte"
              className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none ${
                errors.label ? 'border-rose-500/60' : 'border-slate-200 dark:border-slate-800'
              }`}
            />
            {errors.label && <p className="text-rose-500 mt-1">{errors.label}</p>}
          </div>

          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Descrição / Motivo</label>
            <textarea
              value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none resize-none"
            />
          </div>

          {form.type !== 'pessoa' && (
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Latitude</label>
                <input
                  type="number"
                  step="0.000001"
                  value={form.latitude ?? ''}
                  onChange={(e) => setForm({ ...form, latitude: Number(e.target.value) })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-2 font-mono text-slate-900 dark:text-slate-200 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Longitude</label>
                <input
                  type="number"
                  step="0.000001"
                  value={form.longitude ?? ''}
                  onChange={(e) => setForm({ ...form, longitude: Number(e.target.value) })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-2 font-mono text-slate-900 dark:text-slate-200 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Raio (m)</label>
                <input
                  type="number"
                  value={form.radiusMeters ?? ''}
                  onChange={(e) => setForm({ ...form, radiusMeters: Number(e.target.value) })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-2 font-mono text-slate-900 dark:text-slate-200 focus:outline-none"
                />
              </div>
            </div>
          )}

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
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl shadow-md shadow-rose-600/20 flex items-center gap-2 transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Adicionar à Greylist</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
