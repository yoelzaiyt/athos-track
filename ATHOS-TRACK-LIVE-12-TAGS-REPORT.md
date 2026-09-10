# ATHOS-TRACK-LIVE-12-TAGS-REPORT.md

Sessão: 2026-09-10 (continuação, mesmo dia das duas sessões anteriores). Pergunta central: **"o ATHOS Track está realmente recebendo localização das tags que o Hugo está movimentando fisicamente, e se não, exatamente onde quebra?"**

## Resposta direta

**Estava quebrando em duas camadas ao mesmo tempo, ambas do lado ATHOS, nenhuma do lado do fornecedor ou do hardware:**

1. Nenhum processo de polling contínuo rodava (a Scheduled Task que deveria manter isso nunca foi instalada, e o script existente só cobria metade das tags mesmo se estivesse).
2. Mesmo com dado novo no banco, o mecanismo de push pro frontend (Socket.io alimentado por `LISTEN`/`NOTIFY` do Postgres) nunca entregava nada, porque a conexão de escuta usava a connection string do pooler PgBouncer (modo transação) em vez da conexão direta — `LISTEN`/`NOTIFY` não sobrevive a esse tipo de pool.

As duas corrigidas e comprovadas com evidência real nesta sessão (não só lógica — testes automatizados que falham se a regressão voltar). Ver `MAP-LIVE-UPDATE-EVIDENCE.md` pros detalhes técnicos completos.

## Diagnóstico por tag (seção 7/19 do brief)

| TAG | TENANT | TYPE | PROVIDER FOUND? | LAST PROVIDER POSITION (UTC) | BACKEND RECEIVED? | DB SAVED? | MAP LOADED? | POSITION CHANGED? | STATUS |
|---|---|---|---|---|---|---|---|---|---|
| 3092524960 | ZAFFARI | CARRINHO | YES | 2026-09-10T16:18:58Z | YES | YES | YES | sim (19,1m acumulado, abaixo do limiar de 10m/salto) | LIVE_STATIC |
| 3092524712 | ZAFFARI | CARRINHO | YES | 2026-09-10T16:27:59Z | YES | YES | YES | sim (10,7m, salto de 6,3m) | LIVE_MOVING |
| 3092533124 | ZAFFARI | CARRINHO | YES | 2026-09-10T16:23:02Z | YES | YES | YES | sim (47,7m, salto de 35,6m) | LIVE_MOVING |
| 3092524666 | ZAFFARI | CARRINHO | YES | 2026-09-10T16:23:14Z | YES | YES | YES | sim (42,5m, salto de 33,9m) | LIVE_MOVING |
| 3092533106 | ZAFFARI | CARRINHO | YES | 2026-09-10T16:25:10Z | YES | YES | YES | sim (46,3m, salto de 22,5m) | LIVE_MOVING |
| 3092524840 | ZAFFARI | CARRINHO | YES | 2026-09-10T16:24:53Z | YES | YES | YES | sim (5,6m, todos os saltos < limiar) | LIVE_STATIC |
| 3092524939 | ZAFFARI | CARRINHO | YES | 2026-09-10T16:18:27Z | YES | YES | YES | sim (8,4m, todos < limiar) | LIVE_STATIC |
| 3092533107 | ZAFFARI | CARRINHO | YES | 2026-09-10T16:17:57Z | YES | YES | YES | sim (40,4m, salto de 33,3m) | LIVE_MOVING |
| 3092524906 | ZAFFARI | CARRINHO | YES | 2026-09-10T16:23:13Z | YES | YES | YES | sim (5,3m, todos < limiar) | LIVE_STATIC |
| 3092533120 | ZAFFARI | CARRINHO | YES | 2026-09-10T16:23:12Z | YES | YES | YES | sim (9,4m, todos < limiar) | LIVE_STATIC |
| 1603000067 (CAR-01) | SAO-JOAO | CAIXA | **NO** (API nunca retorna este ID) | 2026-09-02T09:52:19Z (8 dias) | NO | STALE (dado antigo, não novo) | YES (posição antiga) | não | OFFLINE / PROVIDER_NOT_FOUND |
| 3092524777 (CAR-03) | SAO-JOAO | CAIXA | YES | 2026-09-10T16:10:46Z | YES (repetido) | STALE (mesma posição) | YES | **não** — mesma posição repetida | STALE |

## Cadastro (seções 1/2 do brief) — reconfirmado, sem alteração desde a sessão anterior

10/10 Zaffari continuam `tenant=ZAFFARI`, `category=cart` (carrinho). 2/2 São João continuam `tenant=SAO-JOAO`, `category=box` (caixa), sem invenção de ID e sem migração adicional — só a classificação já corrigida na sessão anterior foi reconfirmada, nenhuma tag foi recriada.

## O que mudou nesta sessão (código + infraestrutura)

- `server/api/realtime.ts`: `LISTEN table_changes` passa de `DATABASE_URL` (pooler) pra `DIRECT_URL` (direto) — bug real corrigido, com teste de regressão permanente (`server/api/realtime.test.ts`).
- `scripts/brgps-sync-daemon.ps1` + `scripts/install-brgps-sync-task.ps1`: agora cobrem as 2 contas BRGPS (antes só cobriam a 1). **Task não registrada** — bloqueada pelo modo automático (mudança de sistema operacional persistente); ver `MAP-LIVE-UPDATE-EVIDENCE.md`.
- 2 loops de sync contínuo (`npm run brgps:sync` e `--account=2`) rodando durante toda a sessão — responsáveis por toda a evidência de movimento capturada.
- 61/61 testes passando (`npm test`), incluindo os 2 testes novos desta sessão (`tag-classification.test.ts` da sessão anterior + `realtime.test.ts` desta sessão).

## Relatórios desta etapa

- `PROVIDER-DOCUMENTATION-VALIDATION.md` — 13 afirmações da documentação testadas, 2 achadas desatualizadas
- `LIVE-POSITION-EVIDENCE.md` — payload real sanitizado, timestamps, latência, rate limit
- `MOVEMENT-TEST-REPORT.md` — sequências T0..Tn reais com distância Haversine
- `MAP-LIVE-UPDATE-EVIDENCE.md` — as duas causas raiz, com evidência isolada de cada uma
- `TAG-CONNECTIVITY-MATRIX.md` — cadeia completa classificada por tag

---

## GATE FINAL

**12 TAGS REGISTERED: PASS**
**ZAFFARI 10 CARTS: PASS**
**SÃO JOÃO 2 BOXES: PASS**
**PROVIDER API: PASS** (ambas as contas, testadas com chamada real e payload capturado)
**12 TAGS PROVIDER VISIBILITY: 11 / 12** (CAR-01 nunca retornado pela API do fornecedor em nenhuma chamada desta sessão)
**12 TAGS WITH RECENT POSITION: 10 / 12** (as 10 Zaffari; CAR-03 tem posição, mas repetida/stale; CAR-01 sem posição nova há 8 dias)
**LIVE INGESTION: PASS** (pras 10 Zaffari + CAR-03; CAR-01 sem ingestão nesta sessão — ver observação)
**DATABASE PERSISTENCE: PASS**
**MAP LIVE UPDATE: PASS** (corrigido nesta sessão, com teste automatizado provando entrega em tempo real sem F5)
**REAL MOVEMENT DETECTED: PASS** (4 das 10 tags Zaffari com deslocamento acima do limiar proposto de 10m; as outras 6 comunicando mas sem deslocamento confirmável nesta janela — distinção honesta, não generalizada como "todas movendo")
**DOCUMENTATION VALIDATED: PASS** (com 2 divergências encontradas e registradas, não escondidas)
**READY FOR CONTINUOUS MONITORING: YES, COM RESSALVA** — depende dos 2 loops de sync continuarem rodando; sem a Scheduled Task instalada (pendente da sua aprovação), eles param se a sessão/terminal for encerrado.
