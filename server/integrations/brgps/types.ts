// Tipos da integração com o provedor BRGPS (fabricante das tags de rastreamento).
// Nomes de domínio ficam neutros de provedor (NormalizedPosition, não "BrGpsPosition")
// para permitir trocar o adapter no futuro (DirectDeviceAdapter, outro fornecedor)
// sem alterar frontend/Asset/Position/Geofence/Alerts/Recovery — ver seção 44/45 do brief.

export interface BrGpsEnvelope<T> {
  statusCode: number;
  message: string;
  data: T | null;
  problem: string | null;
}

// ===== GET /tag =====
export interface BrGpsTagRaw {
  id: string | number;
  timestamp: number; // unix seconds — momento da localização
  publishTime: number; // unix seconds — momento em que o fornecedor publicou
  lat: number;
  lng: number;
  battery: -1 | 0 | 1 | 2 | 3;
  mac?: string;
  isActived: boolean;
}

// ===== GET /tag/all =====
// Resposta é o array de IDs diretamente em `data` (sem wrapper, sem campo
// hasMore) — confirmado na documentação oficial do fornecedor (seção 2.2.4):
// "设备Id数组，每次请求最多返回2000个设备号" = array de IDs, máx. 2000 por página.
export type BrGpsTagAllResponse = (string | number)[];

// ===== GET /tag/history =====
export interface BrGpsHistoryPointRaw {
  id: string | number;
  timestamp: number;
  lat: number;
  lng: number;
  distance?: number;
}

export type BatteryLevel = 'UNKNOWN' | 'CRITICAL' | 'LOW' | 'MEDIUM' | 'HIGH';

export type PositionQualityFlag =
  | 'INVALID_COORDINATE'
  | 'STALE_POSITION'
  | 'FUTURE_TIMESTAMP'
  | 'INVALID_BATTERY';

// Formato interno único do ATHOS Core — todo provider (BRGPS hoje, GT06 direto ou
// outro fornecedor amanhã) precisa produzir isto. Ver seção 8 do brief.
export interface NormalizedPosition {
  provider: 'BRGPS';
  externalDeviceId: string;
  deviceId?: string; // provider_devices.id (ATHOS), quando já vinculado a um asset
  assetId?: string;

  occurredAt: Date; // timestamp do fornecedor
  providerPublishedAt: Date; // publishTime do fornecedor
  receivedAt: Date; // momento de ingestão pelo ATHOS

  latitude: number;
  longitude: number;

  sourceType: 'PROVIDER_API';

  batteryRaw: number; // -1..3, valor cru do fornecedor
  batteryLevel: BatteryLevel;

  mac?: string;
  active: boolean;

  providerDistanceRaw?: number; // seção 14 — unidade não confirmada pelo fornecedor

  qualityFlags: PositionQualityFlag[];
  metadata?: Record<string, unknown>;
}

export interface BrGpsClientConfig {
  baseUrl: string;
  apiToken: string;
  timeoutMs?: number;
  maxRetries?: number;
}
