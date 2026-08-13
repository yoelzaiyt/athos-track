import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Maximize2,
  Minimize2,
  Layers,
  Search,
  Filter,
  Map as MapIcon,
  Satellite,
  Globe,
  Eye,
  BatteryCharging,
  Wifi,
  Navigation,
  Navigation2,
  Clock,
  Radio,
  Play,
  Shield,
  X,
  Building,
  User,
  Info,
  MapPin,
  ChevronRight,
  Sparkles,
  Locate,
  Flame,
  Grid,
  CheckCircle2,
  AlertOctagon,
  RotateCcw,
  Gauge,
  Activity,
  FileText,
  SlidersHorizontal,
} from 'lucide-react';
import {
  AssetDevice,
  AssetCategory,
  AssetStatus,
  Geofence,
  MapViewMode,
  RoutePoint,
  PositionSource,
} from '../../types';
import { useAssets } from '../../context/AssetContext';
import { useAuth } from '../../context/AuthContext';
import { mapProvider, getBrasiliaAutoMapTheme } from './MapProvider';
import {
  createAssetLeafletMarkerIcon,
  createClusterLeafletIcon,
  getCategoryThemeColor,
  getStatusBadgeInfo,
} from './AssetIcons';
import { AssetIcon, ASSET_CATEGORY_META } from '../common/AssetIconRegistry';
import { ReplayController } from './ReplayController';
import { NavigationPanel } from './NavigationPanel';
import {
  fetchRoute,
  getCurrentPosition,
  buildWazeUrl,
  buildGoogleMapsUrl,
  suggestProfileForCategory,
  NavigationProfile,
  RouteResult,
  LatLng,
} from './RoutingService';

export interface AssetMapProps {
  assetsList?: AssetDevice[];
  selectedAssetOverride?: AssetDevice | null;
  onSelectAsset?: (asset: AssetDevice) => void;
  heightClass?: string;
  defaultViewMode?: MapViewMode;
  showControls?: boolean;
  showFilters?: boolean;
  showStatsBar?: boolean;
  showClustering?: boolean;
  showDrawer?: boolean;
  enableFollowMode?: boolean;
  geofencesList?: Geofence[];
  routeHistory?: RoutePoint[];
  stoppagesList?: Array<{
    latitude: number;
    longitude: number;
    durationMin: number;
    startTime: string;
    endTime: string;
    locationName: string;
  }>;
  editableGeofence?: boolean;
  onGeofenceCreate?: (geo: Partial<Geofence>) => void;
  /** Modo de captura de ponto único no mapa (ex: centro de uma cerca circular). */
  pickPointMode?: boolean;
  onPointPicked?: (lat: number, lng: number) => void;
  /** Modo de desenho de polígono: cada clique no mapa adiciona um vértice. */
  polygonDraftMode?: boolean;
  polygonDraftPoints?: [number, number][];
  onPolygonPointAdded?: (lat: number, lng: number) => void;
  /** Planta baixa / imagem de referência sobreposta ao mapa para desenhar cercas com precisão. */
  floorPlanOverlay?: { url: string; bounds: [[number, number], [number, number]]; opacity: number } | null;
  specializedCategory?: AssetCategory;
  specializedTitle?: string;
  onOpenHistory?: (asset: AssetDevice) => void;
  onOpenGeofences?: (asset: AssetDevice) => void;
  onOpenAlerts?: (asset: AssetDevice) => void;
  onOpenReports?: (asset: AssetDevice) => void;
}

export const AssetMap: React.FC<AssetMapProps> = ({
  assetsList,
  selectedAssetOverride,
  onSelectAsset,
  heightClass = 'h-[calc(100vh-4rem)]',
  defaultViewMode,
  showControls = true,
  showFilters = true,
  showStatsBar = true,
  showClustering = true,
  showDrawer = true,
  enableFollowMode = false,
  geofencesList,
  routeHistory,
  stoppagesList = [],
  editableGeofence = false,
  onGeofenceCreate,
  pickPointMode = false,
  onPointPicked,
  polygonDraftMode = false,
  polygonDraftPoints = [],
  onPolygonPointAdded,
  floorPlanOverlay = null,
  specializedCategory,
  specializedTitle,
  onOpenHistory,
  onOpenGeofences,
  onOpenAlerts,
  onOpenReports,
}) => {
  const { assets, geofences, selectedAsset, setSelectedAsset } = useAssets();
  const { theme } = useAuth();

  // Tema dos tiles do mapa: automático pelo horário de Brasília, independente do
  // ícone de tema manual das páginas (que só afeta a UI de módulos/telas).
  const [mapTileTheme, setMapTileTheme] = useState<'light' | 'dark'>(() => getBrasiliaAutoMapTheme());
  useEffect(() => {
    const interval = setInterval(() => {
      setMapTileTheme(getBrasiliaAutoMapTheme());
    }, 60000);
    return () => clearInterval(interval);
  }, []);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const overlayTileLayerRef = useRef<L.TileLayer | null>(null);

  const markersRef = useRef<{ [id: string]: L.Marker }>({});
  const clustersRef = useRef<L.Marker[]>([]);
  const geofenceLayersRef = useRef<L.Layer[]>([]);
  const routeLayersRef = useRef<L.Layer[]>([]);
  const stoppageLayersRef = useRef<L.Layer[]>([]);
  const accuracyCirclesRef = useRef<{ [id: string]: L.Circle }>({});
  const navRouteLayerRef = useRef<L.Layer[]>([]);
  const userPositionMarkerRef = useRef<L.Marker | null>(null);
  const floorPlanLayerRef = useRef<L.ImageOverlay | null>(null);
  const pickedPointMarkerRef = useRef<L.Marker | null>(null);
  const polygonDraftLayerRef = useRef<L.Layer[]>([]);

  const savedPrefs = mapProvider.loadPreferences();

  const [viewMode, setViewMode] = useState<MapViewMode>(defaultViewMode || savedPrefs.mode);
  const [filterCategory, setFilterCategory] = useState<AssetCategory | 'all'>(
    specializedCategory || 'all'
  );
  const [filterStatus, setFilterStatus] = useState<AssetStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(enableFollowMode);

  // Active Map Layers Toggles
  const [layers, setLayers] = useState<Record<string, boolean>>({
    geofences: savedPrefs.layers.geofences ?? true,
    routes: savedPrefs.layers.routes ?? true,
    alerts: savedPrefs.layers.alerts ?? true,
    stops: savedPrefs.layers.stops ?? true,
    clusters: savedPrefs.layers.clusters ?? showClustering,
    gpsAccuracy: savedPrefs.layers.gpsAccuracy ?? true,
    heatmap: savedPrefs.layers.heatmap ?? false,
  });

  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [activeDrawerAsset, setActiveDrawerAsset] = useState<AssetDevice | null>(null);
  const [replayFramePoint, setReplayFramePoint] = useState<RoutePoint | null>(null);

  // Navegação estilo Waze até um ativo (recolher carrinho, localizar equipamento, veículo, etc.)
  const [navigationTarget, setNavigationTarget] = useState<AssetDevice | null>(null);
  const [navigationRoute, setNavigationRoute] = useState<RouteResult | null>(null);
  const [navigationProfile, setNavigationProfile] = useState<NavigationProfile>('driving');
  const [userPosition, setUserPosition] = useState<LatLng | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [navigationError, setNavigationError] = useState<string | null>(null);

  const startNavigation = async (asset: AssetDevice) => {
    const suggested = suggestProfileForCategory(asset.category);
    setNavigationTarget(asset);
    setNavigationRoute(null);
    setNavigationError(null);
    setNavigationProfile(suggested);
    setIsCalculatingRoute(true);
    try {
      const origin = await getCurrentPosition();
      setUserPosition({ lat: origin.lat, lng: origin.lng });
      const destination = { lat: asset.telemetry.latitude, lng: asset.telemetry.longitude };
      const result = await fetchRoute(origin, destination, suggested);
      setNavigationRoute(result);
    } catch (err: any) {
      setNavigationError(err?.message || 'Não foi possível calcular a rota até o ativo.');
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  const recalcNavigation = async (profileOverride?: NavigationProfile) => {
    if (!navigationTarget) return;
    const profile = profileOverride || navigationProfile;
    const liveTarget = assets.find((a) => a.id === navigationTarget.id) || navigationTarget;
    setNavigationTarget(liveTarget);
    setIsCalculatingRoute(true);
    setNavigationError(null);
    try {
      const origin = userPosition || (await getCurrentPosition());
      if (!userPosition) setUserPosition(origin);
      const destination = { lat: liveTarget.telemetry.latitude, lng: liveTarget.telemetry.longitude };
      const result = await fetchRoute(origin, destination, profile);
      setNavigationRoute(result);
    } catch (err: any) {
      setNavigationError(err?.message || 'Não foi possível calcular a rota até o ativo.');
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  const handleChangeNavigationProfile = (profile: NavigationProfile) => {
    setNavigationProfile(profile);
    recalcNavigation(profile);
  };

  const cancelNavigation = () => {
    setNavigationTarget(null);
    setNavigationRoute(null);
    setNavigationError(null);
    setUserPosition(null);
  };

  // Assets source
  const sourceAssets = assetsList || assets;
  const sourceGeofences = geofencesList || geofences;

  // Filtered Assets list
  const displayAssets = sourceAssets.filter((a) => {
    if (specializedCategory && a.category !== specializedCategory) return false;
    if (filterCategory !== 'all' && a.category !== filterCategory) return false;
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      return (
        a.name.toLowerCase().includes(q) ||
        a.code.toLowerCase().includes(q) ||
        a.unitName.toLowerCase().includes(q) ||
        a.imei.includes(q) ||
        (a.plateNumber && a.plateNumber.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Initialize Map Instance
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [-23.641414, -46.644827],
        zoom: savedPrefs.zoom || 13,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Save user pan/drag preference break follow mode
      map.on('dragstart', () => {
        setIsFollowing(false);
      });

      map.on('zoomend', () => {
        mapProvider.savePreferences({ zoom: map.getZoom() });
      });

      mapInstanceRef.current = map;
    }
  }, []);

  // Handle Tile Provider Switching (2D / SATÉLITE / HÍBRIDO)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const tileConfig = mapProvider.getTileConfig(viewMode, mapTileTheme);

    if (baseTileLayerRef.current) {
      map.removeLayer(baseTileLayerRef.current);
      baseTileLayerRef.current = null;
    }
    if (overlayTileLayerRef.current) {
      map.removeLayer(overlayTileLayerRef.current);
      overlayTileLayerRef.current = null;
    }

    const baseTile = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: tileConfig.maxZoom,
    }).addTo(map);

    baseTileLayerRef.current = baseTile;

    if (tileConfig.overlayUrl) {
      const overlayTile = L.tileLayer(tileConfig.overlayUrl, {
        attribution: tileConfig.overlayAttribution || '',
        maxZoom: tileConfig.maxZoom,
      }).addTo(map);
      overlayTileLayerRef.current = overlayTile;
    }

    mapProvider.savePreferences({ mode: viewMode });
  }, [viewMode, mapTileTheme]);

  // Planta baixa / imagem de referência do local sobreposta ao mapa
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (floorPlanLayerRef.current) {
      map.removeLayer(floorPlanLayerRef.current);
      floorPlanLayerRef.current = null;
    }

    if (floorPlanOverlay) {
      const overlay = L.imageOverlay(floorPlanOverlay.url, floorPlanOverlay.bounds, {
        opacity: floorPlanOverlay.opacity,
        interactive: false,
      }).addTo(map);
      floorPlanLayerRef.current = overlay;
    }
  }, [floorPlanOverlay]);

  // Captura de clique no mapa: ponto único (centro de cerca circular) ou vértices de polígono
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const active = pickPointMode || polygonDraftMode;

    map.getContainer().style.cursor = active ? 'crosshair' : '';
    if (!active) return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      if (pickPointMode && onPointPicked) {
        onPointPicked(e.latlng.lat, e.latlng.lng);
      } else if (polygonDraftMode && onPolygonPointAdded) {
        onPolygonPointAdded(e.latlng.lat, e.latlng.lng);
      }
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
      map.getContainer().style.cursor = '';
    };
  }, [pickPointMode, polygonDraftMode, onPointPicked, onPolygonPointAdded]);

  // Marcador do ponto capturado (centro da cerca) e prévia do polígono em desenho
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (pickedPointMarkerRef.current) {
      map.removeLayer(pickedPointMarkerRef.current);
      pickedPointMarkerRef.current = null;
    }
    polygonDraftLayerRef.current.forEach((l) => map.removeLayer(l));
    polygonDraftLayerRef.current = [];

    if (pickPointMode && polygonDraftPoints.length === 1 && !polygonDraftMode) {
      const icon = L.divIcon({
        className: 'athos-picked-point-icon',
        html: `<div style="width:18px;height:18px;border-radius:50%;background:#06b6d4;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      const marker = L.marker(polygonDraftPoints[0], { icon }).addTo(map);
      pickedPointMarkerRef.current = marker;
    }

    if (polygonDraftMode && polygonDraftPoints.length > 0) {
      polygonDraftPoints.forEach((pt) => {
        const vertexIcon = L.divIcon({
          className: 'athos-polygon-vertex-icon',
          html: `<div style="width:10px;height:10px;border-radius:50%;background:#06b6d4;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        });
        polygonDraftLayerRef.current.push(L.marker(pt, { icon: vertexIcon }).addTo(map));
      });

      if (polygonDraftPoints.length >= 2) {
        const preview =
          polygonDraftPoints.length >= 3
            ? L.polygon(polygonDraftPoints, { color: '#06b6d4', weight: 2, dashArray: '4, 6', fillOpacity: 0.15 })
            : L.polyline(polygonDraftPoints, { color: '#06b6d4', weight: 2, dashArray: '4, 6' });
        preview.addTo(map);
        polygonDraftLayerRef.current.push(preview);
      }
    }
  }, [pickPointMode, polygonDraftMode, polygonDraftPoints]);

  // Render Geofences
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    geofenceLayersRef.current.forEach((l) => map.removeLayer(l));
    geofenceLayersRef.current = [];

    if (!layers.geofences) return;

    sourceGeofences.forEach((geo) => {
      if (geo.type === 'circle' && geo.coordinates.length > 0) {
        const circle = L.circle(geo.coordinates[0], {
          radius: geo.radius || 300,
          color: geo.color || '#3b82f6',
          fillColor: geo.color || '#3b82f6',
          fillOpacity: 0.18,
          weight: 2,
          dashArray: '6, 6',
        }).addTo(map);

        circle.bindTooltip(`Cerca Virtual: ${geo.name}`, { permanent: false, direction: 'top' });
        geofenceLayersRef.current.push(circle);
      } else if (geo.type === 'polygon' && geo.coordinates.length >= 3) {
        const polygon = L.polygon(geo.coordinates, {
          color: geo.color || '#10b981',
          fillColor: geo.color || '#10b981',
          fillOpacity: 0.18,
          weight: 2,
        }).addTo(map);

        polygon.bindTooltip(`Cerca Virtual: ${geo.name}`, { permanent: false, direction: 'top' });
        geofenceLayersRef.current.push(polygon);
      }
    });
  }, [sourceGeofences, layers.geofences]);

  // Render Route History & Stoppages
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    routeLayersRef.current.forEach((l) => map.removeLayer(l));
    routeLayersRef.current = [];
    stoppageLayersRef.current.forEach((l) => map.removeLayer(l));
    stoppageLayersRef.current = [];

    if (layers.routes && routeHistory && routeHistory.length > 1) {
      const points: [number, number][] = routeHistory.map((p) => [p.latitude, p.longitude]);
      const polyline = L.polyline(points, {
        color: '#06b6d4',
        weight: 4,
        opacity: 0.85,
        smoothFactor: 1,
      }).addTo(map);

      routeLayersRef.current.push(polyline);

      // Fit map bounds to route
      map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
    }

    if (layers.stops && stoppagesList.length > 0) {
      stoppagesList.forEach((stop) => {
        const stopMarker = L.circleMarker([stop.latitude, stop.longitude], {
          radius: 8,
          color: '#f43f5e',
          fillColor: '#f43f5e',
          fillOpacity: 0.9,
          weight: 2,
        }).addTo(map);

        stopMarker.bindTooltip(
          `<strong>Parada (${stop.durationMin} min)</strong><br/>${stop.locationName}<br/>Início: ${stop.startTime}`,
          { permanent: false }
        );
        stoppageLayersRef.current.push(stopMarker);
      });
    }
  }, [routeHistory, stoppagesList, layers.routes, layers.stops]);

  // Render Waze-style Navigation Route & "You are here" marker
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    navRouteLayerRef.current.forEach((l) => map.removeLayer(l));
    navRouteLayerRef.current = [];

    if (userPositionMarkerRef.current) {
      map.removeLayer(userPositionMarkerRef.current);
      userPositionMarkerRef.current = null;
    }

    if (!navigationRoute || !userPosition) return;

    const routeLine = L.polyline(navigationRoute.coordinates, {
      color: '#a855f7',
      weight: 5,
      opacity: 0.9,
      dashArray: '1, 10',
      lineCap: 'round',
    }).addTo(map);
    navRouteLayerRef.current.push(routeLine);

    const userIcon = L.divIcon({
      className: 'athos-user-position-icon',
      html: `<div style="position: relative; width: 22px; height: 22px;">
        <span style="position: absolute; inset: -8px; border-radius: 50%; border: 2px solid #38bdf8; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; opacity: 0.7;"></span>
        <div style="width: 100%; height: 100%; border-radius: 50%; background: #0ea5e9; border: 3px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.4);"></div>
      </div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });

    const userMarker = L.marker([userPosition.lat, userPosition.lng], { icon: userIcon, zIndexOffset: 500 }).addTo(
      map
    );
    userMarker.bindTooltip('Sua posição atual', { direction: 'top' });
    userPositionMarkerRef.current = userMarker;

    map.fitBounds(routeLine.getBounds(), { padding: [80, 80] });
  }, [navigationRoute, userPosition]);

  // Render Assets & Clustering Logic
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Clear old markers
    Object.keys(markersRef.current).forEach((id) => {
      map.removeLayer(markersRef.current[id]);
    });
    markersRef.current = {};

    Object.keys(accuracyCirclesRef.current).forEach((id) => {
      map.removeLayer(accuracyCirclesRef.current[id]);
    });
    accuracyCirclesRef.current = {};

    clustersRef.current.forEach((c) => map.removeLayer(c));
    clustersRef.current = [];

    const currentZoom = map.getZoom();
    const enableClusters = layers.clusters && displayAssets.length > 25 && currentZoom < 12;

    if (enableClusters) {
      // Cluster assets into grid buckets
      const clusterMap: { [gridKey: string]: AssetDevice[] } = {};
      const gridSize = 0.08; // degrees lat/lng bucket

      displayAssets.forEach((asset) => {
        const lat = asset.telemetry.latitude;
        const lng = asset.telemetry.longitude;
        if (isNaN(lat) || isNaN(lng)) return;

        const gridLat = Math.floor(lat / gridSize) * gridSize;
        const gridLng = Math.floor(lng / gridSize) * gridSize;
        const key = `${gridLat.toFixed(3)}_${gridLng.toFixed(3)}`;

        if (!clusterMap[key]) clusterMap[key] = [];
        clusterMap[key].push(asset);
      });

      Object.values(clusterMap).forEach((clusterAssets) => {
        if (clusterAssets.length === 1) {
          const asset = clusterAssets[0];
          renderSingleAssetMarker(asset, map);
        } else {
          // Render cluster badge
          const avgLat =
            clusterAssets.reduce((acc, a) => acc + a.telemetry.latitude, 0) /
            clusterAssets.length;
          const avgLng =
            clusterAssets.reduce((acc, a) => acc + a.telemetry.longitude, 0) /
            clusterAssets.length;

          const theme = getCategoryThemeColor(clusterAssets[0].category);
          const icon = createClusterLeafletIcon(clusterAssets.length, theme.primary);

          const clusterMarker = L.marker([avgLat, avgLng], { icon }).addTo(map);
          clusterMarker.on('click', () => {
            map.flyTo([avgLat, avgLng], currentZoom + 3, { duration: 0.8 });
          });

          clustersRef.current.push(clusterMarker);
        }
      });
    } else {
      // Render all individual asset markers
      displayAssets.forEach((asset) => {
        renderSingleAssetMarker(asset, map);
      });
    }

    function renderSingleAssetMarker(asset: AssetDevice, mapInstance: L.Map) {
      const lat = asset.telemetry.latitude;
      const lng = asset.telemetry.longitude;
      if (isNaN(lat) || isNaN(lng)) return;

      const isSelected = (activeDrawerAsset || selectedAssetOverride || selectedAsset)?.id === asset.id;

      // Custom Leaflet Marker Icon
      const icon = createAssetLeafletMarkerIcon({
        isSelected,
        status: asset.status,
        heading: asset.telemetry.heading,
        batteryLevel: asset.telemetry.batteryLevel,
        category: asset.category,
        subcategory: asset.subcategory,
        code: asset.code,
        name: asset.name,
        speed: asset.telemetry.speed,
        themeMode: theme,
      });

      const marker = L.marker([lat, lng], { icon }).addTo(mapInstance);

      // Tooltip on Hover
      const categoryLabel = ASSET_CATEGORY_META[asset.category]?.label || asset.category;
      const statusBadge = getStatusBadgeInfo(asset.status);
      const isLight = theme === 'light';
      const tooltipBg = isLight ? '#ffffff' : '#0f172a';
      const tooltipTitleColor = isLight ? '#0f172a' : '#ffffff';
      const tooltipSubColor = isLight ? '#475569' : '#94a3b8';
      const tooltipBorder = isLight ? '#cbd5e1' : '#334155';

      marker.bindTooltip(
        `<div style="padding: 6px 10px; font-family: sans-serif; font-size: 11px; color: ${tooltipTitleColor}; background: ${tooltipBg}; border-radius: 10px; border: 1px solid ${statusBadge.color}80; box-shadow: 0 4px 16px rgba(0,0,0,0.25);">
          <div style="font-weight: 700; color: ${tooltipTitleColor};">${asset.name} <span style="font-family: monospace; color: #0284c7;">(${asset.code})</span></div>
          <div style="color: ${tooltipSubColor}; margin-top: 2px;">${categoryLabel}</div>
          <div style="margin-top: 2px; font-weight: 700; color: ${statusBadge.color};">${statusBadge.label}</div>
          <div style="font-size: 10px; color: ${tooltipSubColor}; margin-top: 2px;">Comunicação: ${asset.telemetry.lastCommunication}</div>
        </div>`,
        { direction: 'top', opacity: 0.98, className: 'athos-custom-tooltip' }
      );

      marker.on('click', () => {
        setActiveDrawerAsset(asset);
        if (onSelectAsset) onSelectAsset(asset);
        setSelectedAsset(asset);
        if (isFollowing) {
          mapInstance.panTo([lat, lng]);
        }
      });

      markersRef.current[asset.id] = marker;

      // Render GPS Accuracy Circle if layer enabled
      if (layers.gpsAccuracy && asset.telemetry.gpsAccuracy) {
        const circle = L.circle([lat, lng], {
          radius: asset.telemetry.gpsAccuracy || 10,
          color: '#38bdf8',
          fillColor: '#38bdf8',
          fillOpacity: 0.08,
          weight: 1,
        }).addTo(mapInstance);
        accuracyCirclesRef.current[asset.id] = circle;
      }
    }
  }, [
    displayAssets,
    activeDrawerAsset,
    selectedAssetOverride,
    selectedAsset,
    layers.clusters,
    layers.gpsAccuracy,
    onSelectAsset,
    setSelectedAsset,
  ]);

  // Sync selected asset or follow mode movement
  useEffect(() => {
    const target = selectedAssetOverride || selectedAsset || activeDrawerAsset;
    if (target && mapInstanceRef.current) {
      const lat = target.telemetry.latitude;
      const lng = target.telemetry.longitude;
      if (!isNaN(lat) && !isNaN(lng)) {
        mapInstanceRef.current.flyTo([lat, lng], Math.max(mapInstanceRef.current.getZoom(), 15), {
          duration: 1.0,
        });
      }
    }
  }, [selectedAssetOverride, selectedAsset]);

  // Handle replay frame update on map
  const handleReplayFrameChange = (point: RoutePoint) => {
    setReplayFramePoint(point);
    if (mapInstanceRef.current && point) {
      mapInstanceRef.current.panTo([point.latitude, point.longitude]);
    }
  };

  const currentActiveAsset = activeDrawerAsset || selectedAssetOverride || selectedAsset;

  return (
    <div
      className={`relative w-full ${heightClass} bg-slate-950 overflow-hidden flex flex-col ${
        isFullscreen ? 'fixed inset-0 z-50 h-screen' : ''
      }`}
    >
      {/* Top Floating Map Control Bar */}
      {showControls && (
        <div className="absolute top-4 left-4 right-4 z-10 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
          {/* Left: Search & Category Filters */}
          <div className="pointer-events-auto flex items-center gap-2 bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 backdrop-blur-md p-1.5 rounded-2xl shadow-2xl max-w-xl w-full sm:w-auto transition-colors">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={specializedTitle ? `Buscar em ${specializedTitle}...` : 'Buscar no mapa (Ativo, IMEI, Loja, Placa)...'}
                className="w-full bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            {showFilters && (
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden md:block" />
            )}

            {showFilters && !specializedCategory && (
              <div className="relative hidden md:block">
                <Filter className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value as AssetCategory | 'all')}
                  className="bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs rounded-xl pl-7 pr-2.5 py-1.5 focus:outline-none focus:border-cyan-500/50 cursor-pointer"
                >
                  <option value="all">Todas Categorias</option>
                  <option value="cart">Carrinhos</option>
                  <option value="truck">Caminhões</option>
                  <option value="vehicle">Veículos</option>
                  <option value="forklift">Empilhadeiras</option>
                  <option value="bike">Bicicletas</option>
                  <option value="cargo">Cargas</option>
                  <option value="agro">Agro</option>
                  <option value="tag">Tags BLE</option>
                </select>
              </div>
            )}

            {showFilters && (
              <div className="relative">
                <Activity className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as AssetStatus | 'all')}
                  className="bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs rounded-xl pl-7 pr-2.5 py-1.5 focus:outline-none focus:border-cyan-500/50 cursor-pointer"
                >
                  <option value="all">Todos Status</option>
                  <option value="moving">Em Movimento</option>
                  <option value="stopped">Parados</option>
                  <option value="out_of_geofence">Fora da Cerca</option>
                  <option value="low_battery">Bateria Baixa</option>
                  <option value="offline">Offline</option>
                </select>
              </div>
            )}
          </div>

          {/* Right: Map View Mode Switcher (2D / SATÉLITE / HÍBRIDO) & Layers */}
          <div className="pointer-events-auto flex items-center gap-2 bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 backdrop-blur-md p-1.5 rounded-2xl shadow-2xl transition-colors">
            {/* 3 View Modes Button Group */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950/90 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-mono font-semibold">
              <button
                onClick={() => setViewMode('2D')}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                  viewMode === '2D'
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="Vetor 2D Operacional"
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">2D</span>
              </button>

              <button
                onClick={() => setViewMode('SATELLITE')}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                  viewMode === 'SATELLITE'
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="Imagem de Satélite HD"
              >
                <Satellite className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Satélite</span>
              </button>

              <button
                onClick={() => setViewMode('HYBRID')}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                  viewMode === 'HYBRID'
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="Satélite + Camada de Logradouros"
              >
                <Globe className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Híbrido</span>
              </button>
            </div>

            <div className="h-5 w-px bg-slate-200 dark:bg-slate-800" />

            {/* Layer Toggles Dropdown Trigger */}
            <div className="relative">
              <button
                onClick={() => setShowLayerMenu(!showLayerMenu)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors border ${
                  showLayerMenu
                    ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/30'
                    : 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span className="hidden sm:inline">Camadas</span>
              </button>

              {/* Layer Menu Popup */}
              {showLayerMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-3 space-y-2 text-xs z-30">
                  <div className="text-[10px] font-mono uppercase font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-1.5 flex items-center gap-1">
                    <SlidersHorizontal className="w-3 h-3 text-cyan-500" /> Camadas Ativas
                  </div>

                  <label className="flex items-center justify-between text-slate-800 dark:text-slate-200 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 p-1 rounded">
                    <span>Cercas Virtuais</span>
                    <input
                      type="checkbox"
                      checked={layers.geofences}
                      onChange={(e) => setLayers({ ...layers, geofences: e.target.checked })}
                      className="accent-cyan-500"
                    />
                  </label>

                  <label className="flex items-center justify-between text-slate-800 dark:text-slate-200 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 p-1 rounded">
                    <span>Rotas e Histórico</span>
                    <input
                      type="checkbox"
                      checked={layers.routes}
                      onChange={(e) => setLayers({ ...layers, routes: e.target.checked })}
                      className="accent-cyan-500"
                    />
                  </label>

                  <label className="flex items-center justify-between text-slate-800 dark:text-slate-200 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 p-1 rounded">
                    <span>Paradas Detectadas</span>
                    <input
                      type="checkbox"
                      checked={layers.stops}
                      onChange={(e) => setLayers({ ...layers, stops: e.target.checked })}
                      className="accent-cyan-500"
                    />
                  </label>

                  <label className="flex items-center justify-between text-slate-800 dark:text-slate-200 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 p-1 rounded">
                    <span>Agrupamento (Clusters)</span>
                    <input
                      type="checkbox"
                      checked={layers.clusters}
                      onChange={(e) => setLayers({ ...layers, clusters: e.target.checked })}
                      className="accent-cyan-500"
                    />
                  </label>

                  <label className="flex items-center justify-between text-slate-800 dark:text-slate-200 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 p-1 rounded">
                    <span>Círculo Precisão GPS</span>
                    <input
                      type="checkbox"
                      checked={layers.gpsAccuracy}
                      onChange={(e) => setLayers({ ...layers, gpsAccuracy: e.target.checked })}
                      className="accent-cyan-500"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Follow Asset Toggle */}
            <button
              onClick={() => setIsFollowing(!isFollowing)}
              className={`p-2 rounded-xl transition-colors border ${
                isFollowing
                  ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={isFollowing ? 'Acompanhamento automático ativo' : 'Ativar acompanhamento de ativo'}
            >
              <Locate className="w-4 h-4" />
            </button>

            {/* Fullscreen Button */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 bg-slate-100 dark:bg-slate-950 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl transition-colors border border-slate-200 dark:border-slate-800"
              title="Tela Cheia (Central de Operações)"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Floating Follow Mode Resume Button */}
      {!isFollowing && currentActiveAsset && (
        <button
          onClick={() => {
            setIsFollowing(true);
            if (mapInstanceRef.current) {
              mapInstanceRef.current.flyTo(
                [currentActiveAsset.telemetry.latitude, currentActiveAsset.telemetry.longitude],
                16,
                { duration: 1.0 }
              );
            }
          }}
          className="absolute top-20 left-1/2 -translate-x-1/2 z-20 bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 border border-cyan-400/30 animate-bounce"
        >
          <Locate className="w-4 h-4" />
          <span>Retomar Acompanhamento do Ativo</span>
        </button>
      )}

      {/* Leaflet DOM Canvas Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0 bg-slate-950" />

      {/* Bottom Floating Stats Bar & Map Legend Overlay */}
      <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
        {showStatsBar ? (
          <div className="pointer-events-auto hidden sm:flex items-center gap-3 bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 backdrop-blur-md px-3 py-2 rounded-2xl text-xs font-mono text-slate-700 dark:text-slate-300 shadow-2xl transition-colors">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
              <span>
                Monitorados: <strong className="text-slate-900 dark:text-white">{displayAssets.length}</strong>
              </span>
            </div>
            <div className="h-3 w-px bg-slate-200 dark:bg-slate-800" />
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>
                Movimento:{' '}
                <strong className="text-slate-900 dark:text-white">
                  {displayAssets.filter((a) => a.status === 'moving').length}
                </strong>
              </span>
            </div>
            <div className="h-3 w-px bg-slate-200 dark:bg-slate-800" />
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>
                Fora da Cerca:{' '}
                <strong className="text-slate-900 dark:text-white">
                  {displayAssets.filter((a) => a.status === 'out_of_geofence').length}
                </strong>
              </span>
            </div>
          </div>
        ) : <div />}

        {/* Collapsible Map Legend Button & Overlay Panel */}
        <div className="pointer-events-auto relative">
          <button
            onClick={() => setShowLegend(!showLegend)}
            className={`px-3 py-1.5 rounded-2xl text-xs font-mono font-semibold flex items-center gap-2 backdrop-blur-md transition-all border shadow-2xl ${
              showLegend
                ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border-cyan-500/40'
                : 'bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Info className="w-4 h-4 text-cyan-500" />
            <span>Legenda de Ativos</span>
          </button>

          {showLegend && (
            <div className="absolute bottom-10 right-0 w-72 bg-white/98 dark:bg-slate-900/98 border border-slate-200 dark:border-slate-800 backdrop-blur-2xl rounded-2xl p-4 shadow-2xl text-xs space-y-3 z-30 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="font-mono font-bold uppercase text-[10px] tracking-wider text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Legenda de Ícones do Sistema
                </span>
                <button
                  onClick={() => setShowLegend(false)}
                  className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1">
                {Object.values(ASSET_CATEGORY_META).map((meta) => (
                  <div
                    key={meta.category}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="p-1.5 rounded-lg flex items-center justify-center border"
                        style={{
                          backgroundColor: `${meta.primaryColor}15`,
                          borderColor: `${meta.primaryColor}40`,
                          color: meta.primaryColor,
                        }}
                      >
                        <AssetIcon category={meta.category} className="w-4 h-4" />
                      </div>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{meta.label}</span>
                    </div>
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: meta.primaryColor }}
                    />
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>Indicadores de Alerta:</span>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Mov.
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500" /> Cerca
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500" /> Bat.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Waze-style Navigation Panel Bottom Overlay */}
      {navigationTarget && (
        <div className="absolute bottom-4 left-4 right-4 z-40 pointer-events-none flex justify-center">
          <NavigationPanel
            targetAsset={navigationTarget}
            route={navigationRoute}
            profile={navigationProfile}
            isCalculating={isCalculatingRoute}
            error={navigationError}
            wazeUrl={buildWazeUrl({
              lat: navigationTarget.telemetry.latitude,
              lng: navigationTarget.telemetry.longitude,
            })}
            googleMapsUrl={buildGoogleMapsUrl(
              { lat: navigationTarget.telemetry.latitude, lng: navigationTarget.telemetry.longitude },
              navigationProfile
            )}
            onChangeProfile={handleChangeNavigationProfile}
            onRecalculate={() => recalcNavigation()}
            onCancel={cancelNavigation}
          />
        </div>
      )}

      {/* Route Replay Controller Bottom Overlay */}
      {!navigationTarget && routeHistory && routeHistory.length > 0 && (
        <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-auto">
          <ReplayController
            routePoints={routeHistory}
            stoppages={stoppagesList}
            onFrameChange={handleReplayFrameChange}
          />
        </div>
      )}

      {/* Slide-over Asset Telemetry Detail Drawer */}
      {showDrawer && activeDrawerAsset && (
        <div className="absolute top-0 right-0 h-full w-full sm:w-96 bg-slate-900/98 border-l border-slate-800 backdrop-blur-2xl z-30 shadow-2xl p-5 overflow-y-auto animate-in slide-in-from-right duration-200">
          <div className="flex items-start justify-between pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                  {activeDrawerAsset.category.toUpperCase()} • {activeDrawerAsset.code}
                </span>
                <span
                  className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded border"
                  style={{
                    color: getStatusBadgeInfo(activeDrawerAsset.status).color,
                    borderColor: `${getStatusBadgeInfo(activeDrawerAsset.status).color}40`,
                    backgroundColor: getStatusBadgeInfo(activeDrawerAsset.status).badgeBg,
                  }}
                >
                  {getStatusBadgeInfo(activeDrawerAsset.status).label}
                </span>
              </div>
              <h3 className="text-base font-bold text-white mt-1.5 leading-snug">
                {activeDrawerAsset.name}
              </h3>
            </div>
            <button
              onClick={() => setActiveDrawerAsset(null)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="py-4 space-y-4 text-xs">
            {/* Telemetry KPI Cards */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 bg-slate-950/90 rounded-2xl border border-slate-800/80">
                <div className="text-slate-400 text-[10px] uppercase font-semibold flex items-center gap-1">
                  <Navigation className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Velocidade</span>
                </div>
                <div className="text-lg font-bold text-white font-mono mt-1">
                  {activeDrawerAsset.telemetry.speed !== undefined
                    ? activeDrawerAsset.telemetry.speed
                    : 'N/A'}{' '}
                  <span className="text-xs font-normal text-slate-400">km/h</span>
                </div>
              </div>

              <div className="p-3 bg-slate-950/90 rounded-2xl border border-slate-800/80">
                <div className="text-slate-400 text-[10px] uppercase font-semibold flex items-center gap-1">
                  <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Bateria</span>
                </div>
                <div className="text-lg font-bold text-emerald-400 font-mono mt-1">
                  {activeDrawerAsset.telemetry.batteryLevel !== undefined
                    ? `${activeDrawerAsset.telemetry.batteryLevel}%`
                    : 'N/A'}
                </div>
              </div>
            </div>

            {/* Position & Hardware Specification Table */}
            <div className="bg-slate-950/90 rounded-2xl border border-slate-800/80 p-3.5 space-y-2.5">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800/80">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-cyan-400" /> IMEI / Protocolo
                </span>
                <span className="font-mono text-slate-200">
                  {activeDrawerAsset.imei} ({activeDrawerAsset.protocol})
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-slate-800/80">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-indigo-400" /> Unidade Vinculada
                </span>
                <span className="text-slate-200 font-medium">{activeDrawerAsset.unitName}</span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-slate-800/80">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-amber-400" /> Sinal Telemetria
                </span>
                <span className="font-mono text-emerald-400 font-semibold">
                  {activeDrawerAsset.telemetry.signalStrength}% (4G LTE)
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-slate-800/80">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> Última Comunicação
                </span>
                <span className="font-mono text-slate-300">
                  {activeDrawerAsset.telemetry.lastCommunication}
                </span>
              </div>

              {/* Position Source & GPS Accuracy */}
              <div className="flex justify-between items-center pb-2 border-b border-slate-800/80">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Locate className="w-3.5 h-3.5 text-cyan-400" /> Fonte de Posição
                </span>
                <span className="font-mono text-cyan-300 font-semibold bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                  {activeDrawerAsset.telemetry.positionSource || 'GPS Satellite'} (±
                  {activeDrawerAsset.telemetry.gpsAccuracy || 8}m)
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-400" /> Coordenadas Lat/Long
                </span>
                <span className="font-mono text-slate-400 text-[11px]">
                  {activeDrawerAsset.telemetry.latitude.toFixed(4)},{' '}
                  {activeDrawerAsset.telemetry.longitude.toFixed(4)}
                </span>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  setIsFollowing(true);
                  if (mapInstanceRef.current) {
                    mapInstanceRef.current.flyTo(
                      [
                        activeDrawerAsset.telemetry.latitude,
                        activeDrawerAsset.telemetry.longitude,
                      ],
                      16
                    );
                  }
                }}
                className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-cyan-600/20"
              >
                <Locate className="w-4 h-4" />
                <span>Acompanhar em Tempo Real</span>
              </button>

              <button
                onClick={() => startNavigation(activeDrawerAsset)}
                className="w-full py-2.5 bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-purple-600/20"
              >
                <Navigation2 className="w-4 h-4" />
                <span>Navegar até o Ativo</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onOpenHistory && onOpenHistory(activeDrawerAsset)}
                  className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-slate-700/50"
                >
                  <Play className="w-3.5 h-3.5 text-cyan-400 fill-current" />
                  <span>Histórico</span>
                </button>

                <button
                  onClick={() => onOpenGeofences && onOpenGeofences(activeDrawerAsset)}
                  className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-slate-700/50"
                >
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Cercas</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onOpenAlerts && onOpenAlerts(activeDrawerAsset)}
                  className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-slate-700/50"
                >
                  <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                  <span>Alertas</span>
                </button>

                <button
                  onClick={() => onOpenReports && onOpenReports(activeDrawerAsset)}
                  className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-slate-700/50"
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Relatórios</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
