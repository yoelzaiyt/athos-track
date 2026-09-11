import { AssetDevice, Geofence } from '../../types';
import { ASSET_CATEGORY_META } from '../common/AssetIconRegistry';
import { resolveIconKey, resolveStatusVisual, SELECTED_COLOR } from '../../lib/assetVisualResolver';

// Não importa de './AssetIcons' de propósito: aquele módulo importa 'leaflet',
// que acessa `window` no topo do arquivo e quebra em teste unitário puro
// (ambiente node, sem DOM). ASSET_CATEGORY_META não tem essa dependência.
function categoryPrimaryColor(category: AssetDevice['category']): string {
  return (ASSET_CATEGORY_META[category] || ASSET_CATEGORY_META.asset).primaryColor;
}

/**
 * Conversores puros (sem React, sem DOM, sem MapLibre) entre os dados de
 * negócio do ATHOS Track e GeoJSON consumido pelo AssetMapV2. Extraído em
 * módulo próprio para ser testável sem precisar montar AssetContext/localStorage
 * (mesma convenção de BrGpsMapper.ts).
 */

export function circlePolygon(centerLat: number, centerLng: number, radiusMeters: number, points = 64): [number, number][] {
  // Aproximação geodésica local (sem turf.js) — mesma matemática haversine já
  // usada no motor de geofence do servidor (server/integrations/shared/geofenceEngine.ts).
  const R = 6371000;
  const coords: [number, number][] = [];
  const latRad = (centerLat * Math.PI) / 180;
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dLat = (radiusMeters / R) * Math.cos(angle);
    const dLng = ((radiusMeters / R) * Math.sin(angle)) / Math.cos(latRad);
    coords.push([centerLng + (dLng * 180) / Math.PI, centerLat + (dLat * 180) / Math.PI]);
  }
  return coords;
}

export function geofenceToGeoJsonFeature(g: Geofence) {
  const ring =
    g.type === 'circle' && g.radius
      ? circlePolygon(g.coordinates[0][0], g.coordinates[0][1], g.radius)
      : g.coordinates.map(([lat, lng]) => [lng, lat] as [number, number]);
  return {
    type: 'Feature' as const,
    properties: { id: g.id, name: g.name, color: g.color },
    geometry: { type: 'Polygon' as const, coordinates: [ring] },
  };
}

export interface AssetGeoFeatureProps {
  id: string;
  category: AssetDevice['category'];
  subcategory?: string;
  status: AssetDevice['status'];
  statusColor: string;
  iconKey: string;
  selected: boolean;
  name: string;
  code: string;
  color: string;
}

export function assetFeatureProps(
  asset: AssetDevice,
  selectedAssetId?: string | null
): AssetGeoFeatureProps {
  const statusVisual = resolveStatusVisual(asset.status, asset.telemetry?.lastCommunication, {
    speed: asset.telemetry?.speed,
  });
  return {
    id: asset.id,
    category: asset.category,
    subcategory: asset.subcategory,
    status: asset.status,
    statusColor: statusVisual.color,
    iconKey: resolveIconKey(asset.category, asset.subcategory),
    selected: selectedAssetId != null && asset.id === selectedAssetId,
    name: asset.name,
    code: asset.code,
    color: categoryPrimaryColor(asset.category),
  };
}

export function assetsToGeoJson(assets: AssetDevice[], selectedAssetId?: string | null) {
  return {
    type: 'FeatureCollection' as const,
    features: assets
      .filter((a) => Number.isFinite(a.telemetry?.latitude) && Number.isFinite(a.telemetry?.longitude))
      .map((a) => ({
        type: 'Feature' as const,
        properties: assetFeatureProps(a, selectedAssetId),
        geometry: { type: 'Point' as const, coordinates: [a.telemetry.longitude, a.telemetry.latitude] },
      })),
  };
}

// ===================== Enquadramento inicial / fit robusto =====================

export interface GeoBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export type InitialFitResult =
  | { kind: 'none' }
  | { kind: 'center'; lat: number; lng: number; zoom: number }
  | { kind: 'bounds'; bounds: GeoBounds; outlierCount: number };

export interface InitialFitOptions {
  selectedAssetId?: string | null;
  geofences?: Geofence[];
}

interface Pos { lat: number; lng: number }

/** Distância euclidiana em graus (aproximação suficiente pra ranquear outliers). */
function degDistance(a: Pos, b: Pos): number {
  return Math.hypot(a.lat - b.lat, a.lng - b.lng);
}

function assetsWithPosition(assets: AssetDevice[]): (AssetDevice & { telemetry: { latitude: number; longitude: number } })[] {
  return assets.filter(
    (a): a is AssetDevice & { telemetry: { latitude: number; longitude: number } } =>
      a.telemetry != null &&
      Number.isFinite(a.telemetry.latitude) &&
      Number.isFinite(a.telemetry.longitude)
  ) as (AssetDevice & { telemetry: { latitude: number; longitude: number } })[];
}

function boundsOf(points: Pos[]): GeoBounds | null {
  if (points.length === 0) return null;
  let north = -Infinity, south = Infinity, east = -Infinity, west = Infinity;
  for (const p of points) {
    if (p.lat > north) north = p.lat;
    if (p.lat < south) south = p.lat;
    if (p.lng > east) east = p.lng;
    if (p.lng < west) west = p.lng;
  }
  return { north, south, east, west };
}

/**
 * Fit inicial por prioridade (seção 7 do brief):
 *   1. unidade (ativo) selecionada -> centro com zoom confortável;
 *   2. geofence da unidade          -> enquadrar a zona operacional;
 *   3. ativos próximos/operacionais -> bounds do núcleo central;
 *   4. outliers                    -> NUNCA destroem o enquadramento (ficam
 *      no sistema e continuam renderizados, só não entram no fit inicial).
 *
 * "Ver todos os ativos" é um caminho separado (computeAllBounds).
 */
export function computeInitialFit(
  assets: AssetDevice[],
  opts: InitialFitOptions = {}
): InitialFitResult {
  const withPos = assetsWithPosition(assets);

  // 1. Ativo selecionado tem prioridade absoluta (enquadrar a unidade).
  if (opts.selectedAssetId) {
    const selected = withPos.find((a) => a.id === opts.selectedAssetId);
    if (selected) {
      return { kind: 'center', lat: selected.telemetry.latitude, lng: selected.telemetry.longitude, zoom: 17 };
    }
  }

  // 2. Geofences = zona operacional conhecida.
  const geos = opts.geofences ?? [];
  if (geos.length > 0) {
    const geoPoints: Pos[] = [];
    for (const g of geos) {
      if (g.type === 'circle' && g.radius && g.coordinates[0]) {
        const [lat, lng] = g.coordinates[0];
        // Aproximação: raio em metros vira deslocamento angular pequeno.
        const R = 6371000;
        const dLat = g.radius / R;
        const dLng = g.radius / (R * Math.cos((lat * Math.PI) / 180));
        geoPoints.push({ lat: lat + dLat, lng });
        geoPoints.push({ lat: lat - dLat, lng });
        geoPoints.push({ lat, lng: lng + dLng });
        geoPoints.push({ lat, lng: lng - dLng });
      } else {
        for (const [lat, lng] of g.coordinates) geoPoints.push({ lat, lng });
      }
    }
    if (geoPoints.length > 0) {
      const b = boundsOf(geoPoints)!;
      return { kind: 'bounds', bounds: b, outlierCount: 0 };
    }
  }

  if (withPos.length === 0) return { kind: 'none' };
  if (withPos.length === 1) {
    const a = withPos[0];
    return { kind: 'center', lat: a.telemetry.latitude, lng: a.telemetry.longitude, zoom: 16 };
  }

  // 3+4. Núcleo central: remove os outliers mais distantes do centroide antes
  // de calcular o enquadramento. Regra determinística: mantém os 80% mais
  // próximos do centroide (mínimo 3 ativos) — outliers continuam renderizados.
  const centroid: Pos = {
    lat: withPos.reduce((acc, a) => acc + a.telemetry.latitude, 0) / withPos.length,
    lng: withPos.reduce((acc, a) => acc + a.telemetry.longitude, 0) / withPos.length,
  };
  const ranked = [...withPos]
    .map((a) => ({ a, d: degDistance({ lat: a.telemetry.latitude, lng: a.telemetry.longitude }, centroid) }))
    .sort((x, y) => x.d - y.d);

  const keepCount = Math.max(3, Math.ceil(ranked.length * 0.8));
  const core = ranked.slice(0, keepCount);
  const outlierCount = ranked.length - keepCount;

  if (keepCount === 1) {
    const a = core[0].a;
    return { kind: 'center', lat: a.telemetry.latitude, lng: a.telemetry.longitude, zoom: 16 };
  }
  const b = boundsOf(core.map((r) => ({ lat: r.a.telemetry.latitude, lng: r.a.telemetry.longitude })))!;
  return { kind: 'bounds', bounds: b, outlierCount };
}

/**
 * "Ver todos os ativos": enquadramento completo, incluindo outliers.
 * Caminho explícito, separado do fit inicial robusto.
 */
export function computeAllBounds(assets: AssetDevice[]): GeoBounds | null {
  const withPos = assetsWithPosition(assets).map((a) => ({
    lat: a.telemetry.latitude,
    lng: a.telemetry.longitude,
  }));
  if (withPos.length === 0) return null;
  if (withPos.length === 1) {
    const { lat, lng } = withPos[0];
    return { north: lat, south: lat, east: lng, west: lng };
  }
  return boundsOf(withPos);
}

// ===================== Spiderfy / expansão de cluster =====================

/** Máximo de membros de um cluster que fazem spiderfy em vez de zoom. */
export const SPIDERFY_MAX_MEMBERS = 12;

/**
 * Offsets em PIXELS (dx, dy) para colocar os membros de um cluster em círculo
 * ao redor do centroide (Mesmo layout clássico de spiderfy do markercluster).
 * Puro — o componente converte pixel -> lat/lng via map.project/unproject.
 */
export function spiderfyOffsets(count: number): [number, number][] {
  if (count <= 1) return [[0, 0]];
  // Raio cresce com o nº de membros para acomodar círculo sem sobrepor.
  const radius = 22 + count * 5;
  const offsets: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    offsets.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
  }
  return offsets;
}

/**
 * Palco do spiderfy: membros expandidos (FeatureCollection) prontos pra setData
 * no source auxiliar do V2. Reaproveita assetFeatureProps para cada membro
 * colocado no offsets[i] correspondente.
 */
export function buildSpiderfyGeoJson(
  members: AssetDevice[],
  centers: { lat: number; lng: number }[],
  selectedAssetId?: string | null
) {
  return {
    type: 'FeatureCollection' as const,
    features: members.map((a, i) => {
      const c = centers[i] ?? { lat: a.telemetry.latitude, lng: a.telemetry.longitude };
      return {
        type: 'Feature' as const,
        properties: assetFeatureProps(a, selectedAssetId),
        geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
      };
    }),
  };
}

export { SELECTED_COLOR };