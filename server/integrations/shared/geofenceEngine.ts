// Motor de geofence mínimo, reaproveitando o tipo Geofence já existente no ATHOS
// (circle/polygon — src/types/index.ts). Não é um sistema paralelo: as cercas
// continuam sendo cadastradas na tela normal de Geofences; isto só decide
// dentro/fora para uma posição recebida de um provedor real (BRGPS, GT06
// direto, etc.) — compartilhado entre server/integrations/*. Ver seção 27 do
// brief de integração BRGPS (onde essa lógica nasceu).

export interface GeofenceLike {
  id: string;
  name: string;
  type: 'circle' | 'polygon';
  coordinates: [number, number][];
  radius?: number;
}

const EARTH_RADIUS_M = 6_371_000;

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

function pointInPolygon(lat: number, lng: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [latI, lngI] = polygon[i];
    const [latJ, lngJ] = polygon[j];
    const intersects =
      lngI > lng !== lngJ > lng &&
      lat < ((latJ - latI) * (lng - lngI)) / (lngJ - lngI) + latI;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function isInsideGeofence(lat: number, lng: number, geofence: GeofenceLike): boolean {
  if (geofence.type === 'circle') {
    const [centerLat, centerLng] = geofence.coordinates[0] ?? [0, 0];
    return haversineMeters(lat, lng, centerLat, centerLng) <= (geofence.radius ?? 0);
  }
  return pointInPolygon(lat, lng, geofence.coordinates);
}
