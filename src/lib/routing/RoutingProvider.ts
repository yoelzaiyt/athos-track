// Abstração de motor de roteirização (seção 4 do brief de Recuperação de Ativos):
// o frontend chama getRoutingProvider() e não sabe/depende de qual fornecedor
// está por trás. Hoje só existe o adapter OSRM (reaproveita
// components/map/RoutingService.ts, já em uso no NavigationPanel/AssetMap — não
// duplica a lógica, só encapsula atrás da interface). Trocar de motor no futuro
// (OSRM próprio, Mapbox, Google Directions) é registrar um novo adapter aqui e
// apontar VITE_ROUTING_PROVIDER pra ele — nenhuma tela precisa mudar.
import * as osrm from '../../components/map/RoutingService';
import type { LatLng, NavigationProfile, RouteResult } from '../../components/map/RoutingService';

export type { LatLng, NavigationProfile, RouteResult };

export interface RoutingProvider {
  id: string;
  label: string;
  supportedProfiles: NavigationProfile[];
  fetchRoute(origin: LatLng, destination: LatLng, profile: NavigationProfile): Promise<RouteResult>;
}

class OsrmRoutingProvider implements RoutingProvider {
  readonly id = 'osrm-public-demo';
  readonly label = 'OSRM (servidor demo público)';
  readonly supportedProfiles: NavigationProfile[] = ['driving', 'walking', 'cycling'];
  fetchRoute = osrm.fetchRoute;
}

const PROVIDERS: Record<string, RoutingProvider> = {
  'osrm-public-demo': new OsrmRoutingProvider(),
};

export function getRoutingProvider(): RoutingProvider {
  const configured = import.meta.env.VITE_ROUTING_PROVIDER || 'osrm-public-demo';
  return PROVIDERS[configured] || PROVIDERS['osrm-public-demo'];
}

export function providerSupportsProfile(provider: RoutingProvider, profile: NavigationProfile): boolean {
  return provider.supportedProfiles.includes(profile);
}

export const {
  getCurrentPosition,
  buildWazeUrl,
  buildGoogleMapsUrl,
  formatDistance,
  formatDuration,
  suggestProfileForCategory,
} = osrm;
