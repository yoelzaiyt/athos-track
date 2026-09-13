# MAP-GEOFENCE-EVIDENCE.md

## Seção 13 — "geofence não é posição" (verificado, não alterado)

Inspeção de código confirma: o marcador do ativo é **sempre** desenhado a partir de `asset.telemetry.latitude/longitude` (posição real recebida do fornecedor) em `upsertAssetMarker`. A geofence é renderizada como camada separada (polígono/círculo, `geofenceLayersRef`), nunca usada como origem de posição do marcador. Não há, em nenhum ponto do código (`AssetMap.tsx`, `server/integrations/brgps/db.ts`), um caminho que substitua a coordenada real pelo centro de uma geofence.

## Seção 14 — INSIDE/OUTSIDE/NEAR_BOUNDARY/UNKNOWN considerando accuracy

**Não implementado nesta sessão — gap real, marcado explicitamente, não escondido.**

O motor de geofence existente (`server/integrations/shared/geofenceEngine.ts`, `isInsideGeofence`) faz só uma checagem binária (dentro/fora), usada em `BrGpsRepository.applyPosition` pra decidir `status = 'out_of_geofence'` e disparar alertas de entrada/saída — isso já funciona e não foi tocado.

O que a seção 14 pede (classificação em 4 estados, considerando `accuracy`/raio de erro pra não afirmar "dentro" com certeza quando a precisão é ruim) exigiria código novo. Não implementei porque:
1. Nenhuma das 12 tags reais tem `gpsAccuracy` preenchido — o fornecedor BRGPS nunca retorna esse campo (confirmado em `LIVE-POSITION-EVIDENCE.md` da sessão anterior, payload real capturado). Implementar a lógica sem nenhum dado real pra validar contra seria código não testável nesta sessão.
2. Não há geofence real configurada em nenhum dos 12 ativos hoje pra testar a classificação de qualquer forma.

Se/quando o fornecedor passar a informar precisão, ou uma geofence real for configurada num dos 12 ativos, esse é o próximo passo concreto — não implementar antes disso seria código especulativo sem evidência de funcionamento real.

## Seção 15 — círculo de precisão visual

**Já existia antes desta sessão**, não foi preciso criar: `AssetMap.tsx` já renderiza `L.circle` ao redor do marcador quando `layers.gpsAccuracy` está ligado E `asset.telemetry.gpsAccuracy` tem valor. Como nenhuma das 12 tags reais tem esse campo preenchido (mesmo motivo do item acima), o círculo nunca aparece hoje — comportamento correto (não inventa uma precisão que não existe), só não visualmente demonstrável com o dataset real atual. Corrigido nesta sessão um bug relacionado: o drawer mostrava "±8m" fabricado como fallback quando `gpsAccuracy` era `null` (ver `MAP-NAVIGATION-REPORT.md` da sessão anterior, seção do achado de bateria/sinal fabricados) — já removido.

## Seção 16 — origem da localização (indoor/GPS/BLE/etc.)

Documentado (não novo nesta sessão): `docs/integrations/BRGPS.md` já registra que as tags são "BLE Gateway" (protocolo salvo em `assets.protocol`), a origem exibida na UI é `telemetry.positionSource` (vem do fornecedor como `'GPS'` pra todas as 12 tags reais, confirmado no banco) — nunca inventado. Não há hoje diferenciação de "GPS real" vs. "BLE/Wi-Fi/cell triangulation" além do que o próprio fornecedor informa nesse campo — se a tag está fisicamente indoor, a precisão desse "GPS" reportado pode ser ruim, mas isso é uma limitação de dado de origem, não algo o ATHOS Track possa validar sem o `accuracy` que o fornecedor não envia.
