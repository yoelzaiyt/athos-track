# DIRECT TRACKING INVESTIGATION — RELATÓRIO DE ENTREGA

> Rodada de investigação da cadeia de latência/link das tags de rastreamento
> e da viabilidade de a TAG falar DIRETO com o **nosso** servidor (eliminando
> o intermediário do fornecedor onde tecnicamente possível). Princípio de
> trabalho: engenharia, não hacking — só dispositivos nossos, documentação
> recebida, nenhum comprometimento de infra/cadastro alheio, nenhuma mudança
> em produção, nenhum timestamp fabricado. Evidência por arquivo/linha.

## 1. Resumo executivo

- O caminho atual das tags "Air Tag" em posse é **100% via nuvem do fornecedor**
  (BRGPS = Jason = Heile, mesmo fornecedor) — por API REST, **polling**, nunca
  webhook. `server/brgps-sync` consulta a posição por polling a cada
  `BRGPS_SYNC_INTERVAL_SECONDS` (padrão 15s).
- Já existe em `server/gt06-listener/` um **listener TCP GT06 completo e
  funcional** (login/ack/heartbeat/localização/alarme/RFID, CRC-16/X-25),
  que insere o ativo no banco pelo mesmo caminho de produção. É a fundação do
  caminho direto — **não foi preciso reimplementar protocolo**.
- **Viabilidade do caminho direto depende do hardware.** Inventário completo na
  seção 2. Nenhum dos dispositivos hoje em homologação/uso é SIM-based:
  os discos "Air Tag" são BLE (sem modem celular), então **não conseguem abrir
  TCP direto no nosso listener** — o transporte físico deles é a nuvem do
  fornecedor. Caminho direto só é realizável com dispositivos SIM-based
  GT06-confirmados (família TJ02/GX03, `docs/HARDWARE-CATALOG.md`), que ainda
  **não estão em nossas mãos**.
- Entrega desta rodada: **camada de observabilidade de latência** real e
  honesta (T3 = `telemetry_server_received_at`, migration aditiva), logs
  estruturados `[DEVICE_RX]` no listener, métricas de pipeline no frontend e
  um dashboard técnico admin. Medir antes de migrar qualquer coisa; nada foi
  migrado.

## 2. Inventário de dispositivos (Fases 5/6, 2/3)

| ID | Nome | Transporte | Fala GT06/TCP direto p/ a gente? | Evidência | Status |
|---|---|---|---|---|---|
| `1603000067` | Carrinho BRGPS (CAR-01) | BLE → nuvem BRGPS → API | **NÃO** (sem modem celular) | `docs/HARDWARE-CATALOG.md` §1; histórico BRGPS com dado de demonstração (China/Tailândia) | VENDOR_API confirmed use |
| `3092524777` | Carrinho BRGPS (CAR-03) | BLE → nuvem BRGPS → API | **NÃO** | migration `20260906200000`; sync ao vivo validado (posição aplicada) | VENDOR_API validated pipeline (dado de demonstração) |
| `3092524960…3092533120` (10) | Carrinhos ZAFFARI (ZAF-CART-01..10) | BLE → nuvem BRGPS (conta 2, China) → API | **NÃO** | migrations `20260910100200` + `20260910110000` (discover 100% match); receberam posição real via sync-once 2026-09-10 | VENDOR_API awaiting_first_signal → online |
| `3092660181` | Tag física em homologação (etiqueta) | BLE (mesmo formato disco) | **NÃO**; IMEI ainda UNKNOWN | `gt06_homolog_devices` (WAITING_DEVICE); nunca apareceu na API BRGPS em nenhum formato de ID testado | UNKNOWN transport (provável BLE-disc), aguarda 1º sinal |
| `SN:9260072843` | BLE no-SIM cabeado | BLE → gateway → nuvem | **NÃO** (sem modem; hipótese BLE crowdsourced) | foto real 2026-09-05, `docs/HARDWARE-CATALOG.md` §4 | UNKNOWN, sem datasheet |
| TJ02/GX03 | Rastreador gado/pet (se possui) | **GPRS/4G-CAT1 TCP** | **SIM — confirmado por doc** (protocolo GT06 + `SERVER,0,IP,porta#` via SMS) | `docs/HARDWARE-CATALOG.md` §2/§3, comandos SMS §"Comandos SMS" | NOT IN HANDS — documento/heurestics |

**Classificação da viabilidade do caminho direto:**

- `CONFIRMED` para TJ02/GX03 **se/de quando houver unidade física** (TCP +
  comando SMS de reconfiguração de servidor são o mecanismo de apontamento
  direto — nossos parâmetros `VITE_GT06_HOST`/`GT06_LISTENER_PORT`).
- `IMPORTANT`: as tags atuais (Zaffari/CAR/BLE) **não podem** ser apontadas
  direto — sem modem, o tráfego delas só existe na rede do fornecedor.
- `UNKNOWN`: IMEI das tags físicas; modelo da tag `3092660181` não confirmado
  (provável BLE). Marcar UNKNOWN até evidência runtime, como pede o brief.

## 3. Cadeia atual real (evidência por arquivo)

```
T0/T1  DISPOSITIVO (GPS/time do pacote)
         │  (Air Tag: BLE → infra do fornecedor)
T2     NUVEM DO FORNECEDOR (publishTime)
         │  GET /tag (polling, BRGPS_SYNC_INTERVAL_SECONDS=15)
T3     NOSSO SERVIDOR (sync tick runSyncTick = receivedAt)
         │  BrGpsRepository.applyPosition → assets.telemetry_*
T4     UI (Supabase Realtime LISTEN/NOTIFY → Socket.io → AssetContext)
```

- `BrGpsClient.requestOnce` calcula `durationMs` por chamada e loga
  `[brgps] GET /tag status=… duration=…ms` (`BrGpsClient.ts:142-149`).
- `mapTagToNormalizedPosition` define `receivedAt = now` (**T3**, impreciso em
  até o intervalo de polling) e `occurredAt = raw.timestamp` (**T1**),
  `providerPublishedAt = raw.publishTime` (**T2**) (`BrGpsMapper.ts:35-72`).
- Telemetria gravada com `last_communication = receivedAt`,
  `packet_timestamp = occurredAt`, `provider_published_at = publishTime`
  (`server/integrations/brgps/db.ts:216-238`).
- **Caminho direto GT06** antes desta rodada **não persistia T3**:
  `applyPosition` gravava `last_communication = packet_timestamp = occurredAt`
  (timestamp do dispositivo) (`server/integrations/gt06/db.ts:125-144`) → essa
  era a lacuna de observabilidade para medir device→server real.

### Mudanças desta rodada (FASE 4/7/11/15/16)

1. **Migration aditiva** `supabase/migrations/20260911010000_add_telemetry_server_received_at.sql`:
   `assets.telemetry_server_received_at timestamptz` (nullable, com índice
   parcial). Rollback: `alter table assets drop column telemetry_server_received_at;`.
2. **Listener GT06** (`server/gt06-listener/index.ts`): captura
   `serverReceivedAt = new Date()` no `socket.on('data')` (primeiro instante
   em que o byte do dispositivo pousa no nosso servidor — **T3 do caminho
   direto**), passa por `handleFrame` → `applyLocationToAsset` →
   `Gt06Repository.applyPosition`, que grava `telemetry_server_received_at`.
   Log estruturado **`[DEVICE_RX]`** com `packet_rx_at`, `device_ts` e
   `device_to_server_ms` a cada pacote de localização.
3. **BRGPS** (`server/integrations/brgps/db.ts`): `applyPosition` agora também
   grava `telemetry_server_received_at = receivedAt` (T3 do vendor/polling) —
   comparável com o direto sem mudar o modelo de dados.
4. **Frontend**: `TelemetryData.serverReceivedAt` (`src/types/index.ts`),
   mapeado em `src/lib/mappers.ts`; `buildLatencyMetrics` ganhou
   `serverRxTs`, `deviceToServerRxMs` (= T3−T1), `serverRxToUiMs` (= T4−T3)
   (`src/lib/latency.ts`), cobrindo os dois caminhos.
5. **Dashboard técnico**: `src/pages/admin/LatencyDiagnosticsPage.tsx` (módulo
   admin "Diagnóstico de Latência", incluído em `App.tsx` e `Sidebar.tsx`) —
   tabela por ativo com T1/T2/T3/T4 e deltas (mediana device→servidor,
   servidor→UI, total), com aviso honesto quando não há dado (sem fabricar).

## 4. Resultados de medição

- Device→server real (direto): **sem dado ainda** — requer um GT06 SIM-based
  físico conectado ao listener. O listener agora está instrumentado para
  capturar isso automaticamente no primeiro login real.
- Vendor (brgps): T3 é o instante do sync tick (imprecisão 0..15s).
  Já estava medido via `durationMs` por request e `receivedAt`.
- Frontend → pipeline: o dashboard mostra T4−T3 por ativo real assim que
  houver dados; sem inventar nada quando não há.

## 5. FILES_CHANGED (esta rodada)

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/20260911010000_add_telemetry_server_received_at.sql` | novo — coluna T3 |
| `server/gt06-listener/index.ts` | captura/persiste T3 + log `[DEVICE_RX]` |
| `server/integrations/gt06/db.ts` | `PositionInput.serverReceivedAt` + UPDATE |
| `server/integrations/brgps/db.ts` | grava `telemetry_server_received_at` |
| `src/types/index.ts` | campo `serverReceivedAt` |
| `src/lib/mappers.ts` | mapeia coluna nova |
| `src/lib/latency.ts` / `latency.test.ts` | métricas T3 (+ 2 testes) |
| `src/pages/admin/LatencyDiagnosticsPage.tsx` | novo — dashboard admin |
| `src/App.tsx` / `src/components/layout/Sidebar.tsx` | entrada do módulo |
| `server/integrations/brgps/db.concurrency.test.ts` | garante coluna no banco de teste |

## 6. TESTS / BUILD

- `npx tsc --noEmit`: OK, sem erros.
- `npm test`: **109 pass (11 arquivos)**, incluindo os 2 testes novos de
  `deviceToServerRxMs` e os testes de concorrência reais do `BrGpsRepository`
  (dedup/fingerprint) agora com a coluna nova presente.
- `npx vite build`: OK (só avisos pré-existentes de tamanho de chunk).

## 7. RISKS / ROLLBACK

- **Nada foi aplicado em produção**: a migration é o único artefato SQL e é
  aditiva (adiciona coluna nullable + índice parcial); reverter é um
  `ALTER TABLE … DROP COLUMN`. Nenhuma escrita em runtime muda o comportamento
  de persistência antigo (a coluna nova é só observação).
- O listener GT06, quando um device direto fizer login, passa a gravar
  `provider='GT06'` e `telemetry_server_received_at` **no mesmo fluxo de
  produção já existente** — sem alterar geofence, alertas, histórico, RLS
  (continua via `DIRECT_URL`/gateway, sem expor processo à internet público —
  ressalva já documentada no topo do `index.ts`).
- Caminho antigo **não foi removido**: BRGPS permanece como está (provider
  `BRGPS`/`BRGPS_2`). A ideia `DIRECT_PRIMARY/VENDOR_FALLBACK` fica como
  decisão de produto quando houver dispositivo direto de verdade.

## 8. PENDING (não-executável neste ambiente)

- **Prova de campo do caminho direto (Fases 8-10)**: precisa de um GT06
  SIM-based físico (TJ02/GX03 ou equivalente), pois as tags em mãos são BLE.
  Como executar quando houver: apontar o `SERVER,0,<IP>,<porta>,0#` (comando
  SMS documentado), vincular `assets.imei` ao IMEI real do device, ligar o
  listener com `GT06_LISTENER_HOST/PORT`, e validar `[DEVICE_RX]` +
  `telemetry_server_received_at` no dashboard.
- **IMEI real** da tag `3092660181` (etiqueta) — só aparece no login GT06 se
  ela um dia falar TCP (provável que nunca: BLE).
- **Confirmação com o fornecedor** se `1603000067`/`3092524777` correspondem a
  unidades físicas reais (dado de demonstração observado — China/Tailândia/Leipzig).