import React, { useEffect, useState } from 'react';
import { X, Save, Cpu, Radio, MapPin, Building, Wifi, ScanLine } from 'lucide-react';
import { AssetDevice, AssetCategory, AssetSubcategory, AssetStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { ASSET_CATEGORY_META } from './AssetIconRegistry';
import { QrScannerModal } from './QrScannerModal';

export interface DeviceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (device: AssetDevice) => void;
  editingDevice?: AssetDevice | null;
  defaultCategory?: AssetCategory;
}

const PROTOCOL_OPTIONS: AssetDevice['protocol'][] = [
  'GT06',
  'Traccar Compatible',
  'Wialon IPS',
  'JT/T808',
  'Suntech',
  'Queclink',
  'MQTT',
  'HTTP',
  'BLE Gateway',
  'Custom',
];

const SUBCATEGORY_OPTIONS: Record<AssetCategory, { value: AssetSubcategory; label: string }[]> = {
  cart: [
    { value: 'supermarket_cart', label: 'Carrinho de Supermercado' },
    { value: 'pcd_cart', label: 'Carrinho Adaptado PCD' },
  ],
  vehicle: [
    { value: 'car', label: 'Carro' },
    { value: 'van', label: 'Van / Furgão' },
    { value: 'pickup', label: 'Caminhonete' },
    { value: 'motorcycle', label: 'Motocicleta' },
  ],
  truck: [{ value: 'truck', label: 'Caminhão' }],
  forklift: [
    { value: 'forklift', label: 'Empilhadeira Contrabalançada' },
    { value: 'reach_truck', label: 'Empilhadeira Retrátil' },
  ],
  bike: [{ value: 'bike', label: 'Bicicleta' }],
  cargo: [{ value: 'cargo_box', label: 'Carga / Contêiner' }],
  asset: [
    { value: 'notebook', label: 'Notebook / Equipamento TI' },
    { value: 'generator', label: 'Gerador' },
    { value: 'freezer', label: 'Freezer / Câmara Fria' },
    { value: 'tool', label: 'Ferramenta' },
    { value: 'machine', label: 'Máquina' },
  ],
  tag: [{ value: 'tag', label: 'Tag BLE Genérica' }],
  agro: [
    { value: 'cattle', label: 'Gado' },
    { value: 'horse', label: 'Cavalo' },
    { value: 'sheep', label: 'Ovino' },
    { value: 'tractor', label: 'Trator' },
  ],
};

const STATUS_OPTIONS: AssetStatus[] = [
  'offline',
  'online',
  'moving',
  'stopped',
  'available',
  'in_use',
  'maintenance',
  'low_battery',
  'out_of_geofence',
];

function emptyDevice(
  clientId: string,
  unitId: string,
  unitName: string,
  category: AssetCategory = 'tag'
): AssetDevice {
  return {
    id: `dev_${Date.now()}`,
    name: '',
    code: '',
    imei: '',
    category,
    subcategory: SUBCATEGORY_OPTIONS[category]?.[0]?.value || 'tag',
    clientId,
    unitId,
    unitName,
    status: 'offline',
    protocol: 'BLE Gateway',
    telemetry: {
      latitude: 0,
      longitude: 0,
      speed: 0,
      batteryLevel: 100,
      signalStrength: 0,
      lastCommunication: 'Nunca comunicou',
      positionSource: 'GPS',
      gpsAccuracy: 8,
    },
    lastMovement: new Date().toISOString().slice(0, 19).replace('T', ' '),
  };
}

export const DeviceFormModal: React.FC<DeviceFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingDevice,
  defaultCategory,
}) => {
  const { availableClients, availableUnits } = useAuth();
  const [form, setForm] = useState<AssetDevice>(() =>
    emptyDevice(
      availableClients[0]?.id || 'cli_1',
      availableUnits[0]?.id || 'unit_1',
      availableUnits[0]?.name || '',
      defaultCategory
    )
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (editingDevice) {
      setForm(editingDevice);
    } else {
      setForm(
        emptyDevice(
          availableClients[0]?.id || 'cli_1',
          availableUnits[0]?.id || 'unit_1',
          availableUnits[0]?.name || '',
          defaultCategory
        )
      );
    }
    setErrors({});
  }, [isOpen, editingDevice]);

  if (!isOpen) return null;

  const clientUnits = availableUnits.filter((u) => u.clientId === form.clientId);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Informe o nome do dispositivo.';
    if (!form.code.trim()) errs.code = 'Informe o código / patrimônio.';
    if (!form.imei.trim()) errs.imei = 'Informe o IMEI ou número de série.';
    if (!form.unitId) errs.unitId = 'Selecione a unidade vinculada.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const unit = availableUnits.find((u) => u.id === form.unitId);
    onSave({ ...form, unitName: unit?.name || form.unitName });
  };

  const subcategoryOptions = SUBCATEGORY_OPTIONS[form.category] || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>{editingDevice ? 'Editar Dispositivo' : 'Cadastrar Novo Dispositivo'}</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5 text-xs">
          {/* Identificação */}
          <div className="space-y-3">
            <div className="text-[10px] font-mono uppercase font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-cyan-500" /> Identificação
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Nome do Dispositivo *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Carrinho de Compras #512"
                  className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500/50 ${
                    errors.name ? 'border-rose-500/60' : 'border-slate-200 dark:border-slate-800'
                  }`}
                />
                {errors.name && <p className="text-rose-500 mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Código / Patrimônio *
                </label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="Ex: CAR-512"
                  className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:border-cyan-500/50 ${
                    errors.code ? 'border-rose-500/60' : 'border-slate-200 dark:border-slate-800'
                  }`}
                />
                {errors.code && <p className="text-rose-500 mt-1">{errors.code}</p>}
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  IMEI / Número de Série (GPS) *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.imei}
                    onChange={(e) => setForm({ ...form, imei: e.target.value })}
                    placeholder="Ex: 869403049102931 ou digite/escaneie o QR do rastreador"
                    className={`flex-1 bg-slate-50 dark:bg-slate-950 border rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:border-cyan-500/50 ${
                      errors.imei ? 'border-rose-500/60' : 'border-slate-200 dark:border-slate-800'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    className="shrink-0 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl flex items-center gap-1.5 font-semibold transition-colors"
                    title="Escanear QR Code do rastreador GT06 ou etiqueta BLE"
                  >
                    <ScanLine className="w-4 h-4" />
                    <span className="hidden sm:inline">Escanear</span>
                  </button>
                </div>
                {errors.imei && <p className="text-rose-500 mt-1">{errors.imei}</p>}
              </div>
            </div>
          </div>

          {/* Categoria e Protocolo */}
          <div className="space-y-3">
            <div className="text-[10px] font-mono uppercase font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5 text-indigo-500" /> Categoria &amp; Protocolo de Comunicação
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Categoria</label>
                <select
                  value={form.category}
                  onChange={(e) => {
                    const category = e.target.value as AssetCategory;
                    const defaultSub = SUBCATEGORY_OPTIONS[category]?.[0]?.value;
                    setForm({ ...form, category, subcategory: defaultSub });
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none"
                >
                  {Object.values(ASSET_CATEGORY_META).map((meta) => (
                    <option key={meta.category} value={meta.category}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Subcategoria</label>
                <select
                  value={form.subcategory}
                  onChange={(e) => setForm({ ...form, subcategory: e.target.value as AssetSubcategory })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none"
                >
                  {subcategoryOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Protocolo de Comunicação / API
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PROTOCOL_OPTIONS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setForm({ ...form, protocol: p })}
                      className={`px-3 py-1.5 rounded-lg font-mono text-[11px] font-semibold transition-colors border ${
                        form.protocol === p
                          ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/40 font-bold'
                          : 'bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Vínculo Organizacional */}
          <div className="space-y-3">
            <div className="text-[10px] font-mono uppercase font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-amber-500" /> Cliente &amp; Unidade
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Cliente</label>
                <select
                  value={form.clientId}
                  onChange={(e) => {
                    const clientId = e.target.value;
                    const firstUnit = availableUnits.find((u) => u.clientId === clientId);
                    setForm({
                      ...form,
                      clientId,
                      unitId: firstUnit?.id || '',
                      unitName: firstUnit?.name || '',
                    });
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
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Unidade Vinculada *
                </label>
                <select
                  value={form.unitId}
                  onChange={(e) => {
                    const unit = availableUnits.find((u) => u.id === e.target.value);
                    setForm({ ...form, unitId: e.target.value, unitName: unit?.name || '' });
                  }}
                  className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none ${
                    errors.unitId ? 'border-rose-500/60' : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <option value="">Selecione...</option>
                  {clientUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                {errors.unitId && <p className="text-rose-500 mt-1">{errors.unitId}</p>}
              </div>
            </div>
          </div>

          {/* Localização Inicial */}
          <div className="space-y-3">
            <div className="text-[10px] font-mono uppercase font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-rose-500" /> Localização &amp; Status Inicial
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Latitude</label>
                <input
                  type="number"
                  step="0.000001"
                  value={form.telemetry.latitude}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      telemetry: { ...form.telemetry, latitude: Number(e.target.value) },
                    })
                  }
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 font-mono focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Longitude</label>
                <input
                  type="number"
                  step="0.000001"
                  value={form.telemetry.longitude}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      telemetry: { ...form.telemetry, longitude: Number(e.target.value) },
                    })
                  }
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 font-mono focus:outline-none"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as AssetStatus })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Modelo</label>
                <input
                  type="text"
                  value={form.model || ''}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  placeholder="Opcional"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none"
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
              <span>{editingDevice ? 'Salvar Alterações' : 'Cadastrar Dispositivo'}</span>
            </button>
          </div>
        </form>
      </div>

      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={(value) => {
          setForm((prev) => ({ ...prev, imei: value }));
          setIsScannerOpen(false);
        }}
      />
    </div>
  );
};
