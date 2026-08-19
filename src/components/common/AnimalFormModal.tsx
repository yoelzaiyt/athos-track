import React, { useEffect, useState } from 'react';
import { X, Save, PawPrint, Tag, Radio, AlertTriangle } from 'lucide-react';
import { Animal, AnimalSpecies, AnimalSex, AnimalStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useAssets } from '../../context/AssetContext';

export interface AnimalFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (animal: Animal) => void;
  editingAnimal?: Animal | null;
}

const SPECIES_OPTIONS: { value: AnimalSpecies; label: string }[] = [
  { value: 'bovino', label: 'Bovino' },
  { value: 'ovino', label: 'Ovino' },
  { value: 'caprino', label: 'Caprino' },
  { value: 'equino', label: 'Equino' },
  { value: 'outro', label: 'Outro' },
];
const SEX_OPTIONS: { value: AnimalSex; label: string }[] = [
  { value: 'macho', label: 'Macho' },
  { value: 'femea', label: 'Fêmea' },
];
const STATUS_OPTIONS: { value: AnimalStatus; label: string }[] = [
  { value: 'active', label: 'Ativo no rebanho' },
  { value: 'sold', label: 'Vendido' },
  { value: 'deceased', label: 'Óbito' },
  { value: 'transferred', label: 'Transferido' },
];

function emptyAnimal(clientId: string, unitId: string, unitName: string): Animal {
  return {
    id: `animal_${Date.now()}`,
    athosTagCode: '',
    species: 'bovino',
    sex: 'femea',
    clientId,
    unitId,
    unitName,
    status: 'active',
  };
}

export const AnimalFormModal: React.FC<AnimalFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingAnimal,
}) => {
  const { availableClients, availableUnits } = useAuth();
  const { assets, animals } = useAssets();
  const [form, setForm] = useState<Animal>(() =>
    emptyAnimal(availableClients[0]?.id || 'cli_1', availableUnits[0]?.id || 'unit_1', availableUnits[0]?.name || '')
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    if (editingAnimal) {
      setForm(editingAnimal);
    } else {
      setForm(
        emptyAnimal(availableClients[0]?.id || 'cli_1', availableUnits[0]?.id || 'unit_1', availableUnits[0]?.name || '')
      );
    }
    setErrors({});
  }, [isOpen, editingAnimal]);

  if (!isOpen) return null;

  const clientUnits = availableUnits.filter((u) => u.clientId === form.clientId);

  // Coleiras/dispositivos agro disponíveis: já vinculados a este animal
  // (edição) ou ainda não vinculados a nenhum outro animal.
  const assignedElsewhere = new Set(
    animals.filter((a) => a.id !== form.id).map((a) => a.assignedDeviceId).filter(Boolean)
  );
  const availableDevices = assets.filter(
    (d) => d.category === 'agro' && (!assignedElsewhere.has(d.id) || d.id === form.assignedDeviceId)
  );
  const isSwappingDevice =
    !!editingAnimal?.assignedDeviceId && form.assignedDeviceId !== editingAnimal.assignedDeviceId;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.athosTagCode.trim()) errs.athosTagCode = 'Informe o ID ATHOS do animal.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const unit = availableUnits.find((u) => u.id === form.unitId);
    const device = assets.find((a) => a.id === form.assignedDeviceId);
    onSave({
      ...form,
      unitName: unit?.name || form.unitName,
      assignedDeviceCode: device?.code,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <PawPrint className="w-4 h-4 text-lime-600 dark:text-lime-400" />
            <span>{editingAnimal ? 'Editar Animal' : 'Cadastrar Novo Animal'}</span>
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
              <Tag className="w-3.5 h-3.5 text-lime-500" /> Identificação
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">ID ATHOS *</label>
                <input
                  type="text"
                  value={form.athosTagCode}
                  onChange={(e) => setForm({ ...form, athosTagCode: e.target.value })}
                  placeholder="Ex: AGT-0001"
                  className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:border-lime-500/50 ${
                    errors.athosTagCode ? 'border-rose-500/60' : 'border-slate-200 dark:border-slate-800'
                  }`}
                />
                {errors.athosTagCode && <p className="text-rose-500 mt-1">{errors.athosTagCode}</p>}
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Brinco Auricular</label>
                <input
                  type="text"
                  value={form.earTagId || ''}
                  onChange={(e) => setForm({ ...form, earTagId: e.target.value })}
                  placeholder="Ex: BR-778812"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 font-mono focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Nome (opcional)</label>
                <input
                  type="text"
                  value={form.name || ''}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Espécie</label>
                <select
                  value={form.species}
                  onChange={(e) => setForm({ ...form, species: e.target.value as AnimalSpecies })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none"
                >
                  {SPECIES_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Sexo</label>
                <select
                  value={form.sex}
                  onChange={(e) => setForm({ ...form, sex: e.target.value as AnimalSex })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none"
                >
                  {SEX_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Raça</label>
                <input
                  type="text"
                  value={form.breed || ''}
                  onChange={(e) => setForm({ ...form, breed: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Peso (kg)</label>
                <input
                  type="number"
                  min={0}
                  value={form.weightKg ?? ''}
                  onChange={(e) => setForm({ ...form, weightKg: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 font-mono focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Data de Nascimento</label>
                <input
                  type="date"
                  value={form.birthDate || ''}
                  onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 font-mono focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Lote</label>
                <input
                  type="text"
                  value={form.batchName || ''}
                  onChange={(e) => setForm({ ...form, batchName: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-[10px] font-mono uppercase font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-cyan-500" /> Coleira / Dispositivo de Rastreamento
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Coleira Vinculada</label>
              <select
                value={form.assignedDeviceId || ''}
                onChange={(e) => setForm({ ...form, assignedDeviceId: e.target.value || undefined })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none"
              >
                <option value="">Sem coleira vinculada</option>
                {availableDevices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
            {isSwappingDevice && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  Trocar a coleira não apaga o histórico do animal — a trajetória e os alertas anteriores
                  continuam vinculados a este mesmo ID ATHOS.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="text-[10px] font-mono uppercase font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <PawPrint className="w-3.5 h-3.5 text-lime-500" /> Propriedade &amp; Status
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
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Fazenda / Unidade</label>
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
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Proprietário</label>
                <input
                  type="text"
                  value={form.ownerName || ''}
                  onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as AnimalStatus })}
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
              className="px-4 py-2 bg-lime-600 hover:bg-lime-500 text-white font-semibold rounded-xl shadow-md shadow-lime-600/20 flex items-center gap-2 transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>{editingAnimal ? 'Salvar Alterações' : 'Cadastrar Animal'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
