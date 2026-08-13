import React, { useEffect, useRef, useState } from 'react';
import { X, Save, ClipboardList, User, Calendar, Camera, Trash2, MapPinned } from 'lucide-react';
import { AssetDevice, WorkOrder, WorkOrderStatus, WorkOrderType } from '../../types';
import { VehicleInstallDiagram } from './VehicleInstallDiagram';

export interface WorkOrderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (order: WorkOrder) => void;
  editingOrder?: WorkOrder | null;
  vehicles: AssetDevice[];
}

const TYPE_OPTIONS: { value: WorkOrderType; label: string }[] = [
  { value: 'instalacao', label: 'Instalação' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'desinstalacao', label: 'Desinstalação' },
  { value: 'auditoria', label: 'Auditoria' },
];

const STATUS_OPTIONS: { value: WorkOrderStatus; label: string }[] = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'agendada', label: 'Agendada' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'cancelada', label: 'Cancelada' },
];

function emptyOrder(): WorkOrder {
  return {
    id: `wo_${Date.now()}`,
    code: `OS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 8999)}`,
    type: 'instalacao',
    clientId: '',
    unitId: '',
    unitName: '',
    technicianName: '',
    status: 'pendente',
    scheduledDate: new Date().toISOString().slice(0, 10),
  };
}

export const WorkOrderFormModal: React.FC<WorkOrderFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingOrder,
  vehicles,
}) => {
  const [form, setForm] = useState<WorkOrder>(emptyOrder());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setForm(editingOrder || emptyOrder());
    setErrors({});
  }, [isOpen, editingOrder]);

  if (!isOpen) return null;

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((prev) => ({ ...prev, installPhotoDataUrl: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.technicianName.trim()) errs.technicianName = 'Informe o técnico responsável.';
    if (!form.assetId) errs.assetId = 'Selecione o veículo/ativo.';
    if (!form.scheduledDate) errs.scheduledDate = 'Informe a data agendada.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave(form);
  };

  const selectAsset = (assetId: string) => {
    const asset = vehicles.find((v) => v.id === assetId);
    setForm((prev) => ({
      ...prev,
      assetId,
      assetName: asset?.name,
      vehiclePlate: asset?.plateNumber,
      clientId: asset?.clientId || prev.clientId,
      unitId: asset?.unitId || prev.unitId,
      unitName: asset?.unitName || prev.unitName,
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>{editingOrder ? 'Editar Ordem de Serviço' : 'Nova Ordem de Serviço'}</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Código da OS</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-slate-200 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Veículo / Ativo *</label>
              <select
                value={form.assetId || ''}
                onChange={(e) => selectAsset(e.target.value)}
                className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none ${
                  errors.assetId ? 'border-rose-500/60' : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <option value="">Selecione...</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plateNumber || v.code} — {v.name}
                  </option>
                ))}
              </select>
              {errors.assetId && <p className="text-rose-500 mt-1">{errors.assetId}</p>}
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Tipo de Ordem</label>
            <div className="flex flex-wrap gap-1.5">
              {TYPE_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm({ ...form, type: t.value })}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors border ${
                    form.type === t.value
                      ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/40'
                      : 'bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Status</label>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      status: s.value,
                      completedDate: s.value === 'concluida' ? new Date().toISOString().slice(0, 10) : form.completedDate,
                    })
                  }
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors border ${
                    form.status === s.value
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                <User className="w-3 h-3" /> Técnico Responsável *
              </label>
              <input
                type="text"
                value={form.technicianName}
                onChange={(e) => setForm({ ...form, technicianName: e.target.value })}
                placeholder="Nome do técnico de campo"
                className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none ${
                  errors.technicianName ? 'border-rose-500/60' : 'border-slate-200 dark:border-slate-800'
                }`}
              />
              {errors.technicianName && <p className="text-rose-500 mt-1">{errors.technicianName}</p>}
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Data Agendada *
              </label>
              <input
                type="date"
                value={form.scheduledDate}
                onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
                className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none ${
                  errors.scheduledDate ? 'border-rose-500/60' : 'border-slate-200 dark:border-slate-800'
                }`}
              />
              {errors.scheduledDate && <p className="text-rose-500 mt-1">{errors.scheduledDate}</p>}
            </div>
          </div>

          {form.type === 'instalacao' && (
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                <MapPinned className="w-3 h-3" /> Ponto de Instalação na Carroceria
              </label>
              <VehicleInstallDiagram
                selectedPointId={form.installPointId}
                onSelectPoint={(pointId) => setForm({ ...form, installPointId: pointId })}
              />
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Foto de Instalação (opcional)</label>
            {form.installPhotoDataUrl ? (
              <div className="relative">
                <img
                  src={form.installPhotoDataUrl}
                  alt="Foto de instalação"
                  className="w-full h-32 object-cover rounded-xl border border-slate-200 dark:border-slate-800"
                />
                <button
                  type="button"
                  onClick={() => {
                    setForm((prev) => ({ ...prev, installPhotoDataUrl: undefined }));
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-slate-950/80 hover:bg-rose-600 text-white rounded-lg transition-colors"
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
                <span>Anexar foto da instalação</span>
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="hidden" />
          </div>

          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Observações</label>
            <textarea
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              placeholder="Detalhes da instalação, manutenção ou auditoria"
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
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl shadow-md shadow-cyan-600/20 flex items-center gap-2 transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>{editingOrder ? 'Salvar Alterações' : 'Criar Ordem de Serviço'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
