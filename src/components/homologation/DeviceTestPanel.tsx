import React, { useState } from 'react';
import { Loader2, CheckCircle2, Circle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { homologationDeviceToInsertRow, homologationEventToInsertRow } from '../../lib/mappers';
import { GT06DemoAdapter } from '../../homologation/adapters/gt06DemoAdapter';
import { maskImei } from '../../homologation/mask';
import type { ProtocolAdapterEvent } from '../../homologation/types';
import type { HomologationRequest, HomologationStep } from '../../types/homologation';

const STEP_LABEL: Record<HomologationStep, string> = {
  awaiting_connection: 'Aguardando conexão',
  device_connected: 'Dispositivo conectado',
  handshake_received: 'Handshake recebido',
  imei_identified: 'IMEI identificado',
  location_packet_received: 'Pacote de localização recebido',
  heartbeat_received: 'Heartbeat recebido',
  protocol_identified: 'Protocolo identificado',
  homologation_completed: 'Homologação concluída',
};

const STEP_ORDER: HomologationStep[] = [
  'awaiting_connection', 'device_connected', 'handshake_received', 'imei_identified',
  'location_packet_received', 'heartbeat_received', 'protocol_identified', 'homologation_completed',
];

interface Props {
  request: HomologationRequest;
  onEvent: (event: ProtocolAdapterEvent & { imeiMasked: string }) => void;
  onCompleted: (allSuccess: boolean) => void;
  onDeviceCreated?: (deviceId: string | undefined) => void;
}

export const DeviceTestPanel: React.FC<Props> = ({ request, onEvent, onCompleted, onDeviceCreated }) => {
  const [imei, setImei] = useState(request.testImei);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [stepStatus, setStepStatus] = useState<Partial<Record<HomologationStep, 'pending' | 'success' | 'error'>>>({});

  const start = async () => {
    if (running || done) return;
    setRunning(true);
    setStepStatus({});

    // Mesma razão do HomologationForm: anon só tem INSERT (sem SELECT) nesta
    // tabela, então o id é gerado no cliente e enviado explicitamente — pedir
    // a linha de volta via .select() falharia contra a RLS de leitura.
    const deviceId = crypto.randomUUID();
    const { error: deviceError } = await supabase
      .from('homologation_devices')
      .insert({
        id: deviceId,
        ...homologationDeviceToInsertRow({
          requestId: request.id,
          imei,
          manufacturer: request.manufacturer,
          model: request.model,
          firmwareVersion: request.firmwareVersion,
          demoMode: true,
        }),
      });

    if (deviceError) console.error('[DeviceTestPanel] device insert:', deviceError.message);
    onDeviceCreated?.(deviceError ? undefined : deviceId);

    const imeiMasked = maskImei(imei);
    const adapter = new GT06DemoAdapter();
    let sawError = false;

    for await (const evt of adapter.run({ imei })) {
      setStepStatus((prev) => ({ ...prev, [evt.step]: evt.status }));
      if (evt.status === 'error') sawError = true;

      onEvent({ ...evt, imeiMasked });

      if (evt.status !== 'pending') {
        const { error: eventError } = await supabase.from('homologation_events').insert(
          homologationEventToInsertRow({
            requestId: request.id,
            deviceId: deviceError ? undefined : deviceId,
            sessionToken: request.sessionToken,
            imeiMasked,
            protocol: adapter.protocol,
            packetType: evt.packetType,
            step: evt.step,
            status: evt.status,
            latencyMs: evt.latencyMs,
          })
        );
        if (eventError) console.error('[DeviceTestPanel] event insert:', eventError.message);
      }
    }

    setRunning(false);
    setDone(true);
    onCompleted(!sawError);
  };

  return (
    <div className="rounded-2xl border p-5 sm:p-6" style={{ borderColor: 'var(--h-line)', background: 'var(--h-onyx-raised)' }}>
      <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--h-white)' }}>Dispositivo de Teste</h3>
      <p className="text-xs mb-4" style={{ color: 'var(--h-mute)' }}>
        Confirme o IMEI e inicie a homologação simulada (DEMO_MODE) do fluxo GT06.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          value={imei}
          onChange={(e) => setImei(e.target.value.replace(/[^\d]/g, ''))}
          disabled={running || done}
          className="flex-1 h-mono rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--h-gold)] disabled:opacity-60"
          style={{ borderColor: 'var(--h-line)', background: 'var(--h-onyx)', color: 'var(--h-white)' }}
          placeholder="IMEI"
        />
        <button
          onClick={start}
          disabled={running || done || imei.length < 10}
          className="px-5 py-2 rounded-lg h-mono text-xs uppercase tracking-[0.15em] font-semibold transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ background: 'var(--h-gold)', color: '#0b0d10' }}
        >
          {running && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {done ? 'Concluído' : running ? 'Homologando...' : 'Iniciar Homologação'}
        </button>
      </div>

      <ol className="space-y-2.5">
        {STEP_ORDER.map((step) => {
          const status = stepStatus[step];
          return (
            <li key={step} className="flex items-center gap-3 text-xs">
              {status === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--h-success)' }} />
              ) : status === 'pending' ? (
                <Loader2 className="w-4 h-4 shrink-0 animate-spin" style={{ color: 'var(--h-gold)' }} />
              ) : status === 'error' ? (
                <Circle className="w-4 h-4 shrink-0" style={{ color: 'var(--h-error)' }} />
              ) : (
                <Circle className="w-4 h-4 shrink-0" style={{ color: 'var(--h-line)' }} />
              )}
              <span style={{ color: status === 'success' ? 'var(--h-white)' : 'var(--h-mute)' }}>
                {STEP_LABEL[step]}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
