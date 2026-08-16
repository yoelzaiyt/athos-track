# Integração BRGPS — Tags de Rastreamento Reais

Integração com a API HTTP do fabricante BRGPS (tags de rastreamento), substituindo os dados simulados do módulo de Carrinhos por dados reais. Documento não reproduz segredos — o `api_token` real fica só em `.env` (nunca commitado).

## Arquitetura

Este projeto **não tem um servidor backend persistente** hoje: o frontend fala direto com o Supabase (RLS), e as poucas peças de servidor existentes (`server/gt06-listener`) são processos standalone rodados via `tsx`. A integração BRGPS segue o mesmo padrão em vez de introduzir um servidor Express novo:

```
Tag física → Servidor BRGPS → API BRGPS (HTTP)
   → server/brgps-sync (processo Node standalone, polling)
   → server/integrations/brgps/{BrGpsClient, BrGpsAdapter, BrGpsMapper, BrGpsService, db.ts}
   → Postgres/Supabase (via DIRECT_URL, mesmo padrão de gt06-listener — bypassa RLS como gateway confiável)
   → Supabase Realtime (tabelas `assets`/`system_alerts` na publicação `supabase_realtime`)
   → AssetContext.tsx (assina Realtime) → CartsModule / AssetMap (frontend)
```

O navegador **nunca** conhece o `api_token`, a `BRGPS_BASE_URL` ou qualquer credencial do fornecedor — só o processo `server/brgps-sync` fala com a BRGPS.

### Responsabilidades por arquivo (`server/integrations/brgps/`)

| Arquivo | Responsabilidade |
|---|---|
| `BrGpsClient.ts` | HTTP cru: headers, timestamp (com auto-correção de relógio), timeout, retry, rate limit (100/min) |
| `BrGpsAdapter.ts` | Fala o protocolo do fornecedor: paginação de `/tag/all`, batching de `/tag`, `/tag/history`, `PATCH /tag` |
| `BrGpsMapper.ts` | Puro — converte formato cru em `NormalizedPosition`, battery mapping, fingerprint de dedup |
| `db.ts` (`BrGpsRepository`) | Persistência no Postgres do ATHOS: current position, histórico, geofence, health |
| `../shared/geofenceEngine.ts` | Point-in-circle / point-in-polygon reaproveitando o tipo `Geofence` existente (compartilhado com outras integrações, ex. GT06) |
| `BrGpsService.ts` | Orquestra Adapter + Repository: discovery, sync tick, histórico, ativação |

Entidades de domínio ficam neutras de provedor (`NormalizedPosition`, `Asset`, `Device`, não `BrGpsPosition`/`BrGpsCart`) para permitir trocar o adapter no futuro (ex.: comunicação direta tag → servidor ATHOS, sem servidor do fornecedor) sem alterar frontend, geofence, alertas ou recuperação.

## Variáveis de ambiente

```env
BRGPS_ENABLED=true              # feature flag — false = nenhuma chamada ao fornecedor
BRGPS_BASE_URL=http://www.brgps.com/open   # teste internacional; China: http://brseek.39gps.com/open
BRGPS_API_TOKEN=                # nunca commitar; só em .env / secret manager
BRGPS_SYNC_INTERVAL_SECONDS=15  # intervalo do loop de polling
```

Nunca usar prefixo `VITE_` nestas — isso as colocaria no bundle do navegador.

## Endpoints do fornecedor (confirmados na documentação oficial)

| Endpoint | Método | Uso |
|---|---|---|
| `/tag` | GET | Posição atual em lote (`ids` separados por vírgula) |
| `/tag/all` | GET | Catálogo de IDs (array direto, sem wrapper — máx. 2000/página, paginar por `page`) |
| `/tag/history` | GET | Trajetória real (`id`, `timeFrom`, `timeTo` obrigatórios) |
| `PATCH /tag` | PATCH | Ativação (body: array de IDs numéricos) — operação administrativa |

Resposta padrão: `{ statusCode, message, data, problem }`. Só `statusCode === 200` é sucesso — HTTP 200 com `statusCode: 400` é falha lógica (ex.: `"Timestamp error."`).

### Battery mapping (seção oficial "电量说明")

```
-1 → UNKNOWN (inválido)   0 → CRITICAL (extremamente baixo)   1 → LOW
 2 → MEDIUM                3 → HIGH
```

Nunca convertido em porcentagem — o fornecedor não fornece isso. Frontend mostra a categoria (`Crítica`/`Baixa`/`Média`/`Alta`/`Desconhecida`), nunca um `%` inventado.

## Auto-correção de relógio

O ambiente onde este projeto roda pode ter o relógio do sistema desviado do horário real (foi observado ~5h51min de desvio durante o desenvolvimento). Como o `timestamp` do header só é válido por ~3min contra o relógio do **fornecedor**, `BrGpsClient` lê o header HTTP `Date` de toda resposta (mesmo uma falha lógica) e recalibra automaticamente o timestamp dos próximos requests — sem tocar no relógio do sistema operacional.

## Fluxo de dados

1. **Discovery** (`npm run brgps:discover`): `GET /tag/all` paginado → novos IDs entram em `provider_devices` como `UNASSIGNED`.
2. **Vinculação** (manual, no admin ATHOS — painel "Dispositivos BRGPS Descobertos" em Tags): escreve direto no Supabase (mesmo padrão do resto do app), liga `provider_devices.asset_id` a um `Asset` já existente. Nunca cria Asset comercial automaticamente.
3. **Ativação** (`npm run brgps:activate -- <ids...>`): `PATCH /tag` — operação administrativa via CLI, nunca pelo frontend/usuário de campo.
4. **Sync contínuo** (`npm run brgps:sync`): a cada `BRGPS_SYNC_INTERVAL_SECONDS`, busca em lote (`GET /tag`) só os dispositivos `ASSIGNED` + `is_actived=true`, aplica com dedup + guarda contra posição fora de ordem, atualiza `assets.telemetry_*` (current position) e insere em `asset_route_points` (histórico/breadcrumb — mesma tabela que `HistoryPage.tsx` já esperava usar).
5. **Geofence**: a cada posição aplicada, verifica dentro/fora contra a cerca do asset; em mudança de estado gera `system_alerts` (`geofence_exit`/`geofence_entry`) e, em saída, uma `recovery_occurrences` (fluxo já existente de Central de Recuperação / ATHOS Field), com `is_simulated=false`.
6. **Frontend**: `AssetContext` assina Supabase Realtime nas tabelas `assets`/`system_alerts` e funde no estado — sem WebSocket customizado. Ativos com `provider` preenchido são excluídos da simulação client-side de 4s (só ativos sem provider continuam simulados).

## Comandos

```bash
npm run brgps:discover           # GET /tag/all -> registra novos como UNASSIGNED
npm run brgps:activate -- <id...>  # PATCH /tag -> ativa dispositivos (admin only)
npm run brgps:sync-once          # 1 ciclo de sync
npm run brgps:sync               # loop contínuo
npm run brgps:history -- <id> <fromISO> <toISO>  # GET /tag/history real
npm run brgps:test               # discovery + resumo de dispositivos não vinculados
npm test                         # testes unitários do BrGpsMapper (vitest)
```

## Limitações conhecidas

- **`distance` do histórico**: o fornecedor não documenta a unidade ("与上一个定位点偏移距离" = deslocamento em relação ao ponto anterior). Guardado cru em `distance_raw`, nunca apresentado com unidade inventada.
- **Endpoints internos REST** (`GET /api/v1/provider/brgps/...`) não foram implementados como servidor HTTP: como este projeto não tem backend persistente, as operações administrativas (discovery, ativação) são CLI-only por enquanto. A vinculação Device→Asset (não-privilegiada, sem tocar no fornecedor) já é feita pela UI normalmente, direto no Supabase.
- **RBAC do MAC/ações administrativas** segue o mesmo limite já documentado no resto do app: o `role` local (`AuthContext.setRole`) é só preview de UI, não é reforçado por RLS diferenciada — a real barreira de "quem pode ativar dispositivo" hoje é "quem tem acesso de shell ao `.env`/CLI", não uma permissão de aplicação.
- **Status ONLINE/STALE/OFFLINE/INACTIVE** (seção 33 do brief) não foi implementado como classificação própria: por ora `assets.status` só é tocado pela transição de geofence (dentro/fora). `is_actived` (ativação no fornecedor) e conectividade real (`telemetry_last_communication` recente) ficam disponíveis nos dados, mas não há hoje uma regra que derive um desses 4 estados combinando as duas coisas — para não interferir no `AssetStatus` já usado em filtros/contadores por toda a UI existente sem alinhar antes com o time.
- **Bateria baixa não altera `assets.status` automaticamente**: `low_battery` como status já existe no enum, mas essa integração não o aciona a partir de `batteryLevelCategory` — ficou fora de escopo desta entrega para não haver disputa de precedência com o status de geofence sem definição prévia. A categoria de bateria já aparece corretamente na UI (Carrinhos, drawer do mapa).
