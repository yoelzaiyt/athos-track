import React from 'react';
import type { HomologationEventStatus, HomologationStep } from '../../types/homologation';

export interface ConsoleEvent {
  step: HomologationStep;
  status: HomologationEventStatus;
  packetType: string;
  latencyMs?: number;
  timestamp: string;
  imeiMasked: string;
  protocol: string;
}

const STATUS_COLOR: Record<HomologationEventStatus, string> = {
  pending: 'var(--h-gold)',
  success: 'var(--h-success)',
  error: 'var(--h-error)',
};

interface Props {
  events: ConsoleEvent[];
}

export const HomologationConsole: React.FC<Props> = ({ events }) => (
  <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--h-line)', background: 'var(--h-onyx-raised)' }}>
    <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--h-line)' }}>
      <h3 className="text-sm font-semibold" style={{ color: 'var(--h-white)' }}>Console de Homologação</h3>
      <p className="text-xs mt-1" style={{ color: 'var(--h-mute)' }}>
        Só eventos desta sessão. IMEI mascarado — nenhum dado de outros fornecedores é exibido aqui.
      </p>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full text-left h-mono text-[11px]" style={{ color: 'var(--h-white)' }}>
        <thead>
          <tr className="uppercase tracking-wider" style={{ color: 'var(--h-mute)' }}>
            <th className="px-4 py-2.5">Timestamp</th>
            <th className="px-4 py-2.5">IMEI</th>
            <th className="px-4 py-2.5">Protocol</th>
            <th className="px-4 py-2.5">Packet Type</th>
            <th className="px-4 py-2.5">Status</th>
            <th className="px-4 py-2.5">Latency</th>
          </tr>
        </thead>
        <tbody>
          {events.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center" style={{ color: 'var(--h-mute)' }}>
                Aguardando início da homologação...
              </td>
            </tr>
          ) : (
            events.map((evt, idx) => (
              <tr key={idx} className="border-t" style={{ borderColor: 'var(--h-line)' }}>
                <td className="px-4 py-2">{new Date(evt.timestamp).toLocaleTimeString('pt-BR')}</td>
                <td className="px-4 py-2">{evt.imeiMasked}</td>
                <td className="px-4 py-2">{evt.protocol}</td>
                <td className="px-4 py-2">{evt.packetType}</td>
                <td className="px-4 py-2" style={{ color: STATUS_COLOR[evt.status] }}>{evt.status.toUpperCase()}</td>
                <td className="px-4 py-2">{evt.latencyMs !== undefined ? `${evt.latencyMs}ms` : '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);
