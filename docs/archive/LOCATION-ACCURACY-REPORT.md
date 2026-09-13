# LOCATION-ACCURACY-REPORT.md

## Precisão real: LOCATION ACCURACY = UNKNOWN (não fabricado)

Nenhuma das 10 tags Zaffari tem `accuracy`/`radius`/`precision`/`confidence` no payload real retornado pelo fornecedor (confirmado em `LIVE-POSITION-EVIDENCE.md`, sessão anterior, e reconfirmado nesta auditoria — `telemetry_gps_accuracy` é `null` nas 10). **Não inventamos um valor de precisão** — o círculo de precisão visual (seção 11, já implementado em `AssetMap.tsx` desde antes desta sessão) simplesmente não aparece pra nenhuma dessas tags, porque não há dado real pra desenhar.

## As posições "fora do local físico esperado" — o que sabemos e o que não sabemos

- 9 das 10 tags estão concentradas numa área de ~72m de raio na região de Alphaville/Barueri-SP.
- 1 tag (CART-07) está reportando, nesta sessão, uma posição ~21km distante das outras 9 (região de Osasco), com timestamp recente (não é posição congelada/antiga).
- **Não sabemos se isso reflete a posição física real do carrinho** (alguém pode tê-lo levado embora, é uma tag física, não é impossível) **ou se é uma característica de precisão do posicionamento do fornecedor** pra esse dispositivo específico. Nenhuma das duas hipóteses tem evidência suficiente pra ser afirmada como fato nesta sessão.
- **O que o ATHOS Track NÃO fez**: não movemos essa tag de volta pro grupo, não usamos a geofence do prédio pra "corrigir" a posição, não escondemos o outlier. A regra do brief (seção 12/40) é explícita: geofence não é posição, e não se deve simular precisão que não existe.

## Origem da localização (seção 9/16)

`LOCATION_SOURCE = PROVIDER` — a coordenada é gerada inteiramente do lado do fornecedor BRGPS. O rótulo interno `'GPS'` que aparece na UI (`telemetry_position_source`) é uma constante fixa no código do mapper (`BrGpsMapper.ts`), **não uma confirmação técnica do fornecedor de que o método é GPS de satélite** — as tags são fisicamente discos BLE sem antena celular/GPS visível documentada (`docs/HARDWARE-CATALOG.md`). Isso é um gap de rotulagem identificado, não corrigido nesta sessão (mudar o rótulo exigiria confirmação do fornecedor sobre o método real, que não temos).

## Círculo de precisão (seção 11)

Código já existe (`AssetMap.tsx`, camada `layers.gpsAccuracy`) — condicionado à existência de `telemetry_gps_accuracy`. Como o campo é sempre `null` pras 10 tags reais, o círculo nunca é desenhado hoje. Não é um bug: é o comportamento correto (não fabricar um raio de precisão que o fornecedor não informou).

## Geofence ≠ posição (seção 12) — verificado no código

Nenhuma das 10 tags tem geofence configurada hoje. Mesmo se tivesse, o código nunca usa o centro/área de uma geofence como origem de posição do marcador — o marcador é sempre `asset.telemetry.latitude/longitude`, ponto final (`upsertAssetMarker`, `AssetMap.tsx`).
