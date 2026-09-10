# PROVIDER-API-INTEGRATION.md

## Mecanismo real (não inventado)

O provedor autorizado é **BRGPS** (`http://www.brgps.com/open`). Integração já existia antes desta sessão (`server/integrations/brgps/`), confirmada nesta sessão por chamada real:

```
$ npm run brgps:discover
[brgps] GET /tag/all status=200 duration=2240ms providerStatusCode=200
[brgps-service] catálogo: 1 dispositivos no fornecedor, 0 novos registrados como UNASSIGNED.
```

- **Mecanismo**: polling (`GET /tag` em lote), não webhook — decidido pelo que a API do fornecedor realmente oferece, não por preferência arquitetural.
- **Endpoints usados de verdade**: `GET /tag` (posição em lote), `GET /tag/all` (catálogo paginado), `GET /tag/history` (histórico), `PATCH /tag` (ativação administrativa).
- **Envelope de resposta**: `{statusCode, message, data, problem}` — tratado corretamente (200 HTTP + `problem` ≠ sucesso).
- **Identificador**: a API só expõe `id` numérico da tag — nunca IMEI/ICCID/serial real.
- **Rate limit**: 100 req/min, `SlidingWindowLimiter` em `BrGpsClient.ts`.
- **Credencial**: `BRGPS_BASE_URL`/`BRGPS_API_TOKEN` em `.env` (nunca no frontend, nunca no Git — confirmado, ver TAG-SECURITY-REPORT.md).

## Resultado da consulta real ao catálogo (2026-09-10)

Nenhuma das 10 tag IDs do Zaffari apareceu no catálogo desta conta BRGPS. Isso **não é bloqueio** — a seção 5 do brief pede pré-cadastro local independente de as tags já terem sido vistas pelo fornecedor. Marcação honesta:

**BLOCKED_BY_EXTERNAL_API_INFORMATION**: confirmação de que as 10 tags Zaffari pertencem a esta conta BRGPS específica (vs. uma segunda conta, ver `BRGPS2_*`/`docs/HARDWARE-CATALOG.md`) só existe quando o fornecedor/Hugo ligar a tag e ela aparecer num `discover` subsequente.

## Como o reconhecimento automático vai funcionar (fluxo já existente, não recriado)

1. Hugo liga uma tag física Zaffari.
2. Alguém roda `npm run brgps:discover` (ou o loop de sync já em produção detecta).
3. A tag aparece em `provider_devices` como `UNASSIGNED`, visível em TagsModule.tsx → painel "Dispositivos BRGPS Descobertos".
4. Um admin vincula o dispositivo descoberto ao asset **já pré-cadastrado** (dropdown existente, filtra por `imei` visível) — não precisa criar nada novo, só ligar.
5. `npm run brgps:activate <id>` ativa no fornecedor (`PATCH /tag`).
6. O ciclo de sync (`npm run brgps:sync`) já pega o dispositivo automaticamente a partir daí — grava posição real, atualiza `status` pra `online` (bug de status preso corrigido nesta sessão), gera histórico com `client_id` correto.

**Por que a vinculação continua manual e não 100% automática**: é decisão de segurança já existente no projeto (seção 12 do brief original de tags, documentada em `server/brgps-sync/index.ts`) — nunca vincular/ativar um dispositivo desconhecido sem um humano confirmar. Isso satisfaz a seção 7 do brief atual ("tag não autorizada nunca ganha acesso sozinha"). O que esta sessão eliminou foi a necessidade de **recadastrar** a tag como asset novo — ela já existe, só falta o clique de vínculo quando o hardware aparecer.

## O que NÃO foi tocado

- `BRGPS2_*` (segunda conta, pendente de confirmação do fornecedor) — fora de escopo desta sessão.
- Nenhum endpoint novo foi inventado. Nenhuma chamada de escrita (`PATCH /tag`) foi feita contra as 10 tags Zaffari — só leitura (`discover`).
