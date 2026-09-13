# PROVIDER-INGESTION-MODE.md

## Resposta objetiva (seção 6/31 do brief)

**CURRENT INGESTION MODE: API POLLING**

| Item | Evidência |
|---|---|
| Arquivo responsável | `server/brgps-sync/index.ts` (CLI) + `server/integrations/brgps/BrGpsService.ts` (`runSyncTick`) |
| Processo responsável | `npx tsx server/brgps-sync/index.ts sync --account=2` — rodando continuamente nesta sessão |
| Endpoint utilizado | `GET /tag?ids=<lote>` (posição em lote), `GET /tag/all` (descoberta), `PATCH /tag` (ativação) |
| Evento recebido | Nenhum — o ATHOS **pergunta**, o fornecedor responde. Não há callback/webhook do fornecedor pro ATHOS. |
| Intervalo configurado | `BRGPS_SYNC_INTERVAL_SECONDS=15` (`.env`) |
| Intervalo real observado (por tag) | Muito maior que 15s — ver `TAG-FREQUENCY-REPORT.md`. O poll roda a cada 15s, mas só ~1-3 das 10 tags têm posição NOVA em cada ciclo; a maioria dos ciclos não traz nada de novo pra uma tag específica. |

## Rate limit (seção 30)

`SlidingWindowLimiter` em `BrGpsClient.ts`: **100 requisições/minuto** por conta. Com o loop de 15s fazendo 1 requisição em lote por ciclo, o uso real fica em ~4 req/min — bem abaixo do limite. Nunca observado `rate_limited_total > 0` em nenhuma das duas contas nesta sessão.

## Não existe webhook (seção 32) — não avaliado migrar

`docs/integrations/BRGPS.md` não documenta nenhum mecanismo push/webhook oficial do fornecedor. Não há nada pra comparar "latência polling vs. push" porque a segunda opção não existe tecnicamente pra esse fornecedor, até onde a documentação real (não suposição) permite confirmar.

## Não existe conexão direta dispositivo→ATHOS (seção 33)

As tags BLE não têm protocolo/porta documentados pra apontar diretamente pro servidor ATHOS (diferente do GT06, que é TCP bruto e já tem um listener próprio em `server/gt06-listener/`, usado por OUTRO tipo de rastreador, não estas 10 tags Zaffari). Nenhuma configuração física de dispositivo foi alterada nesta sessão.

## Se o intervalo de polling pudesse ser menor

`BRGPS_SYNC_INTERVAL_SECONDS=15` já está no menor valor configurado no `.env.example` como recomendado. Reduzir mais não mudaria a frequência real de atualização por tag (que é limitada pelo INTERVALO DE TRANSMISSÃO DO PRÓPRIO DISPOSITIVO — em média ~5-6 minutos por tag, ver `TAG-FREQUENCY-REPORT.md`), só aumentaria o número de chamadas HTTP sem retorno útil. Não alterado nesta sessão — não haveria ganho real mensurável.
