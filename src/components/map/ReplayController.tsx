import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Gauge,
  Clock,
  MapPin,
  BatteryCharging,
  Zap,
  Filter,
} from 'lucide-react';
import { RoutePoint } from '../../types';

interface ReplayControllerProps {
  routePoints: RoutePoint[];
  stoppages?: Array<{
    latitude: number;
    longitude: number;
    durationMin: number;
    startTime: string;
    endTime: string;
    locationName: string;
  }>;
  onFrameChange: (point: RoutePoint, index: number) => void;
  onClose?: () => void;
}

export const ReplayController: React.FC<ReplayControllerProps> = ({
  routePoints,
  stoppages = [],
  onFrameChange,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // 1x, 2x, 4x, 8x, 16x
  const [stoppageFilter, setStoppageFilter] = useState<number>(0); // min duration filter in minutes (0 = all)

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentPoint = routePoints[currentIndex] || routePoints[0];

  useEffect(() => {
    if (isPlaying) {
      const intervalMs = Math.max(100, 1000 / playbackSpeed);
      timerRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= routePoints.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          const next = prev + 1;
          onFrameChange(routePoints[next], next);
          return next;
        });
      }, intervalMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, playbackSpeed, routePoints, onFrameChange]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const idx = parseInt(e.target.value, 10);
    setCurrentIndex(idx);
    if (routePoints[idx]) {
      onFrameChange(routePoints[idx], idx);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
    if (routePoints[0]) {
      onFrameChange(routePoints[0], 0);
    }
  };

  const filteredStoppages = stoppages.filter((s) => s.durationMin >= stoppageFilter);

  if (!routePoints || routePoints.length === 0) return null;

  return (
    <div className="bg-slate-900/95 border border-slate-800 backdrop-blur-xl p-4 rounded-2xl shadow-2xl space-y-3 w-full max-w-4xl mx-auto">
      {/* Top Header & Telemetry Indicators */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-cyan-500/10 text-cyan-400 rounded-lg border border-cyan-500/20 font-mono font-bold text-[10px] uppercase">
            REPLAY DE ROTA
          </span>
          <span className="text-slate-200 font-semibold flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            {currentPoint?.timestamp || '12:00:00'}
          </span>
          <span className="text-slate-500 font-mono">
            ({currentIndex + 1} / {routePoints.length} pontos)
          </span>
        </div>

        {/* Live Gauges */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            <span>Velocidade:</span>
            <strong className="text-white text-sm">{currentPoint?.speed || 0} km/h</strong>
          </div>

          <div className="flex items-center gap-1.5 text-slate-300">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Ignição:</span>
            <strong className={(currentPoint?.speed || 0) > 0 ? 'text-emerald-400' : 'text-slate-400'}>
              {(currentPoint?.speed || 0) > 0 ? 'LIGADA' : 'DESLIGADA'}
            </strong>
          </div>
        </div>
      </div>

      {/* Scrubbable Timeline Slider */}
      <div className="space-y-1">
        <input
          type="range"
          min={0}
          max={routePoints.length - 1}
          value={currentIndex}
          onChange={handleSliderChange}
          className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400"
        />
        <div className="flex justify-between text-[10px] font-mono text-slate-500">
          <span>Início ({routePoints[0]?.timestamp || '00:00'})</span>
          <span>{Math.round(((currentIndex + 1) / routePoints.length) * 100)}% concluído</span>
          <span>Fim ({routePoints[routePoints.length - 1]?.timestamp || '23:59'})</span>
        </div>
      </div>

      {/* Controls & Speed Selectors Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {/* Playback Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 transition-colors"
            title="Reiniciar Replay"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              const prev = Math.max(0, currentIndex - 10);
              setCurrentIndex(prev);
              onFrameChange(routePoints[prev], prev);
            }}
            className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 transition-colors"
            title="Voltar 10 Pontos"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-cyan-600/30"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                <span>Pausar</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Reproduzir</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              const next = Math.min(routePoints.length - 1, currentIndex + 10);
              setCurrentIndex(next);
              onFrameChange(routePoints[next], next);
            }}
            className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 transition-colors"
            title="Avançar 10 Pontos"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Speed Multipliers */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <span className="text-slate-500 font-mono px-2 text-[10px]">VELOCIDADE:</span>
          {[1, 2, 4, 8, 16].map((spd) => (
            <button
              key={spd}
              onClick={() => setPlaybackSpeed(spd)}
              className={`px-2.5 py-1 rounded-lg font-mono text-xs font-semibold transition-colors ${
                playbackSpeed === spd
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>

        {/* Stoppage Duration Filter Pills */}
        {stoppages.length > 0 && (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500 text-[10px] flex items-center gap-1">
              <Filter className="w-3 h-3 text-cyan-400" /> Paradas:
            </span>
            {[0, 5, 15, 30].map((min) => (
              <button
                key={min}
                onClick={() => setStoppageFilter(min)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                  stoppageFilter === min
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'bg-slate-950 text-slate-400 border border-slate-800'
                }`}
              >
                {min === 0 ? 'Todas' : `>${min}min`}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
