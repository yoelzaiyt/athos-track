import React, { useEffect, useState } from 'react';
import {
  Shield,
  Circle,
  Square,
  Trash2,
  Save,
  X,
  Sliders,
  AlertTriangle,
  Plus,
  CheckCircle2,
  Copy,
  MapPin,
  Crosshair,
  RotateCcw,
} from 'lucide-react';
import { AssetCategory, Geofence } from '../../types';
import { ASSET_CATEGORY_META } from '../common/AssetIconRegistry';

interface GeofenceEditorProps {
  initialGeofence?: Geofence | null;
  onSave: (geofence: Partial<Geofence>) => void;
  onCancel: () => void;
  /** Ponto único capturado no mapa (centro da cerca circular). */
  pickedCenter?: [number, number] | null;
  /** Vértices do polígono capturados no mapa em tempo real. */
  polygonDraftPoints?: [number, number][];
  isPickingCenter?: boolean;
  isDrawingPolygon?: boolean;
  onStartPickCenter: () => void;
  onStartDrawPolygon: () => void;
  onClearDraft: () => void;
  onFinishPolygon: () => void;
}

export const GeofenceEditor: React.FC<GeofenceEditorProps> = ({
  initialGeofence,
  onSave,
  onCancel,
  pickedCenter,
  polygonDraftPoints = [],
  isPickingCenter = false,
  isDrawingPolygon = false,
  onStartPickCenter,
  onStartDrawPolygon,
  onClearDraft,
  onFinishPolygon,
}) => {
  const [name, setName] = useState(initialGeofence?.name || '');
  const [type, setType] = useState<'circle' | 'polygon'>(initialGeofence?.type || 'circle');
  const [radius, setRadius] = useState<number>(initialGeofence?.radius || 300);
  const [color, setColor] = useState<string>(initialGeofence?.color || '#3b82f6');
  const [targetCategory, setTargetCategory] = useState<AssetCategory | 'all'>(
    initialGeofence?.targetCategory || 'all'
  );
  const [entryAlert, setEntryAlert] = useState<boolean>(initialGeofence?.rules.entryAlert ?? true);
  const [exitAlert, setExitAlert] = useState<boolean>(initialGeofence?.rules.exitAlert ?? true);
  const [stayAlert, setStayAlert] = useState<boolean>(initialGeofence?.rules.stayAlert ?? false);
  const [maxSpeed, setMaxSpeed] = useState<number>(initialGeofence?.rules.maxSpeed || 40);

  useEffect(() => {
    setName(initialGeofence?.name || '');
    setType(initialGeofence?.type || 'circle');
    setRadius(initialGeofence?.radius || 300);
    setColor(initialGeofence?.color || '#3b82f6');
    setTargetCategory(initialGeofence?.targetCategory || 'all');
    setEntryAlert(initialGeofence?.rules.entryAlert ?? true);
    setExitAlert(initialGeofence?.rules.exitAlert ?? true);
    setStayAlert(initialGeofence?.rules.stayAlert ?? false);
    setMaxSpeed(initialGeofence?.rules.maxSpeed || 40);
  }, [initialGeofence]);

  const colors = [
    { label: 'Verde (Zona Interna)', hex: '#10b981' },
    { label: 'Âmbar (Zona Preventiva)', hex: '#f59e0b' },
    { label: 'Vermelho (Limite Crítico)', hex: '#ef4444' },
    { label: 'Azul Operacional', hex: '#3b82f6' },
    { label: 'Ciano Destaque', hex: '#06b6d4' },
    { label: 'Roxo Restrito', hex: '#a855f7' },
  ];

  const effectiveCoordinates: [number, number][] =
    type === 'circle'
      ? pickedCenter
        ? [pickedCenter]
        : initialGeofence?.coordinates || []
      : polygonDraftPoints.length > 0
      ? polygonDraftPoints
      : initialGeofence?.coordinates || [];

  const canSubmit =
    name.trim().length > 0 &&
    (type === 'circle' ? effectiveCoordinates.length === 1 : effectiveCoordinates.length >= 3);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSave({
      id: initialGeofence?.id,
      name,
      type,
      coordinates: effectiveCoordinates,
      radius: type === 'circle' ? radius : undefined,
      color,
      targetCategory,
      rules: {
        entryAlert,
        exitAlert,
        stayAlert,
        maxSpeed: maxSpeed > 0 ? maxSpeed : undefined,
      },
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-5 space-y-4 w-full text-xs">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {initialGeofence ? 'Editar Cerca Virtual' : 'Criar Nova Cerca Virtual'}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Configure a geometria e regras de alerta</p>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-4">
        {/* Name Input */}
        <div>
          <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">Nome da Cerca Virtual</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Pátio Principal Loja Central, Zona Risco..."
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Type Selection */}
        <div>
          <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">Tipo de Geometria</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setType('circle');
                onClearDraft();
              }}
              className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                type === 'circle'
                  ? 'bg-cyan-500/15 border-cyan-500 text-cyan-700 dark:text-cyan-300 font-semibold'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Circle className="w-4 h-4" />
              <span>Circular (Raio)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setType('polygon');
                onClearDraft();
              }}
              className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                type === 'polygon'
                  ? 'bg-cyan-500/15 border-cyan-500 text-cyan-700 dark:text-cyan-300 font-semibold'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Square className="w-4 h-4" />
              <span>Polígono Livre</span>
            </button>
          </div>
        </div>

        {/* Coordinate Picking on Map */}
        <div className="bg-cyan-500/5 border border-cyan-500/20 p-3 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              Posição no Mapa {type === 'circle' ? '(Planta Baixa)' : '(Perímetro na Planta Baixa)'}
            </span>
            {(pickedCenter || polygonDraftPoints.length > 0) && (
              <button type="button" onClick={onClearDraft} className="text-slate-400 hover:text-rose-500 transition-colors" title="Limpar marcação">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {type === 'circle' ? (
            <button
              type="button"
              onClick={onStartPickCenter}
              className={`w-full py-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                isPickingCenter
                  ? 'bg-cyan-600 text-white animate-pulse'
                  : 'bg-white dark:bg-slate-900 border border-cyan-500/30 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              {isPickingCenter ? 'Clique no mapa/planta para marcar o centro...' : pickedCenter ? 'Centro marcado — clique para remarcar' : 'Marcar Centro no Mapa'}
            </button>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={onStartDrawPolygon}
                className={`w-full py-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  isDrawingPolygon
                    ? 'bg-cyan-600 text-white animate-pulse'
                    : 'bg-white dark:bg-slate-900 border border-cyan-500/30 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10'
                }`}
              >
                <Crosshair className="w-3.5 h-3.5" />
                {isDrawingPolygon ? `Clique para adicionar vértices (${polygonDraftPoints.length})` : polygonDraftPoints.length > 0 ? `${polygonDraftPoints.length} vértices — clique para continuar` : 'Desenhar Perímetro no Mapa'}
              </button>
              {isDrawingPolygon && polygonDraftPoints.length >= 3 && (
                <button
                  type="button"
                  onClick={onFinishPolygon}
                  className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Finalizar Polígono ({polygonDraftPoints.length} pontos)
                </button>
              )}
            </div>
          )}

          {!canSubmit && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {type === 'circle' ? 'Marque o centro da cerca no mapa.' : 'Marque ao menos 3 vértices no mapa.'}
            </p>
          )}
        </div>

        {/* Radius Slider if Circular */}
        {type === 'circle' && (
          <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-2">
            <div className="flex justify-between font-mono">
              <span className="text-slate-500 dark:text-slate-400">Raio da Cerca:</span>
              <strong className="text-cyan-600 dark:text-cyan-400">{radius} metros</strong>
            </div>
            <input
              type="range"
              min={10}
              max={2000}
              step={5}
              value={radius}
              onChange={(e) => setRadius(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>
        )}

        {/* Target Asset Category */}
        <div>
          <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">Tipo de Ativo Monitorado</label>
          <select
            value={targetCategory}
            onChange={(e) => setTargetCategory(e.target.value as AssetCategory | 'all')}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none"
          >
            <option value="all">Todos os Ativos</option>
            {Object.values(ASSET_CATEGORY_META).map((meta) => (
              <option key={meta.category} value={meta.category}>
                {meta.label}
              </option>
            ))}
          </select>
        </div>

        {/* Color Palette Picker */}
        <div>
          <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1.5">Cor Identificadora</label>
          <div className="flex items-center gap-2 flex-wrap">
            {colors.map((c) => (
              <button
                key={c.hex}
                type="button"
                onClick={() => setColor(c.hex)}
                style={{ backgroundColor: c.hex }}
                className={`w-7 h-7 rounded-full transition-transform ${
                  color === c.hex ? 'scale-125 ring-2 ring-cyan-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900' : 'opacity-80 hover:opacity-100'
                }`}
                title={c.label}
              />
            ))}
          </div>
        </div>

        {/* Alert Trigger Rules */}
        <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-2.5">
          <div className="text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-1.5 pb-1 border-b border-slate-200 dark:border-slate-800/80">
            <Sliders className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>Regras de Notificação de Alerta</span>
          </div>

          <label className="flex items-center justify-between text-slate-600 dark:text-slate-300 cursor-pointer">
            <span>Alerta na Entrada do Ativo</span>
            <input
              type="checkbox"
              checked={entryAlert}
              onChange={(e) => setEntryAlert(e.target.checked)}
              className="accent-cyan-500 w-4 h-4 rounded"
            />
          </label>

          <label className="flex items-center justify-between text-slate-600 dark:text-slate-300 cursor-pointer">
            <span>Alerta na Saída do Ativo</span>
            <input
              type="checkbox"
              checked={exitAlert}
              onChange={(e) => setExitAlert(e.target.checked)}
              className="accent-cyan-500 w-4 h-4 rounded"
            />
          </label>

          <label className="flex items-center justify-between text-slate-600 dark:text-slate-300 cursor-pointer">
            <span>Alerta de Permanência Prolongada</span>
            <input
              type="checkbox"
              checked={stayAlert}
              onChange={(e) => setStayAlert(e.target.checked)}
              className="accent-cyan-500 w-4 h-4 rounded"
            />
          </label>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">Velocidade Máxima Permitida:</span>
            <div className="flex items-center gap-1 font-mono">
              <input
                type="number"
                min={0}
                max={120}
                value={maxSpeed}
                onChange={(e) => setMaxSpeed(parseInt(e.target.value, 10) || 0)}
                className="w-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-right text-slate-900 dark:text-white"
              />
              <span className="text-slate-400 dark:text-slate-500">km/h</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-xl transition-colors"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={!canSubmit}
            className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl flex items-center gap-2 shadow-lg shadow-cyan-600/30 transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>{initialGeofence ? 'Salvar Alterações' : 'Salvar Cerca Virtual'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
