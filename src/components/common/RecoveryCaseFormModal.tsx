import React, { useEffect, useState } from 'react';
import { X, Save, ShieldAlert, Plus, Trash2, MapPin } from 'lucide-react';
import { AssetDevice, AssetRecoveryCase, FrequentStopPoint, RecoveryCaseStatus } from '../../types';

export interface RecoveryCaseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (recoveryCase: AssetRecoveryCase) => void;
  editingCase?: AssetRecoveryCase | null;
  assets: AssetDevice[];
}

const STATUS_OPTIONS: { value: RecoveryCaseStatus; label: string }[] = [
  { value: 'aberto', label: 'Aberto' },
  { value: 'em_negociacao', label: 'Em Negociação' },
  { value: 'localizado', label: 'Localizado' },
  { value: 'recuperado', label: 'Recuperado' },
  { value: 'encerrado', label: 'Encerrado' },
];

function emptyCase(): AssetRecoveryCase {
  return {
    id: `rcv_${Date.now()}`,
    assetId: '',
    assetName: '',
    assetCode: '',
    clientId: '',
    unitName: '',
    reason: '',
    status: 'aberto',
    openedAt: new Date().toISOString().slice(0, 10),
    responsibleName: '',
    frequentStopPoints: [],
  };
}

export const RecoveryCaseFormModal: React.FC<RecoveryCaseFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingCase,
  assets,
}) => {
  const [form, setForm] = useState<AssetRecoveryCase>(emptyCase());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [stopDraft, setStopDraft] = useState({ label: '', latitude: '', longitude: '' });

  useEffect(() => {
    if (!isOpen) return;
    setForm(editingCase || emptyCase());
    setErrors({});
    setStopDraft({ label: '', latitude: '', longitude: '' });
  }, [isOpen, editingCase]);

  if (!isOpen) return null;

  const selectAsset = (assetId: string) => {
    const asset = assets.find((a) => a.id === assetId);
    setForm((prev) => ({
      ...prev,
      assetId,
      assetName: asset?.name || '',
      assetCode: asset?.code || '',
      plateNumber: asset?.plateNumber,
      clientId: asset?.clientId || prev.clientId,
      unitName: asset?.unitName || prev.unitName,
      lastKnownLatitude: asset?.telemetry.latitude,
      lastKnownLongitude: asset?.telemetry.longitude,
    }));
  };

  const addStopPoint = () => {
    if (!stopDraft.label.trim() || !stopDraft.latitude || !stopDraft.longitude) return;
    const point: FrequentStopPoint = {
      label: stopDraft.label.trim(),
      latitude: Number(stopDraft.latitude),
      longitude: Number(stopDraft.longitude),
      visitCount: 1,
      lastVisit: 'Agora',
    };
    setForm((prev) => ({ ...prev, frequentStopPoints: [...prev.frequentStopPoints, point] }));
    setStopDraft({ label: '', latitude: '', longitude: '' });
  };

  const removeStopPoint = (index: number) => {
    setForm((prev) => ({ ...prev, frequentStopPoints: prev.frequentStopPoints.filter((_, i) => i !== index) }));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.assetId) errs.assetId = 'Selecione o ativo/veículo.';
    if (!form.reason.trim()) errs.reason = 'Informe o motivo do caso.';
    if (!form.responsibleName.trim()) errs.responsibleName = 'Informe o responsável pelo caso.';
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
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <span>{editingCase ? 'Editar Caso de Recuperação' : 'Novo Caso de Recuperação de Ativo'}</span>
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
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Ativo / Veículo *</label>
            <select
              value={form.assetId}
              onChange={(e) => selectAsset(e.target.value)}
              disabled={!!editingCase}
              className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none disabled:opacity-60 ${
                errors.assetId ? 'border-rose-500/60' : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <option value="">Selecione...</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.plateNumber || a.code} — {a.name}
                </option>
              ))}
            </select>
            {errors.assetId && <p className="text-rose-500 mt-1">{errors.assetId}</p>}
          </div>

          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Motivo do Caso *</label>
            <input
              type="text"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Ex: Inadimplência contratual acima de 60 dias"
              className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none ${
                errors.reason ? 'border-rose-500/60' : 'border-slate-200 dark:border-slate-800'
              }`}
            />
            {errors.reason && <p className="text-rose-500 mt-1">{errors.reason}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Responsável pelo Caso *</label>
              <input
                type="text"
                value={form.responsibleName}
                onChange={(e) => setForm({ ...form, responsibleName: e.target.value })}
                placeholder="Setor / Nome do responsável"
                className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none ${
                  errors.responsibleName ? 'border-rose-500/60' : 'border-slate-200 dark:border-slate-800'
                }`}
              />
              {errors.responsibleName && <p className="text-rose-500 mt-1">{errors.responsibleName}</p>}
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as RecoveryCaseStatus })}
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
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Locais Frequentes de Parada ("onde mais para")
            </label>
            <div className="space-y-1.5">
              {form.frequentStopPoints.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5"
                >
                  <span className="text-slate-700 dark:text-slate-300">
                    {p.label}{' '}
                    <span className="font-mono text-slate-400 dark:text-slate-500">
                      ({p.latitude.toFixed(4)}, {p.longitude.toFixed(4)})
                    </span>
                  </span>
                  <button type="button" onClick={() => removeStopPoint(i)} className="text-slate-400 hover:text-rose-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <input
                type="text"
                value={stopDraft.label}
                onChange={(e) => setStopDraft({ ...stopDraft, label: e.target.value })}
                placeholder="Local (ex: endereço residencial)"
                className="flex-1 min-w-[160px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-slate-900 dark:text-slate-200 focus:outline-none"
              />
              <input
                type="number"
                step="0.000001"
                value={stopDraft.latitude}
                onChange={(e) => setStopDraft({ ...stopDraft, latitude: e.target.value })}
                placeholder="Lat"
                className="w-24 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 font-mono text-slate-900 dark:text-slate-200 focus:outline-none"
              />
              <input
                type="number"
                step="0.000001"
                value={stopDraft.longitude}
                onChange={(e) => setStopDraft({ ...stopDraft, longitude: e.target.value })}
                placeholder="Lng"
                className="w-24 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 font-mono text-slate-900 dark:text-slate-200 focus:outline-none"
              />
              <button
                type="button"
                onClick={addStopPoint}
                className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar
              </button>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Observações</label>
            <textarea
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none resize-none"
            />
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
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl shadow-md shadow-rose-600/20 flex items-center gap-2 transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>{editingCase ? 'Salvar Alterações' : 'Abrir Caso'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
