import React, { useState } from 'react';
import {
  PackageCheck,
  Truck,
  MapPin,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Tag,
  Thermometer,
  CheckCircle2,
  Map as MapIcon,
  Lock,
  Unlock,
  Radio,
  Nfc,
  CreditCard,
  MessageSquare,
  Cloud,
} from 'lucide-react';
import { StatCard } from '../components/common/StatCard';
import { LiveMap } from '../components/map/LiveMap';
import { useAssets } from '../context/AssetContext';
import { useAuth } from '../context/AuthContext';
import { AssetIcon } from '../components/common/AssetIconRegistry';
import { SealTriggerMethod } from '../types';

const SEAL_TRIGGER_OPTIONS: { value: SealTriggerMethod; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'rfid', label: 'RFID', icon: Radio },
  { value: 'nfc', label: 'NFC', icon: Nfc },
  { value: 'registered_card', label: 'Cartão Registrado', icon: CreditCard },
  { value: 'sms', label: 'SMS', icon: MessageSquare },
  { value: 'platform', label: 'Plataforma', icon: Cloud },
];

export const CargoModule: React.FC = () => {
  const { shipments, getFilteredAssets, registerSealEvent } = useAssets();
  const { selectedClientId, selectedUnitId } = useAuth();
  const [showMap, setShowMap] = useState(false);

  const cargoAssets = getFilteredAssets(selectedClientId, selectedUnitId).filter(
    (a) => a.category === 'cargo'
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'em_transito':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'parada':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'entregue':
        return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700';
    }
  };

  const getSealBadge = (status?: string) => {
    switch (status) {
      case 'sealed':
        return { classes: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', label: 'Lacrado', icon: Lock };
      case 'open':
        return { classes: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', label: 'Aberto', icon: Unlock };
      case 'tampered':
        return { classes: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 animate-pulse', label: 'Violado', icon: ShieldAlert };
      default:
        return null;
    }
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100 transition-colors">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs font-mono text-purple-600 dark:text-purple-400 uppercase tracking-widest font-bold flex items-center gap-1">
            <PackageCheck className="w-4 h-4" /> Logística de Cargas
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Monitoramento de Cargas e Remessas Rastreáveis
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Acompanhamento de ponta a ponta com sensores de temperatura, geocercas e previsões ETA.
          </p>
        </div>

        <button
          onClick={() => setShowMap(!showMap)}
          className={`px-3.5 py-2 font-semibold text-xs rounded-xl shadow-md hover:-translate-y-0.5 flex items-center gap-2 transition-all border shrink-0 ${
            showMap
              ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/40'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
          }`}
        >
          <MapIcon className="w-4 h-4" />
          <span>{showMap ? 'Ocultar Mapa' : 'Ver no Mapa'}</span>
        </button>
      </div>

      {showMap && (
        <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
          <LiveMap
            assetsList={cargoAssets}
            heightClass="h-[420px]"
            specializedTitle="Cargas Rastreáveis"
            showClustering={false}
          />
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard title="Cargas Monitoradas" value={shipments.length} icon={PackageCheck} variant="indigo" />
        <StatCard title="Em Trânsito" value="2" icon={Truck} variant="emerald" />
        <StatCard title="Parada Programada" value="1" icon={Clock} variant="amber" />
        <StatCard title="Sensores Frio Ativos" value="100%" icon={Thermometer} variant="cyan" />
      </div>

      {/* Cargo Timeline Cards List */}
      <div className="space-y-4">
        {shipments.map((cargo) => {
          const seal = getSealBadge(cargo.sealStatus);
          return (
          <div
            key={cargo.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
          >
            {/* Header row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 rounded-xl font-mono font-bold">
                  {cargo.code}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{cargo.cargoDescription}</h3>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                    <span>Transportadora: <strong className="text-slate-700 dark:text-slate-200">{cargo.carrier}</strong></span>
                    <span>•</span>
                    <span>Placa: <strong className="text-cyan-600 dark:text-cyan-400 font-mono">{cargo.vehiclePlate}</strong></span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {seal && (
                  <span className={`px-2.5 py-1 text-[10px] font-bold font-mono uppercase rounded-full border flex items-center gap-1 ${seal.classes}`}>
                    <seal.icon className="w-3 h-3" /> {seal.label}
                  </span>
                )}
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">Previsão ETA</div>
                  <div className="text-xs font-bold font-mono text-cyan-600 dark:text-cyan-400">{cargo.eta}</div>
                </div>
                <span className={`px-3 py-1 text-xs font-bold font-mono uppercase rounded-full border ${getStatusBadge(cargo.status)}`}>
                  {cargo.status.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Visual Step Timeline */}
            <div className="py-2">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 flex items-center justify-between">
                <span>Progresso do Transporte ({cargo.progressPercent}%)</span>
                <span className="text-cyan-600 dark:text-cyan-400 font-mono">{cargo.currentLocation}</span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 dark:bg-slate-950 h-2 rounded-full overflow-hidden mb-4 border border-slate-200 dark:border-slate-800">
                <div
                  className="bg-gradient-to-r from-purple-500 to-cyan-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${cargo.progressPercent}%` }}
                />
              </div>

              {/* Steps Icons */}
              <div className="grid grid-cols-6 text-center text-[11px] font-medium text-slate-500 dark:text-slate-400 gap-1">
                <div className="flex flex-col items-center text-cyan-600 dark:text-cyan-400 font-bold">
                  <CheckCircle2 className="w-4 h-4 mb-1" />
                  <span>Origem</span>
                </div>
                <div className="flex flex-col items-center text-cyan-600 dark:text-cyan-400 font-bold">
                  <CheckCircle2 className="w-4 h-4 mb-1" />
                  <span>Coleta</span>
                </div>
                <div className={`flex flex-col items-center ${cargo.progressPercent >= 40 ? 'text-cyan-600 dark:text-cyan-400 font-bold' : ''}`}>
                  <Truck className="w-4 h-4 mb-1" />
                  <span>Em Trânsito</span>
                </div>
                <div className={`flex flex-col items-center ${cargo.status === 'parada' ? 'text-amber-600 dark:text-amber-400 font-bold' : ''}`}>
                  <Clock className="w-4 h-4 mb-1" />
                  <span>Parada</span>
                </div>
                <div className="flex flex-col items-center">
                  <MapPin className="w-4 h-4 mb-1" />
                  <span>Destino</span>
                </div>
                <div className="flex flex-col items-center">
                  <ShieldCheck className="w-4 h-4 mb-1" />
                  <span>Entregue</span>
                </div>
              </div>
            </div>

            {/* Footer Tag sensor information */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 font-mono text-cyan-600 dark:text-cyan-400">
                  <Tag className="w-3.5 h-3.5" /> Sensor Tag: {cargo.tagId}
                </span>
                {cargo.temperatureTarget && (
                  <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                    <Thermometer className="w-3.5 h-3.5" /> {cargo.temperatureTarget}
                  </span>
                )}
              </div>
              <button
                onClick={() => alert(`Visualizando rota em tempo real para a carga ${cargo.code}`)}
                className="text-cyan-600 dark:text-cyan-400 hover:underline font-semibold"
              >
                Rastrear no Mapa →
              </button>
            </div>

            {/* Lacre Eletrônico: simulação de eventos por tecnologia */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400 dark:text-slate-500 mr-1">
                Simular Evento de Lacre:
              </span>
              {SEAL_TRIGGER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => registerSealEvent(cargo.id, 'open', opt.value)}
                  className="px-2.5 py-1 text-[10px] font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-amber-500/15 text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-1 transition-colors"
                  title={`Abrir lacre via ${opt.label}`}
                >
                  <opt.icon className="w-3 h-3" /> {opt.label}
                </button>
              ))}
              <button
                onClick={() => registerSealEvent(cargo.id, 'sealed', 'platform')}
                className="px-2.5 py-1 text-[10px] font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500/15 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1 transition-colors"
                title="Fechar lacre"
              >
                <Lock className="w-3 h-3" /> Lacrar
              </button>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
};
