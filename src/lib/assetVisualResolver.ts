import { ASSET_CATEGORY_META, getAssetSVGPath } from '../components/common/AssetIconRegistry';
import { AssetCategory, AssetSubcategory, AssetStatus } from '../types';

/**
 * Resolver centralizado de representação visual de ativos no mapa.
 *
 * Única fonte de verdade para: qual ícone (por categoria + subcategoria) e qual
 * cor/estado visual (NORMAL/SELECTED/ONLINE/OFFLINE/STALE/ALERT) cada ativo deve
 * usar. Tanto o MAP V1 (Leaflet, via AssetIcons.ts) quanto o MAP V2 (MapLibre)
 * consomem as mesmas primitivas daqui — nada de ícone hardcoded em dois lugares.
 *
 * O componente SVG (getAssetSVGPath) continua sendo o MESMO do AssetIconRegistry
 * (o carrinho que já era usado no V1, por ex.) — este módulo só acrescenta a
 * camada de resolução (category/subcategory -> chave de ícone) e o estado visual.
 *
 * Este módulo é deliberadamente puro (sem React, sem Leaflet, sem DOM em
 * top-level) para ser testável em node com vitest — mesma convenção de
 * mapV2GeoJson.ts / BrGpsMapper.ts.
 */

export type AssetVisualState = 'NORMAL' | 'SELECTED' | 'ONLINE' | 'OFFLINE' | 'STALE' | 'ALERT';

export interface AssetVisual {
  /** Chave estável do ícone, usada como nome da imagem no estilo MapLibre. */
  iconKey: string;
  category: AssetCategory;
  subcategory?: string;
  /** Conteúdo SVG interno (paths) — mesma família do V1, via getAssetSVGPath. */
  svgMarkup: string;
  label: string;
  primaryColor: string;
  secondaryColor: string;
}

export interface StatusVisual {
  state: AssetVisualState;
  color: string;
  label: string;
}

/** Tabela de aliases de subcategoria -> subcategoria canônica (alinhada com os
 * aliases que o getAssetSVGPath reconhece). Importante: a chave de ícone e o
 * SVG precisam enxergar as MESMAS aliases, senão 'bovino' e 'cattle' gerariam
 * keys diferentes para o mesmo desenho de vaca. */
const SUBCATEGORY_ALIASES: Record<string, string> = {
  cattle: 'cattle', bovino: 'cattle', gado: 'cattle', cow: 'cattle',
  horse: 'horse', equino: 'horse', cavalo: 'horse',
  sheep: 'sheep', ovino: 'sheep', ovelha: 'sheep',
  goat: 'goat', caprino: 'goat', cabra: 'goat', bode: 'goat',
  buffalo: 'buffalo', bufalo: 'buffalo', 'búfalo': 'buffalo',
  tractor: 'tractor', trator: 'tractor', harvester: 'tractor', maquina_agricola: 'tractor', 'máquina_agrícola': 'tractor',
  motorcycle: 'motorcycle', moto: 'motorcycle',
  notebook: 'notebook', laptop: 'notebook',
  generator: 'generator', gerador: 'generator',
  freezer: 'freezer', refrigerado: 'freezer',
  tool: 'tool', ferramenta: 'tool',
  machine: 'machine', maquina: 'machine', 'máquina': 'machine',
};

/** Subcategorias que têm SVG próprio (profundo) por categoria de negócio. */
export const DEEP_SUBCATEGORIES: Record<string, Set<string>> = {
  agro: new Set(['cattle', 'horse', 'sheep', 'goat', 'buffalo', 'tractor']),
  asset: new Set(['tractor', 'motorcycle', 'notebook', 'generator', 'freezer', 'tool', 'machine']),
};

function categorizeKey(category: AssetCategory): string {
  return ASSET_CATEGORY_META[category] ? category : 'generic';
}

/**
 * Resolve a chave de ícone. Para subcategorias que têm SVG próprio
 * (agro:cattle, asset:tractor, ...), a chave carrega a subcategoria —
 * "agro-cattle", "asset-tractor" — garantindo que o marker no mapa mostra a
 * vaca/trator/gerador real, não só um ícone genérico de categoria. Para o
 * resto, a chave é a categoria ("cart", "box", "tag", ...). Aliases são
 * normalizadas para a subcategoria canônica (bovino === cattle).
 */
export function resolveIconKey(category: AssetCategory, subcategory?: string | AssetSubcategory): string {
  const cat = categorizeKey(category);
  const subRaw = subcategory ? String(subcategory).toLowerCase() : '';
  const sub = SUBCATEGORY_ALIASES[subRaw] ?? subRaw;
  const deepSet = DEEP_SUBCATEGORIES[cat];
  if (deepSet && sub && deepSet.has(sub)) {
    return `${cat}-${sub}`;
  }
  return cat;
}

/**
 * Resolve a representação visual completa de um ativo: ícone SVG + cor + rótulo.
 * Reutiliza getAssetSVGPath do AssetIconRegistry — cada tipo de ativo continua
 * reconhecível pelo seu próprio desenho (carrinho, caixa, tag, vaca, trator...),
 * e o fallback default só é usado quando não há classificação nenhuma.
 */
export function resolveAssetVisual(asset: { category: AssetCategory; subcategory?: string | AssetSubcategory }): AssetVisual {
  const { category, subcategory } = asset;
  const meta = ASSET_CATEGORY_META[category] || ASSET_CATEGORY_META.asset;
  return {
    iconKey: resolveIconKey(category, subcategory),
    category,
    subcategory,
    svgMarkup: getAssetSVGPath(category, subcategory),
    label: meta.label,
    primaryColor: meta.primaryColor,
    secondaryColor: meta.secondaryColor,
  };
}

/** Tempo sem comunicação a partir do qual um ativo "online" é tratado como STALE. */
export const STALE_AFTER_MINUTES = 15;

function parseTimestamp(value: string | undefined | null): number | null {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : null;
}

/**
 * Mapeia status de negócio -> estado visual do marker.
 * STALE (dado velho, ainda não offline) é derivado de lastCommunication:
 * apenas quando é um ISO real (não o placeholder "Agora" da simulação) e mais
 * velho que STALE_AFTER_MINUTES. ALERT cobre fora-da-cerca e bateria baixa.
 */
export function resolveStatusVisual(
  status: AssetStatus | undefined,
  lastCommunication?: string | null,
  opts: { now?: number; speed?: number } = {}
): StatusVisual {
  if (!status || status === 'online' || status === 'available' || status === 'stopped' || status === 'in_use') {
    // Ativo "presente" mas com comunicação velha é STALE, não ONLINE.
    if (status !== 'offline') {
      const commTs = parseTimestamp(lastCommunication);
      if (commTs != null) {
        const ageMin = (opts.now ?? Date.now()) - commTs;
        if (ageMin >= STALE_AFTER_MINUTES * 60_000) {
          return { state: 'STALE', color: '#94a3b8', label: 'DADO VELHO' };
        }
      }
    }
    // Velocidade real do rastreador > 0 = movimento confirmado (GT06 emite speed).
    if (opts.speed != null && opts.speed > 0) {
      return { state: 'ONLINE', color: '#10b981', label: 'MOVIMENTO' };
    }
    if (status === 'stopped' || status === 'online' || status === 'available' || status === 'in_use') {
      return { state: 'ONLINE', color: '#34d399', label: 'OPERACIONAL' };
    }
    return { state: 'NORMAL', color: '#94a3b8', label: 'NORMAL' };
  }
  switch (status) {
    case 'moving':
      return { state: 'ONLINE', color: '#10b981', label: 'MOVIMENTO' };
    case 'out_of_geofence':
      return { state: 'ALERT', color: '#f43f5e', label: 'FORA DA CERCA' };
    case 'low_battery':
      return { state: 'ALERT', color: '#f59e0b', label: 'BATERIA BAIXA' };
    case 'maintenance':
      return { state: 'ALERT', color: '#e11d48', label: 'MANUTENÇÃO' };
    case 'offline':
      return { state: 'OFFLINE', color: '#64748b', label: 'OFFLINE' };
    default:
      return { state: 'NORMAL', color: '#94a3b8', label: 'NORMAL' };
  }
}

/** Azul de seleção — mesmo usado pelo V1 pra marker selecionado. */
export const SELECTED_COLOR = '#38bdf8';

/**
 * Constrói o documento SVG completo (wrapper <svg> com xmlns) a partir do
 * markup interno de getAssetSVGPath, com a cor de traço injetada explicitamente
 * (SVG carregado como imagem não tem contexto CSS, "currentColor" não funciona).
 * Sem DOM — testável em node.
 */
export function buildSvgDocument(svgMarkup: string, color: string, viewBox = '0 0 24 24'): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none" stroke="${color}" ` +
    `stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svgMarkup}</svg>`
  );
}

/** Converte o documento SVG completo em data URL (UTF-8, código ASCII-safe). */
export function svgDocumentToDataUrl(svgDocument: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgDocument)}`;
}

/** Imagem completa pronta para addImage(MapLibre) de um ativo. */
export function resolveAssetImageDataUrl(asset: {
  category: AssetCategory;
  subcategory?: string | AssetSubcategory;
}): string {
  const visual = resolveAssetVisual(asset);
  return svgDocumentToDataUrl(buildSvgDocument(visual.svgMarkup, visual.primaryColor));
}