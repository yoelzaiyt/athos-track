# Integração Jason (= BRGPS)

> **Antes de ler:** "Jason" (nome usado no brief que motivou este documento)
> é o mesmo fornecedor já documentado em `docs/integrations/BRGPS.md` — mesmo
> token, mesma URL, mesmos endpoints. Ver `docs/PROVIDER-ARCHITECTURE.md`
> pra evidência da equivalência. Este documento só traduz a nomenclatura do
> brief pra quem chegar procurando "Jason" especificamente; a documentação
> técnica completa (arquitetura, arquivos, responsabilidades) está em
> `docs/integrations/BRGPS.md` — não duplicada aqui.

## Endpoints (documentação recebida ↔ implementação real)

| Endpoint do brief | Implementação | Onde |
|---|---|---|
| `GET /tag/all` (descoberta) | `discoverAllDeviceIds()` | `BrGpsAdapter.ts` |
| `PATCH /tag` (ativação) | `activateDevices()` / `POST /providers/jason/activate` | `BrGpsAdapter.ts` / `routes-providers.ts` |
| `GET /tag?ids=...` (localização em lote) | `fetchPositions()` | `BrGpsAdapter.ts` |
| `GET /tag/history?Id=&TimeFrom=&TimeTo=` | `fetchHistory()` | `BrGpsAdapter.ts` |

Formato de resposta (`statusCode`/`message`/`data`/`problem`) já mapeado em
`BrGpsEnvelope` (`types.ts`) — bate com o exemplo do brief (`{"statusCode":
200, "message": "OK", "data": [...]}`).

## Headers obrigatórios

`api_token` e `timestamp` (Unix seconds, validade curta) — gerados **só no
backend**, a cada chamada, em `BrGpsClient.buildHeaders()`. O cliente HTTP
ainda corrige desvio de relógio da máquina automaticamente (lendo o header
`Date` da resposta do fornecedor) — não pedido pelo brief, já existia.

## Variável de ambiente

```env
JASON_API_TOKEN=  # alias — mesmo valor de BRGPS_API_TOKEN, ver .env
```

`server/api/index.ts` **não lê `JASON_API_TOKEN`** — o provider real é
instanciado com `BRGPS_BASE_URL`/`BRGPS_API_TOKEN` (fonte de verdade). A
variável existe só pra quem procurar `JASON_API_TOKEN` no ambiente encontrar
e entender a relação, conforme pedido explícito do brief (seção 11).

## Rate limit e proteção contra abuso

100 req/min por endpoint (`SlidingWindowLimiter`, `BrGpsClient.ts`),
300.000/dia documentado mas não contado localmente ainda (pendência —
o volume atual de tags reais não chega perto do limite diário; contagem
diária persistida fica como próximo passo se o volume crescer). Batching
via `ids=1,2,3` já usado no polling (`BrGpsService.runSyncTick()` busca
todos os alvos ativos numa chamada só, não uma por tag).

## Status real (não mock)

Testado ao vivo nesta sessão via `GET /providers/jason/health` — devolve o
`provider_health` real (`requestsTotal`, `lastSuccessAt` etc.), os mesmos
dados que a integração BRGPS já vinha acumulando antes desta rodada.
`POST /providers/jason/activate` testado com um ID de teste — chamada real
ao fornecedor confirmada (não mockada), resultado gravado em `audit_logs`.
