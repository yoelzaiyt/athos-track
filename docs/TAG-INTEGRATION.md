# Integração de tags — ATHOS Track

Documento único e vivo sobre as tags rastreadas, o pipeline de ingestão e o que está
comprovadamente funcionando. Consolida os relatórios de sessão `TAG-*.md`,
`10-TAGS-LIVE-AUDIT.md`, `ATHOS-TRACK-*TAG*.md`, `*-LATENCY*.md`,
`PROVIDER-INGESTION-MODE.md` e `MOVEMENT-TEST-REPORT.md`, hoje em `docs/archive/`.
Atualize **este** arquivo em vez de criar um relatório novo.

Última revisão: 2026-09-11. Snapshot de dados: 2026-09-10/11.

---

## 1. Inventário — 12 tags

### ZAFFARI — 10 carrinhos (`category='cart'`, provider `BRGPS_2`)

Códigos internos `ZAF-CART-01` a `ZAF-CART-10`, tenant
`2c267371-3bf7-4477-a0a2-99f4d53b6800`, unidade Matriz.

| # | IMEI / Tag ID | Situação |
|---|---|---|
| 01 | 3092524960 | LIVE |
| 02 | 3092524712 | LIVE |
| 03 | 3092533124 | LIVE |
| 04 | 3092524666 | LIVE |
| 05 | 3092533106 | LIVE |
| 06 | 3092524840 | LIVE |
| 07 | 3092524939 | LIVE — posição atípica, ver §5 |
| 08 | 3092533107 | LIVE |
| 09 | 3092524906 | LIVE |
| 10 | 3092533120 | LIVE |

10/10 no banco, 10/10 reconhecidas pelo fornecedor, 10/10 com posição real,
10/10 visíveis no mapa. Região Alphaville/Barueri-SP.

`physical_tag_id` = `provider_device_id`: a API BRGPS usa o próprio número de 10
dígitos como `id`, confirmado fisicamente contra 10 fotos de QR code batendo 1:1.
Não há um segundo identificador técnico escondido.

### SÃO JOÃO — 2 caixas (`category='box'`, provider `BRGPS` conta 1)

| Código | Tag ID | Situação |
|---|---|---|
| CAR-01 | 1603000067 | **OFFLINE / PROVIDER_NOT_FOUND** — a API nunca retorna este ID |
| CAR-03 | 3092524777 | **STALE** — posição repetida, não nova |

**Ressalva de proveniência, não resolvida:** as coordenadas dessas duas
(China ~29.20,119.83 e Tailândia ~13.84,100.51) são consistentes com dado de
demonstração do fornecedor, não confirmadas como posição física real do São João.
Pendência comercial com o fornecedor, anterior e externa ao ATHOS Track — o pipeline
em si é real (API real, sem mock, chega até o mapa). Ver `docs/HARDWARE-CATALOG.md`.

## 2. Duas contas BRGPS

| Conta | Endpoint | Tenant | Flag |
|---|---|---|---|
| `BRGPS` (1) | internacional | SÃO JOÃO | `BRGPS_ENABLED` |
| `BRGPS_2` | `brseek.39gps.com` (China), conta `athostrack` | ZAFFARI | `BRGPS2_ENABLED` |

As 10 tags Zaffari **não pertencem à conta 1**. Esse foi o motivo de um relatório
anterior declarar as tags prontas sem nunca ter recebido sinal: elas estavam sendo
buscadas na conta errada. O scaffold `BRGPS2_*` existia desde 2026-09-06, desativado,
esperando a credencial. Tokens só em `.env` (gitignored), nunca em `VITE_*`.

## 3. Modo de ingestão: API POLLING

Não há webhook nem conexão direta dispositivo→ATHOS para estas tags BLE. O ATHOS
**pergunta**, o fornecedor responde.

- Responsável: `server/brgps-sync/index.ts` (CLI) + `BrGpsService.runSyncTick`.
- Endpoints: `GET /tag?ids=<lote>` (posição em lote), `GET /tag/all` (descoberta),
  `PATCH /tag` (ativação).
- Intervalo: `BRGPS_SYNC_INTERVAL_SECONDS=10` (reduzido de 15 em 2026-09-11).
- Rate limit: `SlidingWindowLimiter` em `BrGpsClient.ts`, 100 req/min por conta.
  Uso real ~4-6 req/min. `rate_limited_total` nunca observado > 0.

O GT06 é outro tipo de rastreador, com TCP bruto e listener próprio em
`server/gt06-listener/` — não são estas tags.

### Frequência real ≠ intervalo de polling

Medido em 502 intervalos reais de `asset_route_points`: o dispositivo só transmite
posição nova a cada **~5-6 minutos** (P50 ~332s, P95 ~791s / ~13min). Reduzir o
intervalo de polling abaixo de 10s não aumentaria a frequência visível ao usuário —
só geraria chamadas HTTP sem retorno útil. **O limite é o dispositivo/fornecedor,
não o ATHOS.**

## 4. Latência ponta a ponta

Medido, por trecho. Não existe um número único "end-to-end" porque o frontend não
tem timestamp de render — somar trechos de fontes diferentes e apresentar como
medição única seria fabricar o número.

| Trecho | P50 | P95 | MAX | Base |
|---|---|---|---|---|
| PROVIDER → ATHOS (`GET /tag`) | 804ms | 1015ms | 2832ms | 445 chamadas reais (218 conta 2 + 227 conta 1) |
| DB → Socket.IO → cliente | 14ms | 21ms | 21ms | 15 ciclos, localhost→localhost |
| Dispositivo → publicação no fornecedor | ~119s | — | — | 1 amostra real (`timestamp` vs `publishTime`) |
| Socket.IO → render no mapa | **não instrumentado** | — | — | — |
| Ingestão local (parse + write) | **não isolado** | — | — | embutido nos ~700ms-2,8s do ciclo |

Leitura prática: a parte que o ATHOS controla (banco → tela) é de **dezenas de
milissegundos**, desprezível. O atraso percebido é dominado pelo fornecedor e pela
frequência de transmissão do próprio dispositivo.

## 5. Sobreposição de coordenadas e o outlier CART-07

As 10 tags reportam coordenadas muito próximas — 5 pares em **0,0m (idênticas)**,
30 dos 45 pares ≤50m. Isso, somado ao gate de clustering antigo (>25 ativos), é o que
fazia o mapa parecer mostrar ~5 marcadores com 10 tags ligadas. Corrigido no mapa
(ver `docs/MAP-ARCHITECTURE.md` §5).

`ZAF-CART-07` reporta posição ~21km das outras 9 (região Osasco/SP-015 vs.
Alphaville/Barueri), com timestamp recente — é posição nova de verdade, não dado
congelado nem erro de exibição. **Não afirmamos** se é deslocamento físico real ou
característica de precisão daquele dispositivo. Confirmar com o fornecedor/Hugo.

### `accuracy` nunca vem preenchido

O BRGPS não retorna `telemetry_gps_accuracy` em nenhum payload. Consequência: é
tecnicamente impossível distinguir "coordenada idêntica porque os carrinhos estão
encostados" de "coordenada idêntica porque o fornecedor arredonda/reusa uma leitura".
Ambas seguem em aberto. **Não fabricar "±8m" na UI** — esse foi um bug real corrigido.

Bateria também não vem em percentual: o fornecedor manda categoria (`HIGH`), nunca
convertida em `%` fictício.

## 6. Bugs corrigidos que valem não regredir

1. **Polling não rodava.** Nenhum processo contínuo estava ativo, e o script existente
   cobria só uma das duas contas. Hoje `scripts/brgps-sync-daemon.ps1` +
   `install-brgps-sync-task.ps1` cobrem as duas.
2. **LISTEN/NOTIFY via pooler.** Ver `docs/MAP-ARCHITECTURE.md` §3. Teste de
   regressão em `server/api/realtime.test.ts`.
3. **Status preso em `awaiting_first_signal`** mesmo após receber posição real — o fix
   anterior só cobria `offline`.
4. **Categoria errada**: as 2 tags São João estavam como `cart`, fazendo "Carrinhos"
   mostrar 12 e "Caixas" 0. Era dado errado no banco, não bug de query.
5. **"Bateria Baixa: 11"** com as 12 tags em `HIGH`: `batteryLevel < 20` com
   `batteryLevel = null` é `true` em JS (`null` coage para `0`).
6. **`provider === 'BRGPS'` literal** no frontend (CartsModule, TagsModule) excluía a
   conta 2, exibindo "Simulado" para tags com posição real. Comparar sempre
   considerando os dois providers.
7. **Precisão e sinal fabricados** no mapa ("±8m", "4G LTE") quando o fornecedor não
   informa nenhum dos dois.

## 7. Segurança

- `npm test` verde na última rodada registrada (60/60 e depois 61/61), incluindo RBAC
  ofensivo, isolamento de tenant em ambas as direções e concorrência real de 40
  conexões contra `applyPosition`.
- Autorização: não existe coluna `auth`/`enabled` dedicada. **A existência da linha em
  `assets` é o sinal de autorização** — nunca se cria asset automaticamente para
  dispositivo não autorizado. `provider` preenchido = habilitada/rastreando.
- Sem cache de aplicação (nenhum React Query/SWR): `AssetContext` busca direto do
  Postgres a cada carregamento de sessão.
- Nenhum secret no diff commitado; `.env*` gitignored, só `.env.example` versionado.

### Gaps conhecidos

| Item | Situação |
|---|---|
| Rate limiting em `/rest/*` e `/providers/*` | **ausente.** Só `/auth/login` tem (por IP e por e-mail, SEC-007). Precisa dimensionamento com tráfego real, não número arbitrário |
| `npm audit` | 3 vulnerabilidades moderadas em `qs` via `body-parser`→`express`. `fix` disponível, não aplicado (risco de regressão sem teste dedicado) |
| Nomes de papéis RBAC | schema usa `ATHOS_ADMIN, CLIENT_ADMIN, FLEET_MANAGER, CART_MANAGER, ASSET_MANAGER, OPERATOR, VIEWER` — difere nominalmente de briefs anteriores. Não renomear em produção sem confirmação (quebra sessões/tokens) |
| Scheduled Task de sync | **não registrada.** Os loops de sync param se a sessão/terminal encerrar. Depende de aprovação para instalar |

## 8. Monitoramento contínuo

Funciona, **com a ressalva do item acima**: sem a Scheduled Task instalada, a ingestão
depende de loops rodando manualmente (`npm run brgps:sync` e `--account=2`). Essa é a
dependência operacional mais frágil da integração hoje.

## 9. Histórico

Evidências brutas em `docs/archive/`: `10-TAGS-LIVE-AUDIT.md` (snapshot por tag com
lat/lng e idade do evento), `TAG-CONNECTIVITY-MATRIX.md` (cadeia classificada camada
por camada), `TAG-FREQUENCY-REPORT.md` (os 502 intervalos), `MOVEMENT-TEST-REPORT.md`
(sequências T0..Tn com Haversine), `LIVE-POSITION-EVIDENCE.md` (payload sanitizado),
`ATHOS-TRACK-LIVE-TAG-VALIDATION.md` e `ATHOS-TRACK-LIVE-12-TAGS-REPORT.md`.
