import React, { useEffect, useState } from 'react';
import { X, Save, Link2 } from 'lucide-react';
import { AssetDevice, AssetPairing } from '../../types';

export interface AssetPairingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (pairing: AssetPairing) => void;
  assets: AssetDevice[];
}

function emptyPairing(): AssetPairing {
  return {
    id: `pair_${Date.now()}`,
    label: '',
    clientId: '',
    primaryAssetId: '',
    primaryAssetName: '',
    secondaryAssetId: '',
    secondaryAssetName: '',
    maxDistanceMeters: 500,
    active: true,
  };
}

export const AssetPairingFormModal: React.FC<AssetPairingFormModalProps> = ({ isOpen, onClose, onSave, assets }) => {
  const [form, setForm] = useState<AssetPairing>(emptyPairing());
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    setForm(emptyPairing());
    setErrors({});
  }, [isOpen]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.label.trim()) errs.label = 'Informe uma identificação para o pareamento.';
    if (!form.primaryAssetId) errs.primaryAssetId = 'Selecione o primeiro ativo.';
    if (!form.secondaryAssetId) errs.secondaryAssetId = 'Selecione o segundo ativo.';
    if (form.primaryAssetId && form.primaryAssetId === form.secondaryAssetId) errs.secondaryAssetId = 'Selecione um ativo diferente do primeiro.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave(form);
  };

  const selectPrimary = (assetId: string) => {
    const asset = assets.find((a) => a.id === assetId);
    setForm((prev) => ({ ...prev, primaryAssetId: assetId, primaryAssetName: asset?.name || '', clientId: asset?.clientId || prev.clientId }));
  };

  const selectSecondary = (assetId: string) => {
    const asset = assets.find((a) => a.id === assetId);
    setForm((prev) => ({ ...prev, secondaryAssetId: assetId, secondaryAssetName: asset?.name || '' }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Link2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Novo Pareamento de Proximidade</span>
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
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Identificação *</label>
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="Ex: Comboio Carga Eletrônicos - Escolta"
              className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none ${
                errors.label ? 'border-rose-500/60' : 'border-slate-200 dark:border-slate-800'
              }`}
            />
            {errors.label && <p className="text-rose-500 mt-1">{errors.label}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Ativo Primário *</label>
              <select
                value={form.primaryAssetId}
                onChange={(e) => selectPrimary(e.target.value)}
                className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none ${
                  errors.primaryAssetId ? 'border-rose-500/60' : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <option value="">Selecione...</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.plateNumber || a.code} — {a.name}
                  </option>
                ))}
              </select>
              {errors.primaryAssetId && <p className="text-rose-500 mt-1">{errors.primaryAssetId}</p>}
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Ativo Secundário *</label>
              <select
                value={form.secondaryAssetId}
                onChange={(e) => selectSecondary(e.target.value)}
                className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none ${
                  errors.secondaryAssetId ? 'border-rose-500/60' : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <option value="">Selecione...</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.plateNumber || a.code} — {a.name}
                  </option>
                ))}
              </select>
              {errors.secondaryAssetId && <p className="text-rose-500 mt-1">{errors.secondaryAssetId}</p>}
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Distância Máxima Permitida</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={form.maxDistanceMeters}
                onChange={(e) => setForm({ ...form, maxDistanceMeters: Number(e.target.value) || 0 })}
                className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-slate-200 focus:outline-none"
              />
              <span className="text-slate-400">metros</span>
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
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Criar Pareamento</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
