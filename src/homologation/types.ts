import type { HomologationStep, HomologationEventStatus } from '../types/homologation';

// Contrato que um futuro backend real (listener TCP/UDP do protocolo) deve
// implementar server-side. Hoje só existe a implementação de simulação
// (GT06DemoAdapter, 100% client-side, sem socket algum) — ver item 15/16 do
// pedido de homologação: a arquitetura já nasce pronta para múltiplos
// protocolos, mas só o GT06 é implementado nesta entrega.
export interface ProtocolAdapterEvent {
  step: HomologationStep;
  status: HomologationEventStatus;
  packetType: string;
  latencyMs?: number;
  timestamp: string;
}

export interface ProtocolAdapterRunParams {
  imei: string;
}

export interface ProtocolAdapter {
  readonly protocol: string;
  readonly variant?: string;
  run(params: ProtocolAdapterRunParams): AsyncGenerator<ProtocolAdapterEvent>;
}
