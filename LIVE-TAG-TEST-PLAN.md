# LIVE-TAG-TEST-PLAN.md

Plano de diagnóstico pro teste físico com o Hugo (seção 27 do brief). Usa ferramentas já existentes no projeto — nenhuma UI nova de diagnóstico foi criada nesta sessão (o console de homologação existente, `HomologationConsole.tsx`/`DeviceTestPanel.tsx`, cobre o fluxo GT06 direto; para BRGPS o diagnóstico é via terminal, abaixo).

## Antes de ligar a tag

1. Confirmar que o `.env` tem `BRGPS_ENABLED=true` e `BRGPS_API_TOKEN` preenchido (não imprimir o valor).
2. Ter a lista das 10 IMEIs Zaffari à mão (`TAG-REGISTRY-EVIDENCE.md`).

## Quando o Hugo ligar a tag

Passo a passo, cada `npx tsx` roda contra a API real do fornecedor + banco real:

| Etapa do brief | Comando / lugar | O que confirma |
|---|---|---|
| **TAG DETECTED** | `npm run brgps:discover` | Log `[brgps] GET /tag/all status=200` + `N novos registrados como UNASSIGNED` — se a IMEI da tag ligada aparecer, ela foi detectada pelo fornecedor. |
| **API VALIDATED** | mesmo comando — `providerStatusCode=200` no log | Confirma resposta válida do envelope BRGPS (`problem` ausente). |
| **EVENT RECEIVED / DB SAVED** | abrir TagsModule no frontend → painel "Dispositivos BRGPS Descobertos" | O dispositivo aparece como `UNASSIGNED`, com o ID externo visível. |
| **TENANT RESOLVED** | no mesmo painel, selecionar o asset Zaffari pré-cadastrado com a IMEI correspondente (dropdown já filtra por `!asset.provider`) e clicar "Vincular" | Vínculo grava `provider_devices.asset_id` + `status='ASSIGNED'` — a partir daqui o asset já pertence ao tenant ZAFFARI (definido no pré-cadastro desta sessão, não muda aqui). |
| — | `npm run brgps:activate <id>` | `PATCH /tag` real no fornecedor — log confirma "ativado no fornecedor e marcado como is_actived=true". |
| — | `npm run brgps:sync-once` | Um ciclo real: log final `ciclo concluído: alvos=N recebidas=N aplicadas=N ...` |
| **POSITION VALIDATED** | mesmo log — campo `aplicadas` > 0 significa posição real gravada (não fabricada) | Se `aplicadas=0` e `recebidas=0`, a tag ainda não publicou posição no fornecedor — normal logo após ativação, tentar de novo em alguns segundos. |
| **MAP UPDATED** | TagsModule → "Ver no Mapa", ou LiveMap do módulo correspondente | Marcador aparece na posição real (sem fallback de coordenada fabricada — `AssetContext.tsx` já exclui assets com `provider` setado da simulação de movimento). |
| **LAST_SEEN UPDATED** | `assets.telemetry_last_communication` (visível na tela, "Último Ping" em TagsModule) | Timestamp real do fornecedor, não do momento do clique. |

## Nunca mostrar durante o diagnóstico

- Valor completo de `BRGPS_API_TOKEN` — nenhum comando acima imprime o token.
- MAC address completo em tela padrão (já mascarado por design existente, seção 32 do brief original).

## Loop contínuo (depois do primeiro sinal confirmado)

`npm run brgps:sync` (processo separado, `BRGPS_SYNC_INTERVAL_SECONDS` no `.env`, default 15s) — mantém a tag atualizada automaticamente, sem intervenção manual.

## Se a tag NÃO aparecer no `discover`

Não é falha do sistema ATHOS — significa que a tag ainda não foi vista pela conta BRGPS configurada. Possibilidades (documentadas em `docs/HARDWARE-CATALOG.md`): a tag pode pertencer a uma segunda conta do fornecedor (`BRGPS2_*`, hoje desativada) ou precisar de um tempo de propagação após ligar. Não fabricar um vínculo manual sem a tag ter aparecido de verdade — isso violaria a seção 7 do brief (nunca autorizar dispositivo não confirmado pela API real).
