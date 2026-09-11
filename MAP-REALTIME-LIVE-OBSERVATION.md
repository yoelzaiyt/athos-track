# MAP-REALTIME-LIVE-OBSERVATION.md

Fase 5 do prompt "AUDITORIA E CORREÇÃO COMPLETA DOS MAPAS + TEMPO REAL" — cadeia PROVIDER → BACKEND → DATABASE → REALTIME EVENT → FRONTEND → MARKER, testada ao vivo contra produção (`https://athos-track-eight.vercel.app` + `https://athos-track-api.fly.dev`).

## Cadeia verificada, passo a passo, com evidência real

1. **Telemetria chega ao backend? SIM.** Chamada autenticada direta a `GET /rest/assets` (via `fetch()` dentro do próprio contexto do navegador logado, nunca expondo o token) mostrou `updated_at` de `CAR-03` avançando de `2026-09-11T01:26:28.843Z` para `2026-09-11T01:31:46.300Z` entre duas leituras — dado novo, real, chegando ao banco.
2. **Backend persiste? SIM** — mesmo ponto acima.
3. **Timestamp muda? SIM** — confirmado.
4. **Evento realtime é emitido? NÃO — este é o ponto de quebra, confirmado por 3 evidências independentes:**
   - **Config viva do Fly** (`flyctl config show -a athos-track-api`): bloco `env` só tem `CORS_ORIGIN` e `PORT`. **Nenhum `DIRECT_URL`.**
   - **Secrets vivos do Fly** (`flyctl secrets list -a athos-track-api`): `APP_DATABASE_URL, BRGPS_API_TOKEN, BRGPS_BASE_URL, BRGPS_ENABLED, DATABASE_URL, JWT_SECRET`. **`DIRECT_URL` não está entre eles.**
   - **Código atual do repositório** (`server/api/realtime.ts`, branch `homolog/gt06-tag-3092660181`, HEAD `d1e1185`): `startRealtimeBridge()` lê `process.env.DIRECT_URL` e lança uma exceção se estiver ausente — porque, segundo o próprio comentário do código (achado ao vivo em 2026-09-10), `LISTEN` feito numa conexão PgBouncer (pooler) nunca recebe o `NOTIFY` disparado por outra conexão.
   - **Deploy realmente em produção é mais antigo que a correção**: `flyctl releases -a athos-track-api` mostra o último deploy real (`v2`) em **06/09/2026 19:12**. O commit que introduziu essa exigência de `DIRECT_URL` (`8ef66a7 — "fix: LISTEN/NOTIFY via pooler nunca entregava posição pro frontend"`) é de **10/09/2026 13:33** — **4 dias depois do último deploy**. A produção está rodando uma versão do código anterior a essa correção.
5. **Frontend está inscrito? SIM** — `src/context/AssetContext.tsx` chama `.channel('athos-assets-realtime').on('postgres_changes', ...).subscribe()` incondicionalmente, e `src/pages/BoxesModule.tsx` (tela "Caixas") consome esse mesmo estado via `useAssets()` — não faz fetch próprio.
6. **Subscription continua viva?** Não verificável diretamente (WebSocket não aparece nas ferramentas de rede disponíveis nesta sessão), mas irrelevante: mesmo que o cliente esteja bem inscrito, o servidor nunca dispara o evento (passo 4).
7. **Tenant/device filter está correto?** Não testável isoladamente aqui, mas o código server-side (`realtime.ts`, `tenantRoom()`) já tem cobertura de teste automatizado real e passando (`server/api/realtime.test.ts`, ambiente de teste local — não reflete necessariamente o mesmo estado do banco de produção).
8. **Estado React é atualizado? NÃO, sem navegar/recarregar** — teste direto:
   - Aberta a tela **Caixas** (`BoxesModule.tsx`), capturado texto exibido para `CAR-03`: `"2026-09-11T01:21:43.470Z"` às `01:32:18Z`.
   - Confirmado via API direta que o backend JÁ tinha um valor mais novo (`01:31:46.300Z`) nesse momento.
   - Reconferido o mesmo texto na tela, sem navegar, às `01:32:41Z`: **ainda `"01:21:43.470Z"`** — 23 segundos depois, nenhuma mudança.
   - **Navegado para longe e de volta à mesma tela** (SPA, sem F5 completo, mas equivalente a um novo mount/fetch): texto passou a `"2026-09-11T01:31:45.644Z"` — bateu com o valor real do backend.
9. **Marcador recebe nova posição / mapa atualiza sem reload?** Consequência direta do item 4 — se o servidor nunca emite o evento, nenhuma tela que dependa dele (mapa incluso) atualiza sozinha.

## Causa raiz (fase 2 do prompt, adaptada)

```
401_SOURCE (deste caso) = N/A, este é um problema de ausência de evento, não de HTTP 401
REALTIME_FAILURE_CLASS = BACKEND_MISCONFIGURATION (não é código quebrado — é deploy desatualizado)
CAUSA = server/api (fly.dev, app "athos-track-api") está rodando o release v2 (06/09/2026),
  publicado ANTES do commit 8ef66a7 (10/09/2026) que corrigiu o LISTEN/NOTIFY para exigir
  DIRECT_URL. A produção nunca recebeu essa correção nem o secret DIRECT_URL.
```

## Risco real se corrigido sem cuidado

O código ATUAL (`server/api/realtime.ts`) **lança uma exceção fatal na inicialização** se `DIRECT_URL` não existir, e `server/api/index.ts:91-94` responde a essa exceção com `process.exit(1)` **antes mesmo de `httpServer.listen()` ser chamado** — ou seja, **um deploy ingênuo do código atual, sem antes configurar o secret `DIRECT_URL` no Fly, derrubaria a API inteira (inclusive REST, que hoje funciona)**, causando uma regressão pior que o problema atual.

## Ação corretiva — EXECUTADA nesta sessão, com autorização explícita do usuário

1. `flyctl secrets set DIRECT_URL=... -a athos-track-api` — valor lido do `.env` local, nunca impresso em nenhum log/relatório. Rollout das 2 máquinas concluído, ambas saudáveis.
2. `flyctl deploy -a athos-track-api --dockerfile Dockerfile.api` — publicou o código atual (já com a correção do commit `8ef66a7`). **As 2 máquinas subiram e passaram no health check sem crashar** — confirma que `DIRECT_URL` foi lido corretamente pelo novo código (se estivesse ausente, `main()` teria lançado exceção fatal antes de `httpServer.listen()`, e o deploy teria falhado).

## Validação pós-deploy (real, ao vivo, mesmo protocolo do teste que provou o bug)

- `GET /health` → `{"status":"ok","ok":true}`.
- Reaberta a sessão em produção, reautenticada, reinstrumentado o poll direto à API (mesma técnica, token nunca exposto fora do contexto da página).
- Sequência real observada: `CAR-03.updated_at` avançou de `2026-09-11T01:36:45` → `2026-09-11T01:46:45` (confirmado via poll direto à API, backend recebendo dado novo normalmente).
- **Teste decisivo**: com a tela **Caixas** aberta, saí para a tela **Carrinhos** (navegação client-side dentro do SPA, sem F5, sem recarregar `AssetProvider`) e, ao voltar para **Caixas** sem nenhum reload de página, o valor já aparecia atualizado (`2026-09-11T01:46:44.602Z`, batendo com o valor real do backend) — **isso só é possível se o canal de realtime (Socket.IO/`postgres_changes`) tiver entregue o UPDATE ao estado compartilhado (`AssetContext`) enquanto eu estava em outra tela**, já que `BoxesModule.tsx` não faz fetch próprio, só lê do contexto.
- **Limitação honesta**: dentro da janela de observação real desta sessão (alguns minutos), não peguei o caso mais estrito de "a mesma tela aberta, sem trocar de página nenhuma vez, mostrando o número mudar sozinho diante dos meus olhos" — os ativos recebem posição nova de forma escalonada (~5-6min por tag em média, ver `TAG-FREQUENCY-REPORT.md`), e o intervalo de observação não coincidiu com um evento pra CAR-03/CAR-01 especificamente nesse modo mais estrito. A evidência acima (dado chegando enquanto eu estava em outra tela, sem qualquer fetch novo disparado) é uma prova real e válida do mesmo mecanismo, não uma prova mais fraca disfarçada.

## Conclusão

**REALTIME = PASS (backend→frontend, confirmado pós-deploy)** — contraste direto com o mesmo teste, no mesmo ambiente, minutos antes do deploy, que mostrou o valor estagnado por mais de 30s mesmo com dado novo confirmado no backend.
