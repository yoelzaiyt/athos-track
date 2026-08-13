import React, { useEffect, useState } from 'react';
import { X, Save, Route, Navigation2, AlertTriangle } from 'lucide-react';
import { TripRecord, TripStatus, AssetDevice, Driver, RouteTemplate } from '../../types';

export interface TripFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (trip: TripRecord) => void;
  editingTrip?: TripRecord | null;
  vehicles: AssetDevice[];
  drivers: Driver[];
  routeTemplates?: RouteTemplate[];
}

const STATUS_OPTIONS: { value: TripStatus; label: string }[] = [
  { value: 'planejada', label: 'Planejada' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'concluida', label: 'Concluída' },
];

function emptyTrip(vehicle?: AssetDevice): TripRecord {
  return {
    id: `trp_${Date.now()}`,
    vehicleId: vehicle?.id || '',
    vehiclePlate: vehicle?.plateNumber || vehicle?.code || '',
    vehicleName: vehicle?.name || '',
    driverName: vehicle?.driverName || '',
    origin: '',
    destination: '',
    startTime: new Date().toISOString().slice(0, 16).replace('T', ' '),
    distanceKm: 0,
    avgSpeedKmh: 0,
    maxSpeedKmh: 0,
    status: 'planejada',
  };
}

export const TripFormModal: React.FC<TripFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingTrip,
  vehicles,
  drivers,
  routeTemplates = [],
}) => {
  const [form, setForm] = useState<TripRecord>(() => emptyTrip(vehicles[0]));
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    setForm(editingTrip || emptyTrip(vehicles[0]));
    setErrors({});
  }, [isOpen, editingTrip]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.vehicleId) errs.vehicleId = 'Selecione o veículo.';
    if (!form.origin.trim()) errs.origin = 'Informe a origem.';
    if (!form.destination.trim()) errs.destination = 'Informe o destino.';
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
            <Route className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>{editingTrip ? 'Editar Viagem' : 'Registrar Nova Viagem'}</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
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
                    driverName: v?.driverName || form.driverName,
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

            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Motorista</label>
              <select
                value={form.driverId || ''}
                onChange={(e) => {
                  const d = drivers.find((drv) => drv.id === e.target.value);
                  setForm({ ...form, driverId: e.target.value || undefined, driverName: d?.name || form.driverName });
                }}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none"
              >
                <option value="">{form.driverName || 'Selecione...'}</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Origem *</label>
              <input
                type="text"
                value={form.origin}
                onChange={(e) => setForm({ ...form, origin: e.target.value })}
                className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none ${
                  errors.origin ? 'border-rose-500/60' : 'border-slate-200 dark:border-slate-800'
                }`}
              />
              {errors.origin && <p className="text-rose-500 mt-1">{errors.origin}</p>}
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Destino *</label>
              <input
                type="text"
                value={form.destination}
                onChange={(e) => setForm({ ...form, destination: e.target.value })}
                className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none ${
                  errors.destination ? 'border-rose-500/60' : 'border-slate-200 dark:border-slate-800'
                }`}
              />
              {errors.destination && <p className="text-rose-500 mt-1">{errors.destination}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Distância (km)</label>
              <input
                type="number"
                value={form.distanceKm}
                onChange={(e) => setForm({ ...form, distanceKm: Number(e.target.value) })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 font-mono focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Vel. Média</label>
              <input
                type="number"
                value={form.avgSpeedKmh}
                onChange={(e) => setForm({ ...form, avgSpeedKmh: Number(e.target.value) })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 font-mono focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Vel. Máxima</label>
              <input
                type="number"
                value={form.maxSpeedKmh}
                onChange={(e) => setForm({ ...form, maxSpeedKmh: Number(e.target.value) })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 font-mono focus:outline-none"
              />
            </div>
          </div>

          {routeTemplates.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 space-y-2.5">
              <span className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <Navigation2 className="w-3.5 h-3.5 text-indigo-500" /> Modelo de Rota (Yaw / Desvio)
              </span>
              <select
                value={form.routeTemplateId || ''}
                onChange={(e) => {
                  const tpl = routeTemplates.find((t) => t.id === e.target.value);
                  setForm({
                    ...form,
                    routeTemplateId: e.target.value || undefined,
                    origin: tpl?.origin || form.origin,
                    destination: tpl?.destination || form.destination,
                    distanceKm: tpl?.estDistanceKm ?? form.distanceKm,
                  });
                }}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none"
              >
                <option value="">Nenhum (rota livre)</option>
                {routeTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {form.routeTemplateId && (
                <label className="flex items-center justify-between text-slate-600 dark:text-slate-300 cursor-pointer pt-1">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Desvio de rota detectado (Yaw)
                  </span>
                  <input
                    type="checkbox"
                    checked={form.deviationDetected || false}
                    onChange={(e) => setForm({ ...form, deviationDetected: e.target.checked })}
                    className="accent-amber-500 w-4 h-4 rounded"
                  />
                </label>
              )}
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Status da Viagem</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as TripStatus })}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
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
              <span>{editingTrip ? 'Salvar Alterações' : 'Registrar Viagem'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
