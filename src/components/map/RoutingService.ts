// Motor de roteirização estilo Waze: calcula rota até o ativo, com instruções
// passo a passo, distância/tempo estimados e deep-links para apps de navegação.
// Usa o servidor demo público do OSRM (Open Source Routing Machine) — gratuito,
// sem chave de API, adequado para o protótipo. Em produção, trocar por um
// servidor OSRM próprio ou provedor pago (Mapbox/Google Directions).

export type NavigationProfile = 'driving' | 'walking' | 'cycling';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  coordinate: [number, number]; // lat, lng do início do passo
}

export interface RouteResult {
  coordinates: [number, number][]; // lat, lng — geometria completa da rota
  distanceMeters: number;
  durationSeconds: number;
  steps: RouteStep[];
}

const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1';

const PROFILE_PATH: Record<NavigationProfile, string> = {
  driving: 'driving',
  walking: 'foot',
  cycling: 'bike',
};

const MODIFIER_LABEL: Record<string, string> = {
  uturn: 'Faça o retorno',
  'sharp right': 'Vire acentuadamente à direita',
  right: 'Vire à direita',
  'slight right': 'Mantenha-se à direita',
  straight: 'Siga em frente',
  'slight left': 'Mantenha-se à esquerda',
  left: 'Vire à esquerda',
  'sharp left': 'Vire acentuadamente à esquerda',
};

function translateStep(step: any): string {
  const type = step.maneuver?.type as string | undefined;
  const modifier = step.maneuver?.modifier as string | undefined;
  const name = (step.name as string) || '';
  const roadPart = name ? ` em ${name}` : '';
  const modifierLabel = modifier ? MODIFIER_LABEL[modifier] : undefined;

  switch (type) {
    case 'depart':
      return `Siga${roadPart || ' pelo trajeto indicado'}`;
    case 'arrive':
      return 'Você chegou ao destino';
    case 'roundabout':
    case 'rotary':
      return `Entre na rotatória${roadPart}`;
    case 'exit roundabout':
    case 'exit rotary':
      return `Saia da rotatória${roadPart}`;
    case 'merge':
      return `Entre${roadPart}`;
    case 'on ramp':
      return `Pegue a rampa de acesso${roadPart}`;
    case 'off ramp':
      return `Saia pela rampa${roadPart}`;
    case 'fork':
      return `${modifierLabel || 'Mantenha-se na via'}${roadPart}`;
    case 'end of road':
      return `${modifierLabel || 'Continue'}${roadPart}`;
    case 'continue':
    case 'new name':
      return `Continue${roadPart}`;
    case 'turn':
    default:
      return `${modifierLabel || 'Siga'}${roadPart}`;
  }
}

export async function fetchRoute(
  origin: LatLng,
  destination: LatLng,
  profile: NavigationProfile = 'driving'
): Promise<RouteResult> {
  const profilePath = PROFILE_PATH[profile];
  const url = `${OSRM_BASE_URL}/${profilePath}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=true&alternatives=false`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Não foi possível calcular a rota até o ativo.');
  }

  const data = await response.json();
  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new Error('Nenhuma rota encontrada até a posição do ativo.');
  }

  const route = data.routes[0];
  const coordinates: [number, number][] = route.geometry.coordinates.map(
    (c: [number, number]) => [c[1], c[0]]
  );

  const steps: RouteStep[] = [];
  (route.legs || []).forEach((leg: any) => {
    (leg.steps || []).forEach((step: any) => {
      const loc = step.maneuver?.location as [number, number] | undefined;
      steps.push({
        instruction: translateStep(step),
        distanceMeters: step.distance || 0,
        durationSeconds: step.duration || 0,
        coordinate: loc ? [loc[1], loc[0]] : coordinates[0],
      });
    });
  });

  return {
    coordinates,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    steps,
  };
}

export function getCurrentPosition(): Promise<LatLng & { accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalização não é suportada neste dispositivo/navegador.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => {
        const messages: Record<number, string> = {
          1: 'Permissão de localização negada. Habilite o acesso à localização para navegar.',
          2: 'Não foi possível obter sua localização atual.',
          3: 'Tempo esgotado ao obter sua localização.',
        };
        reject(new Error(messages[err.code] || 'Falha ao obter localização atual.'));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  });
}

export function buildWazeUrl(destination: LatLng): string {
  return `https://waze.com/ul?ll=${destination.lat},${destination.lng}&navigate=yes`;
}

export function buildGoogleMapsUrl(destination: LatLng, profile: NavigationProfile = 'driving'): string {
  const travelmode = profile === 'walking' ? 'walking' : profile === 'cycling' ? 'bicycling' : 'driving';
  return `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&travelmode=${travelmode}`;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds: number): string {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h${minutes > 0 ? ` ${minutes}min` : ''}`;
}

/** Sugere o perfil de deslocamento mais adequado conforme a categoria do ativo. */
export function suggestProfileForCategory(category: string): NavigationProfile {
  if (category === 'cart' || category === 'tag' || category === 'asset' || category === 'bike') {
    return 'walking';
  }
  return 'driving';
}
