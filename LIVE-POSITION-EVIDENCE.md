# LIVE-POSITION-EVIDENCE.md

## Chamada direta à API (seção 16), sem passar pelo pipeline

```
GET /tag?ids=3092524712,3092524960  (conta BRGPS_2, China)
HTTP status: 200
Latência: 962ms
```

Payload real, sanitizado (sem token — o token nunca aparece no corpo da resposta do fornecedor, só no header de request, que não é logado):
```json
[
  {
    "battery": 3,
    "mac": "46:47:84:49:50:EC",
    "isActived": true,
    "id": 3092524712,
    "timestamp": 1789057679,
    "publishTime": 1789057798,
    "lat": -23.5039273,
    "lng": -46.8485786
  },
  {
    "battery": 3,
    "mac": "D8:C9:52:91:5E:FB",
    "isActived": true,
    "id": 3092524960,
    "timestamp": 1789057138,
    "publishTime": 1789057315,
    "lat": -23.5039801,
    "lng": -46.8484985
  }
]
```

Confirma ao vivo o que `docs/integrations/BRGPS.md` documenta: sem `accuracy`, sem `distance`, sem `%` de sinal/bateria — só `battery` na faixa -1..3. Nenhum desses três é fabricado em nenhuma camada (confirmado no banco: `telemetry_gps_accuracy`/`telemetry_signal_strength` ficam `null` pra dado real).

## Três timestamps, três significados (seção 18)

| Campo | Fonte | Exemplo (ZAF-CART-02) |
|---|---|---|
| `timestamp` (device/provider event time) | Momento real do fix de GPS no dispositivo | 2026-09-10T16:27:59.000Z |
| `publishTime` (provider timestamp) | Momento em que o fornecedor publicou/processou | 2026-09-10T16:29:58.000Z |
| `receivedAt` (server) | Momento em que `BrGpsMapper` normalizou a resposta HTTP no ATHOS | calculado como `now()` no instante do parse |

Atraso fornecedor: **119s (≈2min)** entre o fix de GPS e a publicação — medido, não estimado. Persistido sempre em UTC (`timestamptz` no Postgres); a UI (`formatRelativeTimePtBr`) só converte pra exibição local (pt-BR), nunca grava local no banco. Confirmado: `packet_ts`/`last_comm` no banco batem exatamente com os UTC acima, sem deslocamento de fuso.

## Frequência real (seção 4)

Medido em `asset_route_points` (não suposto): intervalo entre posições novas de uma mesma tag variou de **~3 a ~42 minutos** nesta janela de observação (ver `MOVEMENT-TEST-REPORT.md` pra tabela completa) — **não é "tempo real" no sentido de segundos**, é o intervalo real de transmissão de cada dispositivo BLE Gateway, que o ATHOS não controla. O loop de polling (`BRGPS_SYNC_INTERVAL_SECONDS=15`) consulta a cada 15s, mas só aplica posição quando o fornecedor de fato tem algo novo pra aquele ID — na maioria dos ciclos, `aplicadas=0-3` de 10 alvos.

## Rate limit (seção 16)

`SlidingWindowLimiter` em `BrGpsClient.ts`, 100 req/min. Com 2 loops rodando (15s de intervalo cada, 1 request em lote por ciclo) o uso real fica em ~8 req/min por conta — bem abaixo do limite. Nenhum `429`/`rate_limited` observado nesta sessão (`provider_health.rate_limited_total = 0` nas duas contas).

## Latência ponta a ponta (fornecedor → banco)

Medido diretamente nos ciclos de sync desta sessão: **700–2700ms** por ciclo completo (`GET /tag` + parse + `UPDATE`/`INSERT` no Postgres via `DIRECT_URL`). Latência de rede até o fornecedor domina o tempo (700-900ms típico), não o processamento local.
