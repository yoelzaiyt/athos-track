import React, { useEffect, useState } from 'react';
import {
  X,
  TerminalSquare,
  Volume2,
  RotateCw,
  DownloadCloud,
  ShieldAlert,
  Gauge,
  Clock,
  Timer,
  Users,
  CheckCircle2,
} from 'lucide-react';
import { AssetDevice } from '../../types';
import { useAssets } from '../../context/AssetContext';

export interface RemoteCommandsModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: AssetDevice | null;
}

const REPORT_INTERVAL_OPTIONS = ['10s (ACC ligado)', '30s (ACC ligado)', '5min (ACC desligado)', '30min (ACC desligado)'];
const TIMEZONE_OPTIONS = ['UTC-03:00 (Brasília)', 'UTC-04:00 (Amazonas)', 'UTC-05:00 (Acre)', 'UTC+00:00'];

export const RemoteCommandsModal: React.FC<RemoteCommandsModalProps> = ({ isOpen, onClose, asset }) => {
  const { sendRemoteCommand, calibrateOdometer, pushOfflineWhitelist, updateAsset } = useAssets();
  const [odometerDraft, setOdometerDraft] = useState('');
  const [speedThresholdDraft, setSpeedThresholdDraft] = useState('');
  const [reportInterval, setReportInterval] = useState(REPORT_INTERVAL_OPTIONS[0]);
  const [timezone, setTimezone] = useState(TIMEZONE_OPTIONS[0]);

  useEffect(() => {
    if (!isOpen || !asset) return;
    setOdometerDraft(String(asset.telemetry.odometer ?? ''));
    setSpeedThresholdDraft(String(asset.speedLimitKmh ?? ''));
  }, [isOpen, asset]);

  if (!isOpen || !asset) return null;

  const runInstantCommand = (command: string, label: string) => {
    sendRemoteCommand(asset.id, command, label);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <TerminalSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Comandos Remotos Operacionais</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
            <div className="font-bold text-slate-900 dark:text-slate-100 font-mono">{asset.plateNumber || asset.code}</div>
            <div className="text-slate-500 dark:text-slate-400 mt-0.5">{asset.name}</div>
            {asset.lastRemoteCommand && (
              <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Último comando: <strong>{asset.lastRemoteCommand.label}</strong> ({asset.lastRemoteCommand.command}) — {asset.lastRemoteCommand.sentAt}
              </div>
            )}
          </div>

          {/* Calibração de Odômetro */}
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 space-y-2">
            <span className="font-semibold text-slate-600 dark:text-slate-300">Calibração de Odômetro (comando 6B)</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={odometerDraft}
                onChange={(e) => setOdometerDraft(e.target.value)}
                className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 font-mono text-slate-900 dark:text-slate-200 focus:outline-none"
              />
              <span className="text-slate-400">km</span>
              <button
                type="button"
                onClick={() => calibrateOdometer(asset.id, Number(odometerDraft) || 0)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold transition-colors"
              >
                Aplicar
              </button>
            </div>
          </div>

          {/* Threshold de Velocidade */}
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 space-y-2">
            <span className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5" /> Threshold de Velocidade para Alarme (comando 3F)
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={speedThresholdDraft}
                onChange={(e) => setSpeedThresholdDraft(e.target.value)}
                className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 font-mono text-slate-900 dark:text-slate-200 focus:outline-none"
              />
              <span className="text-slate-400">km/h</span>
              <button
                type="button"
                onClick={() => {
                  updateAsset(asset.id, { speedLimitKmh: Number(speedThresholdDraft) || undefined });
                  sendRemoteCommand(asset.id, '3F', 'Threshold de Velocidade Atualizado');
                }}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold transition-colors"
              >
                Aplicar
              </button>
            </div>
          </div>

          {/* Intervalo de Relatório */}
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 space-y-2">
            <span className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5" /> Intervalo Adaptativo de Reporte (comando 34)
            </span>
            <div className="flex items-center gap-2">
              <select
                value={reportInterval}
                onChange={(e) => setReportInterval(e.target.value)}
                className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-slate-900 dark:text-slate-200 focus:outline-none"
              >
                {REPORT_INTERVAL_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => runInstantCommand('34', `Intervalo de Reporte: ${reportInterval}`)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold transition-colors"
              >
                Aplicar
              </button>
            </div>
          </div>

          {/* Fuso Horário */}
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 space-y-2">
            <span className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Fuso Horário do Dispositivo (comando 6C)
            </span>
            <div className="flex items-center gap-2">
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-slate-900 dark:text-slate-200 focus:outline-none"
              >
                {TIMEZONE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => runInstantCommand('6C', `Fuso Horário: ${timezone}`)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold transition-colors"
              >
                Aplicar
              </button>
            </div>
          </div>

          {/* Ações instantâneas */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => runInstantCommand('AA', 'Localizar Rastreador (Buzzer)')}
              className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center gap-2 font-semibold text-slate-600 dark:text-slate-300 hover:border-cyan-500/40 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
            >
              <Volume2 className="w-4 h-4" /> Localizar (Buzzer)
            </button>
            <button
              type="button"
              onClick={() => pushOfflineWhitelist(asset.id)}
              className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center gap-2 font-semibold text-slate-600 dark:text-slate-300 hover:border-cyan-500/40 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
              title={asset.offlineWhitelistSyncedAt ? `Última sync: ${asset.offlineWhitelistSyncedAt}` : 'Nunca sincronizado'}
            >
              <Users className="w-4 h-4" /> Sincronizar Whitelist
            </button>
            <button
              type="button"
              onClick={() => runInstantCommand('62', 'Atualização de Firmware (OTA)')}
              className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center gap-2 font-semibold text-slate-600 dark:text-slate-300 hover:border-cyan-500/40 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
            >
              <DownloadCloud className="w-4 h-4" /> Atualizar Firmware (OTA)
            </button>
            <button
              type="button"
              onClick={() => runInstantCommand('C7', 'Reiniciar Dispositivo')}
              className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center gap-2 font-semibold text-slate-600 dark:text-slate-300 hover:border-amber-500/40 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
            >
              <RotateCw className="w-4 h-4" /> Reiniciar Dispositivo
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Restaurar este dispositivo para configuração de fábrica? Todas as automações locais serão perdidas.')) {
                  runInstantCommand('AB', 'Restauração de Fábrica');
                }
              }}
              className="col-span-2 p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center justify-center gap-2 font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors"
            >
              <ShieldAlert className="w-4 h-4" /> Restaurar Configuração de Fábrica
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
