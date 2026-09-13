# 10-TAGS-LIVE-AUDIT.md

Snapshot real, consultado direto no banco, 2026-09-10T21:13:08Z. Todas as 10 confirmadas: `tenant=ZAFFARI`, `category=cart` (carrinho), existência da linha = autorizada (nunca criada automaticamente), `provider='BRGPS_2'` preenchido = habilitada/rastreando.

| TAG ID | FOUND IN DB | FOUND AT PROVIDER | LAST EVENT (idade) | LAT | LNG | ACCURACY | CONNECTION | MAP MARKER | VISIBLE | RESULT |
|---|---|---|---|---|---|---|---|---|---|---|
| 3092524960 (CART-01) | YES | YES | 66s | -23.503849 | -46.8484483 | null (não informado) | ONLINE | sim | agrupado (cluster) | PASS |
| 3092524712 (CART-02) | YES | YES | 479s | -23.5038888 | -46.8486327 | null | ONLINE | sim | agrupado (cluster) | PASS |
| 3092533124 (CART-03) | YES | YES | 118s | -23.503849 | -46.8484483 | null | ONLINE | sim | agrupado (idêntica a CART-01) | PASS |
| 3092524666 (CART-04) | YES | YES | 118s | -23.5037568 | -46.8483615 | null | ONLINE | sim | agrupado (cluster) | PASS |
| 3092533106 (CART-05) | YES | YES | 50s | -23.503849 | -46.8484483 | null | ONLINE | sim | agrupado (idêntica a CART-01/03) | PASS |
| 3092524840 (CART-06) | YES | YES | 695s | -23.5038888 | -46.8486327 | null | ONLINE | sim | agrupado (idêntica a CART-02) | PASS |
| 3092524939 (CART-07) | YES | YES | 50s | -23.5604756 | -46.7092358 | null | ONLINE | sim | **individual — ~21km das outras 9** | PASS (posição atípica, ver `MAP-MARKER-VISIBILITY.md`) |
| 3092533107 (CART-08) | YES | YES | 66s | -23.5037568 | -46.8483615 | null | ONLINE | sim | agrupado (idêntica a CART-04) | PASS |
| 3092524906 (CART-09) | YES | YES | 463s | -23.5036354 | -46.8489823 | null | ONLINE | sim | agrupado (cluster) | PASS |
| 3092533120 (CART-10) | YES | YES | 99s | -23.5036502 | -46.8482728 | null | ONLINE | sim | agrupado (cluster) | PASS |

**10/10 encontradas no banco. 10/10 reconhecidas pelo fornecedor (confirmado via `discover`, sessão anterior, e via recebimento contínuo de posição nesta sessão). 10/10 com posição válida. 10/10 visíveis no mapa** (algumas dentro de um cluster com contador, não escondidas — ver correção em `MAP-MARKER-VISIBILITY.md`).

## Contadores finais (seção 37)

- **VISIBLE INDIVIDUALLY**: 1/10 (CART-07, isolada pela distância real)
- **CLUSTERED/OVERLAPPED**: 9/10 (todas dentro de ~72m umas das outras, formando um único cluster contíguo neste snapshot)
- **NO POSITION**: 0/10
- **OFFLINE**: 0/10

## Nota sobre `accuracy`

Nenhuma das 10 tags tem `telemetry_gps_accuracy` preenchido — o fornecedor BRGPS nunca retorna esse campo (confirmado no payload real capturado em sessão anterior). Isso significa: não temos como diferenciar tecnicamente "coordenada idêntica porque os carrinhos estão fisicamente encostados" de "coordenada idêntica porque o fornecedor arredonda/reusa uma leitura". Ambas as hipóteses continuam em aberto — não assumimos nenhuma das duas sem confirmação do fornecedor.
