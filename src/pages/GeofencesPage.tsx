import React, { useRef, useState } from 'react';
import {
  Layers,
  Plus,
  Trash2,
  Edit3,
  Shield,
  MapPin,
  CheckCircle2,
  Image as ImageIcon,
  Upload,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import { useAssets } from '../context/AssetContext';
import { LiveMap } from '../components/map/LiveMap';
import { GeofenceEditor } from '../components/map/GeofenceEditor';
import { Geofence } from '../types';
import { ASSET_CATEGORY_META } from '../components/common/AssetIconRegistry';

const DEFAULT_CENTER: [number, number] = [-23.641414, -46.644827];

export const GeofencesPage: React.FC = () => {
  const { geofences, addGeofence, updateGeofence, deleteGeofence } = useAssets();

  const [editingGeofence, setEditingGeofence] = useState<Geofence | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Captura de coordenadas no mapa
  const [isPickingCenter, setIsPickingCenter] = useState(false);
  const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);
  const [pickedCenter, setPickedCenter] = useState<[number, number] | null>(null);
  const [polygonDraftPoints, setPolygonDraftPoints] = useState<[number, number][]>([]);

  // Planta baixa / imagem de referência do local
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [floorPlanUrl, setFloorPlanUrl] = useState<string | null>(null);
  const [floorPlanOpacity, setFloorPlanOpacity] = useState(0.6);
  const [floorPlanSizeMeters, setFloorPlanSizeMeters] = useState(250);

  const showEditor = isCreating || editingGeofence !== null;

  const floorPlanBounds: [[number, number], [number, number]] | null = floorPlanUrl
    ? (() => {
        const center = pickedCenter || DEFAULT_CENTER;
        const dLat = floorPlanSizeMeters / 2 / 110574;
        const dLng = floorPlanSizeMeters / 2 / (111320 * Math.cos((center[0] * Math.PI) / 180));
        return [
          [center[0] - dLat, center[1] - dLng],
          [center[0] + dLat, center[1] + dLng],
        ];
      })()
    : null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFloorPlanUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const resetDraft = () => {
    setIsPickingCenter(false);
    setIsDrawingPolygon(false);
    setPickedCenter(null);
    setPolygonDraftPoints([]);
  };

  const handleStartCreate = () => {
    setEditingGeofence(null);
    setIsCreating(true);
    resetDraft();
  };

  const handleStartEdit = (geo: Geofence) => {
    setIsCreating(false);
    setEditingGeofence(geo);
    resetDraft();
    if (geo.type === 'circle' && geo.coordinates[0]) {
      setPickedCenter(geo.coordinates[0]);
    } else if (geo.type === 'polygon') {
      setPolygonDraftPoints(geo.coordinates);
    }
  };

  const handleCancelEdit = () => {
    setIsCreating(false);
    setEditingGeofence(null);
    resetDraft();
  };

  const handleSaveGeofence = (partial: Partial<Geofence>) => {
    if (editingGeofence) {
      updateGeofence(editingGeofence.id, partial);
    } else {
      const created: Geofence = {
        id: `geo_custom_${Date.now()}`,
        name: partial.name || 'Nova Cerca Virtual',
        clientId: 'cli_1',
        unitId: 'unit_1',
        type: partial.type || 'circle',
        coordinates: partial.coordinates || [DEFAULT_CENTER],
        radius: partial.radius,
        color: partial.color || '#06b6d4',
        rules: partial.rules || { entryAlert: true, exitAlert: true, stayAlert: false },
        assignedAssetsCount: 0,
        targetCategory: partial.targetCategory || 'all',
      };
      addGeofence(created);
    }
    handleCancelEdit();
  };

  const handleDeleteGeofence = (geo: Geofence) => {
    if (window.confirm(`Remover a cerca virtual "${geo.name}"? Esta ação não pode ser desfeita.`)) {
      deleteGeofence(geo.id);
    }
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100 transition-colors">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400 uppercase tracking-widest font-bold flex items-center gap-1">
            <Layers className="w-4 h-4" /> Gestão de Perímetros Seguros
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Editor Visual de Cercas Virtuais (Geofencing)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Desenhe cercas sobre a planta baixa real do local para carrinhos, frotas, empilhadeiras, agro e demais ativos.
          </p>
        </div>

        {!showEditor && (
          <button
            onClick={handleStartCreate}
            className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs rounded-xl shadow-md shadow-cyan-600/20 hover:-translate-y-0.5 flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Cerca Virtual</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Editor Form + Floor Plan Upload */}
        <div className="space-y-6">
          {showEditor ? (
            <GeofenceEditor
              initialGeofence={editingGeofence}
              onSave={handleSaveGeofence}
              onCancel={handleCancelEdit}
              pickedCenter={pickedCenter}
              polygonDraftPoints={polygonDraftPoints}
              isPickingCenter={isPickingCenter}
              isDrawingPolygon={isDrawingPolygon}
              onStartPickCenter={() => {
                setIsPickingCenter(true);
                setIsDrawingPolygon(false);
              }}
              onStartDrawPolygon={() => {
                setIsDrawingPolygon(true);
                setIsPickingCenter(false);
                setPolygonDraftPoints([]);
              }}
              onClearDraft={() => {
                setPickedCenter(null);
                setPolygonDraftPoints([]);
                setIsPickingCenter(false);
                setIsDrawingPolygon(false);
              }}
              onFinishPolygon={() => setIsDrawingPolygon(false)}
            />
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold">
                <Shield className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>Nenhuma cerca em edição</span>
              </div>
              <p>
                Clique em <strong className="text-slate-700 dark:text-slate-300">"Nova Cerca Virtual"</strong> para desenhar um
                novo perímetro, ou use <strong className="text-slate-700 dark:text-slate-300">"Editar"</strong> em uma cerca da
                lista abaixo.
              </p>
            </div>
          )}

          {/* Floor Plan Upload Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
              <ImageIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Planta Baixa do Local</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Envie a planta baixa, croqui ou imagem de satélite do local para usar como referência ao desenhar as cercas.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />

            {!floorPlanUrl ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 hover:border-cyan-500/50 hover:text-cyan-600 dark:hover:text-cyan-400 flex flex-col items-center justify-center gap-1.5 transition-colors text-xs"
              >
                <Upload className="w-5 h-5" />
                <span>Enviar Imagem da Planta Baixa</span>
              </button>
            ) : (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
                  <img src={floorPlanUrl} alt="Planta baixa" className="w-full h-28 object-cover" />
                  <button
                    type="button"
                    onClick={() => setFloorPlanUrl(null)}
                    className="absolute top-1.5 right-1.5 p-1 bg-slate-900/80 hover:bg-rose-600 text-white rounded-lg transition-colors"
                    title="Remover planta baixa"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <SlidersHorizontal className="w-3 h-3" /> Opacidade
                    </span>
                    <span className="font-mono">{Math.round(floorPlanOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={floorPlanOpacity}
                    onChange={(e) => setFloorPlanOpacity(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Tamanho aproximado (metros)</span>
                    <span className="font-mono">{floorPlanSizeMeters}m</span>
                  </div>
                  <input
                    type="range"
                    min={30}
                    max={1000}
                    step={10}
                    value={floorPlanSizeMeters}
                    onChange={(e) => setFloorPlanSizeMeters(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  A planta é centralizada no ponto marcado no mapa (ou no centro padrão). Marque o centro da cerca para
                  reposicionar a planta sobre o local real.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Interactive Map Visualizer */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm min-h-[560px]">
          <LiveMap
            heightClass="h-[560px]"
            pickPointMode={isPickingCenter}
            onPointPicked={(lat, lng) => {
              setPickedCenter([lat, lng]);
              setIsPickingCenter(false);
            }}
            polygonDraftMode={isDrawingPolygon}
            polygonDraftPoints={polygonDraftPoints}
            onPolygonPointAdded={(lat, lng) => setPolygonDraftPoints((prev) => [...prev, [lat, lng]])}
            floorPlanOverlay={
              floorPlanUrl && floorPlanBounds
                ? { url: floorPlanUrl, bounds: floorPlanBounds, opacity: floorPlanOpacity }
                : null
            }
          />
        </div>
      </div>

      {/* Geofences Table List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Cercas Virtuais Ativas</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {geofences.map((geo) => {
            const categoryMeta =
              geo.targetCategory && geo.targetCategory !== 'all' ? ASSET_CATEGORY_META[geo.targetCategory] : null;
            return (
              <div
                key={geo.id}
                className="p-3.5 bg-slate-50 dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 min-w-0">
                    <Shield className="w-4 h-4 shrink-0" style={{ color: geo.color }} />
                    <span className="truncate">{geo.name}</span>
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-mono bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded shrink-0">
                    {geo.type.toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px]">
                  <span>
                    Dispositivos: <strong className="text-slate-700 dark:text-slate-200">{geo.assignedAssetsCount}</strong>
                  </span>
                  <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-medium">
                    {categoryMeta ? categoryMeta.label : 'Todos os Ativos'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    onClick={() => handleStartEdit(geo)}
                    className="flex-1 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-cyan-500/15 text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 font-medium flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Editar
                  </button>
                  <button
                    onClick={() => handleDeleteGeofence(geo)}
                    className="flex-1 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-500/15 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 font-medium flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Excluir
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
