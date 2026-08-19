// Camada REST genérica que imita o subconjunto do query-builder do
// supabase-js realmente usado pelo frontend (.from(table).select().order().
// eq().single()/.maybeSingle(), .insert(), .update(), .delete()). Existe pra
// que src/lib/supabaseClient.ts vire um cliente HTTP fino sem precisar
// reescrever AssetContext.tsx/AuthContext.tsx/mappers.ts inteiros.
//
// Autorização: mesmo nível que a RLS "authenticated only" que o projeto já
// tinha (qualquer sessão válida acessa qualquer tabela da lista) — ver
// server/api/auth.ts. Granularidade por role fica pra depois, como já era o
// caso antes desta migração.

import { Router } from 'express';
import { pool } from './db';
import { requireAuth } from './auth';

// Mesma lista de tabelas hoje consultadas via supabase-js em src/context/*.tsx.
const ALLOWED_TABLES = new Set([
  'assets', 'system_alerts', 'geofences', 'cargo_shipments', 'drivers', 'animals',
  'maintenance_records', 'trip_records', 'cart_recoveries', 'work_orders',
  'greylist_entries', 'asset_recovery_cases', 'route_templates', 'asset_pairings',
  'traffic_segments', 'points_of_interest', 'provider_devices', 'provider_health',
  'system_integrations', 'user_profiles', 'company_clients', 'company_units',
  'homologation_requests', 'homologation_devices', 'homologation_events', 'homologation_reports',
  'recovery_occurrences', 'recovery_timeline_events', 'asset_route_points',
]);

const IDENTIFIER_RE = /^[a-z_][a-z0-9_]*$/;

function assertIdentifier(name: string, label: string) {
  if (!IDENTIFIER_RE.test(name)) {
    throw new Error(`Invalid ${label}: ${name}`);
  }
}

export const restRouter = Router();
restRouter.use(requireAuth);

restRouter.param('table', (req, res, next, table: string) => {
  if (!ALLOWED_TABLES.has(table)) {
    res.status(404).json({ error: `Unknown table: ${table}` });
    return;
  }
  next();
});

const FILTER_OPS: Record<string, string> = { eq: '=', gte: '>=', lte: '<=' };

function parseFilters(query: Record<string, unknown>): [string, string, string][] {
  const filters: [string, string, string][] = [];
  for (const [key, value] of Object.entries(query)) {
    if (typeof value !== 'string') continue;
    for (const op of Object.keys(FILTER_OPS)) {
      if (key.startsWith(`${op}_`)) {
        const col = key.slice(op.length + 1);
        assertIdentifier(col, 'column');
        filters.push([op, col, value]);
        break;
      }
    }
  }
  return filters;
}

function parseEqFilters(query: Record<string, unknown>): [string, string][] {
  return parseFilters(query)
    .filter(([op]) => op === 'eq')
    .map(([, col, value]) => [col, value]);
}

// GET /rest/:table?order=col&ascending=false&eq_col=value&gte_col=value&single=true
restRouter.get('/:table', async (req, res) => {
  const { table } = req.params;
  try {
    const filters = parseFilters(req.query as Record<string, unknown>);
    let sql = `select * from ${table}`;
    const values: unknown[] = [];
    if (filters.length > 0) {
      sql += ' where ' + filters.map(([op, col], i) => `${col} ${FILTER_OPS[op]} $${i + 1}`).join(' and ');
      values.push(...filters.map(([, , v]) => v));
    }
    if (typeof req.query.order === 'string') {
      assertIdentifier(req.query.order, 'order column');
      const ascending = req.query.ascending !== 'false';
      sql += ` order by ${req.query.order} ${ascending ? 'asc' : 'desc'}`;
    }
    const result = await pool.query(sql, values);
    if (req.query.single === 'true') {
      res.json(result.rows[0] ?? null);
      return;
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /rest/:table  body: object | object[]
restRouter.post('/:table', async (req, res) => {
  const { table } = req.params;
  try {
    const rows = Array.isArray(req.body) ? req.body : [req.body];
    if (rows.length === 0) {
      res.status(400).json({ error: 'Empty insert payload' });
      return;
    }
    const columns = Object.keys(rows[0]);
    columns.forEach((c) => assertIdentifier(c, 'column'));

    const insertedRows: unknown[] = [];
    for (const row of rows) {
      const values = columns.map((c) => row[c]);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const sql = `insert into ${table} (${columns.join(', ')}) values (${placeholders}) returning *`;
      const result = await pool.query(sql, values);
      insertedRows.push(result.rows[0]);
    }

    res.status(201).json(Array.isArray(req.body) ? insertedRows : insertedRows[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// PATCH /rest/:table?eq_col=value  body: partial fields
restRouter.patch('/:table', async (req, res) => {
  const { table } = req.params;
  try {
    const filters = parseEqFilters(req.query as Record<string, unknown>);
    if (filters.length === 0) {
      res.status(400).json({ error: 'PATCH requires at least one eq_ filter' });
      return;
    }
    const columns = Object.keys(req.body);
    columns.forEach((c) => assertIdentifier(c, 'column'));
    if (columns.length === 0) {
      res.status(400).json({ error: 'Empty update payload' });
      return;
    }
    const values = columns.map((c) => req.body[c]);
    const setClause = columns.map((c, i) => `${c} = $${i + 1}`).join(', ');
    const whereClause = filters.map(([col], i) => `${col} = $${columns.length + i + 1}`).join(' and ');
    values.push(...filters.map(([, v]) => v));
    const sql = `update ${table} set ${setClause} where ${whereClause} returning *`;
    const result = await pool.query(sql, values);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// DELETE /rest/:table?eq_col=value
restRouter.delete('/:table', async (req, res) => {
  const { table } = req.params;
  try {
    const filters = parseEqFilters(req.query as Record<string, unknown>);
    if (filters.length === 0) {
      res.status(400).json({ error: 'DELETE requires at least one eq_ filter' });
      return;
    }
    const values = filters.map(([, v]) => v);
    const whereClause = filters.map(([col], i) => `${col} = $${i + 1}`).join(' and ');
    const sql = `delete from ${table} where ${whereClause}`;
    await pool.query(sql, values);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
