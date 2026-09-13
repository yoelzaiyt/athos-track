import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MlMap, GeoJSONSource, MapLayerMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Layers,
  Maximize2,
  Minimize2,
  Navigation2,
  Satellite,
  Map as MapIcon,
  Globe2,
  X,
  Maximize,
  EyeIcon,
} from 'lucide-react';
import { AssetDevice, AssetCategory, Geofence } from '../../types';
import { useAssets } from '../../context/AssetContext';
import { mapProvider } from './MapProvider';
import { ASSET_CATEGORY_META } from '../common/AssetIconRegistry';
import { circlePolygon, geofenceToGeoJsonFeature, assetsToGeoJson, computeInitialFit, computeAllBounds, spiderfyOffsets } from './mapV2GeoJson';
import { resolveIconKey, resolveAssetVisual, buildSvgDocument, svgDocumentToDataUrl, SELECTED_COLOR, DEEP_SUBCATEGORIES } from '../../lib/assetVisualResolver';
import { resolveMapLanguage, getMapUIStrings, MapUIStrings } from '../../lib/mapLanguage';

export { circlePolygon, geofenceToGeoJsonFeature, assetsToGeoJson };

const MAP_MAX_SAFE_ZOOM = 19;
const MAP_MIN_ZOOM = 2;
const TILE_ERROR_THRESHOLD = 8;
const TILE_ERROR_WINDOW_MS = 30_000;

/**
 * MAP V2 — misma fonte de dados/realtime/isolamento de tenant do V1
 * (useAssets()/AssetContext), engine de renderização MapLibre GL JS.
 *
 * Esta rodada adiciona sobre a POC:
 *   - Ícone REAL por tipo de ativo (mesmo getAssetSVGPath do V1/AssetIconRegistry:
 *     carrinho, caixa, tag, veículo, bicho...), com anel de STATUS ao redor
 *     (colorido por estado: OFFLINE/STALE/ALERT/MOVIMENTO/sel.) — camada pura em
 *     src/lib/assetVisualResolver.ts.
 *   - Expansão de CLUSTER clicável preservando o ícone de cada ativo: clusters
 *     até 12 membros expandem em círculo (spiderfy, offsets em pixel); acima
 *     disso, zoom. Clique em ícone ampliado seleciona o ativo.
 *   - Fit inicial RESISTENTE A OUTLIERS (computeInitialFit: selecionado > geofence
 *     > núcleo central; outlier nunca destrói o enquadramento e nunca é apagado),
 *     + botão "Ver todos os ativos" (computeAllBounds, inclui outliers).
 *   - Realtime segue incremental (setData na fonte GeoJSON, nunca recria o mapa).
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
const SPIDERFY_SOURCE_ID = 'athos-spiderfy-v2';
const SPIDERFY_LINKS_SOURCE_ID = 'athos-spiderfy-links-v2';
const GEOFENCE_SOURCE_ID = 'athos-geofences-v2';

const ICON_CANVAS_PX = 64;
const ICON_PIXEL_RATIO = 2;

/** Limite de membros por cluster para expandir (spiderfy) em vez de dar zoom. */
const SPIDERFY_LIMIT = 12;

// ------------------- Catálogo & rasterização de ícones (SVG -> ImageData) -------------------
// O SVG dos ícones é o MESMO do V1 (getAssetSVGPath). Como o MapLibre só aceita
// ImageData/sprite, cada chave de ícone é rasterizada UMA vez (cache por sessão)
// e re-adicionada de forma SÍNCRONA após um setStyle (style.load limpa as imagens).
const iconImageCache = new Map<string, Promise<ImageData | null>>();

function buildIconCatalogKeys(): string[] {
  const keys: string[] = [];
  const cats = Object.keys(ASSET_CATEGORY_META) as AssetCategory[];
  for (const c of cats) keys.push(resolveIconKey(c));
  for (const sub of DEEP_SUBCATEGORIES.agro ?? []) keys.push(resolveIconKey('agro', sub));
  for (const sub of DEEP_SUBCATEGORIES.asset ?? []) keys.push(resolveIconKey('asset', sub));
  return [...new Set(keys)];
}

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function rasterizeIcon(iconKey: string): Promise<ImageData | null> {
  const dashIdx = iconKey.indexOf('-');
  const category = (dashIdx >= 0 ? iconKey.slice(0, dashIdx) : iconKey) as AssetCategory;
  const subcategory = dashIdx >= 0 ? iconKey.slice(dashIdx + 1) : undefined;
  const visual = resolveAssetVisual({ category, subcategory });
  const dataUrl = svgDocumentToDataUrl(buildSvgDocument(visual.svgMarkup, visual.primaryColor));

  const img = await loadImageElement(dataUrl);
  if (!img) return null;
  const canvas = document.createElement('canvas');
  canvas.width = ICON_CANVAS_PX;
  canvas.height = ICON_CANVAS_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  // Dark circular chip behind the icon for contrast on light/bright tiles.
  ctx.beginPath();
  ctx.arc(ICON_CANVAS_PX / 2, ICON_CANVAS_PX / 2, ICON_CANVAS_PX / 2 - 2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.fill();
  ctx.drawImage(img, 0, 0, ICON_CANVAS_PX, ICON_CANVAS_PX);
  return ctx.getImageData(0, 0, ICON_CANVAS_PX, ICON_CANVAS_PX);
}

function warmupCatalog(): Promise<void> {
  for (const key of buildIconCatalogKeys()) {
    if (!iconImageCache.has(key)) {
      iconImageCache.set(key, rasterizeIcon(key));
    }
  }
  return Promise.all([...iconImageCache.values()]).then(() => undefined);
}

async function addAllIconImages(map: MlMap): Promise<void> {
  for (const key of buildIconCatalogKeys()) {
    if (map.hasImage(key)) continue;
    const image = await iconImageCache.get(key);
    if (image) map.addImage(key, image, { pixelRatio: ICON_PIXEL_RATIO });
  }
}

// ------------------- Componente -------------------

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
  const lang = resolveMapLanguage();
  const ui = getMapUIStrings(lang);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<MapV2Mode>(defaultMode);
  const [isFollowing, setIsFollowing] = useState(enableFollowMode);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [outlierCount, setOutlierCount] = useState(0);
  const [spiderfyNotice, setSpiderfyNotice] = useState<string | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const tileErrorTimestampsRef = useRef<number[]>([]);

  // Refs "vivas" para handlers de clique e efeitos sem stale closure.
  const displayAssetsRef = useRef(displayAssets);
  displayAssetsRef.current = displayAssets;
  const displayGeofencesRef = useRef(displayGeofences);
  displayGeofencesRef.current = displayGeofences;
  const onSelectAssetRef = useRef(onSelectAsset);
  onSelectAssetRef.current = onSelectAsset;
  const currentSelectedRef = useRef(currentSelected);
  currentSelectedRef.current = currentSelected;
  const spiderfiedClusterIdRef = useRef<number | null>(null);
  const spiderfyStateRef = useRef<{ clusterId: number; center: { lng: number; lat: number }; leaves: GeoJSON.Feature<GeoJSON.Point>[] } | null>(null);
  const initializedRef = useRef(false);
  const handlersRegisteredRef = useRef(false);

  const assetsWithPositionRef = useRef(displayAssets.filter((a) => Number.isFinite(a.telemetry?.latitude) && Number.isFinite(a.telemetry?.longitude)));
  assetsWithPositionRef.current = displayAssets.filter((a) => Number.isFinite(a.telemetry?.latitude) && Number.isFinite(a.telemetry?.longitude));

  // Acelera o raster dos ícones já no mount (browser), independente do estilo.
  useEffect(() => {
    warmupCatalog().catch((e) => console.warn('[AssetMapV2] falha pré-render de ícones', e));
  }, []);

  const rasterStyle = useCallback((viewMode: MapV2Mode) => {
    const base = mapProvider.getTileConfig(viewMode === '2D' ? '2D' : viewMode === 'SATELLITE' ? 'SATELLITE' : 'HYBRID', 'dark');
    const sources: Record<string, unknown> = {
      base: { type: 'raster', tiles: [base.url.replace('{s}', 'a')], tileSize: 256, attribution: base.attribution, maxzoom: MAP_MAX_SAFE_ZOOM },
    };
    const layers: unknown[] = [{ id: 'base', type: 'raster', source: 'base' }];
    if (base.overlayUrl) {
      sources.overlay = { type: 'raster', tiles: [base.overlayUrl.replace('{s}', 'a')], tileSize: 256, attribution: base.overlayAttribution, maxzoom: MAP_MAX_SAFE_ZOOM };
      layers.push({ id: 'overlay', type: 'raster', source: 'overlay' });
    }
    return { version: 8 as const, sources, layers } as maplibregl.StyleSpecification;
  }, []);

  // ------------------------------------------------------------------
  // Construção do estilo em camadas (chamada no load e após cada setStyle).
  // ------------------------------------------------------------------
  const wireSourcesAndLayers = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;

    await addAllIconImages(map);

    if (!map.getSource(CLUSTER_SOURCE_ID)) {
      map.addSource(CLUSTER_SOURCE_ID, {
        type: 'geojson',
        data: assetsToGeoJson(assetsWithPositionRef.current),
        cluster: true,
        clusterRadius: 48,
        clusterMaxZoom: 16,
      });
      // Anel de cluster (agrupamento agregado).
      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: CLUSTER_SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#0e7490',
          'circle-radius': ['step', ['get', 'point_count'], 16, 5, 20, 20, 26],
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
        },
      });
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: CLUSTER_SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12 },
        paint: { 'text-color': '#ffffff', 'text-halo-color': '#0e7490', 'text-halo-width': 1.5 },
      });
      // Anel de STATUS ao redor de cada ativo individual (movimento/fora/offline/stale).
      map.addLayer({
        id: 'asset-ring',
        type: 'circle',
        source: CLUSTER_SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['case', ['get', 'selected'], SELECTED_COLOR, ['get', 'statusColor']],
          'circle-radius': ['interpolate', ['linear'], ['zoom'],
            10, ['case', ['get', 'selected'], 16, 10],
            14, ['case', ['get', 'selected'], 18, 13],
            18, ['case', ['get', 'selected'], 20, 15],
          ],
          'circle-stroke-width': 3,
          'circle-stroke-color': ['case', ['get', 'selected'], '#ffffff', 'rgba(255,255,255,0.85)'],
        },
      });
      // ÍCONE PROPRIETÁRIO de cada tipo de ativo (carrinho, caixa, tag, vaca...).
      map.addLayer({
        id: 'asset-icon',
        type: 'symbol',
        source: CLUSTER_SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': ['get', 'iconKey'],
          'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.65, 14, 0.9, 18, 1.05],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });
      // Rótulo só do ativo SELECIONADO (não polui o mapa com 100 nomes).
      map.addLayer({
        id: 'asset-label',
        type: 'symbol',
        source: CLUSTER_SOURCE_ID,
        filter: ['all', ['!', ['has', 'point_count']], ['get', 'selected']],
        layout: { 'text-field': ['get', 'code'], 'text-offset': [0, 1.6], 'text-size': 12, 'text-anchor': 'top' },
        paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.5 },
      });
    }

    if (!map.getSource(SPIDERFY_SOURCE_ID)) {
      map.addSource(SPIDERFY_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'spiderfy-ring',
        type: 'circle',
        source: SPIDERFY_SOURCE_ID,
        paint: {
          'circle-color': ['case', ['get', 'selected'], SELECTED_COLOR, ['get', 'statusColor']],
          'circle-radius': 13,
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
        },
      });
      map.addLayer({
        id: 'spiderfy-icon',
        type: 'symbol',
        source: SPIDERFY_SOURCE_ID,
        layout: {
          'icon-image': ['get', 'iconKey'],
          'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.65, 14, 0.9, 18, 1.05],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });
      map.addLayer({
        id: 'spiderfy-label',
        type: 'symbol',
        source: SPIDERFY_SOURCE_ID,
        filter: ['get', 'selected'],
        layout: { 'text-field': ['get', 'code'], 'text-offset': [0, 1.5], 'text-size': 11, 'text-anchor': 'top' },
        paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.5 },
      });
    }

    if (!map.getSource(SPIDERFY_LINKS_SOURCE_ID)) {
      map.addSource(SPIDERFY_LINKS_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'spiderfy-line',
        type: 'line',
        source: SPIDERFY_LINKS_SOURCE_ID,
        paint: { 'line-color': 'rgba(148,163,184,0.7)', 'line-width': 1, 'line-dasharray': [2, 2] },
      });
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
  }, []);

  // ------------------------------------------------------------------
  // Handlers de interação — registrados UMA vez (continuam válidos após setStyle).
  // ------------------------------------------------------------------
  const collapseSpiderfy = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    spiderfiedClusterIdRef.current = null;
    spiderfyStateRef.current = null;
    setSpiderfyNotice(null);
    const spider = map.getSource(SPIDERFY_SOURCE_ID) as GeoJSONSource | undefined;
    spider?.setData({ type: 'FeatureCollection', features: [] });
    const links = map.getSource(SPIDERFY_LINKS_SOURCE_ID) as GeoJSONSource | undefined;
    links?.setData({ type: 'FeatureCollection', features: [] });
    map.setFilter('clusters', ['has', 'point_count']);
    map.setFilter('cluster-count', ['has', 'point_count']);
  }, []);

  const renderSpiderfy = useCallback(
    (clusterId: number, center: { lng: number; lat: number }, leaves: GeoJSON.Feature<GeoJSON.Point>[]) => {
      const map = mapRef.current;
      if (!map || leaves.length === 0) return;
      spiderfiedClusterIdRef.current = clusterId;
      spiderfyStateRef.current = { clusterId, center, leaves };
      setSpiderfyNotice(ui.spiderfyNotice(leaves.length));

      const offsets = spiderfyOffsets(leaves.length);
      const selectedId = currentSelectedRef.current?.id ?? null;
      const features = leaves.map((leaf, i) => {
        const p = map.project([center.lng, center.lat]);
        const [dx, dy] = offsets[i] ?? [0, 0];
        const lp = map.unproject({ x: p.x + dx, y: p.y + dy });
        return {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [lp.lng, lp.lat] },
          properties: { ...leaf.properties, selected: leaf.properties?.id === selectedId },
        };
      });
      const links = leaves.map((leaf, i) => {
        const c = features[i].geometry.coordinates;
        return {
          type: 'Feature' as const,
          geometry: {
            type: 'LineString' as const,
            coordinates: [
              [center.lng, center.lat],
              c,
            ],
          },
          properties: {},
        };
      });

      (map.getSource(SPIDERFY_SOURCE_ID) as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features });
      (map.getSource(SPIDERFY_LINKS_SOURCE_ID) as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: links });
      // Esconde TODO cluster em spiderfy (para não desenhar o círculo por cima dos ícones).
      map.setFilter('clusters', ['all', ['has', 'point_count'], ['!=', ['get', 'cluster_id'], clusterId]]);
      map.setFilter('cluster-count', ['all', ['has', 'point_count'], ['!=', ['get', 'cluster_id'], clusterId]]);
    },
    []
  );

  const selectAssetById = useCallback((id: unknown) => {
    const asset = displayAssetsRef.current.find((a) => a.id === id);
    if (!asset) return;
    setSelectedAsset(asset);
    onSelectAssetRef.current?.(asset);
  }, [setSelectedAsset]);

  const registerHandlers = useCallback(() => {
    const map = mapRef.current;
    if (!map || handlersRegisteredRef.current) return;
    handlersRegisteredRef.current = true;

    map.on('click', 'clusters', async (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      const clusterId = feature?.properties?.cluster_id;
      if (clusterId == null) return;
      const source = map.getSource(CLUSTER_SOURCE_ID) as GeoJSONSource;
      const leaves = await source.getClusterLeaves(clusterId, 1000, 0);
      if (leaves.length > 1 && leaves.length <= SPIDERFY_LIMIT) {
        e.originalEvent.stopPropagation?.();
        renderSpiderfy(clusterId, e.lngLat, leaves);
        return;
      }
      const zoom = await source.getClusterExpansionZoom(clusterId);
      const geom = feature.geometry as GeoJSON.Point;
      map.easeTo({ center: geom.coordinates as [number, number], zoom });
    });

    map.on('click', 'asset-icon', (e: MapLayerMouseEvent) => {
      selectAssetById(e.features?.[0]?.properties?.id);
      const c = e.lngLat;
      map.flyTo({ center: [c.lng, c.lat], zoom: 17, duration: 600 });
    });
    map.on('click', 'asset-ring', (e: MapLayerMouseEvent) => {
      selectAssetById(e.features?.[0]?.properties?.id);
      const c = e.lngLat;
      map.flyTo({ center: [c.lng, c.lat], zoom: 17, duration: 600 });
    });
    map.on('click', 'spiderfy-icon', (e: MapLayerMouseEvent) => {
      selectAssetById(e.features?.[0]?.properties?.id);
      collapseSpiderfy();
      const c = e.lngLat;
      map.flyTo({ center: [c.lng, c.lat], zoom: 17, duration: 600 });
    });
    map.on('click', 'spiderfy-ring', (e: MapLayerMouseEvent) => {
      selectAssetById(e.features?.[0]?.properties?.id);
      collapseSpiderfy();
      const c = e.lngLat;
      map.flyTo({ center: [c.lng, c.lat], zoom: 17, duration: 600 });
    });

    // Clique em vazio -> recolhe o spiderfy.
    map.on('click', (e) => {
      if (e.defaultPrevented) return;
      if (spiderfiedClusterIdRef.current != null) collapseSpiderfy();
    });

    map.on('mouseenter', 'clusters', () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'clusters', () => (map.getCanvas().style.cursor = ''));
    map.on('mouseenter', 'asset-icon', () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'asset-icon', () => (map.getCanvas().style.cursor = ''));
    map.on('mouseenter', 'asset-ring', () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'asset-ring', () => (map.getCanvas().style.cursor = ''));
    map.on('mouseenter', 'spiderfy-icon', () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'spiderfy-icon', () => (map.getCanvas().style.cursor = ''));
    map.on('mouseenter', 'spiderfy-ring', () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'spiderfy-ring', () => (map.getCanvas().style.cursor = ''));
    map.on('dragstart', () => setIsFollowing(false));
  }, [collapseSpiderfy, renderSpiderfy, selectAssetById]);

  // ------------------------------------------------------------------
  // Init e ciclo de vida.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: rasterStyle(defaultMode),
      center: [-46.6333, -23.5505],
      zoom: 13,
      maxZoom: MAP_MAX_SAFE_ZOOM,
      minZoom: MAP_MIN_ZOOM,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    mapRef.current = map;
    map.on('load', () => setReady(true));
    // FASE 5: tile error monitoring + automatic fallback.
    map.on('error', (e) => {
      const now = Date.now();
      tileErrorTimestampsRef.current = tileErrorTimestampsRef.current.filter((t) => now - t < TILE_ERROR_WINDOW_MS);
      tileErrorTimestampsRef.current.push(now);
      if (tileErrorTimestampsRef.current.length >= TILE_ERROR_THRESHOLD && !fallbackNotice) {
        console.warn('[AssetMapV2] tile error threshold reached, switching to fallback basemap');
        setFallbackNotice('Tile provider unavailable — using fallback map');
        const center = map.getCenter();
        const zoom = map.getZoom();
        map.setStyle(rasterStyle('2D'));
        map.once('style.load', () => {
          map.jumpTo({ center, zoom });
          wireSourcesAndLayers().catch(() => undefined);
        });
      }
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      wireSourcesAndLayers().catch(() => undefined);
    });
  }, [mode, ready, rasterStyle, wireSourcesAndLayers]);

  const applyInitialFit = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const withPos = assetsWithPositionRef.current;
    const fit = computeInitialFit(withPos, {
      selectedAssetId: currentSelectedRef.current?.id ?? null,
      geofences: displayGeofencesRef.current,
    });
    if (fit.kind === 'center') {
      setOutlierCount(0);
      map.flyTo({ center: [fit.lng, fit.lat], zoom: fit.zoom, duration: 900 });
    } else if (fit.kind === 'bounds') {
      setOutlierCount(fit.outlierCount);
      const b = new maplibregl.LngLatBounds([fit.bounds.west, fit.bounds.south], [fit.bounds.east, fit.bounds.north]);
      map.fitBounds(b, { padding: { top: 80, bottom: 60, left: 90, right: 60 }, maxZoom: 16, duration: 900 });
    } else {
      setOutlierCount(0);
    }
  }, []);

  useEffect(() => {
    if (!ready || initializedRef.current) return;
    initializedRef.current = true;
    registerHandlers();
    wireSourcesAndLayers().then(() => applyInitialFit());
  }, [ready, applyInitialFit, registerHandlers, wireSourcesAndLayers]);

  // Realtime incremental — troca dados das fontes, nunca recria mapa/layers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource(CLUSTER_SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(assetsToGeoJson(assetsWithPositionRef.current));
  }, [ready, displayAssets]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource(GEOFENCE_SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData({ type: 'FeatureCollection', features: displayGeofencesRef.current.map(geofenceToGeoJsonFeature) });
  }, [ready, displayGeofences]);

  // Se um ativo do spiderfy troca de estado/seleção, re-renderiza o spiderfy.
  useEffect(() => {
    const map = mapRef.current;
    const state = spiderfyStateRef.current;
    if (!map || !ready || !state) return;
    renderSpiderfy(state.clusterId, state.center, state.leaves);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, displayAssets, currentSelected]);

  // Clique-para-focar vindo de fora (lista/card) — só quando o ID muda.
  const prevSelectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !currentSelected) return;
    if (prevSelectedIdRef.current === currentSelected.id) return;
    prevSelectedIdRef.current = currentSelected.id;
    const { latitude, longitude } = currentSelected.telemetry;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    map.flyTo({ center: [longitude, latitude], zoom: 17, duration: 700 });
  }, [currentSelected, ready]);

  // Seguir ativo.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !isFollowing || !currentSelected) return;
    const { latitude, longitude } = currentSelected.telemetry;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    map.panTo([longitude, latitude], { duration: 500 });
  }, [currentSelected?.telemetry.latitude, currentSelected?.telemetry.longitude, isFollowing, ready]);

  const fitToVisibleAssets = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const withPos = assetsWithPositionRef.current;
    const all = computeAllBounds(withPos);
    setOutlierCount(0);
    if (!all) return;
    if (withPos.length === 1) {
      map.flyTo({ center: [all.west, all.north], zoom: 16 });
      return;
    }
    const b = new maplibregl.LngLatBounds([all.west, all.south], [all.east, all.north]);
    map.fitBounds(b, { padding: { top: 80, bottom: 60, left: 90, right: 60 }, maxZoom: 17, duration: 800 });
  }, []);

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
      <div ref={containerRef} className="absolute inset-0" style={{ position: 'absolute', inset: 0 }} />

      {/* Modo 2D / Satélite / Híbrido */}
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
            {m === '2D' ? ui.mode2D : m === 'SATELLITE' ? ui.modeSatellite : ui.modeHybrid}
          </button>
        ))}
      </div>

      {/* Controles */}
      <div className="absolute top-3 right-3 z-10 flex gap-1">
        <button
          title={ui.viewAllAssets}
          onClick={fitToVisibleAssets}
          className="rounded bg-black/70 p-2 text-gray-200 hover:bg-black/90"
        >
          <Maximize size={16} />
        </button>
        <button
          title={ui.followAsset}
          onClick={() => setIsFollowing((v) => !v)}
          className={`rounded p-2 ${isFollowing ? 'bg-cyan-600 text-white' : 'bg-black/70 text-gray-200 hover:bg-black/90'}`}
        >
          <Navigation2 size={16} />
        </button>
        <button title={ui.fullscreen} onClick={toggleFullscreen} className="rounded bg-black/70 p-2 text-gray-200 hover:bg-black/90">
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>

      {/* Fallback tile notice */}
      {fallbackNotice && (
        <div className="absolute top-14 left-3 z-10 rounded-lg bg-amber-900/80 px-3 py-2 text-xs text-amber-200 shadow-lg backdrop-blur">
          {fallbackNotice}
        </div>
      )}

      {/* Aviso de outliers no fit inicial */}
      {outlierCount > 0 && (
        <div className="absolute bottom-12 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-black/80 px-3 py-2 text-xs text-gray-200 shadow-lg backdrop-blur">
          <EyeIcon size={12} className="mr-1 inline" />
          {ui.outlierNotice(outlierCount)}
          <button onClick={() => setOutlierCount(0)} className="ml-2 text-cyan-400 hover:text-cyan-300">
            ok
          </button>
        </div>
      )}

      {/* Nota do spiderfy */}
      {spiderfyNotice && (
        <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 flex items-center gap-2 rounded-lg bg-black/80 px-3 py-2 text-xs text-gray-200 shadow-lg backdrop-blur">
          <span>{spiderfyNotice}</span>
          <button onClick={collapseSpiderfy} className="rounded p-0.5 text-gray-400 hover:bg-white/10 hover:text-white">
            <X size={12} />
          </button>
        </div>
      )}

      <div className="absolute bottom-3 left-3 z-10 rounded bg-black/70 px-2 py-1 text-[10px] text-gray-400">
        <Globe2 size={10} className="mr-1 inline" /> {ui.labelMapV2}
      </div>
    </div>
  );
};