// FASE 7/8/10/13: hook de efeitos colaterais que busca periodicamente
// os dados reais do dashboard (status derivado + eventos) via REST
// autenticada — mantém o Dashboard declarativo.
//
// Regra do prompt: "SE APARECE NA TELA, TEM QUE SER REAL."
// poll da API BRGPS não é registrado como evento; os baldes do gráfico
// vêm de: route_points (leituras reais deduplicadas por fingerprint) +
// system_alerts (eventos reais de geofence/alerta). Nenhum contém poll.
//
// "Sem F5": refresh automático periódico (30s status, 60s eventos) +
// fetch no mount.

import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeRealtimeStatus, type RealtimeConnectionStatus } from '../lib/supabaseClient';
import { countDerivedStatuses, type StatusBasisAsset, type DerivedStatusKey } from '../lib/deviceStatus';

const API_URL = import.meta.env.VITE_API_URL as string;

export interface StatusBundle {
  assets: StatusBasisAsset[];
  counts: Record<DerivedStatusKey, number>;
  computedAt: string;
}

export interface EventsBundle {
  hours: number;
  buckets: { hour: string; telemetry: number; alerts: number }[];
  totals: { telemetry: number; alerts: number };
  computedAt: string;
}

function authToken(): string | null {
  try { return localStorage.getItem('athos_auth_token'); } catch { return null; }
}

async function safeFetch<T>(path: string, signal?: AbortSignal): Promise<T> {
  const token = authToken();
  const res = await fetch(`${API_URL}${path}`, {
    signal,
    headers: token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function scopeParams(clientId?: string, unitId?: string): URLSearchParams {
  const p = new URLSearchParams();
  if (clientId) p.set('clientId', clientId);
  if (unitId) p.set('unitId', unitId);
  return p;
}

interface UseDashboardStatsOpts {
  clientId?: string;
  unitId?: string;
  statusPollMs?: number;
  eventsPollMs?: number;
}

const DEFAULT_STATUS_POLL = 30_000;
const DEFAULT_EVENTS_POLL = 60_000;

export function useDashboardStats({
  clientId,
  unitId,
  statusPollMs = DEFAULT_STATUS_POLL,
  eventsPollMs = DEFAULT_EVENTS_POLL,
}: UseDashboardStatsOpts = {}) {
  const scopeQS = scopeParams(clientId, unitId);
  const scopeQSEvents = scopeParams(clientId, unitId);
  scopeQSEvents.set('hours', '6');
  const qsStatus = scopeQS.toString() ? `?${scopeQS.toString()}` : '';
  const qsEvents = scopeQSEvents.toString() ? `?${scopeQSEvents.toString()}` : '';

  const [statusBundle, setStatusBundle] = useState<StatusBundle | null>(null);
  const [eventsBundle, setEventsBundle] = useState<EventsBundle | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeConnectionStatus>('OFFLINE');
  const [lastStatusUpdateAt, setLastStatusUpdateAt] = useState<number | null>(null);
  const [lastEventsUpdateAt, setLastEventsUpdateAt] = useState<number | null>(null);

  const statusAbortRef = useRef<AbortController | null>(null);
  const eventsAbortRef = useRef<AbortController | null>(null);

  useEffect(() => subscribeRealtimeStatus(setRealtimeStatus), []);

  const fetchStatus = useCallback(async () => {
    statusAbortRef.current?.abort();
    const c = new AbortController();
    statusAbortRef.current = c;
    try {
      const res = await safeFetch<StatusBundle>(`/stats/status-basis${qsStatus}`, c.signal);
      setStatusBundle({ assets: res.assets, counts: countDerivedStatuses(res.assets), computedAt: res.computedAt });
      setLastStatusUpdateAt(Date.now());
      setStatusError(null);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setStatusError((err as Error).message ?? 'Falha ao buscar status');
    }
  }, [qsStatus]);

  const fetchEvents = useCallback(async () => {
    eventsAbortRef.current?.abort();
    const c = new AbortController();
    eventsAbortRef.current = c;
    try {
      const res = await safeFetch<EventsBundle>(`/stats/events${qsEvents}`, c.signal);
      setEventsBundle(res);
      setLastEventsUpdateAt(Date.now());
      setEventsError(null);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setEventsError((err as Error).message ?? 'Falha ao buscar eventos');
    }
  }, [qsEvents]);

  useEffect(() => {
    fetchStatus();
    fetchEvents();
    const idStatus = setInterval(fetchStatus, statusPollMs);
    const idEvents = setInterval(fetchEvents, eventsPollMs);
    return () => {
      clearInterval(idStatus);
      clearInterval(idEvents);
      statusAbortRef.current?.abort();
      eventsAbortRef.current?.abort();
    };
  }, [fetchStatus, fetchEvents]);

  return {
    statusBundle,
    statusCounts: statusBundle?.counts ?? null,
    statusLoading: statusBundle === null && statusError === null,
    statusError,
    lastStatusUpdateAt,
    fetchStatus,
    eventsBundle,
    eventsBuckets: eventsBundle?.buckets ?? [],
    eventsLoading: eventsBundle === null && eventsError === null,
    eventsError,
    lastEventsUpdateAt,
    fetchEvents,
    realtimeStatus,
  } as const;
}