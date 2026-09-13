# LIVE-LATENCY-REPORT.md

Medido, não fabricado (seção 37 do brief: "não prometer milissegundos sem prova"). Amostras reais coletadas nesta sessão, com os 2 loops de sync rodando de verdade contra os 2 fornecedores BRGPS.

## PROVIDER → ATHOS (GET /tag, latência de rede até o fornecedor)

Amostras reais extraídas dos logs do loop de sync contínuo desta sessão (não sintéticas):

| Conta | Amostras | P50 | P95 | MAX | MIN |
|---|---|---|---|---|---|
| BRGPS_2 (Zaffari, endpoint China) | 218 | 804ms | 1015ms | 2832ms | 702ms |
| BRGPS (São João, endpoint internacional) | 227 | 834ms | 890ms | 1361ms | 676ms |

Este número é dominado pela latência de rede real até o servidor do fornecedor — não é algo que o ATHOS Track controle ou possa otimizar além de usar conexões keep-alive (já em uso, `fetch` nativo do Node).

## ATHOS INGESTION + DB (parse + UPDATE/INSERT no Postgres)

**Não medido separadamente** — o código atual (`BrGpsService.runSyncTick`) não instrumenta esse passo isoladamente do tempo de rede. O ciclo completo (`GET /tag` + parse + grava no Postgres via `DIRECT_URL`) ficou consistentemente entre 700ms e 2,8s nos logs — como a chamada de rede sozinha já responde nessa faixa (tabela acima), o processamento local (parse + write) é uma fração pequena disso, mas não tenho um número isolado real pra reportar. Marcado como lacuna de instrumentação, não estimado.

## DB → SOCKET.IO (LISTEN/NOTIFY → entrega no cliente)

Medido isoladamente nesta sessão com um teste dedicado (servidor real, cliente Socket.io real, 15 ciclos de `UPDATE` real em `assets`, `localhost`→`localhost`):

| Amostras | P50 | P95 | MAX | MIN |
|---|---|---|---|---|
| 15 | 14ms | 21ms | 21ms | 11ms |

**Ressalva honesta**: isso mede a cadeia inteira Postgres→trigger→NOTIFY→`realtime.ts`→Socket.io→cliente, mas em `localhost` — sem a latência de rede real entre o servidor (Fly.io, região `gru`) e o navegador do usuário final, que depende da conexão de internet de quem está olhando o mapa (não medível a partir desta sessão de desenvolvimento).

## FRONTEND + MAP RENDER (recebimento do evento → marcador atualizado na tela)

**Não medido com instrumentação de código** — não há timestamp de "recebi o evento" e "terminei de atualizar o DOM/Leaflet" no frontend hoje. Evidência qualitativa apenas: nenhum lag perceptível observado durante o teste visual manual (`REALTIME-MAP-EVIDENCE.md`); `upsertAssetMarker` faz `setLatLng`/`setIcon` (operações síncronas do Leaflet, tipicamente sub-milissegundo pra um único marcador). Não reporto um número aqui porque não medi um — reportar "provavelmente <5ms" seria exatamente o "fabricar número" que a seção 37 proíbe.

## Resumo — o que dá pra afirmar com evidência

- **PROVIDER → ATHOS**: ~700ms–1s típico, até ~2,8s no pior caso observado. Medido, real, 445 amostras no total.
- **DB → Socket.io (entrega no cliente)**: ~11–21ms em localhost. Medido, real, mas não representa a rede até um usuário remoto.
- **Ingestão local (parse+DB) e render do frontend**: não instrumentados — não reportados como número, só como "sem evidência própria" nesta sessão.
