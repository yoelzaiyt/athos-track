// Camada REST genérica que imita o subconjunto do query-builder do
// supabase-js realmente usado pelo frontend (.from(table).select().order().
// eq().single()/.maybeSingle(), .insert(), .update(), .delete()). Existe pra
// que src/lib/supabaseClient.ts vire um cliente HTTP fino sem precisar
// reescrever AssetContext.tsx/AuthContext.tsx/mappers.ts inteiros.
//
// Autorização: até a correção descrita em SECURITY-GATE-REPORT.md
// (SEC-001/SEC-002/SEC-003/SEC-005), qualquer sessão válida acessava
// qualquer linha de qualquer tabela da lista, sem filtro de tenant nem de
// role. Esta versão impõe, no servidor:
//   1. tenant scoping obrigatório por client_id do JWT (ADMIN_ROLE escapa,
//      porque é o papel que administra múltiplas empresas por design);
//   2. escopo adicional por unit_id quando o usuário tem uma unidade
//      atribuída (perfis sem unit_id — ex.: CLIENT_ADMIN — continuam vendo
//      todas as unidades do próprio cliente);
//   3. bypass de colunas sensíveis (password_hash nunca sai por aqui —
//      autenticação já tem seu próprio caminho em routes-auth.ts);
//   4. bloqueio de colunas "admin-only" (role/client_id/unit_id/
//      password_hash em user_profiles) contra escrita por não-admin, pra
//      fechar a escalada de privilégio vertical (SEC-005).
//
// RBAC granular (rodada "RBAC + SECURITY HARDENING", ver
// RBAC-SECURITY-GATE.md): o gap acima ("VIEWER vs OPERATOR vs FLEET_MANAGER
// têm o mesmo acesso") está parcialmente fechado — VIEWER agora é
// bloqueado de qualquer escrita (assertNotViewer), OPERATOR não apaga
// registros (assertOperatorCannotDelete), e TENANT_ADMIN (CLIENT_ADMIN)
// ganhou permissão real de administrar usuários do próprio tenant
// (assertUserProfilesTenantAdminRules). O que continua uniforme por
// decisão explícita: MANAGER (FLEET/CART/ASSET_MANAGER) tem o mesmo nível
// de escrita que TENANT_ADMIN nas tabelas operacionais — diferenciar por
// módulo (frotas vs. carrinhos vs. ativos) exigiria filtrar por
// assets.category em cada tabela deste proxy, follow-up explícito (ver
// Pendências em RBAC-SECURITY-GATE.md).

import { Router } from 'express';
import type { Request } from 'express';
import { pool, withTenantContext } from './db';
import { requireAuth, type AuthTokenPayload } from './auth';
import { writeAuditLog } from './audit';

// Mesma lista de tabelas hoje consultadas via supabase-js em src/context/*.tsx.
const ALLOWED_TABLES = new Set([
  'assets', 'system_alerts', 'geofences', 'cargo_shipments', 'drivers', 'animals',
  'maintenance_records', 'trip_records', 'cart_recoveries', 'work_orders',
  'greylist_entries', 'asset_recovery_cases', 'route_templates', 'asset_pairings',
  'traffic_segments', 'points_of_interest', 'provider_devices', 'provider_health',
  'system_integrations', 'user_profiles', 'company_clients', 'company_units',
  'homologation_requests', 'homologation_devices', 'homologation_events', 'homologation_reports',
  'recovery_occurrences', 'recovery_timeline_events', 'asset_route_points',
  'audit_logs',
]);

const IDENTIFIER_RE = /^[a-z_][a-z0-9_]*$/;

function assertIdentifier(name: string, label: string) {
  if (!IDENTIFIER_RE.test(name)) {
    throw new Error(`Invalid ${label}: ${name}`);
  }
}

const ADMIN_ROLE = 'ATHOS_ADMIN';

// RBAC granular (rodada "RBAC + SECURITY HARDENING" — ver RBAC-SECURITY-GATE.md).
// Até aqui esta camada só distinguia ADMIN_ROLE vs. todo o resto — dentro do
// mesmo tenant, VIEWER/OPERATOR/FLEET_MANAGER/CART_MANAGER/ASSET_MANAGER
// tinham o mesmo nível de leitura/escrita entre si (residual documentado em
// SECURITY-GATE-REPORT.md, "AUTORIZAÇÃO"). Cinco papéis conceituais:
//   super_admin (ATHOS_ADMIN)   — tudo, todos os tenants (já existia).
//   tenant_admin (CLIENT_ADMIN) — tudo no próprio tenant, incluindo gerenciar
//     usuários do próprio tenant (novo nesta rodada — ver
//     assertUserProfilesTenantAdminRules).
//   manager (FLEET/CART/ASSET_MANAGER) — CRUD operacional completo no
//     próprio tenant. Tratados uniformemente entre os 3 aqui: a
//     diferenciação por módulo (frotas vs. carrinhos vs. ativos) já existe
//     no frontend (AuthContext.canAccessModule) — replicar isso 1:1 no
//     proxy exigiria filtrar por assets.category em cada tabela, fica como
//     follow-up explícito (ver Pendências em RBAC-SECURITY-GATE.md).
//   operator (OPERATOR) — pode criar/editar dado operacional, nunca apagar:
//     DELETE é a linha que traçamos como "administração estrutural".
//   viewer (VIEWER) — leitura, ponto. Bloqueado de POST/PATCH/DELETE em
//     QUALQUER tabela, inclusive as que já eram admin-only (não faz
//     diferença pra quem só pode ler mesmo).
const TENANT_ADMIN_ROLE = 'CLIENT_ADMIN';
const OPERATOR_ROLE = 'OPERATOR';
// FLEET_MANAGER/CART_MANAGER/ASSET_MANAGER não têm uma constante própria
// aqui — de propósito: nenhuma regra abaixo precisa distingui-los entre si
// nem do TENANT_ADMIN (ver comentário do "manager" acima), então não há
// nenhum `if (MANAGER_ROLES.has(auth.role))` pra escrever. Fica só
// documentado em prosa; declarar um Set sem nenhum uso real seria código
// morto (achado do FINAL-PRE-PRODUCTION-GATE.md, `tsc --noUnusedLocals`).
const VIEWER_ROLE = 'VIEWER';

// Tabelas com coluna própria de tenant.
const DIRECT_TENANT_COLUMN: Record<string, string> = {
  assets: 'client_id',
  geofences: 'client_id',
  drivers: 'client_id',
  animals: 'client_id',
  work_orders: 'client_id',
  greylist_entries: 'client_id',
  asset_recovery_cases: 'client_id',
  route_templates: 'client_id',
  asset_pairings: 'client_id',
  recovery_occurrences: 'client_id',
  company_units: 'client_id',
  user_profiles: 'client_id',
  company_clients: 'id', // o tenant É a própria linha
  // Migration 20260828000000: client_id/unit_id nullable (linhas antigas sem
  // dono conhecido ficam visíveis só pro ATHOS_ADMIN, nunca "públicas").
  cargo_shipments: 'client_id',
  // audit_logs: client_id nullable (ações de escopo ATHOS puro), mesmo
  // tratamento — só ATHOS_ADMIN vê linhas sem tenant. Escrita bloqueada por
  // inteiro logo abaixo (SYSTEM_APPEND_ONLY_TABLES): mesmo ATHOS_ADMIN não
  // grava/edita via este proxy — só server/api/audit.ts (código confiável),
  // pra ninguém conseguir forjar uma entrada de auditoria.
  audit_logs: 'client_id',
};

// Tabelas append-only por código de servidor — bloqueadas pra POST/PATCH/
// DELETE via este proxy pra QUALQUER role, inclusive ATHOS_ADMIN (ver nota
// acima). Diferente de ADMIN_ONLY_*, que ainda libera pro admin.
const SYSTEM_APPEND_ONLY_TABLES = new Set(['audit_logs']);

// Pra tabelas de DIRECT_TENANT_COLUMN que também têm unidade: qual coluna
// escopar quando o usuário tem unit_id atribuído. company_units não é FK
// (unit_id) — é a própria linha, por isso usa "id" ali.
const UNIT_COLUMN: Record<string, string> = {
  assets: 'unit_id',
  geofences: 'unit_id',
  drivers: 'unit_id',
  animals: 'unit_id',
  work_orders: 'unit_id',
  route_templates: 'unit_id',
  recovery_occurrences: 'unit_id',
  user_profiles: 'unit_id',
  company_units: 'id',
  cargo_shipments: 'unit_id',
};

// Tabelas sem client_id direto, mas ligadas a um asset — escopadas via subquery.
// (maintenance_records: confirmado direto no schema real — só tem vehicle_id,
// nunca teve client_id/unit_id, ao contrário do que a correção original de
// SEC-002 assumiu por engano lendo migrations. Corrigido junto com o RLS real.)
const ASSET_LINKED_COLUMN: Record<string, string> = {
  system_alerts: 'asset_id',
  cart_recoveries: 'asset_id',
  provider_devices: 'asset_id',
  asset_route_points: 'asset_id',
  trip_records: 'vehicle_id',
  maintenance_records: 'vehicle_id',
};

// Ligadas a recovery_occurrences (que por sua vez tem client_id/unit_id diretos).
const OCCURRENCE_LINKED_COLUMN: Record<string, string> = {
  recovery_timeline_events: 'occurrence_id',
};

// Tabelas de referência global/compartilhada — não são dado de nenhum tenant
// específico (trânsito e POIs valem pra qualquer cliente que passe por ali;
// provider_health é 1 linha por integração externa, não por empresa). Ficam
// legíveis por qualquer autenticado (sem risco de vazamento — não é dado de
// cliente), mas só ATHOS_ADMIN escreve — não é operação de tenant comum, e
// hoje nada no frontend escreve nelas mesmo (provider_health, por exemplo,
// só é atualizada pelo worker brgps-sync via DIRECT_URL, fora deste proxy).
const ADMIN_ONLY_WRITE_TABLES = new Set(['traffic_segments', 'points_of_interest', 'provider_health']);

// Tabelas do fluxo de homologação de fornecedor (pré-tenant: um fornecedor
// testando um dispositivo antes de qualquer vínculo com cliente). Não são
// dado de nenhum tenant nem dado compartilhado — são operação interna da
// ATHOS. Bloqueadas por inteiro (leitura e escrita) pra quem não é
// ATHOS_ADMIN. O portal público (/homologacao, sem login) grava nelas por um
// caminho separado, fora deste proxy autenticado — ver ATTACK-SURFACE.md
// sobre esse fluxo continuar quebrado/pendente de revisão à parte.
const ADMIN_ONLY_READ_TABLES = new Set([
  'homologation_requests', 'homologation_devices', 'homologation_events', 'homologation_reports',
  // system_integrations não tem client_id/unit_id no schema (confirmado ao
  // vivo) e guarda api_key de integrações (GT06/REST/MQTT/Webhooks/BLE) —
  // não pode ficar legível por qualquer autenticado.
  'system_integrations',
]);
const ADMIN_ONLY_ALL_TABLES = new Set([...ADMIN_ONLY_READ_TABLES]);

// Colunas que este proxy nunca devolve, mesmo pro dono da linha.
const STRIP_COLUMNS: Record<string, string[]> = {
  user_profiles: ['password_hash'],
};

// Colunas que só ADMIN_ROLE pode setar via insert/update, em qualquer
// tabela que não tenha uma regra mais específica abaixo.
const ADMIN_ONLY_WRITE_COLUMNS: Record<string, string[]> = {};

// user_profiles: client_id (moveria o usuário pra outro tenant),
// password_hash (troca de senha tem fluxo próprio —
// scripts/provision-user-password.ts) e session_version (revogação de
// sessão é o /auth/logout) continuam só ADMIN_ROLE, mesmo pro dono do
// tenant — não tem cenário de "tenant_admin legítimo" pra essas três.
const USER_PROFILES_ALWAYS_ADMIN_ONLY_COLUMNS = ['client_id', 'password_hash', 'session_version'];

// role/unit_id/is_active: TENANT_ADMIN agora pode setar em usuários do
// PRÓPRIO tenant (era 100% ADMIN_ROLE antes desta rodada — gap real contra
// o princípio "TENANT_ADMIN administra seu próprio tenant"). Validação de
// valor (nunca conceder ADMIN_ROLE; unit_id tem que ser do mesmo tenant) em
// assertUserProfilesTenantAdminRules, chamada nos handlers POST/PATCH.
const USER_PROFILES_TENANT_ADMIN_COLUMNS = ['role', 'unit_id', 'is_active'];

// Tabelas cujo insert/delete é sempre admin-only (criar/apagar uma empresa
// inteira, ou uma unidade, não é operação de tenant comum).
const ADMIN_ONLY_INSERT_TABLES = new Set(['company_clients', ...ADMIN_ONLY_WRITE_TABLES, ...ADMIN_ONLY_ALL_TABLES]);
const ADMIN_ONLY_DELETE_TABLES = new Set(['company_clients', 'user_profiles', ...ADMIN_ONLY_WRITE_TABLES, ...ADMIN_ONLY_ALL_TABLES]);
// company_clients: PATCH (nome, status ativo/inativo, módulos habilitados,
// provider padrão, identidade visual) é decisão de plataforma — Gerenciador
// de Tenants é ferramenta do ATHOS_ADMIN, não self-service do próprio
// tenant. Sem isso, um CLIENT_ADMIN podia (antes desta correção) editar a
// própria linha de company_clients — inclusive religar módulos que não
// contratou ou reverter uma desativação feita pelo ATHOS_ADMIN.
const ADMIN_ONLY_PATCH_TABLES = new Set(['company_clients', ...ADMIN_ONLY_WRITE_TABLES, ...ADMIN_ONLY_ALL_TABLES]);

// Tabelas cuja escrita bem-sucedida (POST/PATCH/DELETE) gera uma entrada em
// audit_logs automaticamente (seção 6 do brief do Gerenciador de Tenants:
// criação/edição/ativação-desativação/troca de provider/config são tudo
// PATCH nesta tabela — um hook só cobre todos os casos).
const AUDITED_TABLES = new Set(['company_clients']);

class ForbiddenError extends Error {}

function isAdmin(auth: AuthTokenPayload): boolean {
  return auth.role === ADMIN_ROLE;
}

function isTenantAdmin(auth: AuthTokenPayload): boolean {
  return auth.role === TENANT_ADMIN_ROLE;
}

function isViewer(auth: AuthTokenPayload): boolean {
  return auth.role === VIEWER_ROLE;
}

// VIEWER nunca escreve — chamado no topo de POST/PATCH/DELETE, antes de
// qualquer outra checagem (nem tabelas admin-only fariam diferença aqui).
function assertNotViewer(auth: AuthTokenPayload) {
  if (isViewer(auth)) {
    throw new ForbiddenError(`${VIEWER_ROLE} role is read-only`);
  }
}

// "Administração estrutural" (brief RBAC, papel OPERATOR: "pode executar
// operações permitidas sem administração estrutural") — traçamos essa linha
// em DELETE: OPERATOR cria/edita dado operacional, nunca apaga. MANAGER/
// TENANT_ADMIN/ADMIN podem.
function assertOperatorCannotDelete(auth: AuthTokenPayload) {
  if (auth.role === OPERATOR_ROLE) {
    throw new ForbiddenError(
      `${OPERATOR_ROLE} role cannot delete records — requires MANAGER, ${TENANT_ADMIN_ROLE} or ${ADMIN_ROLE}`
    );
  }
}

// Condição extra (AND) que todo GET/PATCH/DELETE de não-admin carrega,
// independente do que o cliente mandou nos filtros: client_id sempre, mais
// unit_id quando o usuário tem uma unidade atribuída. Retorna null se a
// tabela não tem vínculo de tenant conhecido (ver nota acima) — nesse caso o
// acesso segue sem escopo adicional, como já era.
function tenantScopeClause(
  table: string,
  auth: AuthTokenPayload,
  startParamIndex: number
): { sql: string; values: string[] } | null {
  if (isAdmin(auth)) return null;

  if (!auth.client_id) {
    // Não-admin sem client_id atribuído: fail-closed, não "vê tudo".
    throw new ForbiddenError('User has no client_id assigned');
  }

  const values: string[] = [];
  const addValue = (v: string) => {
    values.push(v);
    return startParamIndex + values.length - 1;
  };

  if (DIRECT_TENANT_COLUMN[table]) {
    const parts = [`${DIRECT_TENANT_COLUMN[table]} = $${addValue(auth.client_id)}`];
    const unitCol = UNIT_COLUMN[table];
    if (unitCol && auth.unit_id) {
      parts.push(`${unitCol} = $${addValue(auth.unit_id)}`);
    }
    return { sql: parts.join(' and '), values };
  }

  if (ASSET_LINKED_COLUMN[table]) {
    let sub = `select id from assets where client_id = $${addValue(auth.client_id)}`;
    if (auth.unit_id) sub += ` and unit_id = $${addValue(auth.unit_id)}`;
    return { sql: `${ASSET_LINKED_COLUMN[table]} in (${sub})`, values };
  }

  if (OCCURRENCE_LINKED_COLUMN[table]) {
    let sub = `select id from recovery_occurrences where client_id = $${addValue(auth.client_id)}`;
    if (auth.unit_id) sub += ` and unit_id = $${addValue(auth.unit_id)}`;
    return { sql: `${OCCURRENCE_LINKED_COLUMN[table]} in (${sub})`, values };
  }

  return null;
}

// node-postgres manda um array JS como ARRAY literal do Postgres ("{a,b}"),
// não como JSON — quebra qualquer coluna jsonb (ex.: company_clients.
// enabled_modules, assets.tire_positions) com "invalid input syntax for type
// json". Este proxy não sabe o tipo real da coluna, então serializa arrays e
// objetos planos como JSON antes de mandar pro driver; strings/números/bool/
// null passam direto, e Date vira ISO string (comportamento já esperado).
function serializeForColumn(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value) || (typeof value === 'object' && value.constructor === Object)) {
    return JSON.stringify(value);
  }
  return value;
}

function stripSensitiveColumns<T extends Record<string, unknown>>(table: string, rows: T[]): T[] {
  const cols = STRIP_COLUMNS[table];
  if (!cols || cols.length === 0) return rows;
  return rows.map((row) => {
    const clone = { ...row };
    for (const c of cols) delete clone[c];
    return clone;
  });
}

function assertNoAdminOnlyColumns(table: string, auth: AuthTokenPayload, columns: string[]) {
  if (isAdmin(auth)) return;

  if (table === 'user_profiles') {
    const hitAlways = columns.find((c) => USER_PROFILES_ALWAYS_ADMIN_ONLY_COLUMNS.includes(c));
    if (hitAlways) {
      throw new ForbiddenError(`Column "${hitAlways}" on "user_profiles" can only be set by ${ADMIN_ROLE}`);
    }
    const hitTenantAdmin = columns.find((c) => USER_PROFILES_TENANT_ADMIN_COLUMNS.includes(c));
    if (hitTenantAdmin && !isTenantAdmin(auth)) {
      throw new ForbiddenError(
        `Column "${hitTenantAdmin}" on "user_profiles" can only be set by ${ADMIN_ROLE} or ${TENANT_ADMIN_ROLE}`
      );
    }
    return;
  }

  const forbidden = ADMIN_ONLY_WRITE_COLUMNS[table];
  if (!forbidden) return;
  const hit = columns.find((c) => forbidden.includes(c));
  if (hit) {
    throw new ForbiddenError(`Column "${hit}" on "${table}" can only be set by ${ADMIN_ROLE}`);
  }
}

// Validação de VALOR (não só de coluna) pras 3 colunas que TENANT_ADMIN
// ganhou acesso acima — assertNoAdminOnlyColumns só garante que a coluna
// pode ser tocada; isto garante que o valor não é uma escalada disfarçada:
//   - role: nunca pode virar ADMIN_ROLE (conceder super-admin) via este proxy.
//   - unit_id: se setado, tem que ser uma unidade do MESMO tenant do ator —
//     sem isso um TENANT_ADMIN mal-intencionado podia "provar" que uma
//     unit_id de outro tenant existe testando o erro de FK, ou pior, se a
//     FK não pegasse, atribuir um usuário seu a uma unidade alheia.
// Não se aplica a ADMIN_ROLE (irrestrito) nem a quem não é TENANT_ADMIN
// (já barrado antes de chegar aqui por assertNoAdminOnlyColumns).
async function assertUserProfilesTenantAdminRules(auth: AuthTokenPayload, body: Record<string, unknown>) {
  if (isAdmin(auth) || !isTenantAdmin(auth)) return;

  if ('role' in body && body.role === ADMIN_ROLE) {
    throw new ForbiddenError(`${TENANT_ADMIN_ROLE} cannot grant ${ADMIN_ROLE}`);
  }

  if ('unit_id' in body && body.unit_id) {
    const check = await pool.query('select 1 from company_units where id = $1 and client_id = $2', [
      body.unit_id,
      auth.client_id,
    ]);
    if (check.rowCount === 0) {
      throw new ForbiddenError('unit_id must belong to your own tenant');
    }
  }
}

// Pra tabelas com client_id/unit_id diretos (exceto company_clients e
// company_units, cujo "tenant" é a própria linha), garante que um insert de
// não-admin não crie uma linha em outro tenant/unidade: se o body não mandar
// a coluna, injeta o valor do token; se mandar, tem que bater.
function enforceTenantOnInsertRow(table: string, auth: AuthTokenPayload, row: Record<string, unknown>) {
  if (isAdmin(auth)) return row;

  let next = row;
  const clientCol = DIRECT_TENANT_COLUMN[table];
  if (clientCol && table !== 'company_clients' && table !== 'company_units') {
    if (next[clientCol] !== undefined && next[clientCol] !== auth.client_id) {
      throw new ForbiddenError(`Cannot set ${clientCol} to a different tenant`);
    }
    next = { ...next, [clientCol]: auth.client_id };
  }

  const unitCol = UNIT_COLUMN[table];
  if (unitCol === 'unit_id' && auth.unit_id) {
    if (next[unitCol] !== undefined && next[unitCol] !== auth.unit_id) {
      throw new ForbiddenError(`Cannot set ${unitCol} to a different unit`);
    }
    next = { ...next, [unitCol]: auth.unit_id };
  }

  return next;
}

// Achado nesta rodada (RBAC-SECURITY-GATE.md — testes ofensivos #2/#3
// "alterar tenant_id em requests"): as validações acima só rodavam no
// POST. Um PATCH em qualquer tabela tenant-scoped (ex.: assets) podia
// mandar {client_id: '<outro tenant>'} no corpo, sem NENHUMA trava — o
// tenantScopeClause só restringe QUAIS linhas o WHERE alcança (a linha
// tinha que já ser do próprio tenant pra ser encontrada), não O QUE o SET
// grava nela. Um TENANT_ADMIN/MANAGER/OPERATOR conseguia então "doar"/mover
// um ativo (ou qualquer registro tenant-scoped) pra dentro de outro tenant
// só adivinhando/conhecendo o client_id alheio — e o mesmo valia pra
// asset_id/vehicle_id/occurrence_id em tabelas ligadas por referência
// (system_alerts, cart_recoveries, recovery_timeline_events etc.):
// repontar o vínculo pra um recurso de outro tenant fazia a linha "aparecer"
// pro tenant dono desse recurso (o subquery de tenantScopeClause passa a
// bater). Fecha isso por completo:
//   - client_id: nunca pode ser tocado via PATCH por não-admin (não existe
//     cenário legítimo de "mover meu próprio dado pra outro tenant").
//   - unit_id / asset_id / vehicle_id / occurrence_id: reatribuir DENTRO do
//     mesmo tenant é operação normal (ex.: mover um carrinho de filial,
//     religar um alerta a outro veículo do mesmo cliente) — só valida que o
//     novo valor referencia algo do MESMO tenant do ator, não bloqueia.
// Não se aplica a user_profiles (regra própria e mais granular, ver
// assertUserProfilesTenantAdminRules) nem a company_clients/company_units
// (tenant é a própria linha ali, já coberto por ADMIN_ONLY_PATCH_TABLES/
// tenantScopeClause).
async function assertNoTenantLinkTamperOnPatch(table: string, auth: AuthTokenPayload, body: Record<string, unknown>) {
  if (isAdmin(auth)) return;

  if (table !== 'company_clients' && table !== 'company_units') {
    const clientCol = DIRECT_TENANT_COLUMN[table];
    if (clientCol && clientCol in body) {
      throw new ForbiddenError(`Column "${clientCol}" on "${table}" cannot be changed — it defines tenant ownership`);
    }
    const unitCol = UNIT_COLUMN[table];
    if (unitCol && unitCol !== 'id' && unitCol in body && body[unitCol]) {
      const check = await pool.query('select 1 from company_units where id = $1 and client_id = $2', [
        body[unitCol],
        auth.client_id,
      ]);
      if (check.rowCount === 0) throw new ForbiddenError(`${unitCol} must belong to your own tenant`);
    }
  }

  const assetCol = ASSET_LINKED_COLUMN[table];
  if (assetCol && assetCol in body && body[assetCol]) {
    const conditions = ['id = $1', 'client_id = $2'];
    const values: unknown[] = [body[assetCol], auth.client_id];
    if (auth.unit_id) {
      conditions.push('unit_id = $3');
      values.push(auth.unit_id);
    }
    const check = await pool.query(`select 1 from assets where ${conditions.join(' and ')}`, values);
    if (check.rowCount === 0) throw new ForbiddenError(`${assetCol} does not belong to your organization`);
  }

  const occCol = OCCURRENCE_LINKED_COLUMN[table];
  if (occCol && occCol in body && body[occCol]) {
    const check = await pool.query('select 1 from recovery_occurrences where id = $1 and client_id = $2', [
      body[occCol],
      auth.client_id,
    ]);
    if (check.rowCount === 0) throw new ForbiddenError(`${occCol} does not belong to your organization`);
  }
}

// Mesmo achado do comentário acima, mas no INSERT: enforceTenantOnInsertRow
// só valida unit_id quando o próprio ATOR tem um unit_id (pra forçar). Um
// CLIENT_ADMIN/MANAGER sem unit_id (comum — administram todas as unidades
// do tenant) podia inserir um registro com unit_id de OUTRO tenant sem
// nenhuma validação. client_id continuava correto (não vazava a linha pra
// outro tenant em leitura — tenantScopeClause sempre filtra por client_id
// primeiro), mas era referência órfã/inconsistente sem necessidade nenhuma
// de existir. Fecha quando o body manda unit_id explícito e o ator não tem
// um pra forçar (esse caso já é coberto por enforceTenantOnInsertRow).
async function assertInsertUnitBelongsToTenant(table: string, auth: AuthTokenPayload, row: Record<string, unknown>) {
  if (isAdmin(auth) || auth.unit_id) return;
  const unitCol = UNIT_COLUMN[table];
  if (!unitCol || unitCol === 'id' || row[unitCol] === undefined || row[unitCol] === null) return;
  const check = await pool.query('select 1 from company_units where id = $1 and client_id = $2', [
    row[unitCol],
    auth.client_id,
  ]);
  if (check.rowCount === 0) throw new ForbiddenError(`${unitCol} must belong to your own tenant`);
}

// Pra tabelas ligadas por asset_id/vehicle_id, confirma que o asset
// referenciado pertence ao tenant (e, se aplicável, à unidade) de quem está
// inserindo.
async function assertAssetBelongsToTenant(table: string, auth: AuthTokenPayload, row: Record<string, unknown>) {
  if (isAdmin(auth)) return;
  const col = ASSET_LINKED_COLUMN[table];
  if (!col) return;
  const assetId = row[col];
  if (!assetId) throw new ForbiddenError(`Missing ${col}`);

  const conditions = ['id = $1', 'client_id = $2'];
  const values: unknown[] = [assetId, auth.client_id];
  if (auth.unit_id) {
    conditions.push(`unit_id = $3`);
    values.push(auth.unit_id);
  }
  const check = await pool.query(`select 1 from assets where ${conditions.join(' and ')}`, values);
  if (check.rowCount === 0) {
    throw new ForbiddenError(`Asset does not belong to your organization`);
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

function handleError(res: import('express').Response, err: unknown) {
  if (err instanceof ForbiddenError) {
    res.status(403).json({ error: err.message });
    return;
  }
  // Nunca devolve a mensagem crua do driver pg pro cliente (vaza nome de
  // coluna/tabela — SEC-004). Detalhe completo só no log do servidor.
  console.error('[rest]', (err as Error).message);
  res.status(500).json({ error: 'Internal error' });
}

// GET /rest/:table?order=col&ascending=false&eq_col=value&gte_col=value&single=true
restRouter.get('/:table', async (req: Request, res) => {
  const { table } = req.params;
  try {
    const auth = req.auth!;
    if (ADMIN_ONLY_READ_TABLES.has(table) && !isAdmin(auth)) {
      throw new ForbiddenError(`Only ${ADMIN_ROLE} can read "${table}"`);
    }
    const filters = parseFilters(req.query as Record<string, unknown>);
    const values: unknown[] = [];
    const whereParts: string[] = [];

    for (const [op, col, val] of filters) {
      values.push(val);
      whereParts.push(`${col} ${FILTER_OPS[op]} $${values.length}`);
    }

    const scope = tenantScopeClause(table, auth, values.length + 1);
    if (scope) {
      values.push(...scope.values);
      whereParts.push(scope.sql);
    }

    let sql = `select * from ${table}`;
    if (whereParts.length > 0) sql += ' where ' + whereParts.join(' and ');
    if (typeof req.query.order === 'string') {
      assertIdentifier(req.query.order, 'order column');
      const ascending = req.query.ascending !== 'false';
      sql += ` order by ${req.query.order} ${ascending ? 'asc' : 'desc'}`;
    }

    const result = await withTenantContext(auth, (client) => client.query(sql, values));
    const rows = stripSensitiveColumns(table, result.rows);
    if (req.query.single === 'true') {
      res.json(rows[0] ?? null);
      return;
    }
    res.json(rows);
  } catch (err) {
    handleError(res, err);
  }
});

// POST /rest/:table  body: object | object[]
restRouter.post('/:table', async (req: Request, res) => {
  const { table } = req.params;
  try {
    const auth = req.auth!;
    assertNotViewer(auth);
    if (SYSTEM_APPEND_ONLY_TABLES.has(table)) {
      throw new ForbiddenError(`"${table}" is written by trusted server code only`);
    }
    if (ADMIN_ONLY_INSERT_TABLES.has(table) && !isAdmin(auth)) {
      throw new ForbiddenError(`Only ${ADMIN_ROLE} can create rows in "${table}"`);
    }
    // Criar um user_profiles é "administração estrutural" do tenant — abrir
    // pra qualquer role autenticada (o que valia antes desta rodada) deixava
    // até um OPERATOR/VIEWER criar linhas de usuário no próprio tenant.
    if (table === 'user_profiles' && !isAdmin(auth) && !isTenantAdmin(auth)) {
      throw new ForbiddenError(`Only ${ADMIN_ROLE} or ${TENANT_ADMIN_ROLE} can create rows in "user_profiles"`);
    }

    const rawRows = (Array.isArray(req.body) ? req.body : [req.body]) as Record<string, unknown>[];
    if (rawRows.length === 0) {
      res.status(400).json({ error: 'Empty insert payload' });
      return;
    }

    const preparedRows: Record<string, unknown>[] = [];
    for (const row of rawRows) {
      const columns = Object.keys(row);
      columns.forEach((c) => assertIdentifier(c, 'column'));
      assertNoAdminOnlyColumns(table, auth, columns);
      if (table === 'user_profiles') await assertUserProfilesTenantAdminRules(auth, row);
      await assertAssetBelongsToTenant(table, auth, row);
      await assertInsertUnitBelongsToTenant(table, auth, row);
      preparedRows.push(enforceTenantOnInsertRow(table, auth, row));
    }

    const insertedRows: unknown[] = await withTenantContext(auth, async (client) => {
      const out: unknown[] = [];
      for (const row of preparedRows) {
        const columns = Object.keys(row);
        const values = columns.map((c) => serializeForColumn(row[c]));
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const sql = `insert into ${table} (${columns.join(', ')}) values (${placeholders}) returning *`;
        const result = await client.query(sql, values);
        out.push(result.rows[0]);
      }
      return out;
    });

    const out = stripSensitiveColumns(table, insertedRows as Record<string, unknown>[]);
    if (AUDITED_TABLES.has(table)) {
      for (const row of out as Record<string, unknown>[]) {
        await writeAuditLog({
          actor: auth,
          action: `${table}.create`,
          entityType: table,
          entityId: String(row.id ?? ''),
          result: 'success',
          detail: { name: row.name },
        });
      }
    }
    res.status(201).json(Array.isArray(req.body) ? out : out[0]);
  } catch (err) {
    handleError(res, err);
  }
});

// PATCH /rest/:table?eq_col=value  body: partial fields
restRouter.patch('/:table', async (req: Request, res) => {
  const { table } = req.params;
  try {
    const auth = req.auth!;
    assertNotViewer(auth);
    if (SYSTEM_APPEND_ONLY_TABLES.has(table)) {
      throw new ForbiddenError(`"${table}" is written by trusted server code only`);
    }
    if (ADMIN_ONLY_PATCH_TABLES.has(table) && !isAdmin(auth)) {
      throw new ForbiddenError(`Only ${ADMIN_ROLE} can update "${table}"`);
    }
    const filters = parseEqFilters(req.query as Record<string, unknown>);
    if (filters.length === 0) {
      res.status(400).json({ error: 'PATCH requires at least one eq_ filter' });
      return;
    }
    const columns = Object.keys(req.body ?? {});
    columns.forEach((c) => assertIdentifier(c, 'column'));
    if (columns.length === 0) {
      res.status(400).json({ error: 'Empty update payload' });
      return;
    }
    assertNoAdminOnlyColumns(table, auth, columns);
    if (table === 'user_profiles') {
      await assertUserProfilesTenantAdminRules(auth, req.body ?? {});
    } else {
      await assertNoTenantLinkTamperOnPatch(table, auth, req.body ?? {});
    }

    const values = columns.map((c) => serializeForColumn(req.body[c]));
    const setClause = columns.map((c, i) => `${c} = $${i + 1}`).join(', ');

    const whereParts = filters.map(([col], i) => `${col} = $${columns.length + i + 1}`);
    values.push(...filters.map(([, v]) => v));

    const scope = tenantScopeClause(table, auth, values.length + 1);
    if (scope) {
      values.push(...scope.values);
      whereParts.push(scope.sql);
    }

    const sql = `update ${table} set ${setClause} where ${whereParts.join(' and ')} returning *`;
    const result = await withTenantContext(auth, (client) => client.query(sql, values));
    if (AUDITED_TABLES.has(table)) {
      for (const row of result.rows as Record<string, unknown>[]) {
        await writeAuditLog({
          actor: auth,
          action: `${table}.update`,
          entityType: table,
          entityId: String(row.id ?? ''),
          result: 'success',
          detail: { changedColumns: columns, name: row.name },
        });
      }
    }
    res.json(stripSensitiveColumns(table, result.rows));
  } catch (err) {
    handleError(res, err);
  }
});

// DELETE /rest/:table?eq_col=value
restRouter.delete('/:table', async (req: Request, res) => {
  const { table } = req.params;
  try {
    const auth = req.auth!;
    assertNotViewer(auth);
    if (SYSTEM_APPEND_ONLY_TABLES.has(table)) {
      throw new ForbiddenError(`"${table}" is written by trusted server code only`);
    }
    if (ADMIN_ONLY_DELETE_TABLES.has(table) && !isAdmin(auth)) {
      throw new ForbiddenError(`Only ${ADMIN_ROLE} can delete rows in "${table}"`);
    }
    assertOperatorCannotDelete(auth);

    const filters = parseEqFilters(req.query as Record<string, unknown>);
    if (filters.length === 0) {
      res.status(400).json({ error: 'DELETE requires at least one eq_ filter' });
      return;
    }
    const values: unknown[] = filters.map(([, v]) => v);
    const whereParts = filters.map(([col], i) => `${col} = $${i + 1}`);

    const scope = tenantScopeClause(table, auth, values.length + 1);
    if (scope) {
      values.push(...scope.values);
      whereParts.push(scope.sql);
    }

    const sql = `delete from ${table} where ${whereParts.join(' and ')}${AUDITED_TABLES.has(table) ? ' returning id, name' : ''}`;
    const result = await withTenantContext(auth, (client) => client.query(sql, values));
    if (AUDITED_TABLES.has(table)) {
      for (const row of result.rows as Record<string, unknown>[]) {
        await writeAuditLog({
          actor: auth,
          action: `${table}.delete`,
          entityType: table,
          entityId: String(row.id ?? ''),
          result: 'success',
          detail: { name: row.name },
        });
      }
    }
    res.status(204).end();
  } catch (err) {
    handleError(res, err);
  }
});
