import React, { useState } from 'react';
import { X, Camera, RefreshCw } from 'lucide-react';
import { AssetDevice } from '../../types';

export interface CameraViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: AssetDevice | null;
}

export const CameraViewerModal: React.FC<CameraViewerModalProps> = ({ isOpen, onClose, asset }) => {
  const [snapshots, setSnapshots] = useState<Record<number, string>>({});

  if (!isOpen || !asset) return null;

  const channels = Array.from({ length: asset.cameraChannelsCount || 0 }, (_, i) => i + 1);

  const requestSnapshot = (channel: number) => {
    setSnapshots((prev) => ({ ...prev, [channel]: new Date().toLocaleTimeString('pt-BR') }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Camera className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Câmeras Embarcadas — {asset.plateNumber || asset.code}</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {channels.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-8">
              Este dispositivo não possui canais de câmera configurados.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {channels.map((ch) => (
                <div
                  key={ch}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-950"
                >
                  <div className="aspect-video flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950 text-slate-600 relative">
                    <Camera className="w-8 h-8" />
                    <span className="absolute top-2 left-2 text-[10px] font-mono font-bold text-white bg-black/60 px-1.5 py-0.5 rounded">
                      CAM {ch}
                    </span>
                  </div>
                  <div className="p-2.5 flex items-center justify-between bg-white dark:bg-slate-900">
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                      {snapshots[ch] ? `Snapshot: ${snapshots[ch]}` : 'Sem snapshot recente'}
                    </span>
                    <button
                      onClick={() => requestSnapshot(ch)}
                      className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 transition-colors"
                      title="Solicitar snapshot remoto"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
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
