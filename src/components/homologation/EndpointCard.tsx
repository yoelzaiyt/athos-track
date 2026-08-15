import React from 'react';

const isDemoMode = (import.meta.env.VITE_DEMO_MODE ?? 'true') !== 'false';
const gt06Host = import.meta.env.VITE_GT06_HOST || 'a definir pelo administrador ATHOS';
const gt06Port = import.meta.env.VITE_GT06_TCP_PORT || 'a definir pelo administrador ATHOS';
const gt06Transport = import.meta.env.VITE_GT06_TRANSPORT || 'TCP';
const envLabel = import.meta.env.VITE_ATHOS_ENV_LABEL || 'Homologação';

const Field: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono = true }) => (
  <div className="flex flex-col gap-1 py-3 border-b" style={{ borderColor: 'var(--h-line)' }}>
    <span className="text-[10px] uppercase tracking-[0.15em]" style={{ color: 'var(--h-mute)' }}>{label}</span>
    <span className={`text-sm sm:text-base ${mono ? 'h-mono' : ''}`} style={{ color: 'var(--h-white)' }}>{value}</span>
  </div>
);

export const EndpointCard: React.FC = () => (
  <div
    className="rounded-2xl border p-5 sm:p-6"
    style={{ borderColor: 'var(--h-line)', background: 'var(--h-onyx-raised)' }}
  >
    <div className="flex items-center justify-between mb-1">
      <h3 className="text-sm font-semibold tracking-wide" style={{ color: 'var(--h-white)' }}>
        Endpoint de Homologação
      </h3>
      <span
        className="h-mono text-[10px] px-2 py-1 rounded-full border flex items-center gap-1.5"
        style={{
          borderColor: isDemoMode ? 'var(--h-gold)' : 'var(--h-success)',
          color: isDemoMode ? 'var(--h-gold-bright)' : 'var(--h-success)',
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: isDemoMode ? 'var(--h-gold)' : 'var(--h-success)' }}
        />
        {isDemoMode ? 'Offline — Simulação (DEMO_MODE)' : 'Online'}
      </span>
    </div>
    <p className="text-xs mb-2" style={{ color: 'var(--h-mute)' }}>
      Aponte o dispositivo de teste para estes dados. Host e porta são definidos pelo administrador ATHOS por ambiente.
    </p>

    <div>
      <Field label="Protocolo" value="GT06" />
      <Field label="Host / DNS" value={gt06Host} />
      <Field label="Porta" value={gt06Port} />
      <Field label="Transporte" value={gt06Transport} />
      <div className="flex flex-col gap-1 pt-3">
        <span className="text-[10px] uppercase tracking-[0.15em]" style={{ color: 'var(--h-mute)' }}>Ambiente</span>
        <span className="text-sm h-mono" style={{ color: 'var(--h-white)' }}>{envLabel}</span>
      </div>
    </div>
  </div>
);
