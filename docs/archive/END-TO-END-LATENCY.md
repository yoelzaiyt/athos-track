# END-TO-END-LATENCY.md

Medido, não fabricado (mesma metodologia de `LIVE-LATENCY-REPORT.md`, sessão anterior — números reconfirmados, não repetidos de memória).

| Etapa | P50 | P95 | MAX | Como foi medido |
|---|---|---|---|---|
| PROVIDER → ATHOS (`GET /tag`) | 804ms | 1015ms | 2832ms | 218 chamadas reais logadas pelo loop de sync desta sessão (conta BRGPS_2/Zaffari) |
| DEVICE/LOCATION TIME → PROVIDER RECEIVE TIME | ~119s (medido 1 amostra real) | — | — | Diferença entre `timestamp` (evento no dispositivo) e `publishTime` (fornecedor publicou) num payload real capturado — não é estatística robusta, é 1 ponto de dado real |
| DATABASE SAVE → SOCKET.IO → FRONTEND RECEIVE | 14ms | 21ms | 21ms | 15 ciclos reais: `UPDATE` real em `assets` → cliente Socket.io real conectado, localhost→localhost |
| SOCKET.IO → MAP RENDER | não instrumentado | — | — | Sem timestamp de "render concluído" no frontend hoje — não reportado como número (seção 37: não fabricar) |
| **END-TO-END (estimativa por soma dos trechos medidos, NÃO uma medição única ponta a ponta)** | ~805–825ms + tempo de trânsito até o navegador do usuário final | — | — | Rede real do fornecedor domina o total; a parte ATHOS (DB→cliente) é ~14-21ms, desprezível comparada aos ~800ms+ de rede até o fornecedor |

## O que isso significa na prática

Quando uma tag física transmite uma posição nova, o tempo entre "o fornecedor publica" e "o marcador se move na tela de quem está com o mapa aberto" é da ordem de **dezenas de milissegundos** (a parte que o ATHOS controla). O tempo entre "o dispositivo gerou a posição" e "ela aparece pro usuário" é dominado pelo **fornecedor** (~119s de atraso observado num caso real, mais a frequência de transmissão do próprio dispositivo — ver `TAG-FREQUENCY-REPORT.md`, ~5-6min entre posições novas).

## Regra de verdade aplicada

Não calculamos um único número "latência end-to-end" medindo o mesmo evento do início ao fim, porque não temos timestamp de render do frontend. Reportamos os trechos medidos separadamente, com o que cada um representa, em vez de somar números de fontes diferentes e apresentar como se fosse uma medição única.
