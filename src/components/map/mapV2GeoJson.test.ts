import { describe, it, expect } from 'vitest';
import {
  circlePolygon,
  geofenceToGeoJsonFeature,
  assetsToGeoJson,
  assetFeatureProps,
  computeInitialFit,
  computeAllBounds,
  spiderfyOffsets,
  buildSpiderfyGeoJson,
  SPIDERFY_MAX_MEMBERS,
} from './mapV2GeoJson';
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

  it('inclui campos visuais por feature: iconKey, status, statusColor, selected', () => {
    const cart = makeAsset({ id: 'c1', category: 'cart', code: 'ZAF-CART-01' });
    const box = makeAsset({ id: 'b1', category: 'box', code: 'SJ-BOX-01' });
    const fc = assetsToGeoJson([cart, box], 'b1');

    const byId = Object.fromEntries(fc.features.map((f) => [f.properties.id, f.properties]));
    expect(byId.c1.iconKey).toBe('cart');
    expect(byId.b1.iconKey).toBe('box');
    expect(byId.b1.selected).toBe(true);
    expect(byId.c1.selected).toBe(false);
    expect(byId.c1.statusColor).toMatch(/^#[0-9a-f]{6}$/i);
    expect(typeof byId.c1.name).toBe('string');
    expect(byId.c1.code).toBe('ZAF-CART-01');
  });
});

describe('MapV2 — computeInitialFit (fit por prioridade, outliers não destroem)', () => {
  const makeAt = (id: string, lat: number, lng: number, o: Partial<AssetDevice> = {}): AssetDevice =>
    makeAsset({
      id,
      category: o.category ?? 'cart',
      telemetry: { ...makeAsset().telemetry, latitude: lat, longitude: lng },
      ...o,
    });

  it('nenhum ativo -> kind none', () => {
    expect(computeInitialFit([]).kind).toBe('none');
  });

  it('sem posição válida -> none (sem coordenada default fabricada)', () => {
    const noPos = makeAsset({ telemetry: { ...makeAsset().telemetry, latitude: NaN, longitude: NaN } });
    expect(computeInitialFit([noPos]).kind).toBe('none');
  });

  it('ativo único -> center com zoom confortável', () => {
    const r = computeInitialFit([makeAt('a', -23.5, -46.6)]);
    expect(r.kind).toBe('center');
    if (r.kind === 'center') {
      expect(r.lat).toBeCloseTo(-23.5, 6);
      expect(r.zoom).toBe(16);
    }
  });

  it('ativo selecionado tem prioridade absoluta (center zoom 17)', () => {
    const assets = [
      makeAt('sel', -23.5, -46.6),
      makeAt('other', -22.5, -47.5),
      makeAt('far', -21.0, -50.0),
    ];
    const r = computeInitialFit(assets, { selectedAssetId: 'sel' });
    expect(r.kind).toBe('center');
    if (r.kind === 'center') {
      expect(r.lat).toBeCloseTo(-23.5, 6);
      expect(r.lng).toBeCloseTo(-46.6, 6);
      expect(r.zoom).toBe(17);
    }
  });

  it('outlier MUITO distante não estoura o bounds (fica fora do fit, ainda renderizado)', () => {
    // Núcleo em São Paulo + um outlier no Pará (mesma categoria, nunca removido).
    const core = [
      makeAt('a', -23.5505, -46.6333),
      makeAt('b', -23.5620, -46.6500),
      makeAt('c', -23.5400, -46.6100),
      makeAt('d', -23.5450, -46.6250),
    ];
    const outlier = makeAt('far', -1.45, -48.48);
    const r = computeInitialFit([...core, outlier]);
    expect(r.kind).toBe('bounds');
    if (r.kind === 'bounds') {
      // O fit inicial de 80% (mín 4) não inclui o outlier (-1.45 do núcleo).
      expect(r.bounds.south).toBeGreaterThan(-24);
      expect(r.bounds.north).toBeLessThan(-23);
      expect(r.outlierCount).toBe(1);
    }
  });

  it('computeAllBounds (Ver todos) inclui o outlier de verdade', () => {
    const core = [
      makeAt('a', -23.5505, -46.6333),
      makeAt('b', -23.5620, -46.6500),
    ];
    const outlier = makeAt('far', -1.45, -48.48);
    const b = computeAllBounds([...core, outlier]);
    expect(b).not.toBeNull();
    expect(b!.south).toBeCloseTo(-23.5620, 4);
    expect(b!.north).toBeCloseTo(-1.45, 4);
  });

  it('geofences da unidade têm prioridade sobre o fit por ativos', () => {
    const assets = [makeAt('a', -23.5505, -46.6333), makeAt('b', -23.5620, -46.6500)];
    const geo = makeGeofence({
      type: 'polygon',
      radius: undefined,
      coordinates: [
        [-23.55, -46.63],
        [-23.551, -46.631],
        [-23.552, -46.629],
      ],
    });
    const r = computeInitialFit(assets, { geofences: [geo] });
    expect(r.kind).toBe('bounds');
  });
});

describe('MapV2 — spiderfy (expansão de cluster com ícones individuais)', () => {
  it('spiderfyOffsets gera N posições distintas ao redor do centro (pixels)', () => {
    const offsets = spiderfyOffsets(5);
    expect(offsets).toHaveLength(5);
    const unique = new Set(offsets.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`));
    expect(unique.size).toBe(5);
    // Primeiro offset no topo (ângulo -90° -> dy negativo), como spiderfy clássico.
    expect(offsets[0][1]).toBeLessThan(0);
  });

  it('spiderfyOffsets(1) -> [0,0]', () => {
    expect(spiderfyOffsets(1)).toEqual([[0, 0]]);
  });

  it('não expande clusters gigantes (limite SPIDERFY_MAX_MEMBERS)', () => {
    const offsets = spiderfyOffsets(SPIDERFY_MAX_MEMBERS);
    expect(offsets).toHaveLength(SPIDERFY_MAX_MEMBERS);
  });

  it('buildSpiderfyGeoJson preserva o ícone de cada membro (5 carrinhos + 2 caixas)', () => {
    const members = [
      ...['c1', 'c2', 'c3', 'c4', 'c5'].map((id) => makeAsset({ id, category: 'cart' })),
      makeAsset({ id: 'b1', category: 'box' }),
      makeAsset({ id: 'b2', category: 'box' }),
    ];
    const centers = members.map((a) => ({
      lat: a.telemetry.latitude + (Math.random() - 0.5) * 0.0001,
      lng: a.telemetry.longitude + (Math.random() - 0.5) * 0.0001,
    }));
    const fc = buildSpiderfyGeoJson(members, centers);

    const icons = fc.features.map((f) => f.properties.iconKey);
    expect(icons.filter((k) => k === 'cart')).toHaveLength(5);
    expect(icons.filter((k) => k === 'box')).toHaveLength(2);
    // Cada membro no seu próprio ponto (não todos sobrepostos).
    const coords = fc.features.map((f) => f.geometry.coordinates.join(','));
    expect(new Set(coords).size).toBe(members.length);
  });

  it('assetFeatureProps: subcategoria agro-cattle vira vaca (não genérico)', () => {
    const p = assetFeatureProps(makeAsset({ id: 'v1', category: 'agro', subcategory: 'cattle' }));
    expect(p.iconKey).toBe('agro-cattle');
  });
});
