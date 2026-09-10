# MOVEMENT-TEST-REPORT.md

Teste real de deslocamento (seção 5/9/23 do brief), com os dois loops de sync (`npm run brgps:sync` + `--account=2`) rodando continuamente durante o teste. Distâncias calculadas por Haversine sobre `asset_route_points` real (não estimativa).

## Sequências reais capturadas (T0..Tn), 10 tags Zaffari

| TAG | Pontos | Distância acumulada | Maior salto único | Intervalo típico entre pontos |
|---|---|---|---|---|
| ZAF-CART-01 | 3 | 19.1m | 19.1m (T0→T1) | ~5–35min (irregular — ver "Frequência real" abaixo) |
| ZAF-CART-02 | 4 | 10.7m | 6.3m | ~5–35min |
| ZAF-CART-03 | 4 | 47.7m | 35.6m (T0→T1) | ~3–41min |
| ZAF-CART-04 | 4 | 42.5m | 33.9m (T0→T1) | ~4–39min |
| ZAF-CART-05 | 5 | 46.3m | 22.5m (T0→T1) | ~3–36min |
| ZAF-CART-06 | 4 | 5.6m | 2.8m | ~5–42min |
| ZAF-CART-07 | 4 | 8.4m | 8.2m | ~4–37min |
| ZAF-CART-08 | 3 | 40.4m | 33.3m (T0→T1) | ~3–42min |
| ZAF-CART-09 | 3 | 5.3m | 3.5m | ~10–37min |
| ZAF-CART-10 | 4 | 9.4m | 4.4m | ~5–40min |

Exemplo bruto (ZAF-CART-05, imei 3092533106):
```
T0->T1: 22.5m em 2149s (2026-09-10T15:32:08Z -> 2026-09-10T16:07:57Z)
T1->T2: 6.8m em 325s  (2026-09-10T16:07:57Z -> 2026-09-10T16:13:22Z)
T2->T3: 8.2m em 525s  (2026-09-10T16:13:22Z -> 2026-09-10T16:22:07Z)
T3->T4: 8.9m em 183s  (2026-09-10T16:22:07Z -> 2026-09-10T16:25:10Z)
```
Confirma a condição mínima do brief: **X1/Y1 ≠ X2/Y2** em todas as 10 tags, com timestamp real do dispositivo (`recorded_at`), não do relógio local.

## Limiar de movimento (seção 9) — proposto, não hard-coded no schema

Os saltos T0→T1 (19–48m) ocorreram sobre um intervalo de ~35–41min **sem sync contínuo rodando** (gap entre o `sync-once` manual anterior e o início desta sessão) — não são uma taxa de deslocamento, são "onde a tag estava" em dois instantes distantes. Os saltos *depois* do sync contínuo começar (intervalos de 3–10min) ficam entre **0,0m e 8,9m** — dentro da faixa típica de ruído de GPS/BLE-Gateway pra um dispositivo sem `gpsAccuracy` informada pelo fornecedor (campo sempre `null` nesta integração).

**Não declaro "movimento confirmado" por segmento nenhum abaixo de um limiar não verificado.** Proposta de limiar configurável (não implementado como regra automática nesta sessão — ver Pendências): **10 metros entre pontos consecutivos** como piso de "deslocamento real" vs. ruído, dado que o fornecedor não informa `distance`/`accuracy` utilizável (`docs/integrations/BRGPS.md`, "Limitações conhecidas"). Abaixo disso, classificar como `LIVE_STATIC` (ligada, online, comunicando, sem deslocamento confirmável); acima, `LIVE_MOVING`.

Com esse limiar de 10m: **ZAF-CART-03, 04, 05 e 08 mostram deslocamento real confirmado** (saltos de 20–36m); as demais (01, 02, 06, 07, 09, 10) ficam abaixo do limiar nesta janela de observação — não significa que não se moveram, significa que esta sessão não capturou um salto grande o suficiente pra distinguir de ruído com a precisão que o fornecedor oferece.

## São João — sem sequência de movimento válida

- **CAR-03**: 4 pontos no histórico, mas os 3 mais recentes (desde que o sync contínuo começou) são **dedup exato** — mesma posição, mesmo fingerprint. `STALE_PROVIDER_DATA`, não movimento.
- **CAR-01**: nenhum ponto novo desde 2026-09-02 (8 dias). API não retorna esta tag em nenhum ciclo desta sessão. Sem sequência pra medir distância.

## Regra de verdade aplicada

Nenhuma das 12 tags teve coordenada fabricada, mock ou seed usada nesta análise — todos os pontos vêm de `asset_route_points`, gravados pelo pipeline real (`BrGpsRepository.applyPosition`) a partir de respostas reais da API. Onde não havia dado suficiente (São João), o resultado é **NO NEW LIVE POSITION RECEIVED**, registrado como tal, não como PASS.
