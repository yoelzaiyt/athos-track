import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { X, AlertTriangle, ScanLine } from 'lucide-react';

export interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (value: string) => void;
  title?: string;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({ isOpen, onClose, onScan, title }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setIsReady(false);
    let cancelled = false;
    let stream: MediaStream | null = null;
    let rafId: number | null = null;

    const stopStream = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
    };

    const tick = () => {
      if (cancelled) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });
          if (code?.data) {
            onScan(code.data.trim());
            stopStream();
            return;
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setIsReady(true);
        tick();
      } catch {
        setError('Não foi possível acessar a câmera. Verifique as permissões do navegador ou digite o código manualmente.');
      }
    })();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [isOpen, onScan]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            {title || 'Escanear QR Code do Dispositivo'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {error ? (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden bg-slate-950 aspect-square">
              <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />
              <div
                className={`absolute inset-8 border-2 rounded-2xl pointer-events-none transition-colors ${
                  isReady ? 'border-cyan-400/80 animate-pulse' : 'border-slate-600'
                }`}
              />
            </div>
          )}
          <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
            Aponte a câmera para o QR code impresso no rastreador GT06 ou na etiqueta BLE.
          </p>
        </div>
      </div>
    </div>
  );
};
