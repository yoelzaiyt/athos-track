// Endpoints de estatística operacional honesta (dados 100% reais, sem mock):
//
//   GET /stats/events       -> séries horárias (últimas N horas) de TELEMETRIA
//                              (asset_route_points) e ALERTAS (system_alerts).
//   GET /stats/status-basis -> por asset: timestamps reais (last_comm, packet,
//                              server_received_at), speed, e o par de últimos
//                              pontos de trilha pra derivar deslocamento.
//
// Conceitos (ver docs/OPERATIONAL-REFINEMENT-REPORT.md, EVENT_DEFINITION):
//   - TELEMETRY (LOCATION_UPDATE): cada leitura real do dispositivo persistida
//     em asset_route_points (deduplicada por fingerprint). Uma chamada de
//     polling da API BRGPS que não traz leitura nova NÃO cria ponto.
//   - ALERT (DEVICE_EVENT): linhas de system_alerts (geofence entry/exit e
//     demais eventos de dispositivo gravados pelos providers).
//   - API_POLL: o ciclo de sync em si (`server/brgps-sync`) — nunca é
//     contado como evento em nenhuma das séries.
//
// Tenant isolation: não-admin é FORÇADO ao próprio client_id (fail-closed,
// mesmo padrão do rest.ts); ATHOS_ADMIN pode filtrar ou ver tudo.

import { Router } from 'express';
import { pool } from './db';
import { requireAuth, type AuthTokenPayload } from './auth';

const ADMIN_ROLE = 'ATHOS_ADMIN';
const MAX_HOURS = 24;

export const statsRouter = Router();

statsRouter.use(requireAuth);

function isAdmin(auth: AuthTokenPayload): boolean {
  return auth.role === ADMIN_ROLE;
}

// Resolve o escopo efetivo de tenant/unidade. Retorna:
//   - clientId: string | null (null = todos os clients, só admin)
//   - unitId: string | null (null = sem filtro de unidade)
// Não-admin com client_id ausente: fail-closed (403).
function resolveScope(auth: AuthTokenPayload, query: Record<string, unknown>): { clientId: string | null; unitId: string | null } {
  const rawClient = typeof query.clientId === 'string' && query.clientId ? query.clientId : null;
  const rawUnit = typeof query.unitId === 'string' && query.unitId ? query.unitId : null;

  if (isAdmin(auth)) {
    return { clientId: rawClient, unitId: rawUnit };
  }

  if (!auth.client_id) {
    throw Object.assign(new Error('User has no client_id assigned'), { status: 403 });
  }
  if (rawClient && rawClient !== auth.client_id) {
    throw Object.assign(new Error('Client is not allowed for this user'), { status: 403 });
  }
  if (rawUnit && auth.unit_id && rawUnit !== auth.unit_id) {
    throw Object.assign(new Error('Unit is not allowed for this user'), { status: 403 });
  }
  return { clientId: auth.client_id, unitId: rawUnit ?? auth.unit_id ?? null };
}

function scopeArrays(clientId: string | null, unitId: string | null): { conditions: string[]; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (clientId) conditions.push(`client_id = $${params.push(clientId)}`);
  if (unitId) conditions.push(`unit_id = $${params.push(unitId)}`);
  return { conditions, params };
}

// Haversine em km — usada pra transformar os 2 últimos trilha-points em
// deslocamento, já que BRGPS não fornece velocidade em telemetria.
function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

statsRouter.get('/events', async (req, res) => {
  try {
    const { clientId, unitId } = resolveScope(req.auth!, req.query as Record<string, unknown>);
    const hours = Math.min(Math.max(Number(req.query.hours) || 6, 1), MAX_HOURS);
    const now = new Date();
    const start = new Date(now.getTime() - hours * 3600 * 1000);

    const telemetryParams: unknown[] = [start.toISOString()];
    let telemetryScope = '';
    const alertsParams: unknown[] = [start.toISOString()];
    let alertScope = '';
    if (clientId) {
      telemetryScope += ` and client_id = $${telemetryParams.push(clientId)}`;
      alertScope += ` and a.client_id = $${alertsParams.push(clientId)}`;
    }
    if (unitId) {
      telemetryScope += ` and asset_id in (select id from assets where unit_id = $${telemetryParams.push(unitId)})`;
      alertScope += ` and a.unit_id = $${alertsParams.push(unitId)}`;
    }

    const [telemetryRes, alertsRes] = await Promise.all([
      pool.query(
        `select date_trunc('hour', recorded_at) as hour_bucket, count(*)::int as n
           from asset_route_points
          where recorded_at >= $1${telemetryScope}
          group by 1 order by 1`,
        telemetryParams
      ),
      pool.query(
        `select date_trunc('hour', al.created_at) as hour_bucket, count(*)::int as n
           from system_alerts al
           join assets a on a.id = al.asset_id
          where al.created_at >= $1${alertScope}
          group by 1 order by 1`,
        alertsParams
      ),
    ]);

    const telemetryByHour = new Map<string, number>();
    for (const r of telemetryRes.rows) telemetryByHour.set(r.hour_bucket.toISOString(), r.n);
    const alertsByHour = new Map<string, number>();
    for (const r of alertsRes.rows) alertsByHour.set(r.hour_bucket.toISOString(), r.n);

    // 6 baldes com início de hora em UTC; o frontend formata pra hora local.
    const utcHourStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), 0, 0, 0));
    const firstBucket = utcHourStart(start);
    const buckets = Array.from({ length: hours }, (_, i) => {
      const bucketStart = new Date(firstBucket.getTime() + i * 3600 * 1000);
      const key = bucketStart.toISOString();
      return {
        hour: key,
        telemetry: telemetryByHour.get(key) ?? 0,
        alerts: alertsByHour.get(key) ?? 0,
      };
    });

    res.json({
      hours,
      computedAt: now.toISOString(),
      buckets,
      totals: {
        telemetry: buckets.reduce((s, b) => s + b.telemetry, 0),
        alerts: buckets.reduce((s, b) => s + b.alerts, 0),
      },
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    if (status >= 500) console.error('[stats/events] error:', (err as Error).message);
    res.status(status).json({ error: (err as Error).message });
  }
});

statsRouter.get('/status-basis', async (req, res) => {
  try {
    const { clientId, unitId } = resolveScope(req.auth!, req.query as Record<string, unknown>);
    const { conditions, params } = scopeArrays(clientId, unitId);
    const scope = conditions.length ? ` where ${conditions.join(' and ')}` : '';
    const keyBase = params.length;

    const assetsRes = await pool.query(
      `select a.id as asset_id, a.name as asset_name, a.status, a.category,
              a.telemetry_last_communication as last_comm,
              a.telemetry_packet_timestamp as packet_ts,
              a.telemetry_server_received_at as server_received_at,
              a.telemetry_speed as speed_kmh,
              a.telemetry_battery_level as battery_level,
              a.telemetry_battery_level_category as battery_category,
              a.telemetry_latitude as latitude, a.telemetry_longitude as longitude,
              (select count(*) from system_alerts sa
                where sa.asset_id = a.id and sa.acknowledged = false and sa.severity = 'critical')::int as unacked_critical,
              (select count(*) from system_alerts sa
                where sa.asset_id = a.id and sa.acknowledged = false)::int as unacked_alerts
         from assets a${scope}
        order by a.name`,
      params
    );

    const assetIds = assetsRes.rows.map((r) => r.asset_id as string);
    const motionByAsset = new Map<
      string,
      { distanceKm: number; windowMs: number; derivedSpeedKmh: number | null }
    >();

    if (assetIds.length > 0) {
      const pointsParams: unknown[] = [assetIds];
      const pointsRes = await pool.query(
        `with ranked as (
            select asset_id, latitude, longitude, recorded_at,
                   row_number() over (partition by asset_id order by recorded_at desc) as rn
              from asset_route_points
             where asset_id = any($1::uuid[])
         )
         select asset_id, latitude, longitude, recorded_at from ranked where rn <= 2
          order by asset_id, recorded_at desc`,
        pointsParams
      );
      const latest: Record<string, { lat: number; lng: number; at: Date }> = {};
      for (const r of pointsRes.rows) {
        const id = r.asset_id as string;
        const point = { lat: Number(r.latitude), lng: Number(r.longitude), at: new Date(r.recorded_at) };
        if (latest[id]) {
          const prev = latest[id];
          const dist = distanceKm(prev.lat, prev.lng, point.lat, point.lng);
          const windowMs = Math.abs(prev.at.getTime() - point.at.getTime());
          const derivedSpeedKmh = windowMs > 0 ? (dist / (windowMs / 3600 / 1000)) : null;
          motionByAsset.set(id, { distanceKm: dist, windowMs, derivedSpeedKmh });
        } else {
          latest[id] = point;
        }
      }
    }

    const assets = assetsRes.rows.map((r: Record<string, unknown>) => ({
      assetId: r.asset_id,
      assetName: r.asset_name,
      status: r.status,
      category: r.category,
      lastComm: r.last_comm ? new Date(r.last_comm as string).toISOString() : null,
      packetTs: r.packet_ts ? new Date(r.packet_ts as string).toISOString() : null,
      serverReceivedAt: r.server_received_at ? new Date(r.server_received_at as string).toISOString() : null,
      speedKmh:
        typeof r.speed_kmh === 'number' && Number.isFinite(r.speed_kmh) ? Number(r.speed_kmh) : null,
      batteryLevel:
        typeof r.battery_level === 'number' && Number.isFinite(r.battery_level) ? Number(r.battery_level) : null,
      batteryCategory: r.battery_category ?? null,
      latitude: typeof r.latitude === 'number' ? Number(r.latitude) : null,
      longitude: typeof r.longitude === 'number' ? Number(r.longitude) : null,
      unackedCritical: r.unacked_critical,
      unackedAlerts: r.unacked_alerts,
      motion: motionByAsset.get(r.asset_id as string) ?? null,
    }));

    res.json({ computedAt: new Date().toISOString(), assets });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    if (status >= 500) console.error('[stats/status-basis] error:', (err as Error).message);
    res.status(status).json({ error: (err as Error).message });
  }
});