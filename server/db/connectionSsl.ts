// Decide se uma connection string precisa de TLS. Existia como ternário
// repetido em 6 lugares (server/api/db.ts x2, realtime.ts, migrate.ts,
// gt06/homologRepo.ts, scripts/provision-user-password.ts) — e na
// consolidação num banco único no Railway isso virou bug: homologRepo.ts
// testava só "supabase" e teria conectado sem TLS no banco novo.
//
// Hosts gerenciados (Railway, inclusive o proxy TCP público *.rlwy.net, e
// o Supabase legado) exigem TLS e usam certificado que o Node não valida
// por padrão. Um Postgres local roda sem TLS.
export function sslFor(connectionString: string): { rejectUnauthorized: false } | undefined {
  return /railway|rlwy\.net|supabase/.test(connectionString) ? { rejectUnauthorized: false } : undefined;
}
