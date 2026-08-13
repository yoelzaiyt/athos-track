import React, { useEffect, useRef, useState } from 'react';
import { X, Save, ShieldCheck, Camera, Trash2 } from 'lucide-react';
import { AssetDevice, CartRecovery } from '../../types';

export interface RecoveryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (recovery: Omit<CartRecovery, 'id' | 'assetId' | 'assetName' | 'assetCode' | 'unitName' | 'timestamp'>) => void;
  asset: AssetDevice | null;
  defaultRecoveredBy?: string;
  relatedAlertId?: string;
}

export const RecoveryFormModal: React.FC<RecoveryFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  asset,
  defaultRecoveredBy,
  relatedAlertId,
}) => {
  const [recoveredBy, setRecoveredBy] = useState(defaultRecoveredBy || '');
  const [signatureName, setSignatureName] = useState('');
  const [notes, setNotes] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(undefined);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setRecoveredBy(defaultRecoveredBy || '');
    setSignatureName('');
    setNotes('');
    setPhotoDataUrl(undefined);
    setErrors({});
  }, [isOpen, defaultRecoveredBy, asset]);

  if (!isOpen || !asset) return null;

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!recoveredBy.trim()) errs.recoveredBy = 'Informe quem realizou a recuperação.';
    if (!signatureName.trim()) errs.signatureName = 'Assinatura obrigatória para confirmar a recuperação.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({
      recoveredBy: recoveredBy.trim(),
      signatureName: signatureName.trim(),
      notes: notes.trim() || undefined,
      photoDataUrl,
      relatedAlertId,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Registrar Recuperação</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
            <div className="font-bold text-slate-900 dark:text-slate-100 font-mono">{asset.code}</div>
            <div className="text-slate-500 dark:text-slate-400 mt-0.5">{asset.name} • {asset.unitName}</div>
          </div>

          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Recuperado por *</label>
            <input
              type="text"
              value={recoveredBy}
              onChange={(e) => setRecoveredBy(e.target.value)}
              placeholder="Nome do colaborador / segurança"
              className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none ${
                errors.recoveredBy ? 'border-rose-500/60' : 'border-slate-200 dark:border-slate-800'
              }`}
            />
            {errors.recoveredBy && <p className="text-rose-500 mt-1">{errors.recoveredBy}</p>}
          </div>

          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Observações</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Ex: encontrado no estacionamento externo, sem avarias"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none resize-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Foto (opcional)</label>
            {photoDataUrl ? (
              <div className="relative">
                <img src={photoDataUrl} alt="Evidência da recuperação" className="w-full h-36 object-cover rounded-xl border border-slate-200 dark:border-slate-800" />
                <button
                  type="button"
                  onClick={() => {
                    setPhotoDataUrl(undefined);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-slate-950/80 hover:bg-rose-600 text-white rounded-lg transition-colors"
                  title="Remover foto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center gap-1.5 text-slate-400 dark:text-slate-500 hover:border-cyan-500/50 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
              >
                <Camera className="w-5 h-5" />
                <span>Anexar foto de evidência</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoChange}
              className="hidden"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Assinatura de Confirmação *</label>
            <input
              type="text"
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
              placeholder="Digite seu nome completo para confirmar"
              className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3 py-2 font-serif italic text-slate-900 dark:text-slate-200 focus:outline-none ${
                errors.signatureName ? 'border-rose-500/60' : 'border-slate-200 dark:border-slate-800'
              }`}
            />
            {errors.signatureName ? (
              <p className="text-rose-500 mt-1">{errors.signatureName}</p>
            ) : (
              <p className="text-slate-400 dark:text-slate-500 mt-1">
                Ao assinar, você confirma que o ativo foi localizado e recuperado com segurança.
              </p>
            )}
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
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Confirmar Recuperação</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
