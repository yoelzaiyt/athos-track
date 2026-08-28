# Multi-Provider — Arquitetura

## Achado importante: Heile, Jason e BRGPS são o mesmo fornecedor

O brief que motivou esta rodada descreve dois fornecedores, "Heile" e
"Jason", com credenciais e endpoints próprios. Na prática:

- A chave passada como credencial da **Heile** é **exatamente** o mesmo
  valor já configurado como `BRGPS_API_TOKEN` neste projeto (`.env`, nunca
  versionado — ver `.gitignore`), desde antes desta rodada. (Achado
  FINAL-PRE-PRODUCTION-GATE.md: o valor literal do token estava escrito
  aqui neste arquivo antes desta correção — removido; nunca chegou a ser
  commitado.)
- A URL de documentação da **Jason** (`brgps.com/open`) é o mesmo domínio da
  integração BRGPS já implementada.
- Os endpoints documentados pra Jason (`PATCH /tag` ativação, `GET /tag`
  localização em lote, `GET /tag/history` histórico) são **idênticos** ao
  que `server/integrations/brgps/BrGpsAdapter.ts` já implementa.

Confirmado com o responsável do projeto nesta sessão: **é um fornecedor só**.
Por isso este projeto não tem `providers/heile/` e `providers/jason/` como
duas integrações separadas — isso seria fabricar uma segunda integração
fake pro mesmo fornecedor real (o brief, seção "NÃO FAZER", proíbe
explicitamente "criar dados simulados fingindo serem dados reais"). Existe
**um** provider real (`brgps`), registrado sob os três nomes.

## Camada `TrackingProvider`

```
server/integrations/
  shared/
    TrackingProvider.ts    — contrato comum (activateDevice, getCurrentLocation,
                              getLocationHistory, discoverDeviceIds, healthCheck)
    ProviderRegistry.ts     — registro por id + aliases
    geofenceEngine.ts        (já existia — reaproveitado, não duplicado)
  brgps/
    BrgpsProvider.ts        — implementa TrackingProvider, embrulha o que já
                              existia (BrGpsClient/BrGpsAdapter/BrGpsMapper —
                              nenhum dos três foi reescrito)
    BrGpsClient.ts, BrGpsAdapter.ts, BrGpsMapper.ts, BrGpsService.ts, db.ts
                             (inalterados — ver docs/integrations/BRGPS.md)
```

`server/api/index.ts` registra o provider no boot:

```ts
ProviderRegistry.register(brgpsProvider, ['heile', 'jason']);
```

`ProviderRegistry.get('heile')` e `.get('jason')` resolvem pro mesmo objeto
que `.get('brgps')` — mesmo dado real, sem duplicar estado.

## Endpoints administrativos novos

- `GET /providers/:providerId/health` — status operacional (seção 22 do
  brief). Autenticado, leitura livre (mesmo nível de `GET /rest/provider_health`).
  `:providerId` aceita `brgps`, `heile` ou `jason`.
- `POST /providers/:providerId/activate` — ativação de tag (seção 7),
  `ATHOS_ADMIN`-only. Grava em `audit_logs` (actor, ação, ids, resultado —
  nunca o token) via `server/api/audit.ts`.

Testado ao vivo nesta sessão: os dois aliases devolvem os mesmos dados reais
de `provider_health`; `VIEWER` recebe 403 em `/activate` e 200 em `/health`;
a ativação registra em `audit_logs` de verdade (não `console.log`).

## O que já cobre as exigências técnicas do brief (reaproveitado, não novo)

Tudo isto já existia em `server/integrations/brgps/` antes desta rodada —
listado aqui só pra deixar claro que **não foi reimplementado**:

| Exigência do brief | Onde já estava resolvido |
|---|---|
| §6 `api_token`/`timestamp` gerados no backend, nunca no frontend | `BrGpsClient.buildHeaders()` |
| §6 rate limit 100 req/min | `SlidingWindowLimiter` em `BrGpsClient.ts` |
| §7 `PATCH /tag` ativação | `BrGpsAdapter.activateDevices()` |
| §8 `GET /tag` com múltiplos IDs (batching) | `BrGpsAdapter.fetchPositions()` |
| §9 `GET /tag/history` | `BrGpsAdapter.fetchHistory()` |
| §13 modelo normalizado independente de fornecedor | `NormalizedPosition` (`types.ts`) — alias `NormalizedLocation` em `TrackingProvider.ts` |
| §17 polling controlado, não 1 chamada/tag | `BrGpsService.runSyncTick()`, `BRGPS_SYNC_INTERVAL_SECONDS` |
| §18 distinguir posição fresca/antiga | `qualityFlags: STALE_POSITION/FUTURE_TIMESTAMP` em `BrGpsMapper.ts` |
| §19 não duplicar pontos idênticos | `positionFingerprint()` em `BrGpsMapper.ts` |
| §20 evento de geofence | `server/integrations/shared/geofenceEngine.ts` |
| §22 provider health | tabela `provider_health` + `BrGpsService.upsertProviderHealth` |
| §23 backoff/retry em erro transitório | `BrGpsClient.request()` (retry só em 5xx/timeout/timestamp) |
| §24 não derrubar a app por falha do provider | `BrGpsService.runSyncTick()` captura erro por ciclo, não propaga |

## Pendências reais

- `HEALTHY`/`DEGRADED`/`UNAVAILABLE` na tela de Provider Health do frontend
  (existe a tabela e o endpoint; não há tela dedicada nova — só o card já
  existente que já lia `provider_health`).
- Testes automatizados G/H/K/L/M da seção 29 (timestamp, batching, 429,
  timeout, payload inválido) — a lógica existe e foi exercitada
  manualmente; não há suíte automatizada nova cobrindo especificamente esses
  cenários (só os testes de mapper já existentes, `BrGpsMapper.test.ts`).
- GT06 direto (`GT06Provider`/`DirectGT06Gateway`) — deliberadamente **não**
  implementado nesta rodada (o brief pede isso explicitamente: "NÃO
  implementar servidor GT06 completo nesta fase"). O listener TCP já existe
  (`server/gt06-listener/`) e prova que o protocolo já é falado neste
  projeto — vira um segundo `TrackingProvider` no futuro sem mexer no
  contrato (`TrackingProvider.ts` já é genérico o bastante).
