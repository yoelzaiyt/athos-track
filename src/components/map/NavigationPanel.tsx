import React, { useState } from 'react';
import {
  Navigation2,
  X,
  Car,
  Footprints,
  Bike,
  ExternalLink,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  MapPin,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { AssetDevice } from '../../types';
import {
  RouteResult,
  NavigationProfile,
  formatDistance,
  formatDuration,
} from './RoutingService';

export interface NavigationPanelProps {
  targetAsset: AssetDevice;
  route: RouteResult | null;
  profile: NavigationProfile;
  isCalculating: boolean;
  error: string | null;
  wazeUrl: string;
  googleMapsUrl: string;
  onChangeProfile: (profile: NavigationProfile) => void;
  onRecalculate: () => void;
  onCancel: () => void;
}

const PROFILE_OPTIONS: { id: NavigationProfile; label: string; icon: React.ElementType }[] = [
  { id: 'driving', label: 'Carro / Moto', icon: Car },
  { id: 'walking', label: 'A pé', icon: Footprints },
  { id: 'cycling', label: 'Bicicleta', icon: Bike },
];

export const NavigationPanel: React.FC<NavigationPanelProps> = ({
  targetAsset,
  route,
  profile,
  isCalculating,
  error,
  wazeUrl,
  googleMapsUrl,
  onChangeProfile,
  onRecalculate,
  onCancel,
}) => {
  const [showSteps, setShowSteps] = useState(false);
  const nextStep = route?.steps?.[0];

  return (
    <div className="pointer-events-auto w-full max-w-md mx-auto bg-slate-900/98 border border-slate-800 backdrop-blur-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
      {/* Header: destino e cancelar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-cyan-600/15 border-b border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <Navigation2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] uppercase font-mono font-bold text-cyan-400">Navegar até</div>
            <div className="text-sm font-semibold text-white truncate">
              {targetAsset.name} <span className="text-slate-400 font-mono text-xs">({targetAsset.code})</span>
            </div>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0"
          title="Cancelar navegação"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Seletor de perfil de deslocamento */}
      <div className="flex items-center gap-1.5 px-3 pt-3">
        {PROFILE_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = profile === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onChangeProfile(opt.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-medium transition-colors border ${
                active
                  ? 'bg-cyan-600 text-white border-cyan-500 shadow-md shadow-cyan-600/30'
                  : 'bg-slate-950/90 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{opt.label}</span>
            </button>
          );
        })}
      </div>

      <div className="p-4">
        {isCalculating && (
          <div className="flex items-center justify-center gap-2 py-6 text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
            Calculando rota até o ativo...
          </div>
        )}

        {!isCalculating && error && (
          <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl p-3 mb-1">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!isCalculating && !error && route && (
          <>
            {/* Próxima instrução, estilo Waze */}
            {nextStep && (
              <div className="flex items-center gap-3 bg-slate-950/90 border border-slate-800 rounded-2xl p-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
                  <Navigation2 className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{nextStep.instruction}</div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {formatDistance(nextStep.distanceMeters)}
                  </div>
                </div>
              </div>
            )}

            {/* Distância / ETA totais */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-2.5 text-center">
                <div className="text-[10px] uppercase text-slate-500 font-mono">Distância</div>
                <div className="text-lg font-bold text-white font-mono">
                  {formatDistance(route.distanceMeters)}
                </div>
              </div>
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-2.5 text-center">
                <div className="text-[10px] uppercase text-slate-500 font-mono">Chegada em</div>
                <div className="text-lg font-bold text-emerald-400 font-mono">
                  {formatDuration(route.durationSeconds)}
                </div>
              </div>
            </div>

            {/* Passo a passo colapsável */}
            {route.steps.length > 1 && (
              <button
                onClick={() => setShowSteps(!showSteps)}
                className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 px-1 py-1.5 mb-1"
              >
                <span>Ver passo a passo ({route.steps.length} instruções)</span>
                {showSteps ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}

            {showSteps && (
              <div className="max-h-40 overflow-y-auto space-y-1.5 mb-3 pr-1">
                {route.steps.map((step, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 text-xs text-slate-300 bg-slate-950/60 border border-slate-800/80 rounded-lg px-2.5 py-1.5"
                  >
                    <MapPin className="w-3 h-3 text-cyan-500 shrink-0" />
                    <span className="flex-1 truncate">{step.instruction}</span>
                    <span className="text-slate-500 font-mono text-[10px] shrink-0">
                      {formatDistance(step.distanceMeters)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Ações: recalcular / abrir em apps externos */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={onRecalculate}
                className="flex items-center justify-center gap-1.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700/50 transition-colors"
                title="Recalcular rota"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Atualizar</span>
              </button>

              <a
                href={wazeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 py-2 bg-[#33ccff]/15 hover:bg-[#33ccff]/25 text-[#33ccff] text-xs font-medium rounded-xl border border-[#33ccff]/30 transition-colors"
                title="Abrir no Waze"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Waze</span>
              </a>

              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-medium rounded-xl border border-emerald-500/30 transition-colors"
                title="Abrir no Google Maps"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Maps</span>
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
