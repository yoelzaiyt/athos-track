// Checagem de saúde do provider BRGPS, pensada pra rodar via Scheduled Task
// periódica (ver scripts/install-brgps-healthcheck-task.ps1), separada do
// processo de sync em si (server/brgps-sync). Consulta provider_health e
// calcula a idade do último sucesso 100% no lado do Postgres (extract(epoch
// from (now() - updated_at))) — nunca comparando com Date.now() local, já
// que esta máquina tem um desvio de relógio conhecido (~6h) documentado em
// docs/integrations/BRGPS.md.
//
// Exit code 0 = saudável. Exit code 1 = alerta (status != HEALTHY ou stale).
// Uso: npx tsx scripts/brgps-health-check.ts

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '../.env') });

const STALE_THRESHOLD_SECONDS = 120; // bem acima do BRGPS_SYNC_INTERVAL_SECONDS (15s)

const client = new Client({ connectionString: process.env.DIRECT_URL });
await client.connect();

const { rows } = await client.query<{ status: string; age_seconds: string; requests_total: string; requests_failed: string }>(
  `select status, requests_total, requests_failed,
          extract(epoch from (now() - updated_at)) as age_seconds
   from provider_health where provider = 'BRGPS'`
);

await client.end();

const row = rows[0];

if (!row) {
  console.log('ALERT: nenhuma linha em provider_health para BRGPS — o sync nunca rodou com sucesso (ou a tabela foi limpa).');
  process.exit(1);
}

const ageSeconds = Number(row.age_seconds);

if (row.status !== 'HEALTHY') {
  console.log(`ALERT: provider_health.status = ${row.status} (esperado HEALTHY). requests_total=${row.requests_total} requests_failed=${row.requests_failed}`);
  process.exit(1);
}

if (ageSeconds > STALE_THRESHOLD_SECONDS) {
  console.log(`ALERT: último sucesso há ${Math.round(ageSeconds)}s (limite ${STALE_THRESHOLD_SECONDS}s) — o processo de sync provavelmente parou.`);
  process.exit(1);
}

console.log(`OK: BRGPS HEALTHY, último sucesso há ${Math.round(ageSeconds)}s.`);
process.exit(0);
