// Ponto de entrada do provider BRGPS — mesmo padrão de processo standalone do
// server/gt06-listener/index.ts (rodado via tsx, não um servidor web).
//
// Uso:
//   npx tsx server/brgps-sync/index.ts discover            # GET /tag/all -> registra novos como UNASSIGNED
//   npx tsx server/brgps-sync/index.ts activate <id...>    # PATCH /tag -> ativa dispositivos (admin only)
//   npx tsx server/brgps-sync/index.ts sync-once           # 1 ciclo de GET /tag em lote + persistência
//   npx tsx server/brgps-sync/index.ts sync                # loop contínuo respeitando BRGPS_SYNC_INTERVAL_SECONDS
//   npx tsx server/brgps-sync/index.ts history <id> <fromISO> <toISO>   # GET /tag/history real
//   npx tsx server/brgps-sync/index.ts test                # teste de conectividade seção 23/24/41 do brief
//
// Vinculação Device -> Asset (seção 12) não é feita aqui: é uma escrita simples
// em provider_devices, feita pelo próprio frontend autenticado (mesmo padrão de
// todo o resto do app, que fala direto com o Supabase via RLS) — ver TagsModule.tsx.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { BrGpsClient } from '../integrations/brgps/BrGpsClient.ts';
import { BrGpsAdapter } from '../integrations/brgps/BrGpsAdapter.ts';
import { BrGpsRepository } from '../integrations/brgps/db.ts';
import { BrGpsService } from '../integrations/brgps/BrGpsService.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '../../.env') });

const BRGPS_ENABLED = (process.env.BRGPS_ENABLED ?? 'false').toLowerCase() === 'true';
const BRGPS_BASE_URL = process.env.BRGPS_BASE_URL;
const BRGPS_API_TOKEN = process.env.BRGPS_API_TOKEN;
const BRGPS_SYNC_INTERVAL_SECONDS = Number(process.env.BRGPS_SYNC_INTERVAL_SECONDS ?? 15);
const DIRECT_URL = process.env.DIRECT_URL;

function requireEnv(): { baseUrl: string; apiToken: string; directUrl: string } {
  if (!BRGPS_ENABLED) {
    console.error('[brgps-sync] BRGPS_ENABLED=false — nenhuma chamada ao fornecedor será feita (seção 43 do brief). Ajuste o .env para "true" para prosseguir.');
    process.exit(1);
  }
  if (!BRGPS_BASE_URL || !BRGPS_API_TOKEN) {
    console.error('[brgps-sync] BRGPS_BASE_URL / BRGPS_API_TOKEN não definidos no .env.');
    process.exit(1);
  }
  if (!DIRECT_URL) {
    console.error('[brgps-sync] DIRECT_URL não definido no .env — não dá pra gravar/consultar o Postgres do ATHOS.');
    process.exit(1);
  }
  return { baseUrl: BRGPS_BASE_URL, apiToken: BRGPS_API_TOKEN, directUrl: DIRECT_URL };
}

function buildService(baseUrl: string, apiToken: string, repo: BrGpsRepository): BrGpsService {
  const client = new BrGpsClient({ baseUrl, apiToken });
  const adapter = new BrGpsAdapter(client);
  return new BrGpsService(adapter, repo);
}

async function main() {
  const [, , command, ...args] = process.argv;
  const { baseUrl, apiToken, directUrl } = requireEnv();

  const repo = new BrGpsRepository(directUrl);
  await repo.connect();
  console.log('[brgps-sync] conectado ao Postgres do ATHOS.');

  const service = buildService(baseUrl, apiToken, repo);

  try {
    switch (command) {
      case 'discover': {
        await service.syncDeviceCatalog();
        break;
      }

      case 'activate': {
        if (args.length === 0) {
          console.error('[brgps-sync] uso: activate <externalId...>');
          process.exit(1);
        }
        console.log(`[brgps-sync] ativando ${args.length} dispositivo(s) — operação administrativa, confirme que estes IDs são esperados: ${args.join(', ')}`);
        await service.activateDevices(args);
        break;
      }

      case 'sync-once': {
        await service.runSyncTick();
        break;
      }

      case 'sync': {
        console.log(`[brgps-sync] loop de polling iniciado — intervalo ${BRGPS_SYNC_INTERVAL_SECONDS}s.`);
        // eslint-disable-next-line no-constant-condition
        while (true) {
          await service.runSyncTick();
          await new Promise((resolve) => setTimeout(resolve, BRGPS_SYNC_INTERVAL_SECONDS * 1000));
        }
      }

      case 'history': {
        const [externalId, fromIso, toIso] = args;
        if (!externalId || !fromIso || !toIso) {
          console.error('[brgps-sync] uso: history <externalId> <fromISO> <toISO>');
          process.exit(1);
        }
        const { points } = await service.syncHistory(externalId, new Date(fromIso), new Date(toIso));
        if (points.length === 0) {
          console.log('[brgps-sync] Sem histórico disponível neste período.');
        } else {
          console.table(points.map((p) => ({
            occurredAt: p.occurredAt.toISOString(),
            lat: p.latitude,
            lng: p.longitude,
            distanceRaw: p.providerDistanceRaw ?? 'n/a',
            flags: p.qualityFlags.join(',') || '-',
          })));
        }
        break;
      }

      case 'test': {
        console.log('[brgps-sync] === Teste de conectividade real com a API BRGPS ===');
        const ids = await service.syncDeviceCatalog();
        if (ids.newlyRegistered === 0 && ids.discovered === 0) {
          console.log('[brgps-sync] Nenhuma tag disponível no servidor do fornecedor para esta credencial de teste.');
          break;
        }
        const unassigned = await repo.listUnassignedDevices();
        console.log(`[brgps-sync] ${unassigned.length} dispositivo(s) UNASSIGNED no catálogo local. Vincule um a um asset em TagsModule para incluí-lo no ciclo de sync.`);
        break;
      }

      default:
        console.error('[brgps-sync] comando desconhecido. Use: discover | activate | sync-once | sync | history | test');
        process.exit(1);
    }
  } finally {
    await repo.disconnect();
  }
}

main().catch((err) => {
  console.error('[brgps-sync] erro fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
