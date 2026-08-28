// Teste de integração real da rodada "MULTI-PROVIDER CONCURRENCY TEST" (ver
// MULTI-PROVIDER-VALIDATION.md). Bate direto no Postgres de dev real via
// BrGpsRepository.applyPosition() — o mesmo código que roda em produção —
// com dezenas de chamadas concorrentes de VERDADE (cada uma com sua própria
// conexão pg, não reaproveitando um Client só, que serializaria as queries e
// mascararia qualquer corrida) contra o MESMO asset/dispositivo.
//
// Dois bugs de concorrência reais foram encontrados e corrigidos nesta
// rodada (ver comentários em db.ts, applyPosition): (1) o dedup por
// fingerprint tinha uma janela SELECT-then-INSERT não atômica que estourava
// a constraint única como exceção não tratada; (2) o "nunca substituir a
// posição atual por uma mais antiga" também não era atômico (lost update
// clássico). Este teste é a regressão permanente pros dois.
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../../api/db.ts';
import { BrGpsRepository } from './db.ts';
import type { NormalizedPosition } from './types.ts';
import type { PositionTarget } from './db.ts';

const ids: Record<string, string> = {};

async function cleanup() {
  await pool.query(`delete from asset_route_points where asset_id in (select id from assets where code like 'CONCTEST-%')`);
  await pool.query(`delete from provider_devices where asset_id in (select id from assets where code like 'CONCTEST-%')`);
  await pool.query(`delete from assets where code like 'CONCTEST-%'`);
  await pool.query(`delete from company_units where name like 'CONCTEST Unit%'`);
  await pool.query(`delete from company_clients where code like 'CONCTEST-%'`);
}

let target: PositionTarget;

beforeAll(async () => {
  await cleanup();

  const tenant = await pool.query(
    `insert into company_clients (name, code, cnpj, status, enabled_modules) values ('CONCTEST Tenant','CONCTEST-A','99.999.999/0001-99','active','["assets"]') returning id`
  );
  ids.tenantId = tenant.rows[0].id;

  const unit = await pool.query(
    `insert into company_units (client_id, name, city, state, address, status) values ($1,'CONCTEST Unit','SP','SP','x','active') returning id`,
    [ids.tenantId]
  );
  ids.unitId = unit.rows[0].id;

  const asset = await pool.query(
    `insert into assets (name, code, imei, category, client_id, unit_id, status, protocol, unit_name)
     values ('CONCTEST Asset','CONCTEST-ASSET','000000000000099','asset',$1,$2,'available','GT06','un') returning id`,
    [ids.tenantId, ids.unitId]
  );
  ids.assetId = asset.rows[0].id;

  const device = await pool.query(
    `insert into provider_devices (provider, external_device_id, asset_id, status, is_actived)
     values ('BRGPS','CONCTEST-EXT-1',$1,'ASSIGNED',true) returning id`,
    [ids.assetId]
  );
  ids.providerDeviceId = device.rows[0].id;

  target = {
    providerDeviceId: ids.providerDeviceId,
    externalDeviceId: 'CONCTEST-EXT-1',
    assetId: ids.assetId,
    assetName: 'CONCTEST Asset',
    assetCode: 'CONCTEST-ASSET',
    category: 'asset',
    subcategory: null,
    clientId: ids.tenantId,
    unitId: ids.unitId,
    unitName: 'un',
    status: 'available',
    geofenceId: null,
    geofenceName: null,
  };
}, 30_000);

afterAll(async () => {
  await cleanup();
});

function makePosition(occurredAt: Date, latitude: number, longitude: number): NormalizedPosition {
  return {
    provider: 'BRGPS',
    externalDeviceId: 'CONCTEST-EXT-1',
    occurredAt,
    providerPublishedAt: occurredAt,
    receivedAt: new Date(),
    latitude,
    longitude,
    sourceType: 'PROVIDER_API',
    batteryRaw: 2,
    batteryLevel: 'MEDIUM',
    active: true,
    qualityFlags: [],
  };
}

describe('BrGpsRepository.applyPosition — concorrência real (40 conexões simultâneas)', () => {
  it('nunca lança exceção sob corrida no dedup por fingerprint (duplicação de evento concorrente)', async () => {
    const baseTime = Date.now();
    const calls: { occurredAt: Date; latitude: number; longitude: number }[] = [];

    for (let i = 0; i < 10; i++) {
      calls.push({ occurredAt: new Date(baseTime + i * 1000), latitude: -23.5 + i * 0.001, longitude: -46.6 + i * 0.001 });
    }
    const dup = { occurredAt: new Date(baseTime + 5000), latitude: -23.5123, longitude: -46.6123 };
    for (let i = 0; i < 15; i++) calls.push({ ...dup });
    // Timestamps embaralhados (eventos fora de ordem / atrasados chegando concorrentemente).
    const shuffledOffsetsSec = [50, 30, 45, 10, 60, 20, 55, 5, 40, 35, 25, 15, 65, 70, 1];
    for (const s of shuffledOffsetsSec) {
      calls.push({ occurredAt: new Date(baseTime + s * 1000), latitude: -23.6, longitude: -46.7 });
    }

    const maxTimestampSent = new Date(Math.max(...calls.map((c) => c.occurredAt.getTime())));

    // Cada chamada com sua PRÓPRIA conexão — concorrência de verdade, não
    // serializada por um único pg.Client.
    const settled = await Promise.allSettled(
      calls.map(async (c) => {
        const repo = new BrGpsRepository(process.env.DATABASE_URL!);
        await repo.connect();
        try {
          return await repo.applyPosition(target, makePosition(c.occurredAt, c.latitude, c.longitude));
        } finally {
          await repo.disconnect();
        }
      })
    );

    const rejected = settled.filter((s): s is PromiseRejectedResult => s.status === 'rejected');
    expect(rejected, `nenhuma chamada deveria lançar exceção (achado: ${rejected[0]?.reason})`).toHaveLength(0);

    const fulfilled = settled.filter((s): s is PromiseFulfilledResult<Awaited<ReturnType<BrGpsRepository['applyPosition']>>> => s.status === 'fulfilled');
    expect(fulfilled).toHaveLength(40);
    expect(fulfilled.filter((f) => f.value.deduped)).toHaveLength(14); // 14 das 15 chamadas duplicadas perdem a corrida

    const finalAsset = await pool.query(
      'select telemetry_packet_timestamp, telemetry_latitude, telemetry_longitude from assets where id = $1',
      [ids.assetId]
    );
    // O estado final tem que refletir o timestamp CRONOLOGICAMENTE mais
    // recente entre todas as 40 chamadas concorrentes — não o que "ganhou"
    // por sorte de ordem de execução (era o bug: lost update).
    expect(new Date(finalAsset.rows[0].telemetry_packet_timestamp).getTime()).toBe(maxTimestampSent.getTime());

    const routePoints = await pool.query(
      'select count(*)::int as total, count(distinct fingerprint)::int as distinct_fp from asset_route_points where asset_id = $1',
      [ids.assetId]
    );
    // Nenhuma linha de histórico duplicada, mesmo com 15 chamadas
    // concorrentes mandando o mesmo fingerprint exato.
    expect(routePoints.rows[0].total).toBe(routePoints.rows[0].distinct_fp);
  }, 30_000);
});
