export type MapLabelLang = 'pt' | 'en';

const REGION_LANG_MAP: Record<string, MapLabelLang> = {
  BR: 'pt',
  CN: 'en',
  US: 'en',
  JP: 'en',
  DE: 'en',
  ES: 'en',
  FR: 'en',
};

export function resolveMapLanguage(region?: string): MapLabelLang {
  if (region && REGION_LANG_MAP[region]) return REGION_LANG_MAP[region];
  if (typeof navigator !== 'undefined') {
    const primary = navigator.language?.split('-')[0]?.toLowerCase();
    if (primary === 'pt') return 'pt';
  }
  return 'en';
}

export interface MapUIStrings {
  mode2D: string;
  modeSatellite: string;
  modeHybrid: string;
  viewAllAssets: string;
  followAsset: string;
  fullscreen: string;
  outlierNotice: (n: number) => string;
  spiderfyNotice: (n: number) => string;
  closeSpiderfy: string;
  labelMapV2: string;
  clusterLabel: string;
  communicating: string;
  positionStale: string;
  criticalAlert: string;
  noDataTitle: string;
  noDataDescription: string;
}

const STRINGS: Record<MapLabelLang, MapUIStrings> = {
  pt: {
    mode2D: '2D',
    modeSatellite: 'Satélite',
    modeHybrid: 'Híbrido',
    viewAllAssets: 'Ver todos os ativos',
    followAsset: 'Seguir ativo',
    fullscreen: 'Tela cheia',
    outlierNotice: (n: number) => `${n} ativo(s) fora do enquadramento inicial (continua no mapa)`,
    spiderfyNotice: (n: number) => `${n} ativo(s) expandido(s) — clique para selecionar`,
    closeSpiderfy: 'Fechar',
    labelMapV2: 'MAP V2 — MapLibre GL JS',
    clusterLabel: 'ATIVOS',
    communicating: 'Comunicando',
    positionStale: 'Posição Antiga',
    criticalAlert: 'Alerta Crítico',
    noDataTitle: 'Sem dados nas últimas 6 horas',
    noDataDescription: 'Aguardando eventos...',
  },
  en: {
    mode2D: '2D',
    modeSatellite: 'Satellite',
    modeHybrid: 'Hybrid',
    viewAllAssets: 'View all assets',
    followAsset: 'Follow asset',
    fullscreen: 'Fullscreen',
    outlierNotice: (n: number) => `${n} asset(s) outside initial framing (still on map)`,
    spiderfyNotice: (n: number) => `${n} asset(s) expanded — click to select`,
    closeSpiderfy: 'Close',
    labelMapV2: 'MAP V2 — MapLibre GL JS',
    clusterLabel: 'ASSETS',
    communicating: 'Communicating',
    positionStale: 'Stale Position',
    criticalAlert: 'Critical Alert',
    noDataTitle: 'No data in the last 6 hours',
    noDataDescription: 'Waiting for events...',
  },
};

export function getMapUIStrings(lang: MapLabelLang = 'en'): MapUIStrings {
  return STRINGS[lang] ?? STRINGS.en;
}
