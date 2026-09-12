# TAG-FREQUENCY-REPORT.md

Medido a partir de `asset_route_points` real (502 intervalos observados, 48-56 pontos por tag, acumulados desde que o loop de sync contínuo foi ligado nesta sessão). Não é o intervalo de polling configurado (15s) — é o intervalo real entre EVENTOS NOVOS de cada tag física.

## Por tag (segundos)

| TAG | Pontos | MIN | P50 | P95 | MAX |
|---|---|---|---|---|---|
| ZAF-CART-01 | 49 | 2s | 342s (5,7min) | 924s (15,4min) | 2085s (34,8min) |
| ZAF-CART-02 | 48 | 28s | 360s (6,0min) | 882s (14,7min) | 2074s (34,6min) |
| ZAF-CART-03 | 51 | 22s | 348s (5,8min) | 671s (11,2min) | 2476s (41,3min) |
| ZAF-CART-04 | 56 | 40s | 301s (5,0min) | 662s (11,0min) | 2356s (39,3min) |
| ZAF-CART-05 | 50 | 22s | 332s (5,5min) | 791s (13,2min) | 2149s (35,8min) |
| ZAF-CART-06 | 52 | 17s | 331s (5,5min) | 761s (12,7min) | 2529s (42,2min) |
| ZAF-CART-07 | 49 | 6s | 353s (5,9min) | 1208s (20,1min) | 2201s (36,7min) |
| ZAF-CART-08 | 53 | 52s | 359s (6,0min) | 706s (11,8min) | 2526s (42,1min) |
| ZAF-CART-09 | 48 | 24s | 333s (5,6min) | 768s (12,8min) | 2229s (37,2min) |
| ZAF-CART-10 | 56 | 32s | 326s (5,4min) | 674s (11,2min) | 2433s (40,6min) |

## Agregado (todas as 10, 502 intervalos)

**MIN: 2s | P50: 332s (~5,5min) | P95: 791s (~13,2min) | MAX: 2529s (~42min)**

Os valores MAX (35-42min) vêm majoritariamente do intervalo antes do loop de sync contínuo estar ativo nesta sessão (gap real entre um `sync-once` manual anterior e o início do loop) — não representam o comportamento em regime contínuo. Descartando esses outliers de startup, o padrão real em regime é **~5-6 minutos entre posições novas por tag, com picos de até ~13 minutos (P95)**.

## Conclusão

O poll do ATHOS roda a cada 15s (`BRGPS_SYNC_INTERVAL_SECONDS`), mas a tag física só transmite (ou o fornecedor só disponibiliza) posição nova a cada ~5-6 minutos em média. **A frequência real de atualização visível pro usuário é limitada pelo dispositivo/fornecedor, não pelo ATHOS** — isso não é um valor configurado sendo usado como prova (seção 13 do brief), é medido a partir de 502 eventos reais.
