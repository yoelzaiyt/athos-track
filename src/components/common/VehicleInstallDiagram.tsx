import React from 'react';
import { MapPinned } from 'lucide-react';
import { InstallationPoint } from '../../types';

/**
 * Pontos de referência física no desenho da carroceria do veículo, usados pelo técnico
 * para documentar onde o rastreador foi instalado/camuflado (inspirado no fluxo de
 * instalação de plataformas GPS white-label: diagrama numerado da carroceria).
 */
export const INSTALLATION_POINTS: InstallationPoint[] = [
  { id: 'pt_17_bumper_front', pointCode: '17', label: 'Para-choque dianteiro', xPercent: 8, yPercent: 62 },
  { id: 'pt_18_fender', pointCode: '18', label: 'Paralamas (esq./dir.)', xPercent: 22, yPercent: 40 },
  { id: 'pt_19_pillar_a', pointCode: '19', label: 'Coluna A', xPercent: 40, yPercent: 22 },
  { id: 'pt_20_obd', pointCode: '20', label: 'Porta OBD (sob o painel)', xPercent: 48, yPercent: 55 },
  { id: 'pt_21_dash', pointCode: '21', label: 'Atrás do painel central', xPercent: 55, yPercent: 45 },
  { id: 'pt_22_pillar_b', pointCode: '22', label: 'Coluna B', xPercent: 62, yPercent: 22 },
  { id: 'pt_23_seat', pointCode: '23', label: 'Sob o banco do motorista', xPercent: 58, yPercent: 65 },
  { id: 'pt_24_trunk', pointCode: '24', label: 'Porta-malas / caçamba', xPercent: 85, yPercent: 40 },
  { id: 'pt_25_bumper_rear', pointCode: '25', label: 'Para-choque traseiro', xPercent: 93, yPercent: 62 },
];

interface VehicleInstallDiagramProps {
  selectedPointId?: string | null;
  onSelectPoint?: (pointId: string) => void;
  readOnly?: boolean;
}

export const VehicleInstallDiagram: React.FC<VehicleInstallDiagramProps> = ({
  selectedPointId,
  onSelectPoint,
  readOnly = false,
}) => {
  const selectedPoint = INSTALLATION_POINTS.find((p) => p.id === selectedPointId);

  return (
    <div className="space-y-2">
      <div className="relative w-full aspect-[2/1] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <svg viewBox="0 0 200 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
          {/* Carroceria (perfil lateral simplificado) */}
          <path
            d="M12,70 L18,46 Q28,30 52,30 L78,30 Q88,14 110,14 L138,14 Q154,14 160,30 L176,30 Q192,33 192,48 L192,70 Z"
            className="fill-slate-200 dark:fill-slate-800 stroke-slate-400 dark:stroke-slate-600"
            strokeWidth={1.5}
          />
          {/* Vidros */}
          <path
            d="M60,30 L85,30 L93,17 L110,17 L110,30 M138,30 L138,17 L154,17 L160,30"
            className="fill-none stroke-slate-400 dark:stroke-slate-600"
            strokeWidth={1.2}
          />
          {/* Rodas */}
          <circle cx="50" cy="74" r="11" className="fill-slate-700 dark:fill-slate-900 stroke-slate-400 dark:stroke-slate-600" strokeWidth={1} />
          <circle cx="152" cy="74" r="11" className="fill-slate-700 dark:fill-slate-900 stroke-slate-400 dark:stroke-slate-600" strokeWidth={1} />
        </svg>

        {INSTALLATION_POINTS.map((point) => {
          const isSelected = point.id === selectedPointId;
          return (
            <button
              key={point.id}
              type="button"
              disabled={readOnly}
              title={point.label}
              onClick={() => onSelectPoint?.(point.id)}
              style={{ left: `${point.xPercent}%`, top: `${point.yPercent}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-[10px] font-bold font-mono flex items-center justify-center border-2 transition-all ${
                isSelected
                  ? 'bg-cyan-500 border-cyan-300 text-white scale-125 shadow-lg shadow-cyan-500/40 z-10'
                  : 'bg-white dark:bg-slate-900 border-amber-500/60 text-amber-600 dark:text-amber-400 hover:scale-110'
              } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
            >
              {point.pointCode}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
        <MapPinned className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
        {selectedPoint ? (
          <span>
            Ponto <strong className="text-slate-700 dark:text-slate-200">{selectedPoint.pointCode}</strong> — {selectedPoint.label}
          </span>
        ) : (
          <span>{readOnly ? 'Nenhum ponto de instalação registrado.' : 'Clique em um ponto numerado para marcar onde o rastreador foi instalado.'}</span>
        )}
      </div>
    </div>
  );
};
