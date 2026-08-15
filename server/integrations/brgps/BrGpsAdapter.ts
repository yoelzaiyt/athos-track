// Integra o BrGpsClient (protocolo cru do fornecedor) ao Core Universal ATHOS:
// busca em lote, paginação de /tag/all e conversão via BrGpsMapper. Não fala
// com o banco (isso é responsabilidade do BrGpsRepository/db.ts) — só sabe
// conversar com o fornecedor e devolver tipos normalizados. Ver seção 5 do brief.

import { BrGpsClient } from './BrGpsClient.ts';
import { mapHistoryPoint, mapTagToNormalizedPosition, type MappedHistoryPoint } from './BrGpsMapper.ts';
import type { BrGpsHistoryPointRaw, BrGpsTagRaw, NormalizedPosition } from './types.ts';

const MAX_IDS_PER_ALL_PAGE = 2000; // seção 11 do brief

export class BrGpsAdapter {
  constructor(private client: BrGpsClient) {}

  /**
   * GET /tag/all paginado até esgotar a lista — seção 11/12. A resposta é o
   * array de IDs direto em `data` (confirmado na doc oficial, sem campo
   * hasMore): continuamos paginando enquanto a página vier cheia (2000 ids).
   */
  async discoverAllDeviceIds(isActived?: boolean): Promise<string[]> {
    const allIds: string[] = [];
    let page = 1;

    for (;;) {
      const data = await this.client.request<(string | number)[]>('/tag/all', {
        page: String(page),
        isActived: isActived === undefined ? undefined : String(isActived),
      });

      const ids = (data ?? []).map(String);
      allIds.push(...ids);

      if (ids.length < MAX_IDS_PER_ALL_PAGE) break;
      page += 1;
    }

    return allIds;
  }

  /** GET /tag em lote (múltiplos ids por vírgula) — seção 4/7. */
  async fetchPositions(externalIds: string[]): Promise<NormalizedPosition[]> {
    if (externalIds.length === 0) return [];

    const data = await this.client.request<BrGpsTagRaw[] | BrGpsTagRaw>('/tag', { ids: externalIds.join(',') });
    const list = Array.isArray(data) ? data : data ? [data] : [];
    return list.map((raw) => mapTagToNormalizedPosition(raw));
  }

  /** GET /tag/history — seção 13. */
  async fetchHistory(externalId: string, timeFrom: Date, timeTo: Date): Promise<MappedHistoryPoint[]> {
    const data = await this.client.request<BrGpsHistoryPointRaw[]>('/tag/history', {
      id: externalId,
      timeFrom: String(Math.floor(timeFrom.getTime() / 1000)),
      timeTo: String(Math.floor(timeTo.getTime() / 1000)),
    });
    return (data ?? []).map(mapHistoryPoint);
  }

  /** PATCH /tag — ativação de dispositivos. Seção 15: operação administrativa. */
  async activateDevices(externalIds: string[]): Promise<void> {
    if (externalIds.length === 0) return;
    await this.client.request<null>('/tag', undefined, 'PATCH', externalIds.map(Number));
  }
}
