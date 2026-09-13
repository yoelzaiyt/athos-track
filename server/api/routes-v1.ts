// API pública para sistemas de clientes, autenticada por chave de API
// (card #8). Somente leitura por enquanto; ingestão de posições por
// terceiros fica para um card próprio.
//
//   GET /v1/assets -> ativos da empresa dona da chave, com a última posição.
//
// Isolamento em duas camadas: filtro explícito por client_id na query e RLS
// real via withTenantContext (a chave nunca é tratada como admin).

import { Router } from 'express';
import { requireApiKey } from './apiKeyAuth';
import { apiRateLimit } from './rateLimit';
import { withTenantContext } from './db';

export const v1Router = Router();
v1Router.use(requireApiKey);
v1Router.use(...apiRateLimit.middleware);

v1Router.get('/assets', async (req, res) => {
  const auth = req.auth!;
  try {
    const rows = await withTenantContext(auth, async (client) => {
      const result = await client.query(
        `select id, name, code, category, subcategory, status, unit_id, unit_name,
                telemetry_latitude as latitude, telemetry_longitude as longitude,
                telemetry_speed as speed_kmh, telemetry_battery_level as battery_level,
                telemetry_last_communication as last_communication_at, updated_at
           from assets
          where client_id = $1
          order by name`,
        [auth.client_id]
      );
      return result.rows;
    });
    res.json({ data: rows, count: rows.length });
  } catch (err) {
    console.error('[v1/assets] error:', (err as Error).message);
    res.status(500).json({ error: 'Internal error' });
  }
});
