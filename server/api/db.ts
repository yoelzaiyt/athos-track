import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Missing DATABASE_URL — set it in the environment (Railway injects this automatically for its Postgres addon).');
}

export const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('railway') || connectionString.includes('supabase') ? { rejectUnauthorized: false } : undefined,
});
