# ATHOS TRACK — Fechamento do Gerenciador de Tenants

> Não commitado, não enviado (push), não deployado — conforme pedido.

---

## O que foi feito

O "Gerenciador de Tenants" pedido já existia parcialmente:
`src/pages/admin/ClientsPage.tsx` era uma listagem read-only com um botão
"Cadastrar Novo Cliente" que só mostrava um `alert()` (mesmo padrão da tela
de login que já tinha sido corrigido antes, SEC-010). **Evoluí essa página**
em vez de criar uma nova — reaproveitando `DataTable`, o layout, e
`company_clients` como a entidade de tenant (sem tabela nova).

### 1. Tenants configurados

- **São João** (`sao-joao`) — módulos `Caixas` + `Ativos`. Já existia da
  rodada anterior, só ganhou `slug` novo.
- **Afrin** (`afrin`) — módulos `Carrinhos` + `Ativos`. **É o tenant que
  antes se chamava "Zafari"**, renomeado (mesmo `id`, mesmos módulos,
  mesma posição de "tenant 2") — não um tenant novo. Decisão tomada porque
  o brief lista "Afrin" com módulos idênticos ao que "Zafari" já tinha
  configurado, e criar um "Afrin" do zero teria deixado um "Zafari" órfão
  no banco (violaria "jamais misturar/duplicar dado"). Se essa leitura
  estiver errada, é uma migration pequena de reverter — nenhum dado
  operacional (`assets`, `geofences` etc.) foi tocado, só o `company_clients`.

Migration: `supabase/migrations/20260828050000_tenant_manager_fields.sql`.

### 2. Colunas novas em `company_clients`

`slug` (identificador único, `sao-joao`/`afrin`/`athos-track-demo`),
`default_provider_id` (`'brgps'` — ver seção Providers abaixo),
`brand_color`, `logo_url` (identidade visual — `logo_url` existe no schema,
sem campo na UI ainda, ver Pendências).

### 3. Gerenciador de Tenants (UI)

`src/pages/admin/ClientsPage.tsx`, só visível/operável por `ATHOS_ADMIN`
(botões de criar/editar/ativar somem pra outras roles — a página em si
continua acessível pra leitura, escopada por RLS/tenant scoping igual
qualquer outra tela):

- **Listar**: nome, código, slug, módulos (badges), provider, unidades,
  ativos, status — dado real, sem mock.
- **Criar**: modal com nome, código, slug (auto-gerado do nome, editável),
  CNPJ, módulos (toggle Carrinhos/Caixas/Ativos), provider (select), cor da
  marca, status inicial.
- **Editar**: mesmo modal, pré-preenchido.
- **Ativar/Desativar**: botão de toggle direto na listagem (sem abrir modal).

### 4. Isolamento — nenhum dado compartilhado entre tenants

Reaproveita o RLS real e o tenant-scoping de `server/api/rest.ts` já
construídos e testados nas rodadas anteriores (`SECURITY-GATE-REPORT.md`,
SEC-002/006/012) — não precisei reconstruir isolamento, só usar o que já
existe. **Achado e corrigido nesta rodada**: `company_clients` não estava
na lista de tabelas admin-only pra `PATCH` — um `CLIENT_ADMIN` conseguia
editar a própria linha (inclusive religar módulo não contratado, ou
reverter uma desativação feita pelo ATHOS_ADMIN). Fechado em `rest.ts`
(`ADMIN_ONLY_PATCH_TABLES`).

### 5. Providers — Jason e Heile continuam desacoplados

Nenhuma mudança na arquitetura de provider desta rodada anterior
(`server/integrations/shared/TrackingProvider.ts`,
`server/integrations/brgps/BrgpsProvider.ts`, aliases `heile`/`jason`/
`brgps` no `ProviderRegistry`). O campo novo `company_clients.default_provider_id`
só **referencia** qual provider um tenant usa (todos os 3 tenants atuais
apontam pra `'brgps'`, o único provider real registrado) — não implementei
lógica nova de roteamento por esse campo ainda (ver Pendências).

### 6. Auditoria — persistida, não só console.log

Reaproveita `audit_logs`/`writeAuditLog()` (já existiam de uma rodada
anterior). Novo: `server/api/rest.ts` grava automaticamente em
`company_clients.create/update/delete` — cobre criação, edição,
ativação/desativação e troca de provider (são todos `PATCH` na mesma
tabela, um hook só cobre os quatro).

### Bug real encontrado e corrigido no caminho

`enabled_modules` (jsonb) chegava pro Postgres como array JS cru — o driver
`pg` interpreta isso como sintaxe de ARRAY do Postgres, não JSON, e a
criação de tenant quebrava com `"invalid input syntax for type json"`.
Corrigido em `server/api/rest.ts` (`serializeForColumn()`) pra todo o proxy
genérico, não só pra este caso — mesma classe de bug que eu já tinha visto
e adiado numa rodada anterior (`traffic_segments.coordinates`), agora
efetivamente fechada.

---

## Arquivos criados

```
supabase/migrations/20260828050000_tenant_manager_fields.sql
TENANT-MANAGER-REPORT.md
```

## Arquivos alterados

```
server/api/rest.ts          — ADMIN_ONLY_PATCH_TABLES + company_clients,
                               AUDITED_TABLES + hooks de auditoria,
                               serializeForColumn() (fix jsonb)
src/pages/admin/ClientsPage.tsx  — evoluída: CRUD real (era read-only + alert fake)
src/context/AuthContext.tsx      — refreshClients() exposto no contexto
src/lib/mappers.ts               — CLIENT_FIELDS + clientToInsertRow/clientUpdatesToRow
src/types/index.ts               — CompanyClient: slug/defaultProviderId/brandColor/logoUrl/enabledModules
```

## Migrations

| Arquivo | O que faz |
|---|---|
| `20260828050000_tenant_manager_fields.sql` | `slug`/`default_provider_id`/`brand_color`/`logo_url` em `company_clients`; backfill de slug pros 3 tenants; renomeia Zafari→Afrin |

## Policies alteradas

Nenhuma policy de RLS nova ou alterada — `company_clients` já tinha a
policy `company_clients_tenant_scoped` da rodada de RLS anterior
(SEC-012), que já cobre as colunas novas automaticamente (RLS por linha,
não por coluna).

## Testes executados

- `npm run lint` (tsc --noEmit): **limpo**
- `npm run test`: **29/29 passando** (nenhum teste existente quebrou —
  STOP CONDITION não acionada)
- `npm run build`: **sucesso** (warnings pré-existentes de tamanho de
  bundle/ordem de `@import` CSS, não introduzidos nesta rodada)
- Testes manuais ao vivo (navegador + API, com dados de teste criados e
  removidos em seguida):
  - Criar tenant via UI → apareceu na lista, `audit_logs` gravado
  - Editar módulos via UI → salvou, `audit_logs` gravado com `changedColumns`
  - Ativar/desativar via UI → status mudou, `audit_logs` gravado
  - `CLIENT_ADMIN` tentando editar a própria empresa → **403** (gap fechado)
  - `CLIENT_ADMIN` tentando criar tenant → **403**
  - `CLIENT_ADMIN` lendo `company_clients` → só a própria linha

## Resultado

**PASS** para o que foi pedido nesta rodada: Gerenciador de Tenants
funcional (listar/criar/editar/ativar-desativar/módulos/provider/
identidade visual básica), os dois tenants configurados, isolamento
mantido e reforçado (gap de self-edit fechado), auditoria persistida,
Jason/Heile continuam desacoplados. Nenhum teste existente quebrou.

## Riscos / Pendências reais

1. **Renomeação Zafari→Afrin é uma inferência minha**, não uma instrução
   explícita de "renomeie X para Y" — documentada acima, fácil de reverter
   se estiver errada (não afeta `assets`/`geofences`/dado operacional).
2. **`default_provider_id` é só um rótulo hoje** — nada no backend lê essa
   coluna pra rotear qual `TrackingProvider` usar por tenant; o único
   provider real (`brgps`) atende todos. Fica pronto pro dia que existir
   um segundo provider de verdade.
3. **`logo_url` sem campo na UI** — existe na coluna/tipo, não no formulário
   ainda (só `brand_color` tem input).
4. **Sidebar não esconde "Clientes" de não-admin** — a página em si já
   nega mutações (RBAC server-side + UI condicional nos botões), mas o
   item de menu aparece pra qualquer role (mesmo comportamento de todo o
   resto do menu lateral hoje — não é regressão desta rodada, é um gap
   pré-existente maior, fora do escopo pedido aqui).
5. ~~**`enabled_modules` não é lido pelo `canAccessModule()`**~~ — **fechado
   no addendum abaixo.**

---

## Addendum — fechamento das pendências (mesma sessão, sem commit)

### Correção de nome: Afrin → Grupo Zaffari

O item 1 acima ("Renomeação Zafari→Afrin é uma inferência minha") estava
**errado**: o usuário confirmou que o tenant é o **Grupo Zaffari** (rede
varejista real), não "Afrin". Corrigido:

- `supabase/migrations/20260828050000_tenant_manager_fields.sql` — o
  `UPDATE` que antes fazia `ZAFARI → AFRIN` agora faz
  `ZAFARI/AFRIN → 'Grupo Zaffari'` (`code = 'ZAFFARI'`,
  `slug = 'grupo-zaffari'`), cobrindo tanto um banco novo (ainda em
  `ZAFARI`) quanto o banco de dev atual (já em `AFRIN`).
- Banco de dev (Supabase) corrigido ao vivo com o mesmo `UPDATE`, **com
  confirmação explícita do usuário antes de rodar** (mutação em banco
  compartilhado) — só metadado (`name`/`code`/`slug`), nenhum dado
  operacional tocado.
- `src/pages/admin/ClientsPage.tsx` — placeholders do formulário
  (`Ex: Afrin` → `Ex: Grupo Zaffari`, `Ex: AFRIN` → `Ex: ZAFFARI`).

Não editei o texto de rodadas passadas que já mencionava "Zafari" como fato
histórico (`SECURITY-GATE-REPORT.md`, `docs/MULTI-TENANT-ARCHITECTURE.md`)
— eram descrições corretas do estado no momento em que foram escritas.

### Pendência 3 fechada: campo `logo_url` na UI

`src/pages/admin/ClientsPage.tsx` — `TenantFormState` ganhou `logoUrl`,
com input de URL no modal de criar/editar (mesmo padrão visual dos outros
campos). A coluna e o mapper (`clientToInsertRow`/`clientUpdatesToRow`) já
suportavam o campo desde a rodada anterior — só faltava o input.

### Pendência 5 fechada: sidebar respeita `enabled_modules`

Já estava implementado em `src/context/AuthContext.tsx` no momento deste
addendum (`tenantAllowsModuleKey()`, chamado de dentro de
`canAccessModule()`) — mapeia os 3 módulos configuráveis hoje
(`carts`/`assets`/`boxes`) pras chaves de menu (`carrinhos`/`ativos`/
`caixas`); demais itens do menu continuam sem gating por módulo, como já
estavam, pra não mudar comportamento de tenants que nunca configuraram
isso. `ATHOS_ADMIN` nunca é filtrado (administra múltiplos tenants com
módulos diferentes). `Sidebar.tsx` não precisou de mudança — já chamava
`canAccessModule(item.key)`.

### Pendência 2 — mantida deliberadamente, não é regressão

`default_provider_id` continua só um rótulo (não roteia nada no backend).
Reconfirmei: **não existe hoje nenhum ponto de código que decida
comportamento por tenant+provider** — `brgps-sync` é um processo global
(não por tenant), o GT06 listener não é provider-routed, e
`/providers/:providerId/health|activate` já aceita o `providerId`
explicitamente por request (admin escolhe na tela, não vem do tenant).
Como só existe 1 provider real (`brgps`, com aliases `heile`/`jason`),
implementar "roteamento" agora seria código morto sem nada de verdade pra
rotear. Deixado como está — já documentado no próprio `PROVIDER_OPTIONS`
em `ClientsPage.tsx` ("select já vem pronto pra crescer quando um provider
de verdade diferente existir").

### Testes re-executados após o addendum

- `npm run lint` (tsc --noEmit): limpo
- `npm run test`: 29/29 passando
- `npm run build`: sucesso (mesmos warnings pré-existentes)

### Resultado final

**PASS.** As 4 pendências de código foram fechadas (nome, logo_url,
enabled_modules — a de provider ficou deliberadamente como estava, com
justificativa). Nada commitado/pushado/deployado. Único item aberto sem
relação com este trabalho: erro em runtime `relation "animals" does not
exist` (feature de rebanho Agro, commit `f399350`, migration
`20260818000000_add_animals_table.sql` não aplicada no banco atual) — fora
do escopo do Gerenciador de Tenants, não tocado aqui.
