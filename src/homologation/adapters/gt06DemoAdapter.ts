import type { HomologationStep } from '../../types/homologation';
import type { ProtocolAdapter, ProtocolAdapterEvent, ProtocolAdapterRunParams } from '../types';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const STEP_SEQUENCE: { step: HomologationStep; packetType: string; delayMs: number }[] = [
  { step: 'awaiting_connection', packetType: 'TCP_SYN', delayMs: 600 },
  { step: 'device_connected', packetType: 'TCP_HANDSHAKE', delayMs: 500 },
  { step: 'handshake_received', packetType: 'GT06_HANDSHAKE', delayMs: 450 },
  { step: 'imei_identified', packetType: 'LOGIN_PACKET (0x01)', delayMs: 700 },
  { step: 'location_packet_received', packetType: 'GPS_LOCATION (0x12)', delayMs: 900 },
  { step: 'heartbeat_received', packetType: 'HEARTBEAT (0x13)', delayMs: 500 },
  { step: 'protocol_identified', packetType: 'PROTOCOL_MATCH', delayMs: 400 },
  { step: 'homologation_completed', packetType: 'HOMOLOGATION_OK', delayMs: 300 },
];

// Implementação de simulação (DEMO_MODE) do contrato ProtocolAdapter para o
// GT06. Não abre nenhum socket — só emite a sequência de etapas com timers,
// para exercitar o console/relatório de homologação enquanto não existe um
// listener TCP real. Um backend real implementaria o mesmo contrato lendo de
// um socket de verdade.
export class GT06DemoAdapter implements ProtocolAdapter {
  readonly protocol = 'GT06';
  readonly variant = 'demo-simulation';

  async *run(_params: ProtocolAdapterRunParams): AsyncGenerator<ProtocolAdapterEvent> {
    for (const { step, packetType, delayMs } of STEP_SEQUENCE) {
      yield {
        step,
        status: 'pending',
        packetType,
        timestamp: new Date().toISOString(),
      };

      await sleep(delayMs);

      yield {
        step,
        status: 'success',
        packetType,
        latencyMs: delayMs,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
