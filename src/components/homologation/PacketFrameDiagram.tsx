import React from 'react';

interface FrameField {
  label: string;
  bytes: string;
}

// Estrutura ilustrativa de um Login Packet GT06 (start bit 0x7878, protocolo
// 0x01, IMEI em BCD, serial, checksum, stop bit 0x0D0A) — é o elemento de
// assinatura do hero: em vez de um ícone genérico, mostra que o portal
// entende o protocolo byte a byte. Valores de exemplo, não um payload real.
const FRAME: FrameField[] = [
  { label: 'Start', bytes: '78 78' },
  { label: 'Length', bytes: '0D' },
  { label: 'Protocol (Login)', bytes: '01' },
  { label: 'IMEI (BCD)', bytes: '08 61 23 45 67 89 01' },
  { label: 'Serial No.', bytes: '00 01' },
  { label: 'Checksum', bytes: '3A F1' },
  { label: 'Stop', bytes: '0D 0A' },
];

export const PacketFrameDiagram: React.FC = () => (
  <div className="w-full">
    <div className="flex items-center gap-2 mb-3 h-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--h-mute)' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--h-gold)' }} />
      GT06 · Login Packet (ilustrativo)
    </div>

    <div className="overflow-x-auto pb-3">
      <div className="flex items-stretch gap-px min-w-max">
        {FRAME.map((field, idx) => (
          <div key={idx} className="flex flex-col items-center">
            <div
              className="h-mono text-xs sm:text-sm px-3 py-2.5 border-y border-l last:border-r whitespace-nowrap"
              style={{
                borderColor: 'var(--h-line)',
                background: 'var(--h-onyx-raised)',
                color: 'var(--h-gold-bright)',
              }}
            >
              {field.bytes}
            </div>
            <svg width="100%" height="14" className="w-full">
              <line
                x1="0" y1="1" x2="100%" y2="1"
                stroke="var(--h-gold)"
                strokeWidth="1"
                className="h-trace-line"
                style={{ animationDelay: `${idx * 90}ms` }}
              />
            </svg>
            <div
              className="text-[9px] sm:text-[10px] uppercase tracking-wide text-center px-1 max-w-[110px]"
              style={{ color: 'var(--h-mute)' }}
            >
              {field.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);
