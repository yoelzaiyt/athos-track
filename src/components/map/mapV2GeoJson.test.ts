import { describe, it, expect } from 'vitest';
import { circlePolygon, geofenceToGeoJsonFeature, assetsToGeoJson } from './mapV2GeoJson';
import { AssetDevice, Geofence } from '../../types';

function makeAsset(overrides: Partial<AssetDevice> = {}): AssetDevice {
  return {
    id: overrides.id ?? 'a1',
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

function makeGeofence(overrides: Partial<Geofence> = {}): Geofence {
  return {
    id: 'g1',
    name: 'Zona segura',
    clientId: 'zaffari',
    unitId: 'unit-1',
    type: 'circle',
    coordinates: [[-23.5505, -46.6333]],
    radius: 80,
    color: '#06b6d4',
    rules: { entryAlert: true, exitAlert: true, stayAlert: false },
    assignedAssetsCount: 10,
    ...overrides,
  };
}

function haversineMeters(a: [number, number], b: [number, number]): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

describe('AssetMapV2 — circlePolygon (aproximação geodésica de geofence circular)', () => {
  it('gera N+1 pontos fechando o anel (primeiro === último ponto, ida e volta completa)', () => {
    const ring = circlePolygon(-23.5505, -46.6333, 80, 8);
    expect(ring).toHaveLength(9); // 8 segmentos + ponto de fechamento
  });

  it('cada ponto do anel fica a ~radiusMeters do centro (tolerância de arredondamento geodésico)', () => {
    const centerLat = -23.5505;
    const centerLng = -46.6333;
    const radius = 80;
    const ring = circlePolygon(centerLat, centerLng, radius, 32);
    for (const [lng, lat] of ring) {
      const dist = haversineMeters([centerLat, centerLng], [lat, lng]);
      expect(dist).toBeGreaterThan(radius * 0.98);
      expect(dist).toBeLessThan(radius * 1.02);
    }
  });
});

describe('AssetMapV2 — geofenceToGeoJsonFeature', () => {
  it('geofence tipo circle vira um Polygon com anel gerado por circlePolygon', () => {
    const geofence = makeGeofence({ type: 'circle', radius: 80 });
    const feature = geofenceToGeoJsonFeature(geofence);
    expect(feature.geometry.type).toBe('Polygon');
    expect(feature.geometry.coordinates[0].length).toBeGreaterThan(3);
    expect(feature.properties.id).toBe('g1');
    expect(feature.properties.color).toBe('#06b6d4');
  });

  it('geofence tipo polygon usa as coordenadas reais (lat/lng invertidas para lng/lat GeoJSON)', () => {
    const geofence = makeGeofence({
      type: 'polygon',
      radius: undefined,
      coordinates: [
        [-23.55, -46.63],
        [-23.551, -46.631],
        [-23.552, -46.629],
      ],
    });
    const feature = geofenceToGeoJsonFeature(geofence);
    expect(feature.geometry.coordinates[0]).toEqual([
      [-46.63, -23.55],
      [-46.631, -23.551],
      [-46.629, -23.552],
    ]);
  });

  it('nunca usa o centro/área da geofence como posição de ativo — geofenceToGeoJsonFeature não recebe nem produz dados de asset', () => {
    const geofence = makeGeofence();
    const feature = geofenceToGeoJsonFeature(geofence);
    expect(feature.properties).not.toHaveProperty('assetId');
    expect(feature.properties).not.toHaveProperty('latitude');
  });
});

describe('AssetMapV2 — assetsToGeoJson (fonte realtime dos marcadores)', () => {
  it('inclui apenas ativos com posição válida (lat/lng finitos) — sem coordenada default', () => {
    const valid = makeAsset({ id: 'valid' });
    const invalid = makeAsset({
      id: 'invalid',
      telemetry: { ...valid.telemetry, latitude: NaN, longitude: NaN },
    });
    const fc = assetsToGeoJson([valid, invalid]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].properties.id).toBe('valid');
  });

  it('é genérico por asset_type — não há nenhum caminho especial para category "cart"', () => {
    const cart = makeAsset({ id: 'c1', category: 'cart' });
    const box = makeAsset({ id: 'b1', category: 'box' });
    const forklift = makeAsset({ id: 'f1', category: 'forklift' });
    const fc = assetsToGeoJson([cart, box, forklift]);
    expect(fc.features.map((f) => f.properties.category).sort()).toEqual(['box', 'cart', 'forklift']);
    // Cada feature carrega sua própria cor por categoria — não há branch condicional por tipo.
    const colors = new Set(fc.features.map((f) => f.properties.color));
    expect(colors.size).toBe(3);
  });

  it('coordenadas GeoJSON seguem [longitude, latitude] (não [lat, lng])', () => {
    const asset = makeAsset({ telemetry: { ...makeAsset().telemetry, latitude: -23.5, longitude: -46.6 } });
    const fc = assetsToGeoJson([asset]);
    expect(fc.features[0].geometry.coordinates).toEqual([-46.6, -23.5]);
  });
});
