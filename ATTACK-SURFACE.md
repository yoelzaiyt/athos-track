# ATHOS TRACK — Attack Surface & Inventário Técnico (Fase 1)

> **Status:** FASE 1 — Inventário e mapeamento de superfície de ataque.
> **Nenhuma alteração de código de segurança foi feita nesta fase.**
> Único código alterado nesta sessão (fora do escopo desta auditoria, autorizado
> antes deste prompt): `src/components/map/MapProvider.ts` (troca de provedor de
> tiles de mapa, CARTO → OSM/Stadia). Não relacionado a segurança.
>
> Gerado em: 2026-08-28. Auditor: Claude Code (agindo como auditor sênior a
> pedido do responsável técnico do projeto, dono do repositório e do ambiente).

---

## 1. Metodologia desta fase

Esta fase cobriu apenas **inspeção estática de código-fonte, configuração,
histórico Git e schema de banco**. Nenhum teste de exploração (mesmo
não-destrutivo) foi executado contra o ambiente rodando ou o banco Supabase de
produção — isso fica para as fases seguintes, mediante autorização explícita,
idealmente com tenants de teste dedicados (não o banco real que já tem o
usuário `kleberduartesouza@hotmail.com` e o `joel.oliveira@athos.com.br` que
criamos hoje).

Onde a evidência já é conclusiva **só pela leitura do código** (ex.: uma rota
que literalmente não filtra por tenant), classifico a severidade preliminar
mesmo sem teste ao vivo — porque o comportamento é determinístico e não
depende de estado de runtime. Onde a evidência depende de configuração externa
não visível no repo (ex.: valor real de `CORS_ORIGIN` no Railway), marco como
**NÃO VERIFICÁVEL DO REPO — precisa checar no ambiente**.

---

## 2. Inventário técnico

### 2.1 Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + Vite 6 + TypeScript + Tailwind v4 + React Router 7 |
| Mapa | Leaflet 1.9 |
| Backend HTTP | Express 4 (`server/api`), Node + `tsx` |
| Realtime | Socket.IO 4 (servidor e cliente) |
| Banco | PostgreSQL — hoje hospedado no **Supabase** (pooler `aws-0-sa-east-1.pooler.supabase.com`), acessado **diretamente via `pg`**, não via PostgREST/supabase-js |
| Auth | JWT próprio (`jsonwebtoken`) + `bcryptjs`, substituindo Supabase Auth/GoTrue |
| Integrações externas | BRGPS (provedor de tags GPS reais, HTTP) e GT06 (protocolo TCP binário de rastreadores) |
| Deploy | Frontend → Vercel · API/gt06-listener/brgps-sync → Railway (3 serviços separados, ver `railway*.json`) |
| Testes | Vitest (poucos arquivos: `protocol.test.ts`, `BrGpsMapper.test.ts`) |

### 2.2 Histórico relevante (via `git log`)

O projeto migrou **duas vezes** de modelo de autenticação/dados:

1. Commit inicial → mock de login.
2. `a58fb36` — "Replace mock login with real Supabase Auth, tighten RLS to
   authenticated-only" → nesse ponto o banco tinha RLS real, e o Postgres era
   acessado só via PostgREST/supabase-js com roles `anon`/`authenticated`.
3. `c981b79` — "Migrate backend off Supabase to a self-hosted API on Railway +
   Vercel" → **esse é o commit crítico**: trocou o acesso ao Postgres para uma
   conexão direta via `pg.Pool` usando a connection string do usuário
   `postgres.<projeto>` do pooler Supabase (visível em `.env` como
   `DATABASE_URL`/`DIRECT_URL`). Esse usuário é o **superusuário/owner do
   projeto no Supabase e tem `BYPASSRLS`** — ou seja, a partir desse commit,
   **todas as políticas de RLS escritas nas migrations anteriores (inclusive a
   que "apertou" o acesso em `a58fb36`) deixaram de ter qualquer efeito
   prático**, porque a única aplicação que fala com o banco não é mais
   sujeita a RLS.
4. Autorização por tabela/role ficou marcada como **"pra depois"** nos
   próprios comentários do código novo (`server/api/auth.ts`,
   `server/api/rest.ts`) — ver seção 4.

Isso não é uma suspeita — é o estado documentado no próprio código, e dá pra
confirmar por inspeção estática sem precisar rodar nada.

### 2.3 Componentes / processos deployados (superfícies de rede)

| # | Componente | Onde roda | Porta/protocolo | Exposição |
|---|---|---|---|---|
| A | Frontend (SPA estática) | Vercel | HTTPS 443 | **Pública, internet** |
| B | API Express (`server/api`) | Railway (`railway.json`) | HTTP/S, porta do Railway | **Pública, internet** (consumida pelo frontend via `VITE_API_URL`) |
| C | Socket.IO (mesmo processo da API) | Railway, mesmo host da API | WebSocket sobre o mesmo HTTP | **Pública, internet** |
| D | `gt06-listener` (protocolo binário GT06) | Railway (`railway.gt06-listener.json`) | TCP bruto, porta 5023 (padrão), `HOST=0.0.0.0` | **Pública, internet** — é o propósito: rastreadores físicos se conectam de qualquer rede celular |
| E | `brgps-sync` (worker) | Railway (`railway.brgps-sync.json`) | outbound HTTPS para `www.brgps.com` | Não recebe conexões externas, só consome API de terceiro |
| F | Banco Postgres | Supabase (gerenciado) | 5432/6543, TLS | Exposto à internet pelo próprio Supabase (pooler), mitigado por senha; acessado pela API com role com `BYPASSRLS` |
| G | Portal público de homologação (`/homologacao`) | Servido pelo mesmo frontend (A) | HTTPS | **Pública, internet, sem login** — por design, fornecedores externos submetem IMEIs de teste |

### 2.4 Autenticação (visão geral — detalhe na seção 3 do Security Gate)

- Login: `POST /auth/login` (`server/api/routes-auth.ts`) — busca
  `user_profiles.password_hash`, compara com `bcrypt.compare`, emite JWT
  (`server/api/auth.ts`) assinado com `JWT_SECRET`, **validade 7 dias, sem
  mecanismo de revogação/blacklist e sem refresh token separado**.
- "Logout": só remove o token do `localStorage` no cliente
  (`src/lib/supabaseClient.ts`) — não existe endpoint de logout no servidor,
  então um token vazado continua válido pelos 7 dias inteiros mesmo após
  "logout", troca de senha ou desativação do usuário (não encontrei nenhum
  reconhecimento de "usuário desativado" em `requireAuth`).
- "Recuperar senha" na tela de login é **um `alert()` estático** — não existe
  fluxo real de recuperação de senha no backend (ver `src/pages/Login.tsx`).
  A única forma real de trocar senha é via script CLI
  (`scripts/provision-user-password.ts`), rodado por alguém com acesso a
  `DATABASE_URL`.
- Não há MFA em lugar nenhum.
- Não há rate limiting / proteção de força bruta em `/auth/login` (nenhuma
  dependência de rate-limit no `package.json`, nenhum middleware equivalente
  em `server/api/index.ts`).

### 2.5 Autorização / RBAC (visão geral)

- `requireAuth` (`server/api/auth.ts`) só valida que o JWT é válido — **não
  carrega nem checa `role`, `client_id` ou `unit_id` nenhuma vez**.
- `user_profiles.role` existe no schema (`ATHOS_ADMIN`, `CLIENT_ADMIN`,
  `FLEET_MANAGER`, `CART_MANAGER`, `ASSET_MANAGER`, `OPERATOR`, `VIEWER`) mas,
  pela busca feita, **nenhum lugar do backend lê esse campo para decidir se
  uma operação é permitida** — a distinção de papéis parece existir hoje só
  na UI (mostrar/esconder menus), não como controle de acesso real.
- Comentário textual no próprio código (`server/api/rest.ts`, linhas 6–10):
  *"Autorização: mesmo nível que a RLS 'authenticated only' que o projeto já
  tinha (qualquer sessão válida acessa qualquer tabela da lista) — ver
  server/api/auth.ts. Granularidade por role fica pra depois, como já era o
  caso antes desta migração."*

### 2.6 Modelo multi-tenant

- Tenant = `company_clients` (empresa/cliente ATHOS). Sub-unidade =
  `company_units`. A maioria das tabelas de dados (`assets`, `system_alerts`,
  `geofences`, `drivers`, etc.) tem `client_id`/`unit_id` como FK.
- **O modelo de dados prevê isolamento multi-tenant corretamente** (colunas
  certas existem). **O que falta é a aplicação (enforcement) desse isolamento
  em tempo de execução** — nem no banco (RLS bypassada, seção 2.2), nem na
  API (seção 4).

### 2.7 Tags / licenciamento

- Não encontrei uma máquina de estados de licenciamento no sentido pedido
  pelo prompt mestre (`pending` / `active` / `suspended` / `revoked` por tag,
  com limite contratado). O que existe:
  - `provider_devices.status` — `UNASSIGNED` / `ASSIGNED` (vínculo
    dispositivo BRGPS ↔ asset, não é controle comercial de licença).
  - `homologation_devices` / `homologation_requests` — fluxo de
    homologação de fornecedor, não de licenciamento de tags em produção.
  - Não há coluna de quantidade contratada, plano, ou data de expiração de
    licença em `company_clients`/`company_units` no schema atual.
- **Consequência:** mesmo que existisse um campo de status de licença, hoje
  ele seria editável por qualquer usuário autenticado via
  `PATCH /rest/<tabela>` (seção 4) — não há "autoridade final no servidor"
  como o prompt mestre exige.

### 2.8 Armazenamento de secrets

- `.env` na raiz do projeto (não versionado — confirmado por
  `git ls-files | grep env` só retornar `.env.example`; `.gitignore` cobre
  `.env*` corretamente).
- Secrets presentes no `.env` local (mascarados aqui, não reproduzo valores):
  - `DATABASE_URL` / `DIRECT_URL` — senha do Postgres Supabase (usuário
    `postgres.<ref>`, role com bypass de RLS).
  - `JWT_SECRET` — assinatura dos tokens da API própria.
  - `VITE_SUPABASE_ANON_KEY` — **client-side por design** (anon key é
    pública por natureza no modelo Supabase; não é segredo, mas hoje parece
    não ser mais usada já que o app fala com a API própria, não com
    PostgREST — a confirmar).
  - `BRGPS_API_TOKEN` — credencial do provedor de tags físicas, usada só no
    backend (`server/integrations/brgps`), corretamente sem prefixo `VITE_`
    (não vaza no bundle do frontend).
- **Não encontrei secrets hardcoded no código-fonte** (`src/`, `server/`) nas
  buscas feitas até agora — o padrão observado é sempre `process.env.*`.
- **Não busquei ainda no histórico completo do Git** se algum `.env` real foi
  commitado e depois removido (precisa de scan dedicado tipo `git log -p --
  .env` / `trufflehog`/`gitleaks` no histórico inteiro — listado como
  pendência da Fase de secrets, seção 4 abaixo).

### 2.9 Integrações externas

- **BRGPS** (`server/integrations/brgps`): cliente HTTP outbound para
  `www.brgps.com/open`, token via `BRGPS_API_TOKEN`, roda como worker
  separado (`brgps-sync`), grava no banco via `DIRECT_URL`. Não expõe porta.
- **GT06** (`server/gt06-listener`): já detalhado — TCP bruto, autenticação
  do dispositivo é só o IMEI (sem criptografia/assinatura, inerente ao
  protocolo GT06). O próprio comentário do arquivo alerta: *"Não expor este
  processo direto à internet sem revisitar essa decisão"* — mas
  `railway.gt06-listener.json` o deploya como serviço próprio, e a única
  forma de rastreadores reais se conectarem é estar na internet pública.
  Esse é um risco **arquitetural inerente ao protocolo**, não um bug de
  implementação — precisa ser tratado como tal (mTLS/VPN de operadora, IP
  allowlist quando possível, ou aceitar o risco residual e mitigar no
  business-logic, ex.: detecção de teleporte/velocidade impossível).

### 2.10 Realtime (Socket.IO)

- `server/api/realtime.ts`: qualquer INSERT/UPDATE nas tabelas `assets`
  (UPDATE) e `system_alerts` (INSERT) dispara `io.emit(...)` — **broadcast
  global, para todos os sockets conectados, sem checar autenticação nem
  tenant**. Não há `io.use()` validando JWT na conexão do socket
  (confirmado em `server/api/index.ts`, que só faz
  `new SocketIOServer(httpServer, { cors: {...} })`).

---

## 3. Superfícies de ataque identificadas (mapa consolidado)

| ID | Superfície | Autenticação exigida hoje | Observação |
|---|---|---|---|
| AS-01 | `POST /auth/login` | Nenhuma (é o próprio login) | Sem rate limit, sem lockout |
| AS-02 | `GET/POST/PATCH/DELETE /rest/:table` (26 tabelas) | JWT válido de **qualquer** usuário | Sem checagem de tenant/unit/role |
| AS-03 | Socket.IO `io.emit(postgres_changes:*)` | **Nenhuma** | Broadcast global de `assets`/`system_alerts` |
| AS-04 | TCP GT06 (porta 5023) | IMEI apenas (sem cripto) | Superfície de spoofing inerente ao protocolo |
| AS-05 | Portal público `/homologacao` | Nenhuma (por design) | Fluxo de submissão possivelmente quebrado pós-migração (ver 2.4/2.9) — a confirmar |
| AS-06 | `GET /health` | Nenhuma | Baixo risco, só liveness check |
| AS-07 | Scripts CLI (`scripts/provision-*.ts`) | Acesso à máquina/CI + `.env` | Único caminho de reset de senha hoje |
| AS-08 | Bundle JS do frontend | N/A (público) | Verificar source maps / secrets no bundle — pendente (seção 4) |

---

## 4. O que a Fase 1 já revela como provável P0 (pendente confirmação em teste ao vivo, Fase 3)

Estes três itens são, **pela leitura do código, estruturalmente
determinísticos** — ou seja, não dependem de "sorte" ou de um bug sutil, é o
comportamento desenhado hoje:

1. **AS-02 é um proxy CRUD genérico sem isolamento de tenant.**
   `server/api/rest.ts` monta `select * from <tabela> where <filtros vindos
   da query string>` — os filtros (inclusive `client_id`/`unit_id`) são
   **escolhidos pelo cliente**, não impostos pelo servidor a partir do JWT.
   Sem filtro nenhum, `GET /rest/assets` deve retornar a tabela inteira,
   todas as empresas juntas. Isso também vale para `user_profiles` (que
   inclui a coluna `password_hash`), `company_clients`, `company_units`, etc.
2. **Qualquer usuário autenticado pode escrever em qualquer coluna de
   qualquer tabela permitida**, incluindo a própria linha em `user_profiles`
   — nada impede um `PATCH /rest/user_profiles?eq_id=<próprio id>` com
   `{"role":"ATHOS_ADMIN"}` (escalada vertical) ou trocar `client_id`/
   `unit_id` de um asset para "roubar" visibilidade cross-tenant.
3. **Realtime (AS-03) vaza dados de todas as empresas para qualquer socket
   conectado**, autenticado ou não, porque o `io.emit` é global e não há
   `io.use()` de auth no servidor Socket.IO.

Classifico esses três como **P0 candidatos**, a confirmar com um teste
controlado e não-destrutivo (ex.: `GET /rest/user_profiles` autenticado como
`joel.oliveira@athos.com.br` e inspecionar se retorna `password_hash` de
outros usuários) — que é exatamente o tipo de teste que a Fase 3 (Autenticação
§3 / Multi-tenant §5 do prompt mestre) pede, e que estou **aguardando
autorização** para rodar contra este ambiente, já que ele aponta para o banco
Supabase real (não um tenant de teste isolado).

---

## 5. Lacunas de configuração não verificáveis só pelo repositório

| Item | Por quê não dá pra confirmar do repo |
|---|---|
| Valor real de `CORS_ORIGIN` em produção (Railway) | Só existe como env var no Railway; `.env` local tem `http://localhost:3000`, docs sugerem `*` como valor temporário — precisa checar no dashboard |
| Headers de segurança (CSP, HSTS, X-Frame-Options) em produção | Vercel/Railway podem injetar alguns por padrão; não há `helmet` nem config explícita no código — precisa checar respostas HTTP reais |
| Se o portal `/homologacao` público realmente funciona hoje (dado que usa o mesmo `supabase.from(...)` que agora exige JWT) | Precisa teste funcional ao vivo, sem login |
| Se há WAF/proteção de borda na Railway/Vercel | Não é configuração deste repositório |
| Backups do Supabase (frequência, retenção, teste de restore) | Configuração do painel Supabase, fora do repo |

---

## 6. Pontos positivos observados (para não distorcer o quadro)

- `.env` corretamente fora do Git; `.env.example` sem valores reais.
- `npm audit` → **0 vulnerabilidades conhecidas** nas dependências atuais
  (prod + dev).
- Senhas de usuário armazenadas com **bcrypt** (custo 10), não em texto puro
  nem hash fraco.
- Identificadores de coluna/tabela em `rest.ts` são validados por regex antes
  de entrar em SQL — a superfície de **SQL injection clássica parece baixa**
  (valores sempre parametrizados, identificadores restritos a
  `[a-z_][a-z0-9_]*`). Isso não neutraliza os achados da seção 4, que são de
  **autorização**, não de injeção.
- IMEI é mascarado (`maskImei`) nos eventos de homologação gravados no banco.
- BRGPS token e credenciais de banco não aparecem no bundle do frontend (só
  variáveis `VITE_*` são client-side, e o token BRGPS não tem esse prefixo).

---

## 7. Testes que vão ser necessários nas próximas fases (lista, não executados ainda)

1. Confirmar ao vivo (com o usuário `joel.oliveira@athos.com.br` já criado)
   se `GET /rest/user_profiles` retorna `password_hash` de outros usuários.
2. Confirmar se `GET /rest/assets` sem filtro retorna dados fora do único
   tenant que existe hoje no banco (banco real só tem 1 empresa/1 ativo —
   **vou precisar criar um segundo tenant de teste (`TENANT_B`) antes de
   conseguir provar vazamento cross-tenant de forma definitiva**, conforme
   pede a seção 5 do prompt mestre).
3. Testar `PATCH /rest/user_profiles` para escalada de privilégio (em
   usuário de teste, não no admin real).
4. Conectar um socket Socket.IO sem token e verificar se eventos chegam.
5. Testar o fluxo de submissão do `/homologacao` sem login.
6. Rodar `git log -p` completo (ou `gitleaks`/`trufflehog`) procurando
   segredo commitado e removido no histórico.
7. Checar `CORS_ORIGIN` e headers de segurança reais em produção (requer URL
   de produção — ainda não me foi informada).
8. Fuzzing leve dos parâmetros de `rest.ts` (`order`, `eq_*`) para confirmar
   que identificadores inválidos realmente são rejeitados e não vazam schema
   além do necessário nas mensagens de erro (hoje o `catch` devolve
   `(err as Error).message` **cru** do Postgres ao cliente — provável leak de
   schema via oráculo de erro, a confirmar).
9. Revisar `server/gt06-listener/protocol.ts` (`parseFrames`) por limite de
   buffer — indício de crescimento não limitado, não confirmado ainda.
10. Verificar mecanismo de backup/restore do Supabase (fora do repo).

---

## 8. Encerramento da Fase 1

Inventário feito, superfícies mapeadas, mecanismos de segurança existentes
identificados (bcrypt, JWT, validação de identificador SQL, `.gitignore`
correto, dependências limpas), e as lacunas mais graves já aparentes por
leitura de código foram documentadas com a localização exata (arquivo/linha).

**Não fiz nenhuma tentativa de exploração ao vivo, não alterei nenhuma regra
de negócio, não criei tenants de teste, não fiz commit nem push.**

Aguardando autorização para prosseguir. Ver pergunta ao usuário logo após
este documento.
