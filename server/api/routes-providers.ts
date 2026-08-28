// Endpoints administrativos sobre a camada TrackingProvider (seções 4, 7, 22
// do brief multi-tenant/multi-provider). Aceita 'brgps', 'heile' ou 'jason'
// como :providerId — os três resolvem pro mesmo provider real (ver
// server/integrations/shared/TrackingProvider.ts).

import { Router } from 'express';
import { requireAuth } from './auth';
import { ProviderRegistry } from '../integrations/shared/ProviderRegistry';
import { writeAuditLog } from './audit';

export const providersRouter = Router();
providersRouter.use(requireAuth);

const ADMIN_ROLE = 'ATHOS_ADMIN';

function resolveProvider(req: import('express').Request, res: import('express').Response) {
  const provider = ProviderRegistry.get(req.params.providerId);
  if (!provider) {
    res.status(404).json({ error: `Unknown provider: ${req.params.providerId}` });
    return null;
  }
  return provider;
}

// GET /providers/:providerId/health — status operacional (seção 22). Leitura
// livre pra qualquer autenticado, mesmo nível de acesso que GET /rest/provider_health.
providersRouter.get('/:providerId/health', async (req, res) => {
  const provider = resolveProvider(req, res);
  if (!provider) return;
  try {
    res.json(await provider.healthCheck());
  } catch (err) {
    console.error('[providers] healthCheck failed:', (err as Error).message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// POST /providers/:providerId/activate  body: { externalIds: string[] }
// Ativação de tag (seção 7) — operação administrativa, nunca por usuário de
// campo. Registra em audit_logs: actor, ação, ids, resultado (nunca o token).
providersRouter.post('/:providerId/activate', async (req, res) => {
  const auth = req.auth!;
  if (auth.role !== ADMIN_ROLE) {
    res.status(403).json({ error: `Only ${ADMIN_ROLE} can activate provider devices` });
    return;
  }
  const provider = resolveProvider(req, res);
  if (!provider) return;

  const externalIds = Array.isArray(req.body?.externalIds) ? req.body.externalIds.map(String) : [];
  if (externalIds.length === 0) {
    res.status(400).json({ error: 'externalIds (array) is required' });
    return;
  }

  try {
    await provider.activateDevice(externalIds);
    await writeAuditLog({
      actor: auth,
      action: 'provider.device.activate',
      entityType: 'provider_device',
      entityId: externalIds.join(','),
      result: 'success',
      detail: { providerId: provider.id, requestedAs: req.params.providerId, count: externalIds.length },
    });
    res.json({ ok: true, activated: externalIds.length });
  } catch (err) {
    const message = (err as Error).message;
    await writeAuditLog({
      actor: auth,
      action: 'provider.device.activate',
      entityType: 'provider_device',
      entityId: externalIds.join(','),
      result: 'error',
      detail: { providerId: provider.id, requestedAs: req.params.providerId, error: message },
    });
    console.error('[providers] activate failed:', message);
    res.status(502).json({ error: 'Provider activation failed' });
  }
});
