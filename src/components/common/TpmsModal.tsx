import React from 'react';
import { X, Gauge, Thermometer, AlertTriangle } from 'lucide-react';
import { AssetDevice, TireStatus } from '../../types';

export interface TpmsModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: AssetDevice | null;
}

const STATUS_STYLE: Record<TireStatus, string> = {
  normal: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
  low_pressure: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
  high_pressure: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
  fault: 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400',
};

const STATUS_LABEL: Record<TireStatus, string> = {
  normal: 'Normal',
  low_pressure: 'Pressão Baixa',
  high_pressure: 'Pressão Alta',
  fault: 'Falha no Sensor',
};

export const TpmsModal: React.FC<TpmsModalProps> = ({ isOpen, onClose, asset }) => {
  if (!isOpen || !asset) return null;
  const tires = asset.tirePositions || [];
  const withIssue = tires.filter((t) => t.status !== 'normal').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Gauge className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>TPMS — Monitoramento de Pressão dos Pneus</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-900 dark:text-slate-100 font-mono">{asset.plateNumber || asset.code}</div>
              <div className="text-slate-500 dark:text-slate-400 mt-0.5">{asset.name}</div>
            </div>
            {withIssue > 0 ? (
              <span className="flex items-center gap-1.5 px-2 py-1 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 rounded-lg font-bold">
                <AlertTriangle className="w-3.5 h-3.5" /> {withIssue} pneu(s) com alerta
              </span>
            ) : (
              <span className="px-2 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-lg font-bold">
                Todos normais
              </span>
            )}
          </div>

          {tires.length === 0 ? (
            <p className="text-center text-slate-400 dark:text-slate-600 py-6">Nenhum sensor TPMS vinculado a este veículo.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {tires.map((tire) => (
                <div key={tire.position} className={`p-3 rounded-xl border space-y-1.5 ${STATUS_STYLE[tire.status]}`}>
                  <div className="flex items-center justify-between font-bold font-mono">
                    <span>{tire.position}</span>
                    <span className="text-[9px] uppercase">{STATUS_LABEL[tire.status]}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 font-mono">
                    <span className="flex items-center gap-1">
                      <Gauge className="w-3 h-3" /> {tire.pressureKpa} kPa
                    </span>
                    <span className="flex items-center gap-1">
                      <Thermometer className="w-3 h-3" /> {tire.temperatureC}°C
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
