# Banco único (Railway) — consolidação de 12/09/2026

## Decisão

O projeto passa a ter **um só Postgres: o do Railway** (projeto `athos-track`,
serviço `Postgres`). O Supabase foi descontinuado.

O app nunca usou SDK, Auth ou REST do Supabase — só o Postgres. Não há
dependência `@supabase/*` no `package.json`. O que restava era nome e
configuração: `src/lib/supabaseClient.ts` é um shim que já fala com a API
própria (`server/api`), e `supabase/migrations/` é só o nome da pasta que o
runner lê.

## Por que os dois bancos divergiram

Cada um ficou com metade da história:

| | Supabase (legado) | Railway (produção) |
|---|---|---|
| Tabelas | 38 | 29 → 38 após a consolidação |
| `company_clients` | 3 (seeds de tenant) | 1 — `ATHOS-01` |
| `assets` | 0 | 10 carrinhos BRGPS reais |
| `asset_route_points` | 0 | 324 |

O Supabase recebeu as migrations de tenant mas nunca teve ativo nenhum. O
Railway tem os dados reais mas estava ~20 migrations atrás, com estado misto:
`20260828010000` havia sido aplicada à mão enquanto `20260818000000` e
`20260828000000`, anteriores a ela, não. (Isso não impediu a consolidação
porque `20260828010000` usa `add column if not exists` — reaplicá-la é no-op.)

## O que ficou de fora, de propósito

Decisão do dono do projeto: **produção fica só com os registros atuais** — o
cliente `ATHOS-01` e os 10 carrinhos da conta BRGPS 1 (`CART-3092524666` …
`CART-3092533124`).

Estas migrations estão no ledger com **`adopted = true`** (registradas sem
executar). Se você procurar esses dados em produção, eles não existem — e é
intencional:

| Migration | O que criaria |
|---|---|
| `20260828020000` (parte DML) | tenants Zafari e São João |
| `20260906200000` | asset `CAR-03` (Carrinho BRGPS 3092524777) |
| `20260910100100` (parte DML) | transferência de CAR-01/CAR-03 para São João |
| `20260910100200` (parte DML) | assets das tags Zaffari |
| `20260910110000` | vínculo dessas tags à conta BRGPS 2 |
| `20260912000000` | caixas do São João |

Três delas são **mistas**: a DDL rodou (constraints de `category`/`status`,
coluna `company_clients.enabled_modules`, tabela `tag_tenant_transfers`),
porque o app depende desse schema; só o DML ficou de fora.

**Nota que importa:** as 10 tags que `20260910100200_register_zaffari_tags`
registraria são exatamente os 10 carrinhos que já existem em produção. Eles
estão sob `ATHOS-01`, não sob um tenant Zaffari. Não são ativos faltando — é a
mesma frota, noutro tenant.

## Segurança: a role `athos_app_rw`

`20260828030000_real_rls_defense_in_depth` cria a role sem `BYPASSRLS` que dá a
segunda camada de isolamento (`withTenantContext()` em `server/api/db.ts`).
Até esta consolidação ela **não existia em produção** — ou seja, o isolamento
multi-tenant dependia só da camada de aplicação.

A migration trazia `create role athos_app_rw login password
'__ATHOS_APP_RW_PASSWORD__'`. O comentário prometia substituição "em tempo de
aplicação", mas **ela não existia em lugar nenhum do repo**: rodando como
estava, a role com `select/insert/update/delete` em todas as tabelas nasceria
com uma senha versionada em Git.

Corrigido em `server/db/migrate.ts` (`resolvePlaceholders`): a substituição sai
de `ATHOS_APP_RW_PASSWORD`, exige 16+ caracteres, rejeita aspa simples e barra
invertida, e **falha a migration** se a variável não estiver definida. A
substituição acontece na execução, nunca no checksum — o hash do ledger
depende do arquivo, não da senha do ambiente.

## Como alcançar o banco de produção

O Postgres do Railway **não tem proxy TCP público**, e não precisa ter:

```bash
railway connect Postgres --tunnel-only -P 54329
```

Abre um túnel SSH criptografado numa porta local, sem expor o banco. Exige
Railway CLI **5.x** — a 4.x não tem `--tunnel-only`, e sua rota SSH esbarra em
firewall que bloqueie a porta 22.

`railway ssh` e `railway sandbox` não servem: o primeiro depende da porta 22,
e o sandbox não entra na rede privada do projeto.

## Backup

O plano atual do Railway **não inclui backup nem PITR** (a aba Backups diz que
é só no Pro). Antes da consolidação foi tirado um dump lógico em
`.backups/railway-prod-<timestamp>/` — um JSON por tabela mais
`_schema_columns.json` e `_manifest.json`. `.backups/` é gitignored.

Enquanto não houver plano com backup automático, **tire um dump antes de
qualquer migration** em produção.
