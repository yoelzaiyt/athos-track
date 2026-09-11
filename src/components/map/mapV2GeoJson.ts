import { AssetDevice, Geofence } from '../../types';
import { ASSET_CATEGORY_META } from '../common/AssetIconRegistry';

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

export function assetsToGeoJson(assets: AssetDevice[]) {
  return {
    type: 'FeatureCollection' as const,
    features: assets
      .filter((a) => Number.isFinite(a.telemetry?.latitude) && Number.isFinite(a.telemetry?.longitude))
      .map((a) => ({
        type: 'Feature' as const,
        properties: {
          id: a.id,
          category: a.category,
          status: a.status,
          name: a.name,
          color: categoryPrimaryColor(a.category),
        },
        geometry: { type: 'Point' as const, coordinates: [a.telemetry.longitude, a.telemetry.latitude] },
      })),
  };
}
