# ATHOS TRACK — RBAC + Security Hardening Gate Report

> Não commitado, não enviado (push), não deployado — conforme pedido.
> Gerado em: 2026-08-28. Continuação de `SECURITY-GATE-REPORT.md` (rodada
> anterior) e `TENANT-MANAGER-REPORT.md` (rodada imediatamente anterior a
> esta, mesma sessão).

---

## 1. Escopo desta rodada

1. Fechar o residual explícito da rodada anterior: *"dentro do mesmo
   tenant/unidade, VIEWER/OPERATOR/FLEET_MANAGER/CART_MANAGER/ASSET_MANAGER
   continuam com o mesmo nível de leitura/escrita entre si"* (ver
   `SECURITY-GATE-REPORT.md`, seção AUTORIZAÇÃO).
2. Auditoria ofensiva ao vivo (não só leitura de código) com os 12 vetores
   de ataque listados no prompt, contra a API local (`localhost:4000`)
   apontando pro mesmo Postgres de dev que a aplicação usa.
3. Auditoria geral: RLS, functions, APIs, middleware, autenticação,
   autorização, secrets, env vars, logs, CORS, XSS, CSRF, SQL injection,
   IDOR, mass assignment, exposição de stack trace, exposição de
   service_role, exposição de tokens/secrets de provider.

Metodologia igual à das rodadas anteriores: tudo que está classificado
abaixo com **CONFIRMADO** foi testado ao vivo (script de ataque descartável
+ um novo arquivo de teste automatizado permanente,
`server/api/rbac.test.ts`, 22 testes, todos passando). Onde não há teste ao
vivo possível a partir deste ambiente (produção Railway/Vercel), está
marcado como tal — não inventei cobertura que não existe.

---

## 2. Papéis (RBAC)

Não criei papéis novos no banco/schema — os 7 papéis já existentes em
`UserRole` (`src/types/index.ts`) já mapeiam 1:1 pros 5 papéis conceituais
do prompt:

| Papel do prompt | Papel real no código | Observação |
|---|---|---|
| `super_admin` (ATHOS) | `ATHOS_ADMIN` | já existia, sem mudança de escopo |
| `tenant_admin` | `CLIENT_ADMIN` | **ganhou capacidade nova** nesta rodada (ver §4) |
| `manager` | `FLEET_MANAGER` \| `CART_MANAGER` \| `ASSET_MANAGER` | tratados uniformemente no proxy (ver Pendências) |
| `operator` | `OPERATOR` | **ganhou restrição nova** nesta rodada (sem DELETE) |
| `viewer` | `VIEWER` | **ganhou restrição nova** nesta rodada (read-only total) |

Reaproveitar os papéis existentes evita o mesmo erro que o Gerenciador de
Tenants corrigiu antes (duplicar/misturar dado) — aqui seria duplicar/
misturar *papel*, forçando toda a base de usuários a migrar de role.

---

## 3. Achados — P0 (críticos, fechados nesta rodada)

### P0-1 — Bypass total de toda a API via PostgREST nativo do Supabase

**Confirmado ao vivo.** O projeto Supabase por trás de `DATABASE_URL` ainda
tem seu próprio PostgREST/GoTrue expostos publicamente em
`https://<projeto>.supabase.co`. Os papéis `anon`/`authenticated` (usados
por esse PostgREST — não pela nossa API, que fala Postgres direto via
`pg`) tinham `GRANT` de `SELECT/INSERT/UPDATE/DELETE/TRUNCATE` em **todas**
as tabelas, herdado de antes da migração pra API própria (commit
`a58fb36` → `c981b79`) e nunca revogado.

Teste ao vivo com a anon key pública (`VITE_SUPABASE_ANON_KEY`, hoje dead
code — não é mais referenciada em `src/`, e por isso **não** aparece no
bundle de produção gerado nesta rodada; mas é uma anon key pública *por
design* do modelo Supabase, descobrível por quem tiver acesso ao painel do
projeto, sem login nenhum na nossa aplicação):

```
GET https://<projeto>.supabase.co/rest/v1/provider_health   → 200, dados reais
GET https://<projeto>.supabase.co/rest/v1/system_integrations → 200, [] (vazio hoje, mas guarda api_key de providers — ver rest.ts)
GET https://<projeto>.supabase.co/rest/v1/company_clients   → 200, [] (RLS bloqueou por acidente feliz — ver abaixo)
```

Causa raiz dupla:
1. As tabelas "de referência sem tenant" (`traffic_segments`,
   `points_of_interest`, `provider_health`, `homologation_*`,
   `system_integrations`) tinham policy de RLS `using (true) with check
   (true)` **sem `TO <role>`** — o comentário da migration original dizia
   "só a role da API", mas a policy não impunha isso; qualquer role sem
   `BYPASSRLS` passava.
2. `anon`/`authenticated` tinham `GRANT` direto nessas (e em todas as
   outras) tabelas — sem o grant, nem chegaria a avaliar a policy.

As tabelas "tenant-scoped" (`company_clients`, `user_profiles`, `assets`
etc.) **não vazaram** — a policy delas (`app.is_admin`/`app.client_id` via
`current_setting`) nega tudo quando essas GUCs não estão setadas, o que é
sempre o caso numa sessão do PostgREST nativo. Isso não foi desenhado de
propósito pensando nesse cenário, mas funcionou como segunda camada real.

**Fix**: `supabase/migrations/20260828060000_rbac_security_hardening.sql`
— `REVOKE ALL ... FROM anon, authenticated` em tabelas/sequences/functions/
schema. Nada na aplicação usa esses papéis (confirmado: sem
`@supabase/supabase-js` no `package.json`; `src/lib/supabaseClient.ts` é um
shim que só fala com a API própria). **Aplicado no banco de dev com
confirmação explícita do usuário**, e reverificado ao vivo depois: as
mesmas chamadas acima agora devolvem `401 permission denied for table ...`.

### P0-2 — `PATCH` sem proteção de coluna de tenant (tamper de `client_id`/`unit_id`/vínculos)

**Confirmado por teste automatizado** (`server/api/rbac.test.ts` —
"TENANT_ADMIN (A) não consegue PATCH client_id do próprio asset pra outro
tenant"). `enforceTenantOnInsertRow` (INSERT) sempre validou/forçou
`client_id`, mas essa validação **nunca rodava no PATCH** — só a
`tenantScopeClause` no `WHERE` (que restringe *quais linhas* o PATCH
alcança, não *o que* o `SET` grava). Um `TENANT_ADMIN`/`MANAGER`/`OPERATOR`
conseguia:

```
PATCH /rest/assets?eq_id=<próprio ativo>
body: { client_id: '<id de outro tenant>' }
```

e mover a própria linha pra dentro de outro tenant — ou pior, com
`asset_id`/`vehicle_id`/`occurrence_id` em tabelas ligadas por referência
(`system_alerts`, `cart_recoveries`, `recovery_timeline_events` etc.),
repontar o vínculo pra um recurso de OUTRO tenant fazia a linha "aparecer"
pro tenant dono desse recurso (o subquery de `tenantScopeClause` passa a
bater) — uma forma de **injetar dado forjado na visão de outro tenant**.

Equivale diretamente aos testes ofensivos #2/#3 do prompt ("alterar
tenant_id em requests").

**Fix**: nova função `assertNoTenantLinkTamperOnPatch` em `server/api/
rest.ts`, chamada em todo PATCH (exceto `user_profiles`, que tem regra
própria — ver P1-3). `client_id`: nunca pode ser tocado por não-admin, sem
exceção. `unit_id`/`asset_id`/`vehicle_id`/`occurrence_id`: reatribuir
DENTRO do mesmo tenant continua permitido (é operação normal — mover um
carrinho de filial, religar um alerta a outro veículo do mesmo cliente),
só valida que o novo valor pertence ao MESMO tenant do ator.

---

## 4. Achados — P1 (corrigidos nesta rodada)

### P1-1 — RBAC uniforme dentro do tenant (o pedido central desta rodada)

`VIEWER` conseguia `POST`/`PATCH`/`DELETE` em qualquer tabela não
admin-only do próprio tenant — incluindo apagar ativos, geofences, etc.
`OPERATOR` também apagava registros livremente. **Confirmado e corrigido**:
`assertNotViewer` (bloqueia toda escrita de `VIEWER`, sem exceção — nem nas
tabelas que já eram admin-only, testado em `RBAC-02`) e
`assertOperatorCannotDelete` (`OPERATOR` nunca `DELETE`, testado em
`RBAC-03`; `MANAGER` continua podendo, testado em `RBAC-04`).

### P1-2 — Qualquer role podia criar usuários (`user_profiles`)

`POST /rest/user_profiles` não tinha nenhuma restrição de role além das
colunas sensíveis — um `VIEWER` conseguia criar uma linha de usuário no
próprio tenant (sem conseguir setar `role`/senha, mas ainda assim uma
operação estrutural que não devia estar aberta a qualquer autenticado).
**Fix**: restrito a `ATHOS_ADMIN`/`CLIENT_ADMIN`.

### P1-3 — `TENANT_ADMIN` não conseguia administrar usuários do próprio tenant

Gap direto contra o princípio do prompt ("TENANT_ADMIN pode administrar
somente seu próprio tenant"): antes desta rodada, **só `ATHOS_ADMIN`**
conseguia tocar `role`/`unit_id`/`is_active` em `user_profiles`, mesmo pro
próprio `CLIENT_ADMIN` do tenant. **Fix**: `CLIENT_ADMIN` agora pode setar
essas 3 colunas em usuários do PRÓPRIO tenant (testado em `RBAC-05`), com
validação de valor (`assertUserProfilesTenantAdminRules`):
`client_id`/`password_hash`/`session_version` continuam **sempre**
`ATHOS_ADMIN`-only (não existe cenário legítimo de tenant_admin trocar
esses); `role` nunca pode virar `ATHOS_ADMIN` via este caminho (testado em
`ATK-12a`); `unit_id`, se setado, tem que pertencer ao mesmo tenant.
Confirmado que o escopo continua batendo a fronteira do tenant
(`RBAC-06`): `TENANT_ADMIN` de A não alcança usuário de B (0 linhas
afetadas, não erro — mesmo padrão BOLA-safe do resto da API).

### P1-4 — `audit_logs` sem RLS

A migration de RLS real (`20260828030000`) rodou antes de `audit_logs`
existir (`20260828040000`) — nunca ganhou a segunda camada de defesa,
dependia 100% do filtro em `rest.ts`. **Fix**: RLS habilitado + policy
`audit_logs_tenant_scoped` (mesmo padrão das demais tabelas), na mesma
migration `20260828060000`.

---

## 5. Achados — P2 (corrigido parcial / documentado, não bloqueia o gate)

- **P2-1 (corrigido)**: `enforceTenantOnInsertRow` só validava `unit_id`
  quando o próprio ATOR tinha um `unit_id` atribuído — um
  `CLIENT_ADMIN`/`MANAGER` sem `unit_id` (comum) podia inserir um registro
  com `unit_id` de OUTRO tenant sem validação nenhuma (não vazava dado —
  `client_id` sempre corrigia certo — mas era referência órfã). Fechado
  com `assertInsertUnitBelongsToTenant`.
- **P2-2 (documentado, não corrigido)**: `MANAGER` (`FLEET_MANAGER`/
  `CART_MANAGER`/`ASSET_MANAGER`) continua tratado uniformemente no proxy —
  os 3 têm o mesmo nível de escrita nas tabelas operacionais. A
  diferenciação por módulo (frotas vs. carrinhos vs. ativos) já existe no
  **frontend** (`AuthContext.canAccessModule`), mas replicar isso no proxy
  exigiria filtrar por `assets.category` em cada tabela — decisão
  consciente de não fazer agora pra não arriscar quebrar um manager
  operando um módulo que hoje funciona, sem confirmação de qual tabela
  pertence a qual módulo em cada caso. Follow-up explícito.
- **P2-3 (residual conhecido, não corrigido)**: `/rest/*` continua sem rate
  limiting (só `/auth/login` tem, desde SEC-007). Um `GET /rest/assets`
  sem paginação ainda devolve a tabela inteira do tenant de uma vez. Mesmo
  residual do relatório anterior — fora do escopo desta rodada (RBAC), não
  atacado aqui.
- **P2-4 (mitigação parcial)**: o `REVOKE` do P0-1 fecha o estado ATUAL.
  Uma tabela nova criada depois desta migration, se ganhar grant de
  `anon`/`authenticated` de novo por uma ação fora deste repositório (ex.:
  dashboard do Supabase), reabriria o mesmo problema — não há
  `alter default privileges` que garanta isso contra ações externas às
  migrations.

## 6. Achados — P3 (cosméticos / informativos)

- `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` continuam no `.env` como
  dead config (não referenciadas em `src/`, confirmado não aparecerem no
  bundle). Não é vulnerabilidade (ver P0-1 — a superfície real já foi
  fechada no banco), mas vale limpar do `.env`/`.env.example` numa rodada
  de housekeeping.
- `CORS_ORIGIN` em produção (Railway) não é verificável a partir deste
  ambiente — mesma limitação já registrada em `SECURITY-GATE-REPORT.md`.
  Local (`.env` de dev) está corretamente restrito a `http://localhost:3000`
  (não `*`).

---

## 7. Matriz dos 12 testes ofensivos pedidos

Todos executados ao vivo contra a API real (script descartável primeiro,
depois portado pra `server/api/rbac.test.ts` como regressão permanente —
22/22 passando).

| # | Ataque | Resultado |
|---|---|---|
| 1 | Acessar `tenant_id` de outro cliente | **BLOQUEADO** — `GET` com `eq_id` de recurso de outro tenant devolve `[]` |
| 2 | Alterar `tenant_id` no navegador (client-side) | N/A direto — reforçado pelo #3 (servidor nunca confia no client_id do body) |
| 3 | Alterar `tenant_id` em requests | **Achado P0-2, corrigido** — `PATCH`/`POST` com `client_id` de outro tenant → 403 |
| 4 | Trocar IDs pela URL | **BLOQUEADO** — `eq_id` de recurso alheio no PATCH afeta 0 linhas |
| 5 | Consultar API diretamente | **BLOQUEADO** — sem token → 401; ver também P0-1 (API *paralela* do Supabase, agora fechada) |
| 6 | Alterar body/query params | **BLOQUEADO** — `DELETE`/`PATCH` com filtro apontando pra outro tenant não afeta nada |
| 7 | Acessar endpoints administrativos | **BLOQUEADO** — `system_integrations`, criar/editar `company_clients`, ativar provider — todos 403 pra não-admin |
| 8 | Manipular `provider_id` | **BLOQUEADO** — `defaultProviderId` só `ATHOS_ADMIN`; `/providers/:id/activate` só `ATHOS_ADMIN` |
| 9 | Consultar tags de outro tenant | **BLOQUEADO** — `provider_devices` filtrado por `asset_id` de outro tenant devolve `[]` |
| 10 | Consultar histórico de outro tenant | **BLOQUEADO** — `asset_route_points` idem |
| 11 | Acessar exportações de outro tenant | **N/A / seguro por construção** — export é 100% client-side sobre dado já escopado pelo `GET /rest` (`DataTable.tsx`), sem endpoint de export server-side separado |
| 12 | Privilege escalation | **BLOQUEADO** — auto-promoção, promoção de terceiro a `ATHOS_ADMIN`, e mover usuário de tenant — todos 403 |

---

## 8. Auditoria geral (checklist do prompt)

| Área | Resultado | Base |
|---|---|---|
| Supabase RLS | **PASS** | Todas as tabelas tenant-scoped com policy real (desde SEC-012); `audit_logs` fechado nesta rodada (P1-4); tabelas de referência agora restritas por GRANT, não só por policy (P0-1) |
| Functions | **PASS (não se aplica muito)** | Sem `SECURITY DEFINER` custom nem RPC exposta — só tabelas via proxy |
| APIs (`/rest`, `/auth`, `/providers`) | **PASS** | RBAC granular fechado nesta rodada; ver §3-5 |
| Server actions / middleware | **PASS** | `requireAuth` (JWT + revogação de sessão + conta ativa) roda antes de tudo em `/rest` e `/providers` |
| Autenticação | **PASS** | Sem mudança nesta rodada — já era PASS desde `SECURITY-GATE-REPORT.md` (bcrypt, rate limit, revogação de sessão) |
| Autorização | **PASS** | Era o bloqueador central do relatório anterior — fechado nesta rodada (§3-5) |
| Secrets | **PASS** | `.env` fora do Git; sem secret hardcoded; bundle de produção inspecionado nesta rodada (sem source map, sem string de secret) — item que ficava "NÃO TESTADO" no relatório anterior |
| Variáveis de ambiente | **PASS** | Nenhum secret com prefixo `VITE_`; `BRGPS_API_TOKEN`/`JWT_SECRET`/`DATABASE_URL` só no backend |
| Logs | **PASS (mesmo residual)** | `audit_logs` persistido desde a rodada do Gerenciador de Tenants, agora com RLS também (P1-4). `console.error`/`console.warn` continuam sem redação automática — checado manualmente que nenhum dos pontos tocados nesta rodada loga senha/token |
| CORS | **PASS (local) / NÃO VERIFICÁVEL (produção)** | `.env` local restrito a `localhost:3000`; Railway não verificável deste ambiente (mesma limitação anterior) |
| XSS | **PASS** | Nenhum uso de `dangerouslySetInnerHTML`/`innerHTML=`/`eval` em `src/` (grep confirmado) — React escapa por padrão |
| CSRF | **N/A por design** | Autenticação via `Authorization: Bearer`, nunca cookie — não há credencial ambiente pro navegador anexar automaticamente num request cross-site |
| SQL injection | **PASS** | `IDENTIFIER_RE` valida nome de tabela/coluna antes de interpolar em SQL; todo valor vai parametrizado (`$1`, `$2`...); testado ao vivo (`ERR-02`) |
| IDOR | **PASS** | Era o cerne do P0-2 — corrigido; BOLA nos `GET`/`PATCH`/`DELETE` já valida desde SEC-002/006 |
| Mass assignment | **PASS** | `assertNoAdminOnlyColumns` + `assertNoTenantLinkTamperOnPatch` (novo) cobrem as colunas sensíveis; colunas desconhecidas do schema real são rejeitadas pelo próprio Postgres |
| Exposição de stack trace | **PASS** | `handleError` nunca devolve mensagem crua do driver `pg` — testado ao vivo (`ERR-01`) |
| Exposição de `service_role` | **PASS** | Nunca usado pela aplicação (`postgres.<ref>` via `DATABASE_URL`/`athos_app_rw` via `APP_DATABASE_URL` — nenhum dos dois é a chave `service_role`); grep confirma que a string não aparece em `src/`/`server/` |
| Exposição de tokens/secrets de provider | **PASS (banco) / era P0 (API paralela)** | `BRGPS_API_TOKEN` nunca sai por `/rest` (`system_integrations` é `ADMIN_ONLY_READ_TABLES`); a via de escape real era o PostgREST nativo do Supabase (P0-1), fechada nesta rodada |

---

## 9. Arquivos criados

```
RBAC-SECURITY-GATE.md
server/api/rbac.test.ts
supabase/migrations/20260828060000_rbac_security_hardening.sql
```

## 10. Arquivos alterados

```
server/api/rest.ts   — RBAC granular (assertNotViewer, assertOperatorCannotDelete,
                        assertNoTenantLinkTamperOnPatch, assertInsertUnitBelongsToTenant,
                        assertUserProfilesTenantAdminRules), restrição de
                        colunas de user_profiles reescrita (tenant_admin-aware)
```

## 11. Migrations

| Arquivo | O que faz |
|---|---|
| `20260828060000_rbac_security_hardening.sql` | `REVOKE ALL` de `anon`/`authenticated` em tabelas/sequences/functions/schema (fecha P0-1); habilita RLS + policy tenant-scoped em `audit_logs` (fecha P1-4) |

Aplicada no banco de dev **com confirmação explícita do usuário** antes de
rodar (é uma mutação de schema em banco compartilhado).

## 12. Policies alteradas

- `audit_logs_tenant_scoped` (nova, mesma migration) — mesmo padrão das
  demais tabelas tenant-scoped (`app.is_admin` ou `client_id` batendo
  `app.client_id`).
- Nenhuma policy existente foi alterada — o fix do P0-1 foi por `REVOKE`
  de `GRANT`, não por mudança de policy (as policies das tabelas de
  referência continuam `using (true)`, mas agora só `athos_app_rw`/
  `postgres` alcançam essas tabelas de qualquer forma).

## 13. Testes executados

- `npm run lint` (tsc --noEmit): **limpo**
- `npm run test`: **51/51 passando** (29 pré-existentes + 22 novos em
  `server/api/rbac.test.ts` — STOP CONDITION não acionada, nada quebrou)
- `npm run build`: **sucesso**, bundle inspecionado (sem source map, sem
  string de secret)
- `npm audit`: **0 vulnerabilidades**
- Ataque ao vivo contra `localhost:4000` (API real, tsx watch, mesmo banco
  de dev): script descartável com os 12 vetores + variações RBAC, 29/29
  passando antes de portar pra `server/api/rbac.test.ts` como regressão
  permanente
- Todo dado de teste (`RBACTEST-*`) criado e removido em cada execução —
  confirmado com query direta no banco depois de cada rodada (0 linhas
  residuais)

---

## 14. GATE FINAL

| Critério do prompt | Resultado |
|---|---|
| Nenhuma vulnerabilidade P0 aberta | **PASS** — as 2 encontradas (P0-1, P0-2) foram corrigidas e reverificadas ao vivo nesta mesma rodada |
| Nenhuma quebra de isolamento entre tenants | **PASS** — 12/12 testes ofensivos bloqueados, incluindo o achado novo (P0-2) já com o fix aplicado |
| RLS validada | **PASS** — todas as tabelas tenant-scoped cobertas; `audit_logs` fechado; tabelas de referência agora protegidas por GRANT (não só policy) |
| RBAC validado | **PASS** — os 5 papéis do prompt mapeados, testados individualmente (`server/api/rbac.test.ts`), incluindo o residual explícito do relatório anterior |
| Build aprovado | **PASS** |
| Testes existentes continuam passando | **PASS** — 29/29 originais + 22/22 novos |

### RESULTADO FINAL: **PASS**

Diferente do relatório anterior (que fechou em FAIL por cobertura
incompleta em áreas fora do escopo daquela rodada — LGPD, Backup/Recovery,
Propriedade Intelectual, Tag/Licensing), o critério de PASS **desta**
rodada é o que está definido no prompt mestre desta tarefa (seção acima),
e todos os 6 itens batem.

Isso **não** significa que as 5 áreas que o relatório anterior listou como
bloqueadoras estão resolvidas — elas continuam fora do escopo do que foi
pedido aqui (RBAC + auditoria ofensiva de isolamento), e permanecem como
pendência de um gate de segurança *completo*, não deste gate específico.

---

## 15. Riscos / Pendências reais

1. **MANAGER uniforme entre os 3 sub-papéis** (P2-2) — sem gating por
   módulo no proxy, só no frontend. Não é regressão (nunca existiu), mas é
   o residual mais concreto que sobra do pedido original de RBAC granular.
2. **Rate limiting só em `/auth/login`** (P2-3) — `/rest/*` seguem sem
   limite de requisições. Residual conhecido, não atacado nesta rodada.
3. **`REVOKE` de `anon`/`authenticated` é sobre o estado atual do schema**
   (P2-4) — uma tabela nova criada fora das migrations (dashboard Supabase)
   pode reabrir o mesmo grant. Sem alarme automatizado pra detectar isso
   hoje.
4. **`CORS_ORIGIN`/headers de segurança em produção (Railway/Vercel)** —
   não verificável a partir deste ambiente local, mesma limitação honesta
   do relatório anterior.
5. **`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` dead config** (P3) — sem
   risco (ver P0-1, já fechado no banco), mas vale limpar numa rodada de
   housekeeping.
6. Este gate cobriu especificamente RBAC + isolamento multi-tenant +
   auditoria ofensiva dos 12 vetores + checklist geral. **Não** revalidou
   LGPD, backup/recovery, propriedade intelectual nem a máquina de estados
   de licença (`TAG/LICENSING SECURITY`, já marcado FAIL no relatório
   anterior e não tocado aqui — fora do escopo pedido nesta rodada).
