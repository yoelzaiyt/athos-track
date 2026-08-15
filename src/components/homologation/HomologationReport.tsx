import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { homologationReportToInsertRow } from '../../lib/mappers';
import type { HomologationRequest, HomologationResult } from '../../types/homologation';

export interface ReportChecks {
  dnsCompatible: boolean;
  connectionOk: boolean;
  loginPacketOk: boolean;
  heartbeatOk: boolean;
  locationPacketOk: boolean;
}

interface Props {
  request: HomologationRequest;
  deviceId?: string;
  checks: ReportChecks;
}

const CheckRow: React.FC<{ label: string; ok: boolean }> = ({ label, ok }) => (
  <div className="flex items-center justify-between py-2 border-b text-xs" style={{ borderColor: 'var(--h-line)' }}>
    <span style={{ color: 'var(--h-mute)' }}>{label}</span>
    <span className="flex items-center gap-1.5 h-mono font-semibold" style={{ color: ok ? 'var(--h-success)' : 'var(--h-error)' }}>
      {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
      {ok ? 'OK' : 'FALHA'}
    </span>
  </div>
);

export const HomologationReport: React.FC<Props> = ({ request, deviceId, checks }) => {
  const persisted = useRef(false);
  const [result, setResult] = useState<HomologationResult | null>(null);

  useEffect(() => {
    if (persisted.current) return;
    persisted.current = true;

    const finalResult: HomologationResult =
      checks.connectionOk && checks.loginPacketOk && checks.heartbeatOk && checks.locationPacketOk
        ? 'COMPATIVEL'
        : 'PENDENTE';
    setResult(finalResult);

    supabase
      .from('homologation_reports')
      .insert(
        homologationReportToInsertRow({
          requestId: request.id,
          deviceId,
          protocol: request.protocol,
          transport: request.transport,
          ...checks,
          result: finalResult,
        })
      )
      .then(({ error }) => {
        if (error) console.error('[HomologationReport] insert:', error.message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!result) return null;

  return (
    <div className="rounded-2xl border p-5 sm:p-6" style={{ borderColor: 'var(--h-line)', background: 'var(--h-onyx-raised)' }}>
      <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--h-white)' }}>Relatório de Homologação</h3>
      <p className="h-mono text-xs mb-4" style={{ color: 'var(--h-mute)' }}>
        {request.manufacturer} — {request.model} · Firmware {request.firmwareVersion || 'n/d'}
      </p>

      <CheckRow label="Protocolo / Transporte" ok />
      <CheckRow label="DNS" ok={checks.dnsCompatible} />
      <CheckRow label="Conexão" ok={checks.connectionOk} />
      <CheckRow label="Login Packet" ok={checks.loginPacketOk} />
      <CheckRow label="Heartbeat" ok={checks.heartbeatOk} />
      <CheckRow label="Location Packet" ok={checks.locationPacketOk} />

      <div
        className="mt-5 rounded-xl border px-4 py-4 text-center h-mono text-sm font-bold uppercase tracking-[0.15em]"
        style={{
          borderColor: result === 'COMPATIVEL' ? 'var(--h-success)' : 'var(--h-error)',
          color: result === 'COMPATIVEL' ? 'var(--h-success)' : 'var(--h-error)',
        }}
      >
        {result === 'COMPATIVEL' ? 'Compatível com ATHOS TRACK' : 'Homologação Pendente'}
      </div>
    </div>
  );
};
