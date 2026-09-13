import { describe, it, expect } from 'vitest';
import { buildLatencyMetrics, formatLatencyMs, uiRefreshLatencyMs } from './latency';
import { AssetDevice } from '../types';

function makeAsset(overrides: Partial<AssetDevice> = {}): AssetDevice {
  return {
    id: 'a1',
    name: 'Carrinho 1',
    code: 'ZAF-CART-01',
    imei: '3092524960',
    category: 'cart',
    clientId: 'zaffari',
    unitId: 'unit-1',
    unitName: 'Zaffari Alphaville',
    status: 'online',
    telemetry: {
      latitude: -23.5505,
      longitude: -46.6333,
      speed: 0,
      batteryLevel: 80,
      signalStrength: 90,
      lastCommunication: new Date().toISOString(),
    },
    protocol: 'BLE Gateway',
    lastMovement: new Date().toISOString(),
    ...overrides,
  };
}

describe('latency — buildLatencyMetrics (instrumentação DEV honesta)', () => {
  it('null sem ativo', () => {
    expect(buildLatencyMetrics(null)).toBeNull();
  });

  it('calcula device->vendor, vendor->UI e device->UI com ISO reais', () => {
    const device = new Date(Date.now() - 80_000).toISOString(); // tag de 80s atrás
    const vendor = new Date(Date.now() - 30_000).toISOString(); // vendor recebeu 50s depois
    const ui = new Date(Date.now() - 1_000).toISOString();      // UI já recebeu

    const m = buildLatencyMetrics(makeAsset({
      provider: 'BRGPS',
      telemetry: {
        ...makeAsset().telemetry,
        packetTimestamp: device,
        providerPublishedAt: vendor,
        lastCommunication: ui,
      },
    }), Date.now());

    expect(m).not.toBeNull();
    expect(m!.fromProvider).toBe(true);
    expect(m!.deviceToVendorMs).toBeGreaterThan(45_000);
    expect(m!.vendorToUiMs).toBeGreaterThan(25_000);
    expect(m!.deviceToUiMs).toBeGreaterThan(70_000);
    expect(m!.hadPlaceholder).toBe(false);
  });

  it('placeholder "Agora" da simulação é ignorado (não fabrica latência falsa)', () => {
    const m = buildLatencyMetrics(makeAsset({
      provider: undefined,
      telemetry: { ...makeAsset().telemetry, packetTimestamp: 'Agora', lastCommunication: 'Agora' },
    }), Date.now());
    expect(m!.deviceTs).toBeNull();
    expect(m!.uiTs).toBeNull();
    expect(m!.deviceToUiMs).toBeNull();
    expect(m!.hadPlaceholder).toBe(true);
    expect(m!.fromProvider).toBe(false);
  });

  it('sem providerPublishedAt (sem vendor) não inventa tempo de fornecedor', () => {
    const ui = new Date(Date.now() - 5_000).toISOString();
    const m = buildLatencyMetrics(makeAsset({
      telemetry: { ...makeAsset().telemetry, lastCommunication: ui },
    }), Date.now());
    expect(m!.vendorTs).toBeNull();
    expect(m!.deviceToVendorMs).toBeNull();
    expect(m!.vendorToUiMs).toBeNull();
  });

  it('age do UI é calculada', () => {
    const ui = new Date(Date.now() - 45_000).toISOString();
    const m = buildLatencyMetrics(makeAsset({
      telemetry: { ...makeAsset().telemetry, lastCommunication: ui },
    }), Date.now());
    expect(m!.uiAgeMs).toBeGreaterThan(40_000);
  });

  it('serverRxTs (T3) calcula deviceToServerRxMs (latência real device→servidor)', () => {
    const device = new Date(Date.now() - 100_000).toISOString(); // tag 100s atrás
    const serverRx = new Date(Date.now() - 90_000).toISOString(); // servidor recebeu 10s depois
    const ui = new Date(Date.now() - 1_000).toISOString();

    const m = buildLatencyMetrics(makeAsset({
      provider: 'GT06',
      telemetry: {
        ...makeAsset().telemetry,
        packetTimestamp: device,
        serverReceivedAt: serverRx,
        lastCommunication: ui,
      },
    }), Date.now());

    expect(m).not.toBeNull();
    expect(m!.serverRxTs).toBeGreaterThan(0);
    expect(m!.deviceToServerRxMs).toBeGreaterThanOrEqual(9_000);
    expect(m!.deviceToServerRxMs).toBeLessThanOrEqual(11_000);
    expect(m!.serverRxToUiMs).toBeGreaterThan(88_000);
    expect(m!.fromProvider).toBe(true);
  });

  it('sem serverReceivedAt não inventa latência', () => {
    const device = new Date(Date.now() - 50_000).toISOString();
    const m = buildLatencyMetrics(makeAsset({
      telemetry: { ...makeAsset().telemetry, packetTimestamp: device },
    }), Date.now());
    expect(m!.serverRxTs).toBeNull();
    expect(m!.deviceToServerRxMs).toBeNull();
    expect(m!.serverRxToUiMs).toBeNull();
  });
});

describe('latency — formatLatencyMs', () => {
  it('formata ms/s/min/h', () => {
    expect(formatLatencyMs(500)).toBe('500ms');
    expect(formatLatencyMs(1500)).toBe('1.5s');
    expect(formatLatencyMs(90_000)).toBe('2min');
    expect(formatLatencyMs(7_200_000)).toBe('2.0h');
    expect(formatLatencyMs(null)).toBe('—');
  });
});

describe('latency — uiRefreshLatencyMs (UI_REFRESH_LATENCY_MS, FASE 12)', () => {
  const now = 1_700_000_000_000;
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();

  it('calcula atraso real entre recepção no backend e atualização da UI', () => {
    const ms = uiRefreshLatencyMs(iso(10_000), iso(0), now);
    expect(ms).toBe(10_000);
  });

  it('usa now() quando uiUpdatedAt não é passado (merge instantâneo medido localmente)', () => {
    const ms = uiRefreshLatencyMs(iso(10_000), undefined, now);
    expect(ms).toBe(10_000);
  });

  it('retorna null quando serverReceivedAt não é ISO válido', () => {
    expect(uiRefreshLatencyMs('Agora', iso(0), now)).toBeNull();
    expect(uiRefreshLatencyMs(undefined, iso(0), now)).toBeNull();
  });

  it('retorna null quando uiUpdatedAt é anterior ao serverReceivedAt (relógio deslocado)', () => {
    const ms = uiRefreshLatencyMs(iso(5_000), iso(6_000), now);
    expect(ms).toBeNull();
  });
});