# OPERATIONAL-REFINEMENT-REPORT.md

> Rodada de refino operacional do DASHBOARD (FASE 17 do mapa/operacional) —
> princípio de trabalho: **"SE APARECE NA TELA, TEM QUE SER REAL"**. Nenhum
> número inventado: status derivado só de timestamps/velocidade/deslocamento
> reais; gráficos só de leituras reais (route_points deduplicados) e alertas
> reais; simulação de movimento desligada por padrão.

## 1. O que mudou (causa → correção)

| Problema observado | Correção | Evidência |
|---|---|---|
| `assets.status` no banco mistura conectividade (offline/online/awaiting_first_signal), geofence (out_of_geofence) e **nunca** 'moving'/'stopped' (nem BRGPS nem GT06 derivam esses dois) → painel mostrava "online" para ativo parado há 20min | `src/lib/deviceStatus.ts` deriva a classificação exibida: `alert/moving/stopped/online/stale/offline`, a partir de timestamps REAIS de última comunicação/pacote, velocidade real (GT06), deslocamento dos 2 últimos pontos (BRGPS) e alertas reais não reconhecidos. Janelas configuráveis numa fonte central | `deviceStatus.ts` (+ 0 status fabricado: sem contato/posição → OFFLINE, nunca "online") |
| Simulação de movimento era active por padrão e criava posições/telemetria fabricadas | `isLiveSimulationActive` agora **false** por padrão (`AssetContext.tsx`). O toggle continua no app só pra demo; o painel padrão não inventa "Agora" | `AssetContext.tsx:180` |
| Alerta reconhecido por outro usuário não sumia sem F5 (só UPDATE em system_alerts não era ouvido) | Realtime agora também ouve `UPDATE system_alerts` (corrente passa pelo trigger `server/db/02_realtime_notify.sql`) | `AssetContext.tsx` (.on UPDATE system_alerts) |
| `criticalAlertsCount` contava alertas de TODOS os tenants (array `alerts` global) mesmo com filtro de client/unit | Contador restrito aos alertas cujo `asset_id` pertence ao escopo filtrado | `AssetContext.tsx` (scopedAlertIds) |
| Sem forma de saber se o realtime estava vivo | Estado `REALTIME_CONNECTED/RECONNECTING/OFFLINE` exposto via `subscribeRealtimeStatus()` em `src/lib/supabaseClient.ts` (dos eventos reais do Socket.IO) | `supabaseClient.ts` |
| Gráfico de eventos era alimentado por dados duvidosos | `src/hooks/useDashboardStats.ts`: poll autenticado (30s status / 60s eventos) + fetch no mount; os buckets **só** de `route_points` (leituras reais deduplicadas por fingerprint) + `system_alerts` (eventos reais). Nenhum bucket contém poll | `useDashboardStats.ts` |

## 2. Latência do dashboard (FASE 12, honesta)

- `lastUiRefreshLatencyMs = UI_UPDATED_AT − BACKEND_RECEIVED_AT` medido por ativo
  real que chega via realtime (`AssetContext.tsx`). `uiUpdatedAt` é carimbado no
  instante do merge na UI, não no backend — só entra quando `serverReceivedAt`
  é ISO real (backend = `telemetry_server_received_at`, T3 do caminho direto).
- Dashboard técnico admin **"Diagnóstico de Latência"** (`LatencyDiagnosticsPage`)
  mostra por ativo T1/T2/T3/T4 e deltas (mediana device→servidor, servidor→UI,
  total) com aviso honesto quando não há dado — sem fabricar.
- Backend instrumentado: listener GT06 grava `[DEVICE_RX]` com `packet_rx_at`,
  `device_ts`, `device_to_server_ms`; BRGPS grava `telemetry_server_received_at`
  no mesmo fluxo. Coluna nova aditiva (migration `20260911010000`), rollback = DROP COLUMN.

## 3. FILES_CHANGED

| Arquivo | Mudança |
|---|---|
| `src/lib/deviceStatus.ts` + test | Status derivado real (janelas centrais) |
| `src/lib/latency.ts` + test | `buildLatencyMetrics` com `deviceToServerRxMs`/`serverRxToUiMs` |
| `src/hooks/useDashboardStats.ts` | Poll autenticado de status/eventos reais |
| `src/pages/Dashboard.tsx` | Consome status derivado + realtime status + buckets reais |
| `src/context/AssetContext.tsx` | Simulação off por padrão; UPDATE system_alerts; `lastUiRefreshLatencyMs`; alertas críticos escopados por tenant |
| `src/lib/supabaseClient.ts` | `REALTIME_CONNECTED/RECONNECTING/OFFLINE` |
| `src/pages/admin/LatencyDiagnosticsPage.tsx` | Dashboard de latência T1–T4 |
| `src/pages/Dashboard/…` (via `Dashboard.tsx`) | UI do round |

## 4. TESTS / BUILD

- `npx tsc --noEmit`: OK.
- `npm test`: **135 pass (13 arquivos)** — inclui `deviceStatus.test.ts` (derivação
  nunca inventa status), `latency.test.ts`, `mapV2GeoJson.test.ts`, e os E2E reais
  (tenant isolation, realtime bridge, classificação de tags).
- `npx vite build`: OK (avisos pré-existentes de chunk size; Maplibre só no chunk
  lazy do V2).

## 5. PENDING

- **Visual check em browser real** do dashboard (labels de status, badge realtime,
  buckets do gráfico) — protocolo pronto, requer sessão de browser.
- **Re-medição de latência** com catálogo `provider_devices` completo (BRGPS loop
  contínuo) — intervalo de polling já em 10s.

*Gerado: 2026-09-11 | Git HEAD: pós-commit do WIP (latência + dashboard).*