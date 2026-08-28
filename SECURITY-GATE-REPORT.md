# ATHOS TRACK — Security Gate Report

> Testes executados contra a API **local** (`http://localhost:4000`, mesmo
> banco Supabase de produção configurado em `.env`). Senhas/hashes nunca
> reproduzidos em texto completo.
>
> **Atualização:** **todos os 11 achados desta rodada (SEC-001 a SEC-011)
> foram corrigidos** (`server/api/rest.ts`, `server/api/auth.ts`,
> `server/api/routes-auth.ts`, `server/api/realtime.ts`,
> `server/api/index.ts`, `src/lib/supabaseClient.ts`, `src/pages/Login.tsx`,
> `scripts/provision-user-password.ts`, três migrations em
> `supabase/migrations/`) e reconfirmados ao vivo, sempre com contas/tenants
> de teste descartáveis criados e **removidos** em seguida — o banco fica de
> volta ao estado original (1 tenant, 1 asset, os 2 usuários reais) depois
> de cada rodada. Ver "Status" e "Teste de regressão" em cada achado.

---

## Achados confirmados ao vivo

### SEC-001 — Vazamento de credenciais entre usuários (`user_profiles`)

- **Severidade:** P0
- **Componente:** `server/api/rest.ts` (`GET /rest/:table`) + `server/api/auth.ts` (`requireAuth`)
- **Descrição:** Qualquer usuário autenticado, de qualquer role, lê a tabela
  `user_profiles` inteira via `GET /rest/user_profiles`, incluindo o campo
  `password_hash` de **todos os outros usuários**, não só o próprio.
- **Cenário de ataque:** Um usuário `VIEWER` de qualquer cliente faz login
  normal, chama `GET /rest/user_profiles` com o próprio token, e recebe o
  hash bcrypt de senha de todo mundo (inclusive de `ATHOS_ADMIN`) para
  cracking offline.
- **Impacto:** Comprometimento potencial de qualquer conta da plataforma,
  incluindo admins ATHOS. Exposição de e-mail/role de todos os usuários.
- **Evidência (executada agora, hash mascarado):**
  ```
  GET /rest/user_profiles  (Authorization: Bearer <token de joel.oliveira>)
  → 200 OK, 2 registros:
    kleberduartesouza@hotmail.com | ATHOS_ADMIN | password_hash: $2b$10$...WnVG
    joel.oliveira@athos.com.br    | ATHOS_ADMIN | password_hash: $2b$10$...zJh.
  ```
  (joel.oliveira nunca deveria conseguir ler a linha/hash de kleberduartesouza.)
- **Correção recomendada:**
  1. `GET /rest/user_profiles` (e qualquer tabela sensível) deve, no mínimo,
     nunca devolver `password_hash` — excluir a coluna no SELECT, não confiar
     em "o frontend não mostra".
  2. Aplicar filtro obrigatório por `client_id` do JWT em toda tabela
     tenant-scoped, ignorando qualquer `eq_client_id` vindo da query string.
  3. Médio prazo: sair do proxy CRUD genérico para endpoints específicos por
     recurso, cada um com sua própria regra de autorização (ver seção
     "Recomendação arquitetural" abaixo).
- **Status:** **FIXED** — `stripSensitiveColumns()` em `server/api/rest.ts`
  remove `password_hash` de toda resposta de `user_profiles`, para qualquer
  role, antes de sair pro cliente.
- **Teste de regressão (executado após a correção):**
  `GET /rest/user_profiles` com token de `ATHOS_ADMIN` → 200 OK, 2 registros,
  **nenhum campo `password_hash` presente** (confirmado — a chave nem aparece
  no JSON, não é só mascarada).
  Com token de usuário `VIEWER` de teste → 200 OK, **1 registro** (só o
  próprio), sem `password_hash`. Conta de teste removida depois.

---

### SEC-002 — Proxy CRUD sem isolamento de tenant/unit em 26 tabelas

- **Severidade:** P0
- **Componente:** `server/api/rest.ts` (`GET/POST/PATCH/DELETE /rest/:table`)
- **Descrição:** Nenhuma das 26 tabelas em `ALLOWED_TABLES` tem filtro de
  tenant imposto pelo servidor. O filtro é 100% opcional e escolhido pelo
  cliente via query string.
- **Cenário de ataque:** Um usuário de qualquer empresa chama
  `GET /rest/assets` (ou `system_alerts`, `geofences`, `cargo_shipments`,
  `drivers`, etc.) sem filtro e recebe a tabela inteira, de todas as
  empresas cadastradas na plataforma.
- **Impacto:** Vazamento total de dados operacionais entre clientes ATHOS
  (localização de ativos, alertas, motoristas, cargas) — quebra o requisito
  fundamental do SaaS multi-tenant descrito no prompt mestre.
- **Evidência (executada agora):**
  ```
  GET /rest/assets  (sem nenhum filtro, token de joel.oliveira)
  → 200 OK, retornou a tabela inteira (1 registro — único ativo cadastrado
    no banco hoje, do único tenant "ATHOS Track Demo").
  ```
  **Limitação da evidência:** hoje só existe **um único tenant** no banco
  real (`company_clients` tem 1 linha). O mecanismo (ausência de filtro
  server-side) está 100% provado — inclusive por leitura direta do código
  em `rest.ts`, que nunca injeta `client_id` — mas a prova **empírica** de
  vazamento *entre duas empresas diferentes* exige criar um `TENANT_B` de
  teste, o que é uma escrita em produção e **não foi feita** (fora do escopo
  autorizado "somente leitura" desta rodada).
- **Correção recomendada:** mesma da SEC-001, itens 2 e 3 — o ponto central
  é: **nenhuma tabela tenant-scoped pode ser servida sem o servidor forçar
  `client_id = <do JWT>`** (e `unit_id` quando aplicável ao role).
- **Status:** **FIXED** — `tenantScopeClause()` em `server/api/rest.ts`
  injeta `client_id = <do JWT>` como condição obrigatória em GET/PATCH/DELETE
  para todo não-`ATHOS_ADMIN`, em cima de qualquer filtro vindo do cliente
  (nunca no lugar dele). `ATHOS_ADMIN` continua sem escopo, por design
  (administra múltiplas empresas).
- **Teste de regressão (executado após a correção, com tenant de teste real):**
  Criado `SECTEST Tenant B` (empresa + unidade + asset reais no banco) e um
  usuário `VIEWER` vinculado só ao tenant original (`ATHOS Track Demo`).
  - `GET /rest/assets` sem filtro, como o `VIEWER` → retornou **só o asset do
    próprio tenant**; o asset de `SECTEST Tenant B` **não apareceu**.
  - `GET /rest/company_clients` sem filtro → retornou **só o próprio
    tenant**; `SECTEST Tenant B` não apareceu.
  - Tentativa deliberada de bypass: `GET /rest/assets?eq_client_id=<id do
    Tenant B>` (forçando o filtro de tenant errado na própria URL) → **0
    linhas** (o filtro do servidor se soma ao do cliente com AND, não
    substitui — não existe combinação de query string que escape do próprio
    tenant).
  Tenant B de teste e usuário de teste **removidos** logo em seguida
  (`DELETE /rest/company_clients` em cascade + `DELETE /rest/user_profiles`,
  ambos como `ATHOS_ADMIN`). Banco conferido de volta ao estado original.
- **Limitação residual documentada nesta versão do relatório — fechada em
  SEC-011, abaixo.**

---

### SEC-011 — As 8 tabelas sem coluna de tenant (resíduo de SEC-002)

- **Severidade:** P1
- **Componente:** schema (`cargo_shipments`) + `server/api/rest.ts`
- **Descrição:** `cargo_shipments`, `traffic_segments`, `points_of_interest`,
  `provider_health`, `homologation_requests`, `homologation_devices`,
  `homologation_events`, `homologation_reports` não tinham vínculo de tenant
  algum e ficaram de fora da correção original de SEC-002/SEC-006 — qualquer
  autenticado lia (e, em `cargo_shipments`, também escrevia) essas 8 tabelas
  sem distinção de empresa.
- **Por que são 3 correções diferentes, não uma só:** as 8 tabelas não são
  todas a mesma coisa.
  1. **`cargo_shipments`** é dado de negócio real por cliente (cada empresa
     tem suas próprias cargas em trânsito) que simplesmente nunca ganhou
     `client_id`/`unit_id` no schema — isso é a mesma classe de bug de
     SEC-002, só que precisando de uma migration primeiro.
  2. **`traffic_segments`, `points_of_interest`, `provider_health`** não são
     dado de tenant nenhum — são referência compartilhada (trânsito e POIs
     valem pra qualquer cliente que passe por ali; `provider_health` é uma
     linha só por integração externa, ex.: `BRGPS`, não por empresa).
     Continuam legíveis por qualquer autenticado (não há dado de cliente
     pra vazar ali), mas a escrita virou admin-only — não é operação de
     tenant comum, e nada no frontend escreve nelas hoje mesmo.
  3. **As 4 tabelas de `homologation_*`** são o fluxo interno da ATHOS de
     certificação de fornecedor, pré-tenant por natureza (um IMEI de teste
     ainda não pertence a cliente nenhum). Não são referência
     compartilhada nem dado de cliente — são operação interna da ATHOS.
     Ficaram inteiramente bloqueadas (leitura **e** escrita) pra quem não é
     `ATHOS_ADMIN`.
- **Migration aplicada:**
  `supabase/migrations/20260828000000_add_cargo_shipments_tenant.sql` —
  adiciona `client_id`/`unit_id` (nullable, com FK) em `cargo_shipments`.
  Nullable de propósito: não havia como inferir o tenant de linhas
  antigas (tabela estava vazia no banco de produção no momento da
  correção — confirmado antes de aplicar — mas o design fica correto pra
  qualquer ambiente: linha com `client_id` nulo fica visível só pro
  `ATHOS_ADMIN`, nunca "pública").
- **Correção em `server/api/rest.ts`:** `cargo_shipments` entrou em
  `DIRECT_TENANT_COLUMN`/`UNIT_COLUMN` (mesmo mecanismo de SEC-002/006).
  Duas listas novas: `ADMIN_ONLY_WRITE_TABLES` (leitura livre, escrita
  admin-only: `traffic_segments`, `points_of_interest`, `provider_health`)
  e `ADMIN_ONLY_READ_TABLES`/`ADMIN_ONLY_ALL_TABLES` (bloqueia tudo pra
  não-admin: as 4 de `homologation_*`), checadas nos handlers GET/POST/PATCH.
- **Teste de regressão (executado após a correção, conta `VIEWER` e conta
  `ATHOS_ADMIN` de teste):**
  - `VIEWER` cria um `cargo_shipments` sem informar `client_id` no body →
    **201**, `client_id` injetado automaticamente com o do próprio token.
    `GET /rest/cargo_shipments` como esse `VIEWER` → retorna a linha criada,
    corretamente escopada.
  - `VIEWER` lê `traffic_segments` → **200 OK** (leitura liberada).
  - `VIEWER` tenta criar um `traffic_segments` → **403**,
    `"Only ATHOS_ADMIN can create rows in \"traffic_segments\""`.
  - `VIEWER` tenta ler `homologation_requests` → **403**,
    `"Only ATHOS_ADMIN can read \"homologation_requests\""`.
  - `ATHOS_ADMIN` lê `homologation_requests` normalmente → **200 OK**.
  - `ATHOS_ADMIN` cria/deleta uma linha de teste em `provider_health` →
    **OK** nos dois sentidos (confirma que o admin não ficou bloqueado
    pelas próprias regras novas).
  Todos os dados de teste (`cargo_shipments`, `provider_health`, usuário
  `VIEWER`) **removidos** em seguida; confirmado que o único
  `provider_health` restante é a linha real (`BRGPS`, `HEALTHY`) já
  existente antes desta sessão. `npm run test` → 25/25 passando.
- **Status:** **FIXED**
- **Limitação residual:** o portal público `/homologacao` (sem login) grava
  em `homologation_requests` pelo mesmo caminho `supabase.from(...)` que
  agora exige JWT — esse fluxo já estava provavelmente quebrado antes desta
  sessão (ver `ATTACK-SURFACE.md`) e continua fora do escopo desta correção;
  precisa de uma decisão separada (endpoint público dedicado, ou outro
  mecanismo de submissão sem afetar a proteção agora aplicada às 4 tabelas).

---

### SEC-006 — Isolamento por unidade (`unit_id`) dentro do mesmo tenant

- **Severidade:** P1 (o prompt mestre trata como P0 de multi-tenant, seção
  6; mantenho separado de SEC-002 porque tem uma condição de contorno
  diferente — só afeta perfis com `unit_id` atribuído, não todo usuário)
- **Componente:** `server/api/rest.ts` (mesma correção de SEC-002, estendida)
- **Descrição:** Antes desta correção, um usuário restrito a uma unidade
  (ex.: `OPERATOR` da "Matriz") tinha o mesmo acesso de um `CLIENT_ADMIN` a
  todas as unidades da própria empresa — o filtro só ia até `client_id`.
- **Cenário de ataque:** Um operador de uma filial vê (e, sem a correção,
  também edita) ativos, alertas e ordens de serviço de outra filial da
  mesma empresa, fora da sua alçada.
- **Correção:** `UNIT_COLUMN` em `server/api/rest.ts` mapeia, por tabela,
  qual coluna representa a unidade; `tenantScopeClause()` agora soma
  `unit_id = <do JWT>` à condição de `client_id` sempre que o usuário tem
  uma unidade atribuída (perfis sem `unit_id`, como `CLIENT_ADMIN`,
  continuam vendo todas as unidades do próprio cliente — esse é o
  comportamento correto, não um bug). `company_units` é tratada à parte:
  como a linha *é* a unidade, o escopo extra é `id = <unit_id do JWT>`, não
  uma FK. Insert (`enforceTenantOnInsertRow`) e o check de asset em tabelas
  ligadas por `asset_id` (`assertAssetBelongsToTenant`) também passaram a
  validar a unidade, não só o cliente.
- **Teste de regressão (executado após a correção, com dado real de teste):**
  Criada uma segunda unidade (`SECTEST Unidade B`) **na mesma empresa** já
  existente, com um asset dentro dela, e um usuário `OPERATOR` vinculado só
  à unidade original ("Matriz").
  - `GET /rest/assets` sem filtro, como esse `OPERATOR` → retornou só o
    asset da própria unidade; o asset de `SECTEST Unidade B` **não
    apareceu**, mesmo sendo da mesma empresa.
  - `GET /rest/company_units` sem filtro → retornou só a própria unidade;
    `SECTEST Unidade B` não apareceu.
  - Bypass forçado via `GET /rest/assets?eq_unit_id=<id da Unidade B>` → **0
    linhas**.
  Unidade B, asset e usuário de teste **removidos** em seguida via
  `ATHOS_ADMIN`. Banco conferido de volta ao estado original (1 tenant, 1
  unidade, 1 asset, 2 usuários reais).
- **Status:** **FIXED**
- **Limitação residual:** só as tabelas com coluna `unit_id` foram
  escopadas (`assets`, `geofences`, `drivers`, `animals`,
  `maintenance_records`, `work_orders`, `route_templates`,
  `system_integrations`, `recovery_occurrences`, `user_profiles`,
  `company_units`, mais as ligadas por `asset_id`/`occurrence_id` via
  subquery). `greylist_entries`, `asset_recovery_cases` e `asset_pairings`
  têm `client_id` mas não `unit_id` no schema — ficam escopadas só por
  empresa, não por unidade, até uma migration adicionar a coluna.

---

### SEC-003 — Realtime (Socket.IO) sem autenticação, broadcast global

- **Severidade:** P0
- **Componente:** `server/api/realtime.ts`, `server/api/index.ts`
- **Descrição:** O servidor Socket.IO não exige token (`io.use()` de auth
  inexistente) e retransmite (`io.emit`) qualquer `UPDATE` em `assets` e
  `INSERT` em `system_alerts` — com a linha completa — para **todos** os
  sockets conectados, sem distinção de tenant.
- **Cenário de ataque:** Um script anônimo (sem login, sem token) abre uma
  conexão WebSocket direto na URL pública da API e passa a receber, em
  tempo real, posição GPS e alertas de **todos os ativos de todos os
  clientes** assim que qualquer um deles se move.
- **Impacto:** Vazamento de localização em tempo real de ativos de qualquer
  cliente, sem precisar de credencial nenhuma — pior que SEC-002 porque nem
  exige uma conta válida na plataforma.
- **Evidência (executada agora):**
  ```
  socket.io-client conectando em ws://localhost:4000 SEM Authorization header
  → { connected: true, id: "ZDJX7n_I1GWXVuUwAAAP" }
  ```
  Conexão anônima aceita normalmente. (Não forcei nenhum evento de mudança
  — isso exigiria uma escrita — mas o código-fonte confirma que qualquer
  `UPDATE` em `assets` seria retransmitido para esse mesmo socket, já que o
  `io.emit` é incondicional e global.)
- **Correção recomendada:**
  1. `io.use((socket, next) => { valida JWT do handshake; next() })`,
     rejeitando conexões sem token válido.
  2. Emitir em uma *room* por `client_id` (`socket.join(client_id)` após
     autenticar) em vez de `io.emit` global — trocar
     `io.emit('postgres_changes:'+table, payload)` por
     `io.to(payload.new.client_id).emit(...)`.
- **Status:** **FIXED** — `io.use(authenticateSocket)` em
  `server/api/realtime.ts` exige JWT válido no handshake; sockets de
  `ATHOS_ADMIN` entram na room `admins`, os demais na room `client:<seu
  client_id>`. Cada evento é emitido só pra room do tenant dono da linha
  (`system_alerts` resolve o tenant via `asset_id → assets.client_id`, já
  que a tabela não tem `client_id` direto). `src/lib/supabaseClient.ts`
  agora manda o token no handshake (`auth: { token }`).
- **Teste de regressão (executado após a correção):**
  - Conexão sem token → rejeitada, `"Missing auth token"`.
  - Conexão com token adulterado/inválido → rejeitada, `"Invalid or expired
    token"`.
  - Conexão com token válido de `ATHOS_ADMIN` → aceita normalmente.
  - Não testado neste momento: confirmar que um evento real de `TENANT_A`
    não chega num socket de `TENANT_B` (exigiria forçar um `UPDATE` em
    `assets` para gerar o NOTIFY — nenhuma escrita adicional foi feita além
    da criação/remoção do tenant de teste já registrada em SEC-002). O
    isolamento por room do Socket.IO é uma garantia do próprio Socket.IO
    (mensagem só chega a quem está na room), então o risco residual aqui é
    baixo, mas fica como item de regressão pendente.

---

### SEC-004 — Vazamento de schema via mensagens de erro do Postgres

- **Severidade:** P2
- **Componente:** `server/api/rest.ts` (todos os handlers, `catch` genérico)
- **Descrição:** Erros do driver `pg` são devolvidos crus ao cliente
  (`res.status(500).json({ error: (err as Error).message })`).
- **Cenário de ataque:** Enumerar nomes reais de colunas/tabelas testando
  `eq_<palpite>=x` e observando a mensagem `column "..." does not exist`
  vs. uma resposta válida — útil para direcionar os ataques SEC-001/SEC-002
  sem precisar do código-fonte.
- **Impacto:** Facilita reconhecimento de schema por um atacante; não é, por
  si só, uma via de acesso a dados.
- **Evidência (executada agora):**
  ```
  GET /rest/assets?eq_this_column_does_not_exist=x
  → 500 {"error":"column \"this_column_does_not_exist\" does not exist"}
  ```
- **Correção recomendada:** responder com mensagem genérica ao cliente
  (`{"error":"Invalid request"}`) e logar o erro detalhado só server-side.
- **Status:** **FIXED** — `handleError()` em `server/api/rest.ts` responde
  sempre `{"error":"Internal error"}` pro cliente em erro inesperado (exceto
  `ForbiddenError`, que devolve a mensagem específica de autorização, sem
  detalhe de SQL); o erro real vai só pro `console.error` do servidor. O
  catch de `/auth/login` em `routes-auth.ts` recebeu o mesmo tratamento.
- **Teste de regressão (executado após a correção):**
  `GET /rest/assets?eq_this_column_does_not_exist=x` → `500
  {"error":"Internal error"}` (antes: `{"error":"column \"...\" does not
  exist"}`).

---

### SEC-005 — Escalada de privilégio vertical (não executada — só análise de código)

- **Severidade:** P0 (classificação preliminar, teste real **não realizado**)
- **Componente:** `server/api/rest.ts` (`PATCH /:table`)
- **Descrição:** O handler de `PATCH` aceita qualquer coluna do corpo da
  requisição (só valida que é um identificador SQL válido) e qualquer
  filtro `eq_*` — nada impede `PATCH /rest/user_profiles?eq_id=<próprio id>`
  com `{"role":"ATHOS_ADMIN"}`.
- **Por que não testei ao vivo:** a autorização desta rodada foi
  explicitamente "somente leitura, sem escrever/alterar nada". Escalar o
  próprio usuário de teste seria uma escrita real no banco de produção.
- **Impacto (se confirmado):** qualquer usuário vira `ATHOS_ADMIN` sozinho.
- **Correção recomendada:** mesma raiz das anteriores — nenhuma coluna de
  controle de acesso (`role`, `client_id`, `unit_id`, `status` de
  licenciamento) pode ser editável via o proxy genérico; precisa de
  endpoints dedicados com validação de quem pode mudar o quê.
- **Status:** **FIXED** — `assertNoAdminOnlyColumns()` em `server/api/rest.ts`
  bloqueia `role`/`client_id`/`unit_id`/`password_hash` em `user_profiles`
  no `POST`/`PATCH` pra qualquer requisição que não seja `ATHOS_ADMIN`,
  antes de montar o SQL (não é um filtro de resposta, é rejeição da
  requisição inteira com 403).
- **Teste de regressão (executado após a correção, em conta de teste
  descartável, não em `joel.oliveira` nem `kleberduartesouza`):**
  Criado usuário `sectest.viewer@athostrack.local` (`VIEWER`). Login OK.
  `PATCH /rest/user_profiles?eq_id=<próprio id>` com body
  `{"role":"ATHOS_ADMIN"}` → **403**,
  `{"error":"Column \"role\" on \"user_profiles\" can only be set by
  ATHOS_ADMIN"}`. Conta de teste removida em seguida por um `ATHOS_ADMIN`
  real (confirmando também que `DELETE /rest/user_profiles` é admin-only:
  a mesma tentativa de `DELETE` feita pelo próprio VIEWER, contra
  `company_clients`, também voltou 403).

---

## Matriz consolidada (Fase 1 + confirmação ao vivo)

| ID | Área | Severidade | Evidência | Status |
|---|---|---|---|---|
| SEC-001 | Vazamento credenciais (user_profiles) | P0 | Confirmado ao vivo antes e depois da correção | **PASS** |
| SEC-002 | Multi-tenant (proxy CRUD sem filtro) | P0 | Confirmado ao vivo com 2 tenants reais de teste (criados e removidos) | **PASS** (com resíduo documentado em 7 tabelas sem coluna de tenant) |
| SEC-003 | Realtime sem autenticação | P0 | Conexão anônima/inválida rejeitada ao vivo após correção | **PASS** (teste de isolamento por evento real ainda pendente) |
| SEC-004 | Vazamento de schema via erro | P2 | Confirmado ao vivo antes e depois da correção | **PASS** |
| SEC-005 | Escalada de privilégio vertical | P0 | Confirmado ao vivo com conta de teste descartável | **PASS** |
| SEC-006 | Isolamento por unidade (unit_id) | P1 | Confirmado ao vivo com 2 unidades reais de teste no mesmo tenant (criadas e removidas) | **PASS** (mesmo resíduo de 3 tabelas sem coluna unit_id) |
| SEC-007 | Força bruta em /auth/login | P1 | Confirmado ao vivo antes (15 tentativas sem bloqueio) e depois (bloqueio na 9ª) da correção | **PASS** |
| SEC-008 | Sem revogação de sessão / token de 7 dias | P1 | Confirmado ao vivo (logout via UI real revogou o token; token reusado após logout foi bloqueado) | **PASS** |
| SEC-009 | Sem conceito de usuário desativado | P1 | Confirmado ao vivo (token pré-existente e login novo bloqueados após desativação) | **PASS** |
| SEC-010 | "Recuperar senha" é um alert() falso | P2 | Confirmado antes (código) e depois (teste ao vivo no navegador) da correção | **PASS** |
| SEC-011 | 8 tabelas sem coluna/regra de tenant | P1 | Confirmado ao vivo (cargo_shipments escopado, referência admin-only-write, homologação admin-only-tudo) | **PASS** |

---

## Recomendação arquitetural (visão geral, para autorização futura)

A causa raiz de SEC-001/002/003 é a mesma: `server/api/rest.ts` foi
desenhado como um **proxy genérico de tabela**, sem noção de tenant nem de
role, herdando literalmente o nível de proteção que o Supabase RLS tinha
*antes* de existir role-based policies (só "autenticado = acesso total").
Isso não é uma falha pontual corrigível linha a linha — é uma decisão de
arquitetura que precisa ser revisitada:

- **Opção A (mínima, rápida):** adicionar um middleware que, para cada
  tabela tenant-scoped, injeta `client_id = req.auth.client_id` como filtro
  obrigatório (ignorando o que vier da query string), bloqueia leitura de
  colunas sensíveis (`password_hash`) por padrão, e adiciona checagem de
  `role` antes de `POST/PATCH/DELETE`. Mantém o proxy genérico, mas fecha os
  3 buracos.
- **Opção B (correta a médio prazo):** substituir o proxy genérico por
  endpoints REST específicos por recurso (`/assets`, `/alerts`, etc.), cada
  um com sua própria query SQL escrita à mão já incluindo `where client_id =
  $1`, igual a `server/integrations/gt06/db.ts` e `server/integrations/brgps`
  já fazem hoje (esses dois módulos, que não passam pelo proxy genérico,
  **não têm esse problema** — são exemplos internos do padrão correto).

**Opção A foi implementada e testada nesta sessão** (arquivos alterados:
`server/api/rest.ts`, `server/api/auth.ts`, `server/api/routes-auth.ts`,
`server/api/realtime.ts`, `src/lib/supabaseClient.ts`). Opção B continua
válida como evolução de médio prazo — o proxy genérico, mesmo escopado,
ainda é mais frágil a erro humano (esquecer uma tabela nova em
`DIRECT_TENANT_COLUMN`) do que endpoints escritos à mão por recurso.

---

## Gate parcial ao final desta rodada

| Frente | Resultado |
|---|---|
| Autenticação (JWT, bcrypt) | **Corrigido e confirmado ao vivo**: rate limiting (SEC-007), revogação de sessão real (SEC-008), conta desativável (SEC-009) |
| Autorização / RBAC | **Corrigido** para os casos testados (SEC-005); RBAC granular por operação continua limitado (ex.: qualquer role do tenant ainda lê/edita os mesmos recursos dentro do próprio tenant — não há ainda distinção OPERATOR vs FLEET_MANAGER vs CLIENT_ADMIN) |
| Isolamento multi-tenant | **Corrigido e confirmado ao vivo** com 2 tenants reais de teste, nas 19 tabelas com vínculo de tenant conhecido |
| Isolamento entre unidades (`unit_id`) | **Corrigido e confirmado ao vivo** (SEC-006), com o mesmo resíduo de 3 tabelas sem coluna `unit_id` |
| Realtime (Socket.IO) | **Corrigido e confirmado ao vivo** (conexão exige JWT); isolamento por evento real não forçado em teste |
| Vazamento de schema via erro | **Corrigido e confirmado ao vivo** |
| Tabelas sem coluna/regra de tenant (8 tabelas) | **Corrigido e confirmado ao vivo** (SEC-011) |
| Testes automatizados existentes | 25/25 passando após as mudanças (`npm run test`) |
| Regressão funcional manual | Login, dashboard, mapa e realtime testados no navegador após a correção — funcionando |

**Isto NÃO é um "CYBER SECURITY GATE — PASS" completo** no sentido do prompt
mestre — essa classificação formal (seção 30/36) exige cobrir autenticação,
API security, webhooks, tags/licenciamento, frontend, infraestrutura, LGPD,
backup, mobile (N/A aqui) e propriedade intelectual. Este relatório cobre os
6 achados de multi-tenant/autorização (SEC-001 a SEC-006) e a auditoria de
autenticação abaixo (SEC-007 a SEC-010).

---

## Auditoria de autenticação (P1)

Testado ao vivo contra `http://localhost:4000/auth/login`, com uma conta
descartável criada e removida só pra este teste (`sectest.brute@...`) —
nenhuma conta real foi usada para tentativas de senha errada.

### SEC-007 — Sem proteção contra força bruta em `/auth/login`

- **Severidade:** P1
- **Componente:** `server/api/routes-auth.ts`, `server/api/index.ts`
- **Descrição:** Não existe rate limiting, lockout por tentativas, CAPTCHA
  nem atraso progressivo no endpoint de login. Nenhuma dependência de
  rate-limit no `package.json`, nenhum middleware equivalente registrado.
- **Cenário de ataque:** Dado um e-mail válido (papéis administrativos são
  previsíveis: `admin@`, nome.sobrenome corporativo), um atacante testa
  senhas em sequência sem nenhum freio do servidor.
- **Impacto:** Viabiliza força bruta / credential stuffing contra qualquer
  conta, incluindo `ATHOS_ADMIN`. É o tipo de falha que, sozinha, pode
  reabrir os P0 já fechados (uma conta admin comprometida por senha fraca
  ignora toda a correção de tenant scoping).
- **Evidência (executada agora):** 15 tentativas de senha errada em
  **1,4 segundos**, todas processadas normalmente (`401`), sem nenhum `429`
  nem atraso crescente; a 16ª tentativa, com a senha certa, autenticou
  normalmente — nenhum lockout foi acionado mesmo após as 15 falhas.
- **Correção recomendada:** rate limiting por IP + por e-mail no
  `/auth/login` (ex.: `express-rate-limit`, ou um contador simples em
  Postgres/Redis com backoff exponencial); considerar exigir CAPTCHA depois
  de N falhas.
- **Correção aplicada:** dois limitadores em `server/api/routes-auth.ts`:
  - `loginLimiterByIp` (`express-rate-limit`, novo pacote adicionado —
    `npm audit` continua em 0 vulnerabilidades): 30 requisições / 15min por
    IP em `/auth/login`, contém um atacante único mirando muitas contas.
    `app.set('trust proxy', 1)` em `server/api/index.ts` pra funcionar
    corretamente atrás do proxy do Railway em produção (sem isso, todo
    tráfego pareceria vir de um IP só).
  - Um limitador por e-mail (`Map` em memória, sem dependência nova): 8
    tentativas falhas / 15min por e-mail, resetado a cada login bem-sucedido
    — só conta falha (`registerFailedAttempt`), então um usuário legítimo
    que erra a senha 1-2 vezes e acerta na 3ª não é penalizado.
  - **Limitação conhecida:** o limitador por e-mail vive em memória do
    processo — reseta a cada deploy/restart e não é compartilhado entre
    réplicas se a API algum dia rodar com mais de uma instância. Suficiente
    pro deploy atual (1 instância no Railway); se escalar horizontalmente,
    precisa virar Redis/Postgres.
- **Teste de regressão (executado após a correção, conta de teste
  descartável):** 12 tentativas de senha errada em sequência →
  **1ª-8ª: `401`**, **9ª-12ª: `429`** (`"Too many login attempts for this
  account. Try again later."`). Tentativa com a senha **correta** logo
  depois, ainda dentro da janela de 15min → **também bloqueada com 429**
  (comportamento esperado: a conta fica temporariamente indisponível após
  estourar o limite, mesmo pro dono legítimo — trade-off padrão desse tipo
  de proteção). `npm run test` → 25/25 passando depois da mudança.
- **Status:** **FIXED**

### SEC-008 — Sem revogação de sessão / token de vida longa sem controle

- **Severidade:** P1
- **Componente:** `server/api/auth.ts`
- **Descrição:** JWT válido por 7 dias, sem `jti`, sem blacklist, sem
  conceito de "sessão" no servidor. "Logout" só apaga o token do
  `localStorage` no navegador (`src/lib/supabaseClient.ts`) — o token
  continua 100% válido no servidor até expirar sozinho.
- **Cenário de ataque:** Token roubado (XSS, malware, dispositivo
  perdido) continua funcionando por até 7 dias mesmo depois de "logout"; e
  como não existe coluna de usuário desativado (ver SEC-009), nem trocar a
  senha nem desligar o funcionário invalida um token já emitido.
- **Impacto:** Janela de exposição longa para qualquer token vazado.
- **Correção recomendada:** trade-off arquitetural, não é um patch de uma
  linha — opções incluem (a) reduzir a validade do JWT (ex.: 1h) com
  refresh token de vida mais longa e revogável, ou (b) manter uma tabela de
  sessões ativas no Postgres e checar em `requireAuth`.
- **Correção aplicada (opção b, adaptada — sem tabela nova):** o JWT passou
  a carregar só `sub`/`email`/`sv` (session_version no momento do login),
  nada de role/client_id/unit_id — esses agora são buscados frescos no banco
  a cada requisição por `resolveAuth()` (`server/api/auth.ts`), junto com
  `is_active`. Migration
  `supabase/migrations/20260828010000_add_session_revocation.sql` adiciona
  `session_version integer not null default 1` em `user_profiles`.
  Incrementar essa coluna invalida **todo** token já emitido pra essa
  pessoa, imediatamente, mesmo dentro da validade de 7 dias — sem precisar
  de blacklist (que cresceria sem limite). Três gatilhos:
  1. **`POST /auth/logout`** (novo endpoint, autenticado) — logout de
     verdade, não só limpar `localStorage`. `src/lib/supabaseClient.ts`
     chama isso no `signOut()`.
  2. **Troca de senha** via `scripts/provision-user-password.ts` — agora
     também incrementa `session_version`, fechando o "token vazado continua
     válido mesmo depois de trocar a senha".
  3. **Qualquer `ATHOS_ADMIN`**, via `PATCH /rest/user_profiles` — pode
     forçar `session_version++` em qualquer usuário pra "deslogar de todo
     lugar" sem precisar trocar a senha da pessoa.
  A mesma checagem (`resolveAuth`) passou a valer também pro handshake do
  Socket.IO (`server/api/realtime.ts`), então revogar/desativar também
  derruba a conexão de realtime, não só o REST.
- **Teste de regressão (executado após a correção, conta de teste
  descartável):**
  - Login → token funciona → `POST /auth/logout` → **o mesmo token, reusado
    em seguida, falha** com `"Session revoked — please sign in again"`.
  - Botão real "Sair da Plataforma" na UI (não script) → confirmado que
    incrementa `session_version` no banco de verdade (testado com a conta
    `joel.oliveira`, de 1 pra 2).
  - `npm run test` → 25/25 passando; login/dashboard/mapa/realtime
    funcionando normalmente no navegador depois da correção (token antigo,
    do formato pré-correção, expira graciosamente e pede novo login —
    comportamento esperado, mesmo padrão das correções anteriores).
- **Status:** **FIXED**

### SEC-009 — Não existe conceito de "usuário desativado"

- **Severidade:** P1
- **Componente:** schema (`user_profiles`)
- **Descrição:** A tabela não tinha coluna `is_active`/`status`/`disabled_at`.
  A única forma de tirar o acesso de alguém era deletar a linha inteira
  (perde histórico de autoria) ou trocar a senha via script CLI — e mesmo
  assim, qualquer token já emitido pra essa pessoa continuava válido (ver
  SEC-008).
- **Correção aplicada:** mesma migration de SEC-008 adiciona `is_active
  boolean not null default true`. Checado em dois pontos: `POST
  /auth/login` (não deixa nem gerar token novo pra conta inativa) e
  `resolveAuth()` (derruba token já emitido na primeira requisição depois
  da desativação). `is_active` entrou em `ADMIN_ONLY_WRITE_COLUMNS` em
  `server/api/rest.ts` — só `ATHOS_ADMIN` liga/desliga, ninguém se
  autorreativa.
- **Teste de regressão (executado após a correção, conta de teste
  descartável):**
  - `ATHOS_ADMIN` desativa a conta de teste (`PATCH is_active=false`).
  - Token **já emitido antes** da desativação, reusado depois → bloqueado,
    `"Account is inactive"`.
  - Tentativa de **login novo**, senha correta, conta desativada →
    bloqueado, `"Account is inactive"`.
  - A própria conta desativada tentando se reativar (`PATCH
    is_active=true` no próprio id) → bloqueado (a essa altura o token dela
    já nem passa mais do `requireAuth`, então nem chega na checagem de
    coluna admin-only — bloqueio em duas camadas independentes).
- **Status:** **FIXED**

### SEC-010 — Fluxo de "recuperar senha" é um `alert()` falso

- **Severidade:** P2 (é enganoso pro usuário, mas não abre uma via de
  ataque nova por si só — é ausência de funcionalidade, não uma
  vulnerabilidade explorável)
- **Componente:** `src/pages/Login.tsx`
- **Descrição:** O link "Recuperar senha" chama `e.preventDefault()` e
  mostra `alert('Instruções de recuperação foram enviadas para o seu
  e-mail cadastrado.')` — nenhum e-mail é enviado, nenhum backend é
  chamado. A única forma real de redefinir senha é
  `scripts/provision-user-password.ts`, rodado manualmente por alguém com
  acesso a `DATABASE_URL`.
- **Impacto:** Usuário legítimo trancado pra fora sem saber que precisa
  abrir um chamado; falsa sensação de funcionalidade existente.
- **Correção recomendada:** ou implementar um fluxo real (token de reset
  com expiração curta, enviado por e-mail), ou trocar o link por uma
  mensagem honesta ("Contate o administrador da sua empresa").
- **Por que a mensagem honesta, não o fluxo real:** este projeto não integra
  nenhum provedor de e-mail hoje (nenhum SMTP/SendGrid/Resend/nodemailer em
  lugar nenhum do código — confirmado por busca). Implementar reset por
  e-mail de verdade exigiria escolher e configurar um provedor externo
  (decisão de produto/custo, não um patch de segurança), então a correção
  desta rodada fecha o problema real (o link mentir sobre ter enviado algo)
  sem inventar uma dependência nova por conta própria.
- **Correção aplicada:** `src/pages/Login.tsx` — o `alert()` nativo saiu;
  "Recuperar senha" agora mostra um banner inline honesto ("Recuperação
  automática de senha ainda não está disponível. Entre em contato com o
  administrador da sua empresa ou com o suporte ATHOS para redefinir sua
  senha."), no mesmo padrão visual do banner de erro de credenciais já
  existente na tela.
- **Teste de regressão (executado após a correção):** clique em "Recuperar
  senha" → banner inline aparece, sem travar a página com um `alert()`
  nativo; login normal testado logo em seguida, funcionando sem
  interferência do novo estado (`infoMsg` é limpo a cada tentativa de
  login). `npm run test` → 25/25 passando.
- **Status:** **FIXED**

---

### SEC-012 — RLS morto (Banco de Dados): defesa em profundidade real

- **Severidade:** P1 (arquitetural — não era um P0 explorável isoladamente,
  já que a camada de aplicação (`rest.ts`) já bloqueava tudo que foi testado;
  o risco era "um bug futuro no filtro do app = vazamento total, sem
  segunda camada")
- **Componente:** Supabase Postgres (roles/policies) + `server/api/db.ts` +
  `server/api/rest.ts`
- **Descrição:** A API conectava só com `postgres.<projeto>` (role com
  `BYPASSRLS`, dono das tabelas) — toda policy de RLS já escrita nas
  migrations (`20260813150000_require_authenticated_rls.sql` e outras) era
  código morto, sem nenhum efeito prático.
- **Correção aplicada:**
  1. Migration `20260828030000_real_rls_defense_in_depth.sql`: cria a role
     `athos_app_rw` (login, **sem** `BYPASSRLS`, senha fora do arquivo
     versionado — substituída em tempo de aplicação via
     `ATHOS_APP_RW_PASSWORD`), com grants explícitos, e reescreve as
     policies de RLS de ~24 tabelas pra ler duas GUCs de sessão
     (`app.client_id`, `app.is_admin`) espelhando exatamente o mapeamento
     `DIRECT_TENANT_COLUMN`/`ASSET_LINKED_COLUMN`/`OCCURRENCE_LINKED_COLUMN`
     já usado em `rest.ts`.
  2. `server/api/db.ts` ganhou `withTenantContext()`: abre uma transação na
     conexão restrita, define `app.client_id`/`app.is_admin` via
     `set_config(..., true)` (escopo `SET LOCAL`, reseta sozinho no
     commit/rollback — não vaza pra outra requisição que reuse a conexão do
     pool depois), roda a query, comita.
  3. `server/api/rest.ts`: as 4 queries de dado do proxy genérico (GET/
     POST/PATCH/DELETE) passaram a rodar dentro de `withTenantContext`, na
     conexão restrita — não mais na `pool` superusuária. (`DATABASE_URL`/
     `DIRECT_URL` continuam existindo, sem mudança, pra login, resolução de
     auth, `gt06-listener`, `brgps-sync` e migrations — gateways internos
     confiáveis por design já documentado no projeto.)
  4. Nova variável `APP_DATABASE_URL` no `.env` (não commitado).
- **Bugs reais encontrados e corrigidos no processo** (nenhum dos dois era
  vazamento de dado — os dois falhavam fechado, com `"Internal error"`, não
  abrindo acesso indevido; ainda assim, quebravam funcionalidade legítima
  pra usuários não-admin):
  - **`maintenance_records`** nunca teve `client_id`/`unit_id` no schema
    real — só `vehicle_id`. A correção original de SEC-002 tinha assumido
    (por leitura errada das migrations, não confirmada contra o banco) que
    a tabela era `client_id`-direto. Corrigido: agora está em
    `ASSET_LINKED_COLUMN` (via `vehicle_id`), igual `trip_records`.
  - **`system_integrations`** não tem nenhuma coluna de tenant (nem direta
    nem via asset) e guarda `api_key` de integrações (GT06/REST/MQTT/
    Webhooks/BLE) — mesmo erro de mapeamento. Corrigido: movida pra
    `ADMIN_ONLY_READ_TABLES` (bloqueia leitura **e** escrita pra
    não-admin, já que tem credencial sensível, não só "sem tenant").
  - Causa raiz de ambos: o mapeamento original foi construído lendo texto
    de migrations, não consultando `information_schema.columns` do banco
    real — que está em alguns pontos dessincronizado dos arquivos
    versionados (ver também: tabela `animals` nunca tinha sido aplicada
    neste banco antes desta sessão — migration existia, nunca rodou; a
    RLS real só foi possível depois de aplicá-la).
- **Bug de sintaxe SQL descoberto e corrigido durante os testes:** a
  primeira versão das policies usava
  `client_id = current_setting('app.client_id', true)::uuid` dentro de um
  `OR`. Postgres não garante short-circuit nesse padrão especificamente com
  cast — mesmo com `app.is_admin = 'true'` (lado esquerdo do OR), o banco
  tentava avaliar `''::uuid` (client_id vazio de admin) e estourava
  `invalid input syntax for type uuid`. Corrigido comparando como texto
  (`client_id::text = current_setting(...)`), sem cast nenhum — elimina o
  erro estruturalmente, não só evita o caso admin.
- **Teste de regressão (executado após a correção — todos ao vivo, contra o
  banco real):**
  - **Prova direta, sem passar por `rest.ts` nem uma vez** (conexão raw com
    `athos_app_rw`, via `APP_DATABASE_URL`):
    - Sem `app.client_id` definido → `select count(*) from assets` = **0**.
    - `app.client_id` = São João (não é dono do asset existente) → **0**.
    - `app.client_id` = tenant dono do asset → **1** (correto).
    - `UPDATE company_clients set name='HACKED' where code='ZAFARI'`, sessão
      autenticada como São João → **0 linhas afetadas**.
    - `app.is_admin = 'true'` → vê as 3 empresas (Zafari, São João, ATHOS
      Track Demo).
  - **Ponta a ponta pela API real** (login → JWT → `/rest/*`): `VIEWER` do
    tenant demo lê `assets`/`company_clients` corretamente escopado; recebe
    403 em `system_integrations`; cria um `maintenance_records` vinculado a
    um asset do próprio tenant com sucesso.
  - `npm run test` → 25/25. App testado no navegador (login, dashboard,
    mapa, realtime) — funcionando normalmente com a nova camada ativa.
  - Todos os dados de teste (usuário, registro de manutenção) removidos em
    seguida; Zafari/São João **não** são dados de teste — foram criados a
    pedido explícito (seção 1 do prompt de multi-tenant) e permanecem.
- **Status:** **FIXED**
- **Limitação residual:** RLS cobre só `client_id` — não replica o escopo
  por `unit_id` que `rest.ts` já faz (SEC-006). Aceito conscientemente: o
  objetivo da segunda camada é impedir o vazamento mais grave (entre
  empresas diferentes), não ser uma cópia exata da lógica de aplicação.

---

## GATE FINAL

Resposta objetiva por área, conforme a estrutura pedida no prompt mestre
(seção 35). Onde a área foi genuinamente testada e corrigida nesta sessão,
a resposta é PASS/FAIL. Onde a área **não foi tocada nesta sessão**
(nenhum teste, nenhuma correção — só o levantamento superficial do
`ATTACK-SURFACE.md`, quando houve), isso está dito explicitamente: marcar
PASS ali seria inventar cobertura que não existe (regra de honestidade
técnica, seção 37 do prompt mestre).

| Área | Resultado | Base |
|---|---|---|
| **AUTENTICAÇÃO** | **PASS** | Login, bcrypt, rate limiting (SEC-007), revogação de sessão (SEC-008), conta desativável (SEC-009) e mensagem honesta de recuperação de senha (SEC-010) — todos testados ao vivo. Residual conhecido: sem fluxo real de reset por e-mail (precisa de provedor externo, decisão de produto) e sem MFA (nunca implementado, nunca reivindicado). |
| **AUTORIZAÇÃO** | **PASS** | Escalada de privilégio vertical bloqueada e testada (SEC-005); colunas/tabelas admin-only aplicadas e testadas. Residual conhecido: dentro do mesmo tenant/unidade, `VIEWER`/`OPERATOR`/`FLEET_MANAGER`/`CART_MANAGER`/`ASSET_MANAGER` continuam com o mesmo nível de leitura/escrita entre si — não há RBAC granular por operação além da distinção admin vs. não-admin. |
| **ISOLAMENTO MULTI-TENANT** | **PASS** | Testado ao vivo com 2 tenants reais criados e removidos (SEC-002); as 8 tabelas residuais fechadas (SEC-011). |
| **ISOLAMENTO ENTRE UNIDADES** | **PASS** | Testado ao vivo com 2 unidades reais no mesmo tenant (SEC-006). Residual: `greylist_entries`, `asset_recovery_cases`, `asset_pairings` têm `client_id` mas não `unit_id` no schema — escopadas só por empresa. |
| **BANCO DE DADOS** | **PASS (parcial)** | RLS real implementado (SEC-012, ver detalhe abaixo) e provado em produção com testes que não passam por `rest.ts` nenhuma vez. Residual: TLS pro banco usa `rejectUnauthorized:false`; backups/retenção/teste de restore não verificados (fora do repositório, painel do Supabase); RLS cobre só `client_id` (empresa), não `unit_id` — mesma decisão de escopo do SEC-006/011. |
| **API SECURITY** | **PASS (parcial)** | BOLA/BFLA/mass assignment/vazamento de schema no proxy `/rest` corrigidos e testados (SEC-001/002/004/005/006/011). **Não testado/não corrigido:** rate limiting nos endpoints `/rest/*` (só `/auth/login` tem — um `GET /rest/assets` sem filtro ainda devolve a tabela inteira de uma vez, sem paginação, dentro do próprio tenant); fuzzing sistemático de parâmetros. |
| **WEBHOOK SECURITY** | **N/A** — não existe endpoint de webhook inbound nesta aplicação. O sistema recebe telemetria via protocolo TCP binário próprio (GT06, seção 9 do `ATTACK-SURFACE.md`) e consome a API do BRGPS via chamadas HTTP outbound — nenhum dos dois é um webhook no sentido do prompt mestre (endpoint HTTP que aceita eventos de terceiros por assinatura). |
| **TAG/LICENSING SECURITY** | **FAIL** | Confirmado no `ATTACK-SURFACE.md`: não existe máquina de estados de licença (`pending`/`active`/`suspended`/`revoked`) nem limite contratado por tenant no schema atual. `provider_devices.status` (`UNASSIGNED`/`ASSIGNED`) é vínculo técnico BRGPS↔asset, não controle comercial. Não corrigido nesta sessão — não foi pedido e é uma feature nova, não um patch de segurança num mecanismo já existente. |
| **SECRETS** | **PASS (parcial)** | `.env` fora do Git, `.gitignore` correto, nenhum secret hardcoded encontrado em `src/`/`server/` nas buscas feitas, token BRGPS não vaza no bundle (sem prefixo `VITE_`). **Não executado:** varredura do histórico completo do Git (`git log -p`/gitleaks/trufflehog) atrás de segredo commitado e removido depois — item pendente desde o `ATTACK-SURFACE.md`, nunca rodado. |
| **DEPENDÊNCIAS** | **PASS** | `npm audit` em 0 vulnerabilidades, antes e depois de adicionar `express-rate-limit`. Não fiz checagem de typosquatting/pacotes abandonados além do que o `npm audit` cobre. |
| **FRONTEND** | **NÃO TESTADO** | Não gerei o build de produção nem inspecionei o bundle final por secrets/source maps/stack traces expostos nesta sessão. |
| **MOBILE** | **N/A** | Não há aplicativo Android/iOS neste repositório — é uma SPA web (Vite/React), sem diretório `android/`/`ios/` nem dependência de React Native/Capacitor. |
| **INFRAESTRUTURA** | **NÃO TESTADO** | `CORS_ORIGIN` real em produção (Railway) não é verificável a partir do repositório — os próprios docs do projeto (`docs/deploy/RAILWAY_VERCEL.md`) sugerem usar `*` "temporariamente", sem confirmação de que isso foi trocado depois. Headers de segurança HTTP em produção, configuração de rede/portas no Railway/Vercel: fora do alcance desta sessão (sem acesso aos dashboards). Não há Docker neste projeto (sem Dockerfile) — item "containers" do prompt mestre é N/A aqui. |
| **LOGS/AUDITORIA** | **FAIL** | Esta sessão adicionou logging pontual (`console.error` em falhas de auth/autorização), mas não existe uma trilha de auditoria estruturada e persistida (quem/o quê/quando/tenant/unidade) para eventos críticos (mudança de role, ativação/revogação de sessão, alteração administrativa) — os logs de `console.error` vão pro stdout do processo, não pro banco, e não são consultáveis depois de um restart/redeploy. |
| **LGPD** | **NÃO TESTADO** | O mapeamento de dados pessoais coletados/finalidade/retenção/exclusão (seção 16 do prompt mestre) não foi feito nesta sessão. |
| **BACKUP/RECOVERY** | **NÃO TESTADO** | Configuração de backup do Supabase é do painel, fora deste repositório — não verificada. |
| **PROPRIEDADE INTELECTUAL / LICENCIAMENTO** | **NÃO TESTADO** | Nenhuma auditoria técnica de proteção de PI (ofuscação de bundle, enforcement de licença de uso) foi feita além do gap já registrado em TAG/LICENSING SECURITY. |

### RESULTADO FINAL: **FAIL**

Não por causa de nenhum P0 aberto — **todos os P0 confirmados nesta sessão
foram corrigidos e testados ao vivo** (SEC-001, 002, 003, 005), e o Banco de
Dados saiu de FAIL pra PASS (SEC-012, RLS real com prova independente do
código da aplicação). O motivo do FAIL é que o critério de aprovação do
prompt mestre (seção 36) exige cobertura documentada em todas as frentes, e
**5 áreas nunca foram tocadas nesta sessão** (Frontend; Infraestrutura;
LGPD; Backup/Recovery; Propriedade Intelectual), **uma ficou parcial**
(Logs/Auditoria) e **uma foi identificada como gap real e não corrigida**
(Tag/Licensing Security).

**Bloqueadores exatos para um PASS completo:**
1. **TAG/LICENSING SECURITY** — implementar a máquina de estados de licença
   server-side (hoje não existe no schema).
2. **FRONTEND** — auditar o bundle de produção por secrets/source maps.
3. **INFRAESTRUTURA** — confirmar `CORS_ORIGIN` e headers de segurança reais
   no ambiente de produção (Railway/Vercel), fora do alcance deste
   ambiente local; confirmar backup/restore no painel do Supabase.
4. **LOGS/AUDITORIA** — trilha de auditoria persistida e consultável, não
   só `console.error` de processo.
5. **LGPD** e **PROPRIEDADE INTELECTUAL** — nunca auditados nesta sessão.

Nenhum destes bloqueadores invalida o que já foi corrigido — SEC-001 a
SEC-012 (exceto SEC-010, que também foi corrigido — só a numeração seguiu a
ordem cronológica) estão fechados, testados ao vivo, com regressão
confirmada (`npm run test`, 25/25, mais os testes manuais no navegador).
Eles definem o que falta pra fechar o gate por completo, não um retrocesso
no que já foi feito.

### Limitações desta auditoria (honestidade técnica, seção 37)

- Nada aqui foi testado contra o ambiente de **produção** real (Railway/
  Vercel) — tudo rodou contra a API local (`localhost:4000`) apontando pro
  mesmo banco Supabase que a produção usa. Configuração específica de
  produção (env vars, headers, CDN, WAF) não foi verificada.
- Os testes de isolamento usaram dados de teste criados e removidos na
  hora — não há garantia formal de que um cenário com volume real de dados
  (milhares de linhas, múltiplos tenants simultâneos) não revele um caso de
  borda não coberto.
- Não houve pentest de infraestrutura (portas, firewall, IAM cloud), nem
  fuzzing automatizado, nem mutation testing dos testes existentes (seções
  21/22 do prompt mestre) — o `npm run test` que passou (25/25) cobre só o
  protocolo GT06 e o mapper do BRGPS, nada dos novos mecanismos de
  autorização desta sessão tem teste automatizado ainda, só verificação
  manual ao vivo.
- "PASS" nas áreas acima significa "os cenários de ataque específicos que
  testei foram bloqueados" — não significa "impossível de invadir" ou
  "100% seguro". Segurança absoluta não existe; isto é o que foi verificado,
  como foi verificado, e o que ainda falta verificar.
