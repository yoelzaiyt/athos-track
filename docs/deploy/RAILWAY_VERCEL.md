# Deploy: Vercel (frontend) + Railway (API + workers + Postgres)

Este runbook assume a migração completa pra fora do Supabase: Postgres, autenticação e
realtime agora são resolvidos pela API própria em `server/api` (ver comentários nesses
arquivos para o desenho). `@supabase/supabase-js` foi removido do projeto.

## 1. Provisionar o Postgres no Railway

1. Crie um projeto no Railway → `railway init` (ou pelo dashboard).
2. Adicione o addon: `railway add --database postgres`.
3. A `DATABASE_URL` gerada usa o host interno (`postgres.railway.internal`), que só é
   alcançável de dentro da rede privada do Railway — não dá pra rodar `npm run db:migrate`
   direto da sua máquina apontando pra ela. O jeito mais simples é entrar por SSH no próprio
   serviço Postgres e rodar o schema via `psql`:
   ```
   railway ssh keys add                          # uma vez, registra sua chave SSH local
   railway ssh config --service Postgres         # gera o Host "railway-postgres" no seu ~/.ssh/config
   ssh -o StrictHostKeyChecking=accept-new railway-postgres -- psql --version   # aceita o host key na 1ª vez

   # concatena, na ordem certa, o bootstrap + todas as migrations do Supabase + os patches novos:
   (cat server/db/00_bootstrap.sql; \
    for f in supabase/migrations/*.sql; do cat "$f"; done; \
    cat server/db/01_add_password_auth.sql; \
    cat server/db/02_realtime_notify.sql) > /tmp/full_schema.sql

   ssh railway-postgres -- psql -U postgres -d railway -v ON_ERROR_STOP=1 < /tmp/full_schema.sql
   ```
   Isso aplica, em ordem: o shim do schema `auth` do Supabase (`server/db/00_bootstrap.sql`),
   todas as migrations originais em `supabase/migrations/*.sql` sem nenhuma edição de conteúdo
   (a única mudança em `supabase/migrations` foi um bugfix genuíno — `drop function` antes do
   `create or replace function resolve_recovery_mission` na migration `20260815051000`, que já
   falharia igual num Supabase novo, não é coisa específica do Railway), e os dois patches novos
   (`password_hash` em `user_profiles` + triggers de realtime).

   `server/db/migrate.ts` (`npm run db:migrate`) faz exatamente essa concatenação — use-o se
   estiver rodando de dentro da rede do Railway (ex: via `railway ssh --service athos-api --
   npm run db:migrate`, depois que o serviço da API já estiver no ar).

## 2. Serviço da API (Express) no Railway

Este repositório tem 3 processos diferentes (API + 2 workers) rodando do mesmo código —
cada um vira um **serviço Railway separado**, todos criados com `railway add --service <nome>`
(serviço vazio, sem repo/imagem).

O comando de start de cada serviço vem de `railway.json` na raiz do repo — só que os 3
serviços não podem ler o mesmo arquivo ao mesmo tempo (cada um precisa do seu próprio
`startCommand`). A forma que funciona de verdade (testada — a variável de serviço
`RAILWAY_CONFIG_FILE` **não** é respeitada por `railway up`): antes de cada deploy, copiar o
arquivo de config específico do serviço por cima de `railway.json`:

```
cp railway.api.json railway.json && railway up --service athos-api --ci
cp railway.brgps-sync.json railway.json && railway up --service athos-brgps-sync --ci
cp railway.gt06-listener.json railway.json && railway up --service athos-gt06-listener --ci
```

Os três arquivos (`railway.api.json`, `railway.brgps-sync.json`, `railway.gt06-listener.json`)
já estão no repo com `build.buildCommand` sobrescrito pra um `echo` — sem isso, o Railpack
detecta o `vite build` do frontend (por causa do `package.json` compartilhado), gera um
`dist/index.html` e passa a servir esse HTML estático via Caddy, **ignorando** o
`deploy.startCommand` configurado. Pulando o build do frontend, o Railpack trata o serviço
como app Node comum e respeita o start command.

Variáveis de ambiente do serviço `athos-api`:
- `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (referência à variável do serviço Postgres do mesmo projeto)
- `JWT_SECRET` = string aleatória longa (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- `CORS_ORIGIN` = domínio do Vercel (passo 4) — use `*` temporariamente até ter esse domínio

Depois do deploy, gere um domínio público (`railway domain --service athos-api`) e confirme com
`curl https://<seu-servico>.up.railway.app/health` → `{"ok":true}`.

## 3. Workers no Railway (BRGPS + GT06)

| Serviço | Config | Variáveis extras |
|---|---|---|
| `athos-brgps-sync` | `railway.brgps-sync.json` | `DIRECT_URL` = `${{Postgres.DATABASE_URL}}`, `BRGPS_ENABLED`, `BRGPS_BASE_URL`, `BRGPS_API_TOKEN`, `BRGPS_SYNC_INTERVAL_SECONDS` |
| `athos-gt06-listener` | `railway.gt06-listener.json` | `DIRECT_URL` = `${{Postgres.DATABASE_URL}}` |

Esses dois processos já falavam direto com Postgres via `pg` (não usavam `supabase-js`), então
não precisam de nenhuma mudança de código — só apontar a connection string pro Railway.

Nota: com `BRGPS_ENABLED=false` (padrão até ter um `BRGPS_API_TOKEN` real), o processo
`brgps-sync` loga que está desativado e sai com `process.exit(1)` — por isso
`railway.brgps-sync.json` usa `restartPolicyType: "NEVER"` (em vez de `ON_FAILURE`), pra esse
encerramento esperado não virar loop de reinício no painel do Railway. Quando o token real
existir, ajuste `BRGPS_ENABLED=true` + `BRGPS_API_TOKEN` nas variáveis do serviço e rode
`railway redeploy --service athos-brgps-sync` — aí o processo passa a rodar como daemon de
verdade (o `sync` fica em loop interno, não sai mais sozinho).

## 4. Frontend no Vercel

1. Importe o repositório no Vercel (New Project) ou crie via CLI (`vercel deploy --prod --yes`
   de dentro do repo).
2. **Armadilha conhecida**: em alguns projetos novos, a CLI/dashboard da Vercel detecta este
   repo como "monorepo de serviços" e trava o Framework Preset do projeto em **"Services"**
   (uma feature ainda em beta) em vez de **"Vite"**. Sintoma: build até passa, mas o site
   inteiro retorna 404 em "/" (o roteamento desse preset não fica pronto pra servir a SPA).
   Não tem flag de CLI pra corrigir isso — é um toggle manual, uma única vez:
   **Project Settings → Build and Deployment → Framework Preset → trocar para "Vite" → Save.**
   Depois disso, deploys normais (`vercel deploy --prod`) funcionam sem mais tocar nisso.
3. `vercel.json` no repo só precisa do rewrite de SPA:
   ```json
   { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
   ```
4. Variáveis de ambiente do projeto Vercel (`vercel env add <NOME> production`):
   - `VITE_API_URL` = URL pública do serviço da API no Railway (passo 2).
   - Demais `VITE_*` (GT06, `VITE_ATHOS_ENV_LABEL`, `VITE_DEMO_MODE`) — copie do `.env.example`.
5. Deploy. Depois, volte no serviço da API do Railway e ajuste `CORS_ORIGIN` pro domínio final do Vercel.

## 5. Criar o primeiro usuário com login

O CRUD de Usuários (`Usuários e Matriz de Permissões`) cria o **perfil** em `user_profiles`,
mas não a senha — isso é proposital (nunca envie senha por esse formulário). Depois de
cadastrar o usuário na tela, libere o login rodando, com acesso a `DATABASE_URL`:

```
npm run user:set-password -- usuario@empresa.com "senha-forte-aqui"
```

## 6. Diferenças em relação ao Supabase (o que mudou de verdade)

- **Auth**: login por e-mail/senha própria (bcrypt + JWT em `server/api`), não mais GoTrue.
- **RLS**: removida como camada de enforcement — a API (`server/api/auth.ts`) exige um JWT
  válido em toda rota, mesmo nível de proteção que a policy `authenticated only` que o projeto
  já tinha, só que aplicada no código em vez de no banco.
- **Realtime**: `LISTEN/NOTIFY` do Postgres (triggers em `server/db/02_realtime_notify.sql`)
  em vez do Supabase Realtime, repassado ao navegador via Socket.io.
- **Cliente no frontend**: `src/lib/supabaseClient.ts` continua se chamando assim e exportando
  `supabase`, mas por baixo agora é um cliente HTTP fino falando com `server/api` — o resto do
  app (`AssetContext.tsx`, `AuthContext.tsx`, `mappers.ts`) não precisou ser reescrito.
