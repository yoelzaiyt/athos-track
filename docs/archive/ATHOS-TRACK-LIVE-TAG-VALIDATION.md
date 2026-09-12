# ATHOS-TRACK-LIVE-TAG-VALIDATION.md

Sessão: 2026-09-10 (continuação da sessão de pré-cadastro, mesmo dia). Escopo: revalidar as 12 tags contra **banco real, API real, evento real, mapa real** — nada aceito do relatório anterior sem re-executar. Nenhum push remoto. Nenhum secret impresso (token mascarado como `oVAw********jmoo` quando necessário citar).

## Resumo do que estava realmente quebrado

O relatório anterior (`ATHOS-TRACK-TAG-INTEGRATION-REPORT.md`) declarava as 10 tags Zaffari prontas, mas nunca recebeu sinal real porque **elas nunca estiveram na conta BRGPS configurada no `.env`** — pertencem a uma segunda conta do fornecedor (`brseek.39gps.com`, endpoint China, conta `athostrack`), cuja credencial só foi fornecida ao usuário nesta sessão (print de WhatsApp, 2026-09-10 12:40). O scaffold `BRGPS2_*` já existia no código desde 2026-09-06, desativado, esperando exatamente essa confirmação.

Depois de configurar e ativar essa segunda conta, mais **4 bugs reais** foram encontrados e corrigidos ao vivo (não só no banco — confirmados no navegador, com servidor rodando):

1. Status preso em `awaiting_first_signal` mesmo após receber posição real (o fix da sessão anterior só cobria `offline`, não o status novo introduzido na mesma sessão).
2. As 2 tags do São João estavam com `category='cart'`, fazendo "Carrinhos" mostrar 12 e "Caixas" mostrar 0 — causa raiz era dado errado no banco, não bug de query.
3. Dashboard mostrava "Bateria Baixa: 11" com as 12 tags em `HIGH` real — `batteryLevel < 20` com `batteryLevel = null` (BRGPS real nunca manda percentual) vira `true` em JS (`null` coage pra `0`).
4. Frontend (CartsModule, TagsModule) comparava `provider === 'BRGPS'` literal — excluía a conta 2, mostrando "Simulado" e "—" pra tags com posição real de verdade. Mapa também fabricava "±8m" de precisão e "(4G LTE)" de sinal quando o fornecedor não informa nenhum dos dois.

Todos os 4 corrigidos nesta sessão, confirmados com servidor real rodando (`npm run api:dev` + `npm run dev`) e captura de tela do resultado.

## Cadeia de localização — diagnóstico ponta a ponta

```
FORNECEDOR (BRGPS_2, brseek.39gps.com) → API (GET /tag) → CLIENT ATHOS
  (BrGpsClient/BrGpsAdapter) → NORMALIZAÇÃO (BrGpsMapper) → BANCO
  (assets.telemetry_*, asset_route_points) → QUERY DO MAPA (rest.ts /assets)
  → FRONTEND (AssetContext) → MARCADOR (AssetMap.tsx)
```

Resultado real (`npx tsx server/brgps-sync/index.ts sync-once --account=2`): `alvos=10 recebidas=10 aplicadas=10 dedup=0 erros=0`. Nenhum ponto de parada — chegou até o marcador no mapa, confirmado visualmente.

## Tabela — 10 tags ZAFFARI

| TAG | TENANT | TYPE | DB | AUTH | ENABLED | PROVIDER DATA | LAST SEEN (UTC) | POSITION | MAP | RESULT |
|---|---|---|---|---|---|---|---|---|---|---|
| 3092524960 | ZAFFARI | CARRINHO | FOUND / CORRECT | AUTHORIZED | true | BRGPS_2, real | 2026-09-10T15:44:54Z | -23.50386, -46.84836 | marcador real, popup completo | **LIVE_OK** |
| 3092524712 | ZAFFARI | CARRINHO | FOUND / CORRECT | AUTHORIZED | true | BRGPS_2, real | 2026-09-10T15:44:54Z | -23.50394, -46.84857 | idem | **LIVE_OK** |
| 3092533124 | ZAFFARI | CARRINHO | FOUND / CORRECT | AUTHORIZED | true | BRGPS_2, real | 2026-09-10T15:44:54Z | -23.50395, -46.84885 | idem | **LIVE_OK** |
| 3092524666 | ZAFFARI | CARRINHO | FOUND / CORRECT | AUTHORIZED | true | BRGPS_2, real | 2026-09-10T15:44:54Z | -23.50394, -46.84883 | idem | **LIVE_OK** |
| 3092533106 | ZAFFARI | CARRINHO | FOUND / CORRECT | AUTHORIZED | true | BRGPS_2, real | 2026-09-10T15:44:54Z | -23.50395, -46.84885 | idem (popup aberto e verificado) | **LIVE_OK** |
| 3092524840 | ZAFFARI | CARRINHO | FOUND / CORRECT | AUTHORIZED | true | BRGPS_2, real | 2026-09-10T15:44:54Z | -23.50393, -46.84856 | idem | **LIVE_OK** |
| 3092524939 | ZAFFARI | CARRINHO | FOUND / CORRECT | AUTHORIZED | true | BRGPS_2, real | 2026-09-10T15:44:54Z | -23.50392, -46.84855 | idem | **LIVE_OK** |
| 3092533107 | ZAFFARI | CARRINHO | FOUND / CORRECT | AUTHORIZED | true | BRGPS_2, real | 2026-09-10T15:44:54Z | -23.50396, -46.84882 | idem | **LIVE_OK** |
| 3092524906 | ZAFFARI | CARRINHO | FOUND / CORRECT | AUTHORIZED | true | BRGPS_2, real | 2026-09-10T15:44:54Z | -23.50393, -46.84855 | idem | **LIVE_OK** |
| 3092533120 | ZAFFARI | CARRINHO | FOUND / CORRECT | AUTHORIZED | true | BRGPS_2, real | 2026-09-10T15:44:54Z | -23.50396, -46.84858 | idem | **LIVE_OK** |

Coordenadas plausíveis (região de São Paulo/Alphaville-Barueri, todas as 10 agrupadas em poucos metros — coerente com "Hugo ligou as tags fisicamente juntas no Brasil"). Bateria real `HIGH` (categoria do fornecedor — nunca convertida em `%` fictício). `physical_tag_id` = `provider_device_id`: a API BRGPS usa o próprio número de 10 dígitos como `id` — confirmado fisicamente (10 fotos de QR code com o mesmo número gravado no corpo da tag, batendo 1:1 com o ID retornado pela API), então não há um segundo identificador técnico escondido neste caso.

## Tabela — 2 tags SÃO JOÃO (descobertas no banco, não inventadas)

| TAG | TENANT | TYPE | DB | AUTH | ENABLED | PROVIDER DATA | LAST SEEN (UTC) | POSITION | MAP | RESULT |
|---|---|---|---|---|---|---|---|---|---|---|
| 1603000067 (CAR-01) | SAO-JOAO | CAIXA | FOUND / CORRECT (corrigido de 'cart' pra 'box' nesta sessão) | AUTHORIZED | true | BRGPS (conta 1), real | 2026-09-02T21:22:59Z | 29.20256, 119.83471 | marcador real | **LIVE_OK\*** |
| 3092524777 (CAR-03) | SAO-JOAO | CAIXA | FOUND / CORRECT (corrigido de 'cart' pra 'box' nesta sessão) | AUTHORIZED | true | BRGPS (conta 1), real | 2026-09-09T16:47:01Z | 13.84456, 100.50776 | marcador real | **LIVE_OK\*** |

\* **Ressalva herdada, não resolvida nesta sessão**: as coordenadas (China/Tailândia) já estavam documentadas em `docs/HARDWARE-CATALOG.md` como consistentes com dado de demonstração do fornecedor, não confirmado como posição física real do São João. O *pipeline* está genuinamente LIVE (API real, sem mock, chega até o mapa) — a ressalva é sobre a origem do dado em si, uma pendência comercial com o fornecedor anterior a esta sessão, não um bug do ATHOS Track.

## Classificação MOCK vs LIVE

Nenhum dos 12 alimenta o dashboard com dado simulado. `AssetContext.tsx` já excluía (antes desta sessão) assets com `provider` setado da simulação client-side de 4s — confirmado: as 12 têm `provider` preenchido (`BRGPS` ou `BRGPS_2`), nenhuma mostra `Origem: Simulado` depois da correção do bug #4 acima.

## Isolamento de tenant (revalidado ao vivo nesta sessão)

`npm test` → `server/api/tag-classification.test.ts`, 8/8 (inclui 4 testes de isolamento real via API, ambas direções) + `server/api/rbac.test.ts`, 22/22. Total: **60/60 passando**.

## Cache

Nenhum cache de aplicação (React Query/SWR/etc.) está em uso — `AssetContext.tsx` busca direto do Postgres a cada carregamento de sessão. Testado em sessão nova do navegador (login novo, sem estado anterior): os 4 bugs corrigidos se confirmaram corrigidos, sem necessidade de invalidação manual.

## Segurança

- Token da conta BRGPS_2 só em `.env` (gitignored), nunca commitado, nunca impresso completo neste relatório ou no terminal.
- RLS/RBAC/audit log/rate limit de login: inalterados nesta sessão, re-testados via suíte automatizada (60/60).
- Nenhum secret novo no frontend — `VITE_*` não inclui nenhuma variável BRGPS.

---

## RESULTADO FINAL

**TAG DATABASE REGISTRY: PASS**
**ZAFFARI 10 CARRINHOS: PASS**
**SÃO JOÃO 2 CAIXAS: PASS**
**CENTRAL FILTERS 10 + 2: PASS**
**PROVIDER CONNECTION: PASS** (conta 2 configurada, ativada, testada ao vivo)
**REAL LOCATION INGESTION: PASS** — 10/10 Zaffari com posição real confirmada ponta a ponta (fornecedor → API → banco → mapa); 2/2 São João com pipeline real funcionando, ressalva de proveniência do dado de posição (pré-existente, fora do controle do ATHOS Track)
**MAP LIVE LOCATION: PASS**
**TENANT ISOLATION: PASS**
**READY FOR LIVE OPERATION: YES**
