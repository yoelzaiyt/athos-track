import React, { useMemo, useRef, useState } from 'react';
import { PacketFrameDiagram } from '../../components/homologation/PacketFrameDiagram';
import { EndpointCard } from '../../components/homologation/EndpointCard';
import { HomologationForm } from '../../components/homologation/HomologationForm';
import { DeviceTestPanel } from '../../components/homologation/DeviceTestPanel';
import { HomologationConsole, ConsoleEvent } from '../../components/homologation/HomologationConsole';
import { HomologationReport } from '../../components/homologation/HomologationReport';
import type { ProtocolAdapterEvent } from '../../homologation/types';
import type { HomologationRequest, HomologationStep } from '../../types/homologation';

const envLabel = import.meta.env.VITE_ATHOS_ENV_LABEL || 'Homologação';

const StepEyebrow: React.FC<{ n: string; label: string }> = ({ n, label }) => (
  <div className="flex items-center gap-3 mb-4">
    <span className="h-mono text-xs px-2 py-1 rounded border" style={{ borderColor: 'var(--h-gold)', color: 'var(--h-gold-bright)' }}>
      {n}
    </span>
    <h2 className="text-base sm:text-lg font-semibold tracking-tight" style={{ color: 'var(--h-white)' }}>{label}</h2>
  </div>
);

export const HomologationPortalPage: React.FC = () => {
  const [request, setRequest] = useState<HomologationRequest | null>(null);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [consoleEvents, setConsoleEvents] = useState<ConsoleEvent[]>([]);
  const [stepResults, setStepResults] = useState<Partial<Record<HomologationStep, boolean>>>({});
  const [completed, setCompleted] = useState(false);

  const formSectionRef = useRef<HTMLDivElement>(null);

  const handleEvent = (evt: ProtocolAdapterEvent & { imeiMasked: string }) => {
    if (!request) return;
    setConsoleEvents((prev) => [...prev, { ...evt, protocol: request.protocol }]);
    if (evt.status !== 'pending') {
      setStepResults((prev) => ({ ...prev, [evt.step]: evt.status === 'success' }));
    }
  };

  const checks = useMemo(
    () => ({
      connectionOk: !!stepResults.device_connected,
      loginPacketOk: !!stepResults.imei_identified,
      heartbeatOk: !!stepResults.heartbeat_received,
      locationPacketOk: !!stepResults.location_packet_received,
      dnsCompatible: !!request?.supportsDnsConfig && !!stepResults.device_connected,
    }),
    [stepResults, request]
  );

  return (
    <div className="athos-homologation-theme min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur border-b" style={{ borderColor: 'var(--h-line)', background: 'rgba(11,13,16,0.85)' }}>
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between">
          <span className="text-sm sm:text-base font-semibold tracking-[0.08em]" style={{ color: 'var(--h-white)' }}>
            ATHOS <span style={{ color: 'var(--h-gold)' }}>TRACK</span>
          </span>
          <span className="h-mono text-[10px] uppercase tracking-[0.15em] px-2.5 py-1 rounded-full border" style={{ borderColor: 'var(--h-line)', color: 'var(--h-mute)' }}>
            {envLabel}
          </span>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 pt-14 pb-10">
        <p className="h-mono text-xs uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--h-gold)' }}>
          Device Integration &amp; Homologation
        </p>
        <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight mb-4 max-w-2xl" style={{ color: 'var(--h-white)' }}>
          Portal técnico de homologação ATHOS TRACK
        </h1>
        <p className="text-sm sm:text-base max-w-xl mb-10" style={{ color: 'var(--h-mute)' }}>
          Envie os dados do seu equipamento, valide o fluxo de conexão GT06 e receba o parecer de compatibilidade
          com a plataforma ATHOS TRACK.
        </p>

        <div className="rounded-2xl border p-5 sm:p-8 mb-10" style={{ borderColor: 'var(--h-line)', background: 'var(--h-onyx-raised)' }}>
          <PacketFrameDiagram />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-start">
          <EndpointCard />
          <button
            onClick={() => formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="h-mono text-xs uppercase tracking-[0.15em] font-semibold px-6 py-4 rounded-xl w-full md:w-auto transition-opacity hover:opacity-90"
            style={{ background: 'var(--h-gold)', color: '#0b0d10' }}
          >
            Iniciar Homologação ▸
          </button>
        </div>
      </section>

      {/* Flow */}
      <section ref={formSectionRef} className="max-w-5xl mx-auto px-5 sm:px-8 pb-8">
        <StepEyebrow n="01" label="Dados do Fornecedor" />
        {!request ? (
          <div className="rounded-2xl border p-5 sm:p-8" style={{ borderColor: 'var(--h-line)', background: 'var(--h-onyx-raised)' }}>
            <HomologationForm onSubmitted={setRequest} />
          </div>
        ) : (
          <div className="rounded-2xl border p-5 text-xs h-mono" style={{ borderColor: 'var(--h-success)', color: 'var(--h-success)' }}>
            Solicitação recebida para {request.companyLegalName} — {request.manufacturer} {request.model}.
          </div>
        )}
      </section>

      {request && (
        <section className="max-w-5xl mx-auto px-5 sm:px-8 pb-8">
          <StepEyebrow n="02" label="Teste de Dispositivo" />
          <DeviceTestPanel
            request={request}
            onEvent={handleEvent}
            onCompleted={() => setCompleted(true)}
            onDeviceCreated={setDeviceId}
          />
        </section>
      )}

      {request && consoleEvents.length > 0 && (
        <section className="max-w-5xl mx-auto px-5 sm:px-8 pb-8">
          <StepEyebrow n="03" label="Console de Homologação" />
          <HomologationConsole events={consoleEvents} />
        </section>
      )}

      {request && completed && (
        <section className="max-w-5xl mx-auto px-5 sm:px-8 pb-16">
          <StepEyebrow n="04" label="Relatório Final" />
          <HomologationReport request={request} deviceId={deviceId} checks={checks} />
        </section>
      )}

      <footer className="border-t py-6 text-center h-mono text-[10px]" style={{ borderColor: 'var(--h-line)', color: 'var(--h-mute)' }}>
        ATHOS TRACK — Portal de Homologação · Ambiente: {envLabel} · Dados simulados quando DEMO_MODE está ativo
      </footer>
    </div>
  );
};
