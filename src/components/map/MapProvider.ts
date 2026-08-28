import L from 'leaflet';
import { MapViewMode, ThemeMode } from '../../types';

const BRASILIA_TIMEZONE = 'America/Sao_Paulo';

/**
 * Tema das camadas do mapa (claro/escuro) decidido automaticamente pelo horário de
 * Brasília, independente do tema manual escolhido pelo usuário para as páginas
 * (aquele é controlado pelo ícone no topo e não deve afetar a renderização do mapa).
 * Dia (06h–17h59 em Brasília) → tiles claros; fora disso → tiles escuros.
 */
export function getBrasiliaAutoMapTheme(): ThemeMode {
  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: BRASILIA_TIMEZONE,
    hour: 'numeric',
    hour12: false,
  }).format(new Date());
  const hour = parseInt(hourStr, 10) % 24;
  return hour >= 6 && hour < 18 ? 'light' : 'dark';
}

export interface TileProviderConfig {
  id: MapViewMode;
  name: string;
  url: string;
  attribution: string;
  overlayUrl?: string; // For Hybrid mode road/label overlay
  overlayAttribution?: string;
  maxZoom: number;
}

export interface MapProviderAbstraction {
  getTileConfig(mode: MapViewMode, themeMode?: ThemeMode): TileProviderConfig;
  loadPreferences(): { mode: MapViewMode; zoom: number; layers: Record<string, boolean> };
  savePreferences(prefs: { mode?: MapViewMode; zoom?: number; layers?: Record<string, boolean> }): void;
}

class AthosMapProvider implements MapProviderAbstraction {
  private STORAGE_KEY = 'athos_map_preferences_v1';

  public getTileConfig(mode: MapViewMode, themeMode: ThemeMode = 'dark'): TileProviderConfig {
    if (mode === '2D') {
      // CARTO descontinuou o acesso anônimo aos estilos Voyager/Dark (agora exige API
      // key própria: carto.com/basemaps/apikey). Claro usa o tile clássico do OSM (mesmo
      // provider do modo STREETS, sem chave em qualquer domínio). Escuro usa Stadia Maps
      // (tiles.stadiamaps.com) — free tier sem chave apenas quando o Referer é localhost;
      // em produção precisa de uma API key gratuita da Stadia (ver comentário em NIGHT).
      if (themeMode === 'light') {
        return {
          id: '2D',
          name: 'Vetor 2D Operacional (Claro)',
          url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        };
      }
      return {
        id: '2D',
        name: 'Vetor 2D Operacional (Escuro)',
        url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
        attribution:
          '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      };
    }

    if (mode === 'SATELLITE') {
      return {
        id: 'SATELLITE',
        name: 'Imagem de Satélite HD',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: '&copy; Esri, Maxar, Earthstar Geographics, USDA, USGS',
        maxZoom: 19,
      };
    }

    if (mode === 'HYBRID') {
      return {
        id: 'HYBRID',
        name: 'Satélite Híbrido com Ruas',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: '&copy; Esri &copy; OpenStreetMap',
        overlayUrl: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png',
        overlayAttribution: '&copy; CARTO &copy; OpenStreetMap',
        maxZoom: 19,
      };
    }

    if (mode === 'STREETS') {
      return {
        id: 'STREETS',
        name: 'Ruas Padrão (OSM Clássico)',
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      };
    }

    if (mode === 'TERRAIN') {
      return {
        id: 'TERRAIN',
        name: 'Terreno (Relevo)',
        url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        attribution: '&copy; OpenStreetMap contributors, SRTM | &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
        maxZoom: 17,
      };
    }

    if (mode === 'NIGHT') {
      // Mesma ressalva do 2D escuro: Stadia libera uso anônimo só com Referer localhost
      // (dev). Em produção (domínio real), sem VITE_STADIA_API_KEY isso volta a quebrar
      // como a CARTO quebrou — precisa de conta gratuita em stadiamaps.com e trocar a
      // URL por .../alidade_smooth_dark/{z}/{x}/{y}{r}.png?api_key=SUA_CHAVE.
      return {
        id: 'NIGHT',
        name: 'Modo Noturno Manual',
        url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
        attribution:
          '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      };
    }

    // TRAFFIC: base de ruas clara + camada de congestionamento (mock) desenhada pelo AssetMap
    return {
      id: 'TRAFFIC',
      name: 'Trânsito em Tempo Real',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    };
  }

  public loadPreferences() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          mode: (parsed.mode as MapViewMode) || '2D',
          zoom: parsed.zoom || 13,
          layers: parsed.layers || {
            geofences: true,
            routes: true,
            alerts: true,
            events: true,
            stops: true,
            clusters: true,
            gpsAccuracy: true,
            heatmap: false,
          },
        };
      }
    } catch (e) {
      console.warn('Failed to load map preferences', e);
    }
    return {
      mode: '2D' as MapViewMode,
      zoom: 13,
      layers: {
        geofences: true,
        routes: true,
        alerts: true,
        events: true,
        stops: true,
        clusters: true,
        gpsAccuracy: true,
        heatmap: false,
      },
    };
  }

  public savePreferences(prefs: { mode?: MapViewMode; zoom?: number; layers?: Record<string, boolean> }) {
    try {
      const existing = this.loadPreferences();
      const updated = {
        ...existing,
        ...prefs,
        layers: { ...existing.layers, ...(prefs.layers || {}) },
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save map preferences', e);
    }
  }
}

export const mapProvider = new AthosMapProvider();
