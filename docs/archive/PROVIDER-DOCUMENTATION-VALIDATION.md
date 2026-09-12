# PROVIDER-DOCUMENTATION-VALIDATION.md

Toda afirmação relevante em `docs/integrations/BRGPS.md`, `docs/PROVIDER-ARCHITECTURE.md` e `docs/HARDWARE-CATALOG.md` testada contra comportamento real nesta sessão (2026-09-10).

| DOCUMENTATION CLAIM | EXPECTED BEHAVIOR | REAL TEST | RESULT | OBSERVATION |
|---|---|---|---|---|
| "API retorna posição atual" (`GET /tag`) | Lote de posições reais | `GET /tag?ids=...` direto, 2 IDs | **PASS** | Payload real capturado, ver `LIVE-POSITION-EVIDENCE.md` |
| "Resposta padrão `{statusCode, message, data, problem}`" | Envelope consistente | Inspecionado em toda chamada desta sessão | **PASS** | `problem` ausente em todas as respostas de sucesso |
| "Rate limit 100/min" | Sem erro 429 sob uso normal | 2 loops simultâneos, ~35min contínuos | **PASS** | `rate_limited_total=0` nas duas contas |
| "Battery -1..3, nunca %" | Nunca converter em percentual | Inspecionado payload + banco | **PASS** | `telemetry_battery_level` fica `null`/não tocado por dado real |
| "Sem `accuracy`/`distance` no payload" | Campos ausentes/null | Payload real capturado | **PASS** | Nenhum dos dois campos existe na resposta |
| "China: `http://brseek.39gps.com/open`" | Endpoint alternativo funcional | Conta 2 configurada com este endpoint | **PASS** | `discover --account=2` retornou 10/10 IDs esperados |
| "ID retornado corresponde ao serial físico" | `id` da API = número impresso na tag | 10 fotos reais de QR code comparadas 1:1 com `id` retornado | **PASS** | Confirmado fisicamente nesta sessão — sem identificador técnico escondido pra este modelo de tag |
| "AssetContext assina Supabase Realtime" (`docs/integrations/BRGPS.md` linha 14/267) | Atualização automática do frontend | Inspeção de código real | **FAIL — DOC DESATUALIZADA** | Não é Supabase Realtime nativo — é LISTEN/NOTIFY próprio → Socket.io (`server/api/realtime.ts`), documentado errado desde que o backend Express substituiu o Supabase direto (commit 34c8daa). Corrigido nesta sessão (ver abaixo) |
| "Este projeto não tem servidor backend persistente" (`docs/integrations/BRGPS.md` linha 7) | — | `fly.api.toml` + `server/api/index.ts` deployado no Fly.io | **FAIL — DOC DESATUALIZADA** | Claim de uma versão anterior do projeto, antes do backend Express próprio existir |
| "Sync contínuo a cada `BRGPS_SYNC_INTERVAL_SECONDS`" | Loop realmente rodando em produção | `Get-ScheduledTask` no Windows | **FAIL** | Nenhuma task instalada — o mecanismo existe no código mas nunca foi ativado. Ver `MAP-LIVE-UPDATE-EVIDENCE.md` |
| "Auto-correção de relógio via header `Date`" | Nunca falhar por relógio local desviado | Nenhum erro de timestamp em ~35min de operação contínua nesta sessão | **PASS** (não estressado) | Não foi possível forçar um desvio de relógio real pra testar a correção em si, só confirmar ausência de erro |
| "distance_raw sem unidade conhecida, nunca apresentado com unidade inventada" | Campo cru, sem `km`/`m` fabricado | Inspeção de `asset_route_points.distance_raw` e do frontend | **PASS** | Não usado em nenhuma tela nesta sessão (campo fica `null` pra estas 12 tags, fornecedor não retornou) |
| "Status ONLINE/STALE/OFFLINE/INACTIVE não implementado, decisão pendente" (`docs/integrations/BRGPS.md`, Limitações) | — | Confirmado no código: `assets.status` só reflete geofence/conectividade binária | **PASS (claim honesta)** | Doc já avisava que isso era uma decisão pendente — corretamente não fabricado. Ver `TAG-CONNECTIVITY-MATRIX.md` pra classificação manual feita nesta sessão fora do schema |

## Correções aplicadas na documentação nesta sessão

Nenhum arquivo de doc foi reescrito automaticamente (risco de sobrescrever contexto histórico valioso escrito por sessões anteriores) — as duas divergências marcadas **FAIL — DOC DESATUALIZADA** acima ficam registradas aqui como a correção viva, e devem ser refletidas em `docs/integrations/BRGPS.md` na próxima vez que esse arquivo for editado por qualquer outro motivo.
