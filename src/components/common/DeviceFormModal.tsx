import React, { useEffect, useState } from 'react';
import {
  X,
  Save,
  Cpu,
  Radio,
  MapPin,
  Building,
  Wifi,
  ScanLine,
  Satellite,
  CreditCard,
  Lock,
  Unlock,
  Fuel,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  Loader2,
  Timer,
  Gauge,
  Phone,
  MessageSquare,
  Power,
  Route,
  CircleParking,
  Thermometer,
  Hourglass,
  Vibrate,
  Siren,
  Mail,
  BellRing,
  Bell,
} from 'lucide-react';
import { AssetDevice, AssetCategory, AssetSubcategory, AssetStatus, PositionSource, ScheduledUnlockWindow, FuelTankCalibration, AlertConfig } from '../../types';
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
  'RFID',
  'NFC',
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
  box: [
    { value: 'box', label: 'Caixa Padrão' },
    { value: 'sealed_box', label: 'Caixa Lacrada' },
  ],
  agro: [
    { value: 'cattle', label: 'Gado (Bovino)' },
    { value: 'horse', label: 'Cavalo (Equino)' },
    { value: 'sheep', label: 'Ovino' },
    { value: 'goat', label: 'Caprino' },
    { value: 'buffalo', label: 'Búfalo' },
    { value: 'tractor', label: 'Trator' },
  ],
};

const POSITIONING_SOURCE_OPTIONS: PositionSource[] = ['GPS', 'Wi-Fi', 'LBS', 'BLE Gateway'];

const DAY_LABELS: { value: number; label: string }[] = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

const DEFAULT_ALERT_CONFIG: AlertConfig = {
  transmissionIntervalSeconds: 30,
  alertPhoneNumber: '',
  speedAlertEnabled: false,
  smsEmailNotificationsEnabled: false,
  ignitionAlertEnabled: false,
  routeDeviationAlertEnabled: false,
  parkingAlertEnabled: false,
  temperatureAlertEnabled: false,
  temperatureThresholdC: 8,
  idleAlertEnabled: false,
  idleThresholdMinutes: 10,
  movingAlarmEnabled: false,
  fuelAlertEnabled: false,
  fatigueAlertEnabled: false,
  serviceNotificationsEnabled: false,
  platformAlarmEnabled: false,
};

interface AlertShortcut {
  key: keyof AlertConfig;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ALERT_SHORTCUTS: AlertShortcut[] = [
  { key: 'speedAlertEnabled', label: 'Alerta de Velocidade', icon: Gauge },
  { key: 'ignitionAlertEnabled', label: 'Acionamento de Ignição', icon: Power },
  { key: 'routeDeviationAlertEnabled', label: 'Desvio de Rota', icon: Route },
  { key: 'parkingAlertEnabled', label: 'Alerta de Estacionamento', icon: CircleParking },
  { key: 'temperatureAlertEnabled', label: 'Alerta de Temperatura', icon: Thermometer },
  { key: 'idleAlertEnabled', label: 'Marcha Lenta (Idle)', icon: Hourglass },
  { key: 'movingAlarmEnabled', label: 'Alarme de Movimento', icon: Vibrate },
  { key: 'fuelAlertEnabled', label: 'Alerta de Combustível', icon: Fuel },
  { key: 'fatigueAlertEnabled', label: 'Condução (Fadiga)', icon: Siren },
  { key: 'smsEmailNotificationsEnabled', label: 'Notificação SMS/E-mail', icon: MessageSquare },
  { key: 'serviceNotificationsEnabled', label: 'Notificações de Serviço', icon: Mail },
  { key: 'platformAlarmEnabled', label: 'Alarme da Plataforma', icon: BellRing },
];

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
  const [icBindStep, setIcBindStep] = useState<'idle' | 'waiting' | 'success'>('idle');
  const [windowDraft, setWindowDraft] = useState<{ startTime: string; endTime: string; daysOfWeek: number[] }>({
    startTime: '08:00',
    endTime: '18:00',
    daysOfWeek: [1, 2, 3, 4, 5],
  });

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
    setIcBindStep('idle');
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
  const showFleetControls = form.category === 'vehicle' || form.category === 'truck';

  const alertConfig: AlertConfig = { ...DEFAULT_ALERT_CONFIG, ...form.alertConfig };

  const updateAlertConfig = (updates: Partial<AlertConfig>) => {
    setForm((prev) => ({ ...prev, alertConfig: { ...DEFAULT_ALERT_CONFIG, ...prev.alertConfig, ...updates } }));
  };

  const toggleAlertShortcut = (key: keyof AlertConfig) => {
    updateAlertConfig({ [key]: !alertConfig[key] } as Partial<AlertConfig>);
  };

  const togglePositioningSource = (source: PositionSource) => {
    setForm((prev) => {
      const current = prev.positioningPriority || [];
      const next = current.includes(source) ? current.filter((s) => s !== source) : [...current, source];
      return { ...prev, positioningPriority: next };
    });
  };

  const handleBindCard = () => {
    setIcBindStep('waiting');
    setTimeout(() => {
      const cardId = `IC-CARD-${Math.floor(10000 + Math.random() * 89999)}`;
      setForm((prev) => ({
        ...prev,
        doorLockCardId: cardId,
        doorLockCardBoundAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      }));
      setIcBindStep('success');
    }, 1800);
  };

  const handleUnbindCard = () => {
    setForm((prev) => ({ ...prev, doorLockCardId: undefined, doorLockCardBoundAt: undefined }));
    setIcBindStep('idle');
  };

  const toggleDraftDay = (day: number) => {
    setWindowDraft((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day].sort((a, b) => a - b),
    }));
  };

  const addUnlockWindow = () => {
    if (windowDraft.daysOfWeek.length === 0) return;
    const newWindow: ScheduledUnlockWindow = {
      id: `unl_${Date.now()}`,
      startTime: windowDraft.startTime,
      endTime: windowDraft.endTime,
      daysOfWeek: windowDraft.daysOfWeek,
    };
    setForm((prev) => ({
      ...prev,
      scheduledUnlockWindows: [...(prev.scheduledUnlockWindows || []), newWindow],
    }));
  };

  const removeUnlockWindow = (id: string) => {
    setForm((prev) => ({
      ...prev,
      scheduledUnlockWindows: (prev.scheduledUnlockWindows || []).filter((w) => w.id !== id),
    }));
  };

  const emptyAdCurve = (): FuelTankCalibration['adCurve'] => [
    { fraction: '1/4', adValue: 0 },
    { fraction: '1/2', adValue: 0 },
    { fraction: '3/4', adValue: 0 },
    { fraction: 'cheio', adValue: 0 },
  ];

  const getTank = (n: 1 | 2): FuelTankCalibration | undefined =>
    form.telemetry.fuelTanks?.find((t) => t.tankNumber === n);

  const updateTank = (n: 1 | 2, updates: Partial<FuelTankCalibration>) => {
    setForm((prev) => {
      const tanks = prev.telemetry.fuelTanks || [];
      const existing = tanks.find((t) => t.tankNumber === n);
      const base: FuelTankCalibration = existing || {
        tankNumber: n,
        capacityLiters: 0,
        volumeLiters: 0,
        percent: 0,
        adCurve: emptyAdCurve(),
      };
      const updatedTank = { ...base, ...updates };
      const others = tanks.filter((t) => t.tankNumber !== n);
      return {
        ...prev,
        telemetry: {
          ...prev.telemetry,
          fuelTanks: [...others, updatedTank].sort((a, b) => a.tankNumber - b.tankNumber),
        },
      };
    });
  };

  const removeTank = (n: 1 | 2) => {
    setForm((prev) => ({
      ...prev,
      telemetry: { ...prev.telemetry, fuelTanks: (prev.telemetry.fuelTanks || []).filter((t) => t.tankNumber !== n) },
    }));
  };

  const updateTankAd = (n: 1 | 2, fraction: FuelTankCalibration['adCurve'][number]['fraction'], adValue: number) => {
    const curve = getTank(n)?.adCurve || emptyAdCurve();
    updateTank(n, { adCurve: curve.map((p) => (p.fraction === fraction ? { ...p, adValue } : p)) });
  };

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

          {/* Cascata de Posicionamento */}
          <div className="space-y-3">
            <div className="text-[10px] font-mono uppercase font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Satellite className="w-3.5 h-3.5 text-emerald-500" /> Cascata de Posicionamento (Fallback)
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Selecione, na ordem desejada, as fontes de posicionamento usadas quando a principal falhar (ex: GPS →
              Wi-Fi → LBS / estação-base).
            </p>
            <div className="flex flex-wrap gap-1.5">
              {POSITIONING_SOURCE_OPTIONS.map((source) => {
                const order = (form.positioningPriority || []).indexOf(source);
                const active = order !== -1;
                return (
                  <button
                    key={source}
                    type="button"
                    onClick={() => togglePositioningSource(source)}
                    className={`px-3 py-1.5 rounded-lg font-mono text-[11px] font-semibold transition-colors border flex items-center gap-1.5 ${
                      active
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 font-bold'
                        : 'bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {active && (
                      <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] flex items-center justify-center font-bold">
                        {order + 1}
                      </span>
                    )}
                    {source}
                  </button>
                );
              })}
            </div>
            {(form.positioningPriority?.length || 0) > 0 && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                Ordem ativa: {(form.positioningPriority || []).join(' > ')}
              </p>
            )}
          </div>

          {/* Atalhos de Alertas — grade de toggles por dispositivo */}
          <div className="space-y-3">
            <div className="text-[10px] font-mono uppercase font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-cyan-500" /> Atalhos de Alertas &amp; Notificações
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5 text-slate-400" /> Intervalo de Transmissão (s)
                </label>
                <input
                  type="number"
                  min={5}
                  value={alertConfig.transmissionIntervalSeconds}
                  onChange={(e) => updateAlertConfig({ transmissionIntervalSeconds: Number(e.target.value) })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" /> Telefone para Alertas
                </label>
                <input
                  type="text"
                  value={alertConfig.alertPhoneNumber}
                  onChange={(e) => updateAlertConfig({ alertPhoneNumber: e.target.value })}
                  placeholder="Opcional"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {ALERT_SHORTCUTS.map(({ key, label, icon: Icon }) => {
                const active = Boolean(alertConfig[key]);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleAlertShortcut(key)}
                    aria-pressed={active}
                    className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-colors ${
                      active
                        ? 'bg-cyan-500/15 border-cyan-500/40'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <span
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                        active ? 'bg-cyan-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <span
                      className={`text-[10px] leading-tight font-semibold ${
                        active ? 'text-cyan-700 dark:text-cyan-300' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {label}
                    </span>
                    <span
                      className={`text-[9px] font-mono font-bold uppercase tracking-wide ${
                        active ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-slate-600'
                      }`}
                    >
                      {active ? 'Ativo' : 'Inativo'}
                    </span>
                  </button>
                );
              })}
            </div>

            {(alertConfig.temperatureAlertEnabled || alertConfig.idleAlertEnabled) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {alertConfig.temperatureAlertEnabled && (
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Limite de Temperatura (°C)
                    </label>
                    <input
                      type="number"
                      value={alertConfig.temperatureThresholdC}
                      onChange={(e) => updateAlertConfig({ temperatureThresholdC: Number(e.target.value) })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                )}
                {alertConfig.idleAlertEnabled && (
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Limite de Marcha Lenta (min)
                    </label>
                    <input
                      type="number"
                      value={alertConfig.idleThresholdMinutes}
                      onChange={(e) => updateAlertConfig({ idleThresholdMinutes: Number(e.target.value) })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Controles de Frota: Trava com Cartão IC + Auto-Destrava + Multi-Tanque */}
          {showFleetControls && (
            <>
              <div className="space-y-3">
                <div className="text-[10px] font-mono uppercase font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-violet-500" /> Trava de Porta — Cartão IC de Proximidade
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 space-y-2.5">
                  {form.doorLockCardId ? (
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-bold font-mono">
                          <Lock className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                          {form.doorLockCardId}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                          Vinculado em {form.doorLockCardBoundAt}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleUnbindCard}
                        className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        Desvincular
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                        {icBindStep === 'waiting'
                          ? 'Aguardando aproximação do cartão IC do leitor... (bipe rápido)'
                          : 'Nenhum cartão IC vinculado à trava de porta.'}
                      </p>
                      <button
                        type="button"
                        onClick={handleBindCard}
                        disabled={icBindStep === 'waiting'}
                        className="shrink-0 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white rounded-lg font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        {icBindStep === 'waiting' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CreditCard className="w-3.5 h-3.5" />
                        )}
                        {icBindStep === 'waiting' ? 'Vinculando...' : 'Vincular Cartão'}
                      </button>
                    </div>
                  )}
                  {icBindStep === 'success' && (
                    <p className="text-emerald-600 dark:text-emerald-400 text-[10px] flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Bipe longo seguido de bipes rápidos — vínculo concluído com sucesso.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-[10px] font-mono uppercase font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-cyan-500" /> Automação de Trava
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 space-y-3">
                  <label className="flex items-center justify-between text-slate-600 dark:text-slate-300 cursor-pointer">
                    <span>Destravar automaticamente ao entrar na cerca virtual</span>
                    <input
                      type="checkbox"
                      checked={form.autoUnlockOnGeofenceEntry || false}
                      onChange={(e) => setForm({ ...form, autoUnlockOnGeofenceEntry: e.target.checked })}
                      className="accent-cyan-500 w-4 h-4 rounded"
                    />
                  </label>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 space-y-2">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Janelas de Destrava Programada</span>
                    {(form.scheduledUnlockWindows || []).map((w) => (
                      <div
                        key={w.id}
                        className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5"
                      >
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {w.startTime}–{w.endTime} · {w.daysOfWeek.map((d) => DAY_LABELS[d].label).join(', ')}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeUnlockWindow(w.id)}
                          className="text-slate-400 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="time"
                        value={windowDraft.startTime}
                        onChange={(e) => setWindowDraft((prev) => ({ ...prev, startTime: e.target.value }))}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-slate-900 dark:text-slate-200"
                      />
                      <span className="text-slate-400">até</span>
                      <input
                        type="time"
                        value={windowDraft.endTime}
                        onChange={(e) => setWindowDraft((prev) => ({ ...prev, endTime: e.target.value }))}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-slate-900 dark:text-slate-200"
                      />
                      <div className="flex items-center gap-1">
                        {DAY_LABELS.map((d) => (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() => toggleDraftDay(d.value)}
                            className={`w-7 h-7 rounded-lg text-[10px] font-bold transition-colors ${
                              windowDraft.daysOfWeek.includes(d.value)
                                ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40'
                                : 'bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            {d.label[0]}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={addUnlockWindow}
                        className="ml-auto px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Adicionar
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-[10px] font-mono uppercase font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                  <Fuel className="w-3.5 h-3.5 text-amber-500" /> Calibração Multi-Tanque de Combustível
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([1, 2] as const).map((n) => {
                    const tank = getTank(n);
                    return (
                      <div
                        key={n}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-700 dark:text-slate-200">Tanque {n}</span>
                          {tank ? (
                            <button
                              type="button"
                              onClick={() => removeTank(n)}
                              className="text-slate-400 hover:text-rose-500 transition-colors"
                              title={`Remover Tanque ${n}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => updateTank(n, {})}
                              className="text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> Ativar
                            </button>
                          )}
                        </div>
                        {tank && (
                          <>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-slate-500 dark:text-slate-400 mb-0.5">Capacidade (L)</label>
                                <input
                                  type="number"
                                  value={tank.capacityLiters}
                                  onChange={(e) => updateTank(n, { capacityLiters: Number(e.target.value) })}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 font-mono text-slate-900 dark:text-slate-200"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 dark:text-slate-400 mb-0.5">Volume Atual (L)</label>
                                <input
                                  type="number"
                                  value={tank.volumeLiters}
                                  onChange={(e) => {
                                    const vol = Number(e.target.value);
                                    const pct = tank.capacityLiters > 0 ? Math.round((vol / tank.capacityLiters) * 100) : 0;
                                    updateTank(n, { volumeLiters: vol, percent: pct });
                                  }}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 font-mono text-slate-900 dark:text-slate-200"
                                />
                              </div>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">Curva AD por fração ({tank.percent}% atual)</span>
                              <div className="grid grid-cols-4 gap-1.5 mt-1">
                                {tank.adCurve.map((p) => (
                                  <div key={p.fraction}>
                                    <label className="block text-[9px] text-slate-400 dark:text-slate-500 text-center mb-0.5">
                                      {p.fraction}
                                    </label>
                                    <input
                                      type="number"
                                      value={p.adValue}
                                      onChange={(e) => updateTankAd(n, p.fraction, Number(e.target.value))}
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-1.5 py-1 font-mono text-center text-slate-900 dark:text-slate-200"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-[10px] font-mono uppercase font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-indigo-500" /> Câmeras &amp; Captura Agendada de Foto
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 space-y-3">
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Nº de Canais de Câmera</label>
                    <input
                      type="number"
                      min={0}
                      max={8}
                      value={form.cameraChannelsCount ?? 0}
                      onChange={(e) => setForm({ ...form, cameraChannelsCount: Number(e.target.value) })}
                      className="w-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 font-mono text-slate-900 dark:text-slate-200 focus:outline-none"
                    />
                  </div>

                  <label className="flex items-center justify-between text-slate-600 dark:text-slate-300 cursor-pointer pt-2 border-t border-slate-200 dark:border-slate-800/80">
                    <span>Captura de foto agendada (diferente do snapshot único)</span>
                    <input
                      type="checkbox"
                      checked={form.scheduledPhotoCapture?.enabled || false}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          scheduledPhotoCapture: {
                            enabled: e.target.checked,
                            intervalMinutes: form.scheduledPhotoCapture?.intervalMinutes || 15,
                            onlyWhenIgnitionOn: form.scheduledPhotoCapture?.onlyWhenIgnitionOn ?? true,
                            fromTime: form.scheduledPhotoCapture?.fromTime || '06:00',
                            toTime: form.scheduledPhotoCapture?.toTime || '20:00',
                          },
                        })
                      }
                      className="accent-indigo-500 w-4 h-4 rounded"
                    />
                  </label>

                  {form.scheduledPhotoCapture?.enabled && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-slate-500 dark:text-slate-400 mb-0.5">Intervalo (min)</label>
                        <input
                          type="number"
                          value={form.scheduledPhotoCapture.intervalMinutes}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              scheduledPhotoCapture: { ...form.scheduledPhotoCapture!, intervalMinutes: Number(e.target.value) },
                            })
                          }
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 font-mono text-slate-900 dark:text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-500 dark:text-slate-400 mb-0.5">De</label>
                        <input
                          type="time"
                          value={form.scheduledPhotoCapture.fromTime}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              scheduledPhotoCapture: { ...form.scheduledPhotoCapture!, fromTime: e.target.value },
                            })
                          }
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-slate-900 dark:text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-500 dark:text-slate-400 mb-0.5">Até</label>
                        <input
                          type="time"
                          value={form.scheduledPhotoCapture.toTime}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              scheduledPhotoCapture: { ...form.scheduledPhotoCapture!, toTime: e.target.value },
                            })
                          }
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-slate-900 dark:text-slate-200"
                        />
                      </div>
                      <label className="flex flex-col items-start justify-end gap-1 cursor-pointer">
                        <span className="text-slate-500 dark:text-slate-400">Só c/ ignição ligada</span>
                        <input
                          type="checkbox"
                          checked={form.scheduledPhotoCapture.onlyWhenIgnitionOn}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              scheduledPhotoCapture: { ...form.scheduledPhotoCapture!, onlyWhenIgnitionOn: e.target.checked },
                            })
                          }
                          className="accent-indigo-500 w-4 h-4 rounded"
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </>
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
