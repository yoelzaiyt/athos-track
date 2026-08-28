# ATHOS TRACK — Homologation Readiness Report

> Gerado em: 2026-08-28. Continuação de `PRODUCTION-DEPLOY-REPORT.md`
> (frontend já publicado na Vercel) — esta rodada tentou publicar o
> backend real no Railway e transformar o ambiente numa vitrine funcional
> completa.

---

## GATE FINAL

```
BACKEND PUBLICADO:          FAIL   (bloqueado na Fase 2 — Railway não autenticado neste ambiente)
VERCEL → BACKEND:           FAIL   (depende do item acima — continua apontando pro placeholder)
BRCPS REAL:                 PASS   (testado ao vivo contra o backend local — ver Fase 8)
AUTH:                       PASS   (3 contas de homologação reais criadas e testadas)
ATHOS CENTRAL:               PASS COM RESSALVA (funcional localmente; inacessível publicamente sem backend)
SÃO JOÃO:                    PASS COM RESSALVA (idem)
GRUPO ZAFFARI:                PASS COM RESSALVA (idem — e é o tenant com o dispositivo BRGPS real)
TENANT ISOLATION BACKEND:   PASS   (10/10 ataques cruzados bloqueados, testado ao vivo — ver Fase 7)
SECURITY:                   PASS COM RESSALVA (ver Fase 10 — 2 gaps não-bloqueadores encontrados)
TESTS:                      PASS   (52/52, lint limpo, build limpo, 0 vulnerabilidades)

HOMOLOGAÇÃO/VITRINE:        NOT READY  — backend não está publicamente acessível
PRODUÇÃO COMERCIAL:         NOT READY  — depende da vitrine, mais os itens da Fase 11 do relatório anterior
```

**Por que "NOT READY" apesar de quase tudo estar PASS**: o objetivo desta
rodada era especificamente sair de "frontend publicado sozinho" pra
"vitrine funcional com backend público" — e isso não aconteceu, porque o
Railway não está autenticado neste ambiente (Fase 2, bloqueio explícito
pedido no prompt: "PARAR SOMENTE NESTA ETAPA"). Tudo que **não** depende
de um backend publicamente acessível foi executado, testado ao vivo, e
está documentado abaixo — não é um "quase fiz", é trabalho real
completo, só que o último elo (publicar o processo em algum lugar que a
Vercel alcance) precisa de uma ação sua.

---

## O que preciso de você pra fechar isto

O Railway CLI está instalado neste ambiente mas **sem sessão autenticada**
(`railway whoami` → `Unauthorized`). Duas formas de resolver, sua escolha:

1. **Você mesmo autentica**: digite `!railway login` no prompt (o `!`
   roda o comando aqui diretamente) — abre um fluxo OAuth no navegador.
   Depois disso eu consigo criar o serviço, publicar e trazer a URL real.
2. **Me passa um token**: gera um token em
   `railway.app` → configurações da conta → Tokens, e me manda o valor —
   eu uso `RAILWAY_TOKEN`/`railway login --browserless` sem precisar de
   interação sua no navegador.

Sem um dos dois, não dá pra publicar o backend em lugar nenhum — e,
conforme pedido explicitamente no prompt, **não troquei o Railway por
outro provedor por conta própria**.

---

## FASE 0 — Preservação (inspeção, nada alterado)

| Item | Achado |
|---|---|
| Frontend | React 19 + Vite 6 + TS, `src/` — SPA, já publicada na Vercel (`PRODUCTION-DEPLOY-REPORT.md`) |
| Backend | Express 4 + `tsx` (roda TS direto, sem passo de compilação), `server/api/` — processo standalone, não framework full-stack |
| Arquitetura | 3 serviços Railway separados: `api` (HTTP+Socket.IO), `brgps-sync` (worker de polling), `gt06-listener` (TCP) — `railway.api.json`/`railway.brgps-sync.json`/`railway.gt06-listener.json`, cada um com seu próprio `startCommand` |
| `vercel.json` | Corrigido numa rodada anterior (`c748a57`) depois que `vercel link` tinha sobrescrito com um `buildCommand` quebrado — confirmado íntegro nesta rodada, nenhuma alteração necessária |
| Variáveis usadas | `VITE_API_URL` (frontend, confirmado no código — `src/lib/supabaseClient.ts:14`, não é suposição); `DATABASE_URL`/`APP_DATABASE_URL`/`JWT_SECRET`/`CORS_ORIGIN`/`BRGPS_*` (backend) |
| Autenticação | JWT próprio (`jsonwebtoken`) + `bcryptjs`, sessão revogável (`session_version`), rate limit em `/auth/login` — não é Supabase Auth (substituído numa rodada anterior) |
| Banco | Postgres do Supabase (`aws-0-sa-east-1.pooler.supabase.com`), acessado direto via `pg`, RLS real em segunda camada (`athos_app_rw`, sem `BYPASSRLS`) |
| Integração BRCPS | Real, funcional, **não recriada nem substituída** — `server/integrations/brgps/`, 3 aliases (`brgps`/`heile`/`jason`) resolvendo pro mesmo `BrgpsProvider` |
| Multi-tenant | `company_clients`/`company_units` + `client_id`/`unit_id` em todas as tabelas de dado — RBAC granular por papel (5 níveis), testado exaustivamente em rodadas anteriores desta sessão |

**Nenhuma inconsistência nova encontrada na inspeção** além do que já
estava documentado nos relatórios anteriores desta sessão (`ATTACK-SURFACE.md`,
`SECURITY-GATE-REPORT.md`, `RBAC-SECURITY-GATE.md`,
`FINAL-PRE-PRODUCTION-GATE.md`).

---

## FASE 1 — Backend publicável (correções aplicadas)

| Item pedido | Estado antes | Ação |
|---|---|---|
| Comando real de start | Já era real (`npm run api:start` → `tsx server/api/index.ts`) | Nenhuma — confirmado, **não é placeholder** apesar do `buildCommand` de `railway.api.json` conter `echo` (isso é correto: essa etapa só *builda*, e o serviço da API não precisa de build — `tsx` roda TS direto; o `echo` só pula o build do *frontend*, que não é usado por este serviço) |
| PORT do Railway | Já lia `process.env.PORT` corretamente | Nenhuma |
| Bind em 0.0.0.0 | Implícito (Node já faz isso por padrão sem host explícito) | Tornado **explícito** (`httpServer.listen(PORT, '0.0.0.0', ...)`) — remove qualquer ambiguidade |
| `GET /health` | Existia, devolvia `{ok:true}` | Agora devolve `{status:'ok', ok:true}` — bate com o formato pedido nesta rodada, mantém compatibilidade |
| `GET /providers/health` (agregado) | **Não existia** — só `/providers/:providerId/health` | Criado (`server/api/routes-providers.ts`) — lista health de todos os providers registrados |
| `GET /providers/brgps/health` | Já existia e funcionava | Confirmado, sem alteração |
| Shutdown gracioso | **Não existia** — sem handler de SIGTERM/SIGINT, um redeploy do Railway cortaria requisições em voo e a conexão com o Postgres abruptamente | Adicionado (`server/api/index.ts` + `closeDbPools()` novo em `server/api/db.ts`) — para de aceitar conexão nova, deixa requisições em voo terminarem, fecha as pools do banco, timeout de segurança de 10s |
| Logs | Já existiam (`console.log`/`console.error` estruturados) | Sem alteração — adequados |
| CORS restritivo | `CORS_ORIGIN` só suportava 1 origem | Agora aceita lista separada por vírgula (múltiplos domínios/previews) — necessário pra Fase 5 |
| Dependência de `localhost` | Nenhuma encontrada no código do backend (só em comentários explicando comportamento de dev) | Nenhuma ação necessária |

Reexecutado depois das mudanças: `npm run lint` limpo, `npm run test`
52/52, `npm run build` limpo, `npm audit` 0 vulnerabilidades. Servidor
local reiniciou sozinho (`tsx watch`) e `/health`/`/providers/health`
testados ao vivo com sucesso.

---

## FASE 2 — Publicação do backend: 🛑 BLOQUEADA

`railway whoami` → `Unauthorized. Please login with railway login`. Sem
sessão Railway autenticada neste ambiente. **Não publiquei em nenhum
provedor** (nem Railway, nem substituto) — ver "O que preciso de você"
no topo deste relatório.

---

## FASE 3 — Secrets (mapeamento, sem imprimir valor nenhum)

| Variável | Estado |
|---|---|
| `BRGPS_API_TOKEN` | **CONFIGURADO** |
| `DATABASE_URL` | **CONFIGURADO** |
| `APP_DATABASE_URL` | **CONFIGURADO** |
| `JWT_SECRET` | **CONFIGURADO** |
| `CORS_ORIGIN` (local) | CONFIGURADO — `http://localhost:3000` (correto pra dev; precisa virar a URL real da Vercel quando o backend for publicado) |
| `BRGPS_BASE_URL` | CONFIGURADO — `http://www.brgps.com/open` |
| `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` | presentes mas **não usadas** pelo código (dead config, já documentado em `RBAC-SECURITY-GATE.md`) |

Nenhum destes tem prefixo `VITE_` (exceto os dois já identificados como
não usados/públicos por natureza) — nenhum segredo real vai pro bundle do
frontend. Confirmado por grep no bundle de produção já gerado
(`FINAL-PRE-PRODUCTION-GATE.md`/`RBAC-SECURITY-GATE.md`): nenhuma string
de token aparece no JS publicado.

---

## FASE 4 — Vercel → Backend

**Bloqueada** (depende da Fase 2). Confirmado no código: a variável real
é `VITE_API_URL` (`src/lib/supabaseClient.ts:14`), não uma suposição —
já está configurada na Vercel (rodada anterior) apontando pra um
placeholder inválido de propósito (`https://athos-track-api-not-deployed.example.invalid`).
Assim que existir uma URL pública real, é só `vercel env rm VITE_API_URL
production && vercel env add VITE_API_URL production --value <URL-real>`
e `vercel deploy --prod` de novo.

---

## FASE 5 — CORS

Código já corrigido nesta rodada pra suportar múltiplas origens (Fase 1).
**Validação ao vivo browser → backend não é possível** sem o backend
publicado — o teste real (não `*`, checar preflight, checar erro
apropriado de origem não autorizada) fica pendente pra quando a Fase 2 se
resolver. Localmente, `CORS_ORIGIN=http://localhost:3000` já é restritivo
(não `*`), consistente com o pedido de não usar `*` sem necessidade
técnica.

---

## FASE 6 — Autenticação de homologação

3 contas reais criadas em `user_profiles` (mecanismo de auth real do
projeto — bcrypt + JWT, não é frontend fake), senha idêntica pra
facilitar (identificada como homologação em nome e e-mail):

| Contexto | E-mail | Papel | Tenant |
|---|---|---|---|
| ATHOS Central | `homologacao.central@athostrack.com.br` | `ATHOS_ADMIN` | todos |
| São João | `homologacao.saojoao@athostrack.com.br` | `CLIENT_ADMIN` (TENANT_ADMIN) | São João, somente |
| Grupo Zaffari | `homologacao.zaffari@athostrack.com.br` | `CLIENT_ADMIN` (TENANT_ADMIN) | Grupo Zaffari, somente |

**Senha (as 3 contas): `Homolog@Athos2026`** — credencial de homologação,
não é secret de infraestrutura, então informada aqui conforme pedido.

Funcionam **hoje contra o backend local** (`localhost:4000`, rodando
nesta sessão) — não contra a Vercel, pelo mesmo motivo já documentado em
`PRODUCTION-DEPLOY-REPORT.md`.

---

## FASE 7 — Teste de isolamento (backend, ao vivo, com as contas reais)

10 tentativas deliberadas de acesso cruzado, batendo direto na API
(nunca só na URL) — alterando `client_id`/query params/payload/headers:

| # | Ataque | Resultado |
|---|---|---|
| ISO-01 | São João: `GET /rest/assets?eq_client_id=<Zaffari>` | Bloqueado — `[]` |
| ISO-02 | São João: `GET /rest/company_clients?eq_id=<Zaffari>` | Bloqueado — `[]` |
| ISO-03 | São João: `PATCH company_clients` de Zaffari | Bloqueado — 403 |
| ISO-04 | São João: headers `X-Tenant-Id`/`X-Client-Id` forjados = Zaffari | Ignorado pela API (não são headers que a API lê pra decidir tenant — só o JWT decide) |
| ISO-05 | São João: `POST /rest/assets` com `client_id=<Zaffari>` no corpo | Bloqueado — 403, "Cannot set client_id to a different tenant" |
| ISO-06 | São João: `GET /rest/user_profiles?eq_client_id=<Zaffari>` | Bloqueado — `[]` |
| ISO-07 | Zaffari: `GET /rest/assets?eq_client_id=<São João>` | Bloqueado — `[]` |
| ISO-08 | Zaffari: `GET /rest/company_units?eq_client_id=<São João>` | Bloqueado — `[]` |
| ISO-09 | Zaffari: `PATCH` em massa tentando desativar usuários de São João | Bloqueado — `[]` afetadas |
| ISO-10 | Zaffari: `GET /rest/company_clients` sem filtro | Só devolve a própria linha |

**10/10 bloqueados.** Isolamento validado no **backend**, não só na URL —
exatamente como pedido ("não considerar isolamento de URL suficiente").
Nenhum dado de teste residual (confirmado por query direta depois).

---

## FASE 8 — BRCPS real (somente leitura)

Nenhuma escrita no fornecedor, nenhuma ativação, nenhuma alteração de
dispositivo — só health e consultas via o fluxo já existente.

- `GET /providers/brgps/health` → `HEALTHY`, 389 requisições históricas.
- `GET /providers/health` (novo endpoint desta rodada) → mesmo resultado, formato agregado.
- `GET /rest/provider_devices` (leitura) → **2 dispositivos reais conhecidos**: 1 `UNASSIGNED` (nunca vinculado a um asset), 1 `ASSIGNED` (vinculado a um ativo real, "Carrinho BRGPS 3092524777").
- `npm run brgps:sync-once` (1 ciclo real de sincronização, leitura no fornecedor + gravação só no nosso banco — não altera nada do lado do fornecedor): **posição real recebida e aplicada** pro dispositivo `ASSIGNED` — confirmado com timestamp fresco (`telemetry_last_communication` a poucos segundos da execução).

**Diferenciação pedida, com evidência real**:
- API acessível: ✅ sim (`GET /tag` devolveu 200).
- Provider saudável: ✅ sim (`HEALTHY`, 0 erros neste ciclo).
- Credencial válida: ✅ sim (sem erro de autenticação).
- Timeout: não ocorreu.
- Erro ATHOS: não ocorreu (nenhum erro do nosso lado).
- **Dispositivo "offline"**: o asset vinculado mostra `status: offline` no nosso sistema — mas isso é sobre o **último sinal de GPS do dispositivo físico** (`telemetry_packet_timestamp` ~27min mais antigo que o momento da consulta), não sobre a integração: a API do fornecedor respondeu com dados válidos e atualizados pro mesmo dispositivo. São coisas diferentes, tratadas como tal — não classifiquei automaticamente como "falha da integração".

---

## FASE 9 — Validação dos links (parcial)

Só o que **não depende de login real** pôde ser testado contra a Vercel
publicada (sem backend): shell carrega, roteamento por tenant funciona
(`/sao-joao`, `/grupo-zaffari`), erro de rede tratado sem crash — tudo já
documentado em `PRODUCTION-DEPLOY-REPORT.md`, não re-testado do zero
nesta rodada (nada mudou no frontend publicado desde então). Login,
dashboard, dados, sessão expirada, acesso cruzado **contra a URL pública**
continuam bloqueados até a Fase 2 se resolver — mas foram todos
re-validados contra o **backend local** nesta rodada (Fase 6/7) e em
`UI-E2E-VALIDATION.md`.

---

## FASE 10 — Pente-fino (auditoria módulo a módulo)

| Módulo | Classificação | Nota |
|---|---|---|
| Painel Central | PASS COM RESSALVA | Funcional, dado real; alguns gráficos do Dashboard não foram individualmente re-auditados além do já corrigido (`FINAL-PRE-PRODUCTION-GATE.md`) |
| São João | PASS COM RESSALVA | Caixas/Ativos funcionais; 0 ativos reais ainda (estado real do tenant, não bug) |
| Grupo Zaffari | PASS | Carrinhos/Ativos funcionais; **tem o único dispositivo BRGPS real ASSIGNED** |
| Autenticação | PASS | bcrypt, rate limit, sessão revogável, testado exaustivamente |
| Usuários | PASS | CRUD real, TENANT_ADMIN administra próprio tenant (RBAC round) |
| Tenants (admin) | PASS | CRUD completo (`ClientsPage.tsx`) |
| Ativos | PASS | — |
| Carrinhos | PASS | — |
| Caixas | PASS | Corrigido em rodada anterior (não existia entrada de menu) |
| Tags/Dispositivos | PASS | Dado real do BRGPS confirmado nesta rodada |
| Mapas/Geofences | PASS | Crash de lat/lng nulo já corrigido |
| Alertas | PASS | — |
| Histórico | PASS | Corrigido em rodada anterior (não existia entrada de menu) |
| Relatórios | PASS COM RESSALVA | Dado real (corrigido); exportação PDF/Excel **INCOMPLETO** (desabilitada honestamente, não implementada) |
| Providers | PASS | Aliases corretos, health real, endpoint agregado novo |
| API | PASS COM RESSALVA | Bem protegida e testada; sem rate limit em `/rest/*` (só `/auth/login`) |
| Dashboards | PASS COM RESSALVA | — |
| Módulo Bovinos/Agro | NÃO INICIADO | Conforme instrução explícita desta rodada |

### Checklist de segurança/qualidade (achados novos desta rodada)

- **Headers de segurança HTTP**: **INCOMPLETO** — nenhum middleware tipo
  `helmet` nem headers manuais (`X-Content-Type-Options`,
  `Strict-Transport-Security` etc.) no backend. Não corrigido nesta rodada
  (fora do escopo pedido, e instalar uma dependência nova não pedida
  explicitamente às vésperas de publicar merece confirmação sua antes).
- Todos os outros itens do checklist (código duplicado, imports mortos,
  secrets, RBAC, IDOR, XSS, injection, exposição de stack trace, CORS,
  dependências vulneráveis, tratamento de erros) — **sem achado novo**
  além do que já está documentado em `FINAL-PRE-PRODUCTION-GATE.md` e
  `RBAC-SECURITY-GATE.md` (rate limiting em `/rest/*` e imports mortos
  pré-existentes continuam como pendência conhecida, não reintroduzidos
  nem agravados nesta rodada).

---

## FASE 11 — Testes

- `npm run lint`: PASS
- `npm run test`: 52/52 PASS
- `npm run build`: PASS
- `npm audit`: 0 vulnerabilidades
- Nenhum teste alterado, removido ou ignorado.

---

## Arquivos alterados nesta rodada

```
server/api/index.ts        — bind 0.0.0.0 explícito, /health no formato pedido,
                              CORS multi-origem, shutdown gracioso (SIGTERM/SIGINT)
server/api/db.ts           — closeDbPools() exportado (usado pelo shutdown)
server/api/routes-providers.ts — GET /providers/health (agregado, novo)
```

**Motivo**: Fase 1 deste prompt (backend publicável no Railway) — nenhuma
dessas mudanças altera comportamento pra quem já usa a API hoje, só
adiciona robustez de infraestrutura (shutdown, bind explícito, CORS mais
flexível) e um endpoint novo que só soma.

**Testes executados**: `npm run lint`, `npm run test` (52/52), `npm run
build`, `npm audit` — todos depois das mudanças, todos passando.

**Não commitei/dei push** — não é estritamente necessário pro fluxo
autorizado até agora (o deploy real do backend, que dependeria de Git, está
bloqueado na Fase 2). Aguardando sua confirmação, igual à rodada anterior.

---

## Pendências antes de produção comercial

Herdadas de `FINAL-PRE-PRODUCTION-GATE.md` (não re-abordadas nesta
rodada, fora do escopo): TAG/LICENSING SECURITY, LGPD, backup/recovery,
propriedade intelectual, exportação PDF/Excel, mapa escuro sem chave
Stadia em produção, headers de segurança HTTP, rate limiting em `/rest/*`,
GT06 sem dedup/timestamp guard (`MULTI-PROVIDER-VALIDATION.md`).

Novas desta rodada: publicar o backend (Railway), depois repetir a Fase 9
inteira (validação de link ao vivo) contra a URL pública de verdade.
