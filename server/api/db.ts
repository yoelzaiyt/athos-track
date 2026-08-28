import { Pool, type PoolClient } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Missing DATABASE_URL — set it in the environment (Railway injects this automatically for its Postgres addon).');
}

// Role superusuário do projeto Supabase (BYPASSRLS) — usada pra login,
// resolução de auth (server/api/auth.ts), e pelos gateways internos
// confiáveis (gt06-listener, brgps-sync, scripts/migrate). Nunca usar este
// pool pra servir uma query de dado de tenant vinda de requisição de
// usuário — pra isso existe withTenantContext() abaixo.
export const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('railway') || connectionString.includes('supabase') ? { rejectUnauthorized: false } : undefined,
});

// RLS real como segunda camada de defesa (ver SECURITY-GATE-REPORT.md —
// "Banco de Dados" — e supabase/migrations/20260828030000_real_rls_defense_in_depth.sql).
// Role athos_app_rw NÃO tem BYPASSRLS: toda query de dado de tenant feita por
// server/api/rest.ts passa por aqui, dentro de uma transação que define
// app.client_id/app.is_admin via set_config() — as policies do banco leem
// essas GUCs e recusam devolver/gravar linha fora do tenant, mesmo que o
// filtro em rest.ts tenha um bug.
const appConnectionString = process.env.APP_DATABASE_URL;
const restrictedPool = appConnectionString
  ? new Pool({
      connectionString: appConnectionString,
      ssl: appConnectionString.includes('railway') || appConnectionString.includes('supabase') ? { rejectUnauthorized: false } : undefined,
    })
  : null;

if (!restrictedPool) {
  console.warn(
    '[db] APP_DATABASE_URL não definido — queries de tenant caem de volta pro pool superusuário ' +
      '(BYPASSRLS). O isolamento continua garantido só pela camada de aplicação (server/api/rest.ts), ' +
      'sem a segunda camada de RLS real. Configure APP_DATABASE_URL pra fechar isso.'
  );
}

export interface TenantAuth {
  client_id: string | null;
  role: string;
}

// Roda fn(client) dentro de uma transação com o contexto de tenant do
// usuário definido via set_config (SET LOCAL, escopo só dessa transação —
// reseta sozinho no COMMIT/ROLLBACK, sem risco de vazar pra outra requisição
// que reuse a mesma conexão do pool depois).
export async function withTenantContext<T>(auth: TenantAuth, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const targetPool = restrictedPool ?? pool;
  const client = await targetPool.connect();
  try {
    await client.query('BEGIN');
    if (restrictedPool) {
      await client.query(`select set_config('app.is_admin', $1, true)`, [auth.role === 'ATHOS_ADMIN' ? 'true' : 'false']);
      await client.query(`select set_config('app.client_id', $1, true)`, [auth.client_id ?? '']);
    }
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
