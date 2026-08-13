import React, { useState } from 'react';
import { X, Camera, RefreshCw, Download, Mic, MicOff, PlayCircle, Search, Video } from 'lucide-react';
import { AssetDevice } from '../../types';

export interface CameraViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: AssetDevice | null;
}

interface RecordingSegment {
  id: string;
  channel: number;
  start: string;
  end: string;
  sizeMb: number;
}

export const CameraViewerModal: React.FC<CameraViewerModalProps> = ({ isOpen, onClose, asset }) => {
  const [snapshots, setSnapshots] = useState<Record<number, string>>({});
  const [mode, setMode] = useState<'live' | 'playback'>('live');
  const [playbackDate, setPlaybackDate] = useState(new Date().toISOString().slice(0, 10));
  const [playbackFrom, setPlaybackFrom] = useState('08:00');
  const [playbackTo, setPlaybackTo] = useState('18:00');
  const [segments, setSegments] = useState<RecordingSegment[] | null>(null);
  const [talkbackActive, setTalkbackActive] = useState(false);

  if (!isOpen || !asset) return null;

  const channels = Array.from({ length: asset.cameraChannelsCount || 0 }, (_, i) => i + 1);

  const requestSnapshot = (channel: number) => {
    setSnapshots((prev) => ({ ...prev, [channel]: new Date().toLocaleTimeString('pt-BR') }));
  };

  const searchRecordings = () => {
    const found: RecordingSegment[] = channels.map((ch, i) => ({
      id: `rec_${ch}_${Date.now()}_${i}`,
      channel: ch,
      start: `${playbackDate} ${playbackFrom}`,
      end: `${playbackDate} ${playbackTo}`,
      sizeMb: Math.round(120 + Math.random() * 480),
    }));
    setSegments(found);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Camera className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>DVR Multi-Canal — {asset.plateNumber || asset.code}</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {channels.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 text-center py-8">
              Este dispositivo não possui canais de câmera configurados.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-1 rounded-xl">
                  <button
                    onClick={() => setMode('live')}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                      mode === 'live' ? 'bg-indigo-500 text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Ao Vivo ({channels.length} canais)
                  </button>
                  <button
                    onClick={() => setMode('playback')}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                      mode === 'playback' ? 'bg-indigo-500 text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Playback / Gravações
                  </button>
                </div>

                <button
                  onClick={() => setTalkbackActive((prev) => !prev)}
                  className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-colors border ${
                    talkbackActive
                      ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40 animate-pulse'
                      : 'bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Intercomunicador bidirecional (talkback) via microfone do veículo"
                >
                  {talkbackActive ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  {talkbackActive ? 'Encerrar Intercomunicador' : 'Iniciar Intercomunicador'}
                </button>
              </div>

              {mode === 'live' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {channels.map((ch) => (
                    <div key={ch} className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-950">
                      <div className="aspect-video flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950 text-slate-600 relative">
                        <Camera className="w-8 h-8" />
                        <span className="absolute top-2 left-2 text-[10px] font-mono font-bold text-white bg-black/60 px-1.5 py-0.5 rounded">
                          CAM {ch}
                        </span>
                        {talkbackActive && (
                          <span className="absolute top-2 right-2 text-[9px] font-mono font-bold text-white bg-rose-600/80 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <Mic className="w-2.5 h-2.5" /> AO VIVO
                          </span>
                        )}
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

              {mode === 'playback' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-end gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                    <div>
                      <label className="block text-slate-500 dark:text-slate-400 mb-1">Data</label>
                      <input
                        type="date"
                        value={playbackDate}
                        onChange={(e) => setPlaybackDate(e.target.value)}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-slate-900 dark:text-slate-200 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 dark:text-slate-400 mb-1">De</label>
                      <input
                        type="time"
                        value={playbackFrom}
                        onChange={(e) => setPlaybackFrom(e.target.value)}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-slate-900 dark:text-slate-200 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 dark:text-slate-400 mb-1">Até</label>
                      <input
                        type="time"
                        value={playbackTo}
                        onChange={(e) => setPlaybackTo(e.target.value)}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-slate-900 dark:text-slate-200 focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={searchRecordings}
                      className="ml-auto px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Search className="w-3.5 h-3.5" /> Buscar Gravações
                    </button>
                  </div>

                  {segments && (
                    <div className="space-y-1.5">
                      {segments.map((seg) => (
                        <div
                          key={seg.id}
                          className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2"
                        >
                          <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                            <Video className="w-3.5 h-3.5 text-indigo-500" />
                            CAM {seg.channel} · {seg.start} – {seg.end.slice(-5)}
                            <span className="text-slate-400 dark:text-slate-500 font-mono">({seg.sizeMb}MB)</span>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-500/15 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" title="Reproduzir">
                              <PlayCircle className="w-3.5 h-3.5" />
                            </button>
                            <button className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500/15 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors" title="Baixar arquivo de vídeo">
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
