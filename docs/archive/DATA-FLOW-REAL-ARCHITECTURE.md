# DATA-FLOW-REAL-ARCHITECTURE.md

## Caminho real, verificado no código e testado ao vivo (não hipótese)

```
TAG FÍSICA (disco BLE, sem SIM próprio confirmado)
   ↓  (mecanismo de rádio da tag até a infraestrutura do fornecedor — não visível/controlável pelo ATHOS)
NUVEM DO FORNECEDOR (BRGPS, conta "BRGPS_2" / brseek.39gps.com, China)
   ↓  GET /tag (polling — ver PROVIDER-INGESTION-MODE.md)
BACKEND ATHOS (server/brgps-sync/index.ts, loop a cada 15s)
   ↓  parse (server/integrations/brgps/BrGpsMapper.ts)
POSTGRES (UPDATE assets + INSERT asset_route_points, via DIRECT_URL)
   ↓  trigger assets_notify_update → pg_notify('table_changes', ...)
LISTEN/NOTIFY (server/api/realtime.ts, via DIRECT_URL — nunca DATABASE_URL/pooler)
   ↓  io.to(tenantRoom).emit('postgres_changes:assets', payload)
SOCKET.IO (autenticado por JWT, isolado por tenant room)
   ↓
FRONTEND (src/lib/supabaseClient.ts shim → AssetContext.tsx → AssetMap.tsx)
   ↓
MARCADOR NO MAPA (upsertAssetMarker — atualiza in-place, sem F5)
```

Corresponde à opção **F** do brief (seção 5): "polling da nossa aplicação na API externa" — confirmado, não escolhido por suposição.

## Isso é conexão direta do dispositivo com o ATHOS?

**NÃO.** Resposta objetiva à seção 8:

```
TAG FÍSICA
  → infraestrutura do fornecedor BRGPS (intermediário — controla como/quando a tag reporta)
  → nossa API consulta essa infraestrutura via HTTP (polling)
  → nosso banco
  → nosso Socket.io
  → navegador do usuário
```

Existem, no mínimo, **dois intermediários fora do controle do ATHOS**: o rádio/gateway físico entre a tag e a nuvem do fornecedor (mecanismo não documentado — ver seção "origem da coordenada" abaixo), e a própria nuvem do fornecedor (que decide o que retornar em `GET /tag`, com que atraso, e com que coordenada).

## Onde a coordenada é criada (seção 9)

**LOCATION_SOURCE = PROVIDER** (não confirmável além disso). O payload real do fornecedor só traz `lat`/`lng`/`battery`/`mac`/`timestamp`/`publishTime` — nenhum campo `source`/`method`/`accuracy` que diga se veio de GPS puro, BLE, triangulação de celular ou outra técnica. O campo interno `telemetry_position_source` do ATHOS é preenchido com a string fixa `'GPS'` no código do mapper — **isso é uma suposição herdada do nome do protocolo declarado (`assets.protocol='BLE Gateway'`), não uma confirmação técnica do fornecedor**. Marcado aqui como um gap: o rótulo "GPS" na UI não deveria ser tratado como garantia de precisão GPS real, dado que a tag é fisicamente um disco BLE sem antena celular/GPS visível (catalogado em `docs/HARDWARE-CATALOG.md`, sessões anteriores).

## API x Webhook x Polling (seção 6)

**CURRENT INGESTION MODE: API POLLING.**

Evidência:
- Arquivo: `server/brgps-sync/index.ts`, comando `sync` — loop `while(true)` com `setTimeout(..., BRGPS_SYNC_INTERVAL_SECONDS * 1000)`.
- Processo responsável: `npx tsx server/brgps-sync/index.ts sync --account=2` (rodando nesta sessão).
- Endpoint: `GET /tag` (lote, `BrGpsAdapter.ts`).
- Nenhum endpoint de webhook/callback é exposto pelo ATHOS pro fornecedor chamar — `server/api/index.ts` não tem rota `POST /webhook/*` ou similar pra ingestão de posição.
- `docs/integrations/BRGPS.md` não documenta a existência de um mecanismo de push/webhook oficial do fornecedor — não foi inventado nenhum.
