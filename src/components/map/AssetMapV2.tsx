import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MlMap, GeoJSONSource, MapLayerMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Layers, Locate, Maximize2, Minimize2, Navigation2, Satellite, Map as MapIcon, Globe2 } from 'lucide-react';
import { AssetDevice, AssetCategory, Geofence } from '../../types';
import { useAssets } from '../../context/AssetContext';
import { mapProvider } from './MapProvider';
import { circlePolygon, geofenceToGeoJsonFeature, assetsToGeoJson } from './mapV2GeoJson';

export { circlePolygon, geofenceToGeoJsonFeature, assetsToGeoJson };

/**
 * MAP V2 (POC) — mesma fonte de dados/realtime/isolamento de tenant do V1
 * (useAssets()/AssetContext, sem fetch próprio), engine de renderização trocada
 * para MapLibre GL JS. Ver OPERATIONAL-MAP-ARCHITECTURE.md e MAP-V2-POC-REPORT.md
 * para o que está DENTRO e FORA do escopo desta POC.
 *
 * Fora de escopo nesta primeira POC (permanece só no V1/AssetMap.tsx):
 * edição de geofence, floor plan overlay, modo de desenho de polígono,
 * replay/histórico, painel de rotas/navegação. Ver seção "Escopo" do relatório.
 */

export type MapV2Mode = '2D' | 'SATELLITE' | 'HYBRID';

export interface AssetMapV2Props {
  assetsList?: AssetDevice[];
  geofencesList?: Geofence[];
  selectedAssetOverride?: AssetDevice | null;
  onSelectAsset?: (asset: AssetDevice) => void;
  heightClass?: string;
  defaultMode?: MapV2Mode;
  enableFollowMode?: boolean;
}

const CLUSTER_SOURCE_ID = 'athos-assets-v2';
const GEOFENCE_SOURCE_ID = 'athos-geofences-v2';


export const AssetMapV2: React.FC<AssetMapV2Props> = ({
  assetsList,
  geofencesList,
  selectedAssetOverride,
  onSelectAsset,
  heightClass = 'h-[calc(100vh-4rem)]',
  defaultMode = '2D',
  enableFollowMode = false,
}) => {
  const { assets, geofences, selectedAsset, setSelectedAsset } = useAssets();
  const displayAssets = assetsList ?? assets;
  const displayGeofences = geofencesList ?? geofences;
  const currentSelected = selectedAssetOverride !== undefined ? selectedAssetOverride : selectedAsset;

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<MapV2Mode>(defaultMode);
  const [categoryFilter, setCategoryFilter] = useState<AssetCategory | 'all'>('all');
  const [isFollowing, setIsFollowing] = useState(enableFollowMode);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const visibleAssets = useMemo(
    () => (categoryFilter === 'all' ? displayAssets : displayAssets.filter((a) => a.category === categoryFilter)),
    [displayAssets, categoryFilter]
  );
  const assetsWithValidPosition = useMemo(
    () => visibleAssets.filter((a) => Number.isFinite(a.telemetry?.latitude) && Number.isFinite(a.telemetry?.longitude)),
    [visibleAssets]
  );

  const rasterStyle = useCallback((viewMode: MapV2Mode) => {
    const base = mapProvider.getTileConfig(viewMode === '2D' ? '2D' : viewMode === 'SATELLITE' ? 'SATELLITE' : 'HYBRID', 'dark');
    const sources: Record<string, unknown> = {
      base: { type: 'raster', tiles: [base.url.replace('{s}', 'a')], tileSize: 256, attribution: base.attribution },
    };
    const layers: unknown[] = [{ id: 'base', type: 'raster', source: 'base' }];
    if (base.overlayUrl) {
      sources.overlay = { type: 'raster', tiles: [base.overlayUrl.replace('{s}', 'a')], tileSize: 256, attribution: base.overlayAttribution };
      layers.push({ id: 'overlay', type: 'raster', source: 'overlay' });
    }
    return { version: 8 as const, sources, layers } as maplibregl.StyleSpecification;
  }, []);

  // Init — uma única vez. Trocar de modo depois só troca o style (setStyle),
  // não recria o mapa (equivalente ao "não recriar o mapa inteiro" do V1).
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: rasterStyle(defaultMode),
      center: [-46.6333, -23.5505],
      zoom: 13,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    mapRef.current = map;
    map.on('load', () => setReady(true));
    map.on('dragstart', () => setIsFollowing(false));
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Troca de modo (2D/SATELLITE/HYBRID) — setStyle preserva câmera via reuso manual.
  const prevModeRef = useRef(defaultMode);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || prevModeRef.current === mode) return;
    prevModeRef.current = mode;
    const center = map.getCenter();
    const zoom = map.getZoom();
    map.setStyle(rasterStyle(mode));
    map.once('style.load', () => {
      map.jumpTo({ center, zoom });
      wireSourcesAndLayers();
    });
  }, [mode, ready, rasterStyle]);

  const wireSourcesAndLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!map.getSource(CLUSTER_SOURCE_ID)) {
      map.addSource(CLUSTER_SOURCE_ID, {
        type: 'geojson',
        data: assetsToGeoJson(assetsWithValidPosition),
        cluster: true,
        clusterRadius: 48,
        clusterMaxZoom: 16,
      });
      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: CLUSTER_SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#0891b2',
          'circle-radius': ['step', ['get', 'point_count'], 16, 5, 20, 20, 26],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: CLUSTER_SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12 },
        paint: { 'text-color': '#ffffff' },
      });
      map.addLayer({
        id: 'asset-point',
        type: 'circle',
        source: CLUSTER_SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': 9,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      map.on('click', 'clusters', async (e: MapLayerMouseEvent) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        const clusterId = features[0]?.properties?.cluster_id;
        const source = map.getSource(CLUSTER_SOURCE_ID) as GeoJSONSource;
        if (clusterId == null) return;
        const zoom = await source.getClusterExpansionZoom(clusterId);
        const geom = features[0].geometry as GeoJSON.Point;
        map.easeTo({ center: geom.coordinates as [number, number], zoom });
      });
      map.on('click', 'asset-point', (e: MapLayerMouseEvent) => {
        const id = e.features?.[0]?.properties?.id;
        const asset = displayAssetsRef.current.find((a) => a.id === id);
        if (asset) {
          setSelectedAsset(asset);
          onSelectAssetRef.current?.(asset);
        }
      });
      map.on('mouseenter', 'asset-point', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'asset-point', () => (map.getCanvas().style.cursor = ''));
      map.on('mouseenter', 'clusters', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'clusters', () => (map.getCanvas().style.cursor = ''));
    }

    if (!map.getSource(GEOFENCE_SOURCE_ID)) {
      map.addSource(GEOFENCE_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: displayGeofencesRef.current.map(geofenceToGeoJsonFeature) },
      });
      map.addLayer({
        id: 'geofence-fill',
        type: 'fill',
        source: GEOFENCE_SOURCE_ID,
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.12 },
      });
      map.addLayer({
        id: 'geofence-line',
        type: 'line',
        source: GEOFENCE_SOURCE_ID,
        paint: { 'line-color': ['get', 'color'], 'line-width': 2 },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetsWithValidPosition]);

  // Refs "vivas" para não precisar recriar handlers de clique a cada tick de dados.
  const displayAssetsRef = useRef(displayAssets);
  displayAssetsRef.current = displayAssets;
  const displayGeofencesRef = useRef(displayGeofences);
  displayGeofencesRef.current = displayGeofences;
  const onSelectAssetRef = useRef(onSelectAsset);
  onSelectAssetRef.current = onSelectAsset;

  useEffect(() => {
    if (ready) wireSourcesAndLayers();
  }, [ready, wireSourcesAndLayers]);

  // Realtime incremental: só troca os dados da fonte GeoJSON (setData), nunca
  // recria mapa/layers — equivalente ao marker.setLatLng() do V1 (AssetMap.tsx:1347-1370).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource(CLUSTER_SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(assetsToGeoJson(assetsWithValidPosition));
  }, [assetsWithValidPosition, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource(GEOFENCE_SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData({ type: 'FeatureCollection', features: displayGeofences.map(geofenceToGeoJsonFeature) });
  }, [displayGeofences, ready]);

  // fitToVisibleAssets — genérico por asset_type, mesma semântica do V1
  // (AssetMap.tsx:410-433): sem coordenada default, sem "if categoria === cart".
  const fitToVisibleAssets = useCallback(() => {
    const map = mapRef.current;
    if (!map || assetsWithValidPosition.length === 0) return;
    if (assetsWithValidPosition.length === 1) {
      const a = assetsWithValidPosition[0];
      map.flyTo({ center: [a.telemetry.longitude, a.telemetry.latitude], zoom: 16 });
      return;
    }
    const bounds = new maplibregl.LngLatBounds();
    assetsWithValidPosition.forEach((a) => bounds.extend([a.telemetry.longitude, a.telemetry.latitude]));
    map.fitBounds(bounds, { padding: 60, maxZoom: 17, duration: 800 });
  }, [assetsWithValidPosition]);

  // Clique-para-focar vindo de fora (lista/card) — reage só à troca do ID selecionado.
  const prevSelectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !currentSelected) return;
    if (prevSelectedIdRef.current === currentSelected.id) return;
    prevSelectedIdRef.current = currentSelected.id;
    const { latitude, longitude } = currentSelected.telemetry;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return; // sem coordenada default
    map.flyTo({ center: [longitude, latitude], zoom: 17 });
  }, [currentSelected, ready]);

  // Seguir ativo — panTo contínuo na posição do ativo selecionado, sem alterar zoom.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !isFollowing || !currentSelected) return;
    const { latitude, longitude } = currentSelected.telemetry;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    map.panTo([longitude, latitude], { duration: 500 });
  }, [currentSelected?.telemetry.latitude, currentSelected?.telemetry.longitude, isFollowing, ready]);

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  return (
    <div className={`relative w-full ${heightClass}`} data-testid="asset-map-v2">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="absolute top-3 left-3 z-10 flex gap-1 rounded-lg bg-black/70 p-1 backdrop-blur">
        {(['2D', 'SATELLITE', 'HYBRID'] as MapV2Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${mode === m ? 'bg-cyan-600 text-white' : 'text-gray-300 hover:bg-white/10'}`}
          >
            {m === '2D' && <MapIcon size={14} />}
            {m === 'SATELLITE' && <Satellite size={14} />}
            {m === 'HYBRID' && <Layers size={14} />}
            {m}
          </button>
        ))}
      </div>
      <div className="absolute top-3 right-3 z-10 flex gap-1">
        <button
          title="Reajustar enquadramento"
          onClick={fitToVisibleAssets}
          className="rounded bg-black/70 p-2 text-gray-200 hover:bg-black/90"
        >
          <Locate size={16} />
        </button>
        <button
          title="Seguir ativo"
          onClick={() => setIsFollowing((v) => !v)}
          className={`rounded p-2 ${isFollowing ? 'bg-cyan-600 text-white' : 'bg-black/70 text-gray-200 hover:bg-black/90'}`}
        >
          <Navigation2 size={16} />
        </button>
        <button title="Tela cheia" onClick={toggleFullscreen} className="rounded bg-black/70 p-2 text-gray-200 hover:bg-black/90">
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>
      {/* 3D: DEFERRED nesta POC — sem fonte de dados de edifícios/terreno disponível
          hoje (ver MAP-V2-POC-REPORT.md, seção 3D). Não fabricado como "PASS". */}
      <div className="absolute bottom-3 left-3 z-10 rounded bg-black/70 px-2 py-1 text-[10px] text-gray-400">
        <Globe2 size={10} className="mr-1 inline" /> MAP V2 POC — MapLibre GL JS
      </div>
    </div>
  );
};
