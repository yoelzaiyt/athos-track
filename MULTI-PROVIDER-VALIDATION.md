# ATHOS TRACK — Multi-Provider Concurrency Validation Report

> Não commitado, não enviado (push), não deployado — conforme pedido.
> Gerado em: 2026-08-28. Continuação de `UI-E2E-VALIDATION.md` (rodada
> imediatamente anterior, mesma sessão).

---

## 0. Correção de premissa (leia isto antes do resto)

O objetivo pedido foi **"provar que Heile e Jason podem operar
simultaneamente sem mistura de dados, eventos ou tenants"**, com uma
arquitetura esperada de dois adapters independentes (`Provider Adapter ├──
Heile └── Jason`).

**Isso não existe no código, de propósito, e a decisão está documentada
desde uma rodada anterior desta mesma sessão** (`server/integrations/
shared/TrackingProvider.ts`, cabeçalho do arquivo):

> *"Heile" e "Jason" (nomes usados no brief recebido) e "BRGPS" (nome já em
> uso neste projeto) são o MESMO fornecedor: mesmo token (...), mesma URL
> de documentação, mesmos endpoints (...) idênticos ao já implementado.
> **Confirmado pelo responsável do projeto nesta sessão.** Por isso este
> projeto NÃO tem providers/heile/ e providers/jason/ como duas integrações
> separadas — isso seria fabricar uma segunda integração fake pro mesmo
> fornecedor real.*

Ou seja: não é uma lacuna, é uma decisão de engenharia já tomada e
confirmada com o responsável do projeto — construir uma segunda integração
"Jason" separada da "Heile" seria literalmente criar uma integração
fictícia fingindo ser real, o que o próprio prompt desta sessão proíbe
explicitamente ("não criar dados simulados fingindo serem dados reais").

**O que existe de verdade**: um único provider real (`BrgpsProvider`),
registrado no `ProviderRegistry` sob **três nomes/aliases** — `'brgps'`,
`'heile'`, `'jason'` — todos resolvendo pro **mesmo objeto em memória**
(`ProviderRegistry.register(brgpsProvider, ['heile', 'jason'])`,
`server/api/index.ts:31`). Não há dois processos, dois workers, duas filas,
dois webhooks, nem dois tokens — é uma única integração, com um alias de
nome pra compatibilidade com nomenclatura usada em briefs anteriores.

**Como tratei isso** (mesmo espírito do que já foi feito com a correção do
nome "Afrin→Grupo Zaffari" numa rodada anterior): não recusei o pedido, mas
também não fabriquei um teste de "Heile vs. Jason" que não faz sentido pra
essa arquitetura. Reformulei pros dois testes que **são** reais e
respondem à pergunta de fundo do prompt ("será que dado/tenant se
confundem sob concorrência?"):

1. **O mecanismo de alias em si pode causar confusão de identidade?**
   (§1) — resposta estática, verificável pelo código.
2. **A ÚNICA integração real (BRGPS) é segura sob carga concorrente de
   verdade — sem misturar tenant, duplicar evento, perder atualização ou
   derrubar o processo?** (§2-4) — testado ao vivo, com problemas reais
   encontrados e corrigidos.

Além disso, os itens do prompt sobre "indisponibilidade de um provider sem
afetar o outro" foram reinterpretados pro par que **de fato existe e é
genuinamente independente**: BRGPS (`server/brgps-sync`) vs. GT06
(`server/gt06-listener`) — dois protocolos, dois processos, dois
fornecedores de hardware diferentes, isso sim uma arquitetura real de
"dois providers" (ver §5).

---

## 1. O alias nunca vira identidade de dado (verificado por leitura de código)

- `ProviderRegistry.get(idOrAlias)` resolve `'heile'`/`'jason'`/`'brgps'`
  pro mesmo `providerId` interno e devolve **a mesma instância** de
  `BrgpsProvider` — o objeto retornado não sabe, e não tem como saber, sob
  qual alias foi pedido.
- `NormalizedPosition.provider` (o campo que entra no banco via
  `positionFingerprint`/`asset_route_points.provider`) é **tipado como o
  literal `'BRGPS'`** (`server/integrations/brgps/types.ts:51`) — não
  existe um valor `'heile'` ou `'jason'` possível nesse campo em lugar
  nenhum do pipeline de dados. Não há como um evento "nascer" marcado como
  Heile ou Jason.
- Identificação de tenant (`client_id`) vem exclusivamente do JOIN
  `provider_devices → assets` em `getActivePositionTargets()`
  (`server/integrations/brgps/db.ts:95-120`) — nunca do alias usado pra
  resolver o provider. Não existe nenhum ponto do código onde "qual nome
  usei pra pegar o provider" influencia "de qual tenant é o dado".

**Conclusão desta seção**: estruturalmente impossível um evento "Jason"
ser atribuído a um dispositivo/tenant "Heile" ou vice-versa, porque não
existe informação de alias em nenhum lugar do modelo de dados pra
confundir — é a mesma pergunta que "pode a chamada `objeto.metodo()` se
confundir com `mesmoObjeto.metodo()` chamado por uma variável com outro
nome?". PASS, por construção.

---

## 2. Teste de carga concorrente real — achados e correções

Rodei `BrGpsRepository.applyPosition()` (o método real que
`BrGpsService.runSyncTick()` chama em produção) com **40 chamadas
concorrentes de verdade** contra o **mesmo asset/dispositivo** — cada
chamada com sua **própria conexão Postgres** (não reaproveitando um único
`pg.Client`, que serializaria as queries e mascararia qualquer corrida).
Mix do teste:

- 10 posições genuinamente novas, timestamps crescentes.
- 15 chamadas com o **mesmíssimo fingerprint** (mesmo device+timestamp+
  lat/lng) — testa duplicação de evento sob concorrência.
- 15 chamadas com timestamps **embaralhados fora de ordem** (offsets de
  1s a 70s enviados em ordem aleatória) — testa eventos atrasados/fora de
  ordem chegando ao mesmo tempo.

Dado de teste (`CONCTEST-*`) criado e removido ao final — confirmado 0
linhas residuais depois da limpeza.

### CRIT-01 — Dedup por fingerprint não era atômico → exceção derrubava o ciclo inteiro

**Antes do fix**: 10 das 40 chamadas concorrentes **lançavam exceção não
tratada** (`duplicate key value violates unique constraint
"idx_route_points_fingerprint"`). Causa: a checagem de dedup era um
`SELECT` seguido de um `INSERT` separado — sob concorrência real, duas
chamadas com o mesmo fingerprint podiam passar as duas pelo `SELECT`
(nenhuma via a linha da outra ainda, porque nenhuma tinha commitado) e só
uma conseguia `INSERT`; a outra estourava a constraint única do banco como
erro, não como "já deduplicado".

**Por que importa**: `BrGpsService.runSyncTick()` só tem `try/catch` em
volta do **ciclo inteiro**, não por posição — uma exceção nessa altura
derrubaria o processamento de TODOS os dispositivos restantes daquele
ciclo de sync, não só o duplicado. Isso é exatamente o cenário
"indisponibilidade" que o prompt pediu pra testar, só que **auto-infligido
por uma corrida interna**, não por queda do fornecedor.

**Fix**: `server/integrations/brgps/db.ts` — o `INSERT` agora usa
`ON CONFLICT (fingerprint) WHERE fingerprint IS NOT NULL DO NOTHING
RETURNING id` (a constraint é um índice único parcial — precisa do `WHERE`
pro Postgres casar o arbiter). Quem perde a corrida cai graciosamente em
`{ deduped: true }`, sem exceção.

### CRIT-02 — "Nunca substituir posição atual por uma mais antiga" não era atômico (lost update)

**Antes do fix**: rodando o mesmo teste, o timestamp final gravado em
`assets.telemetry_packet_timestamp` **não batia com o maior timestamp
enviado** entre as 40 chamadas — uma leitura cronologicamente mais antiga
sobrescreveu uma mais nova. Causa: a decisão "isNewer" era calculada a
partir de um `SELECT` do estado atual, e o `UPDATE` que vinha depois não
reavaliava essa condição — quem quer que executasse o `UPDATE` por último
em relógio de parede vencia, **independente de qual tinha o timestamp de
GPS mais recente**. Clássico *lost update*.

**Por que importa**: é a garantia central do provider ("Seção 20: nunca
substituir a posição atual por uma mais antiga", comentário já existente
no código) sendo violada sob concorrência real — a posição "atual" que o
mapa ao vivo mostra podia ficar presa numa leitura antiga mesmo com
leituras mais novas já processadas.

**Fix**: o `UPDATE` agora carrega a condição de "mais novo" na própria
cláusula `WHERE` (`WHERE id = $10 AND (telemetry_packet_timestamp IS NULL
OR telemetry_packet_timestamp < $6)`), tornando check-e-escrita uma
operação atômica garantida pelo lock de linha do Postgres — quem grava por
último sempre reavalia contra o valor **já commitado**, nunca contra uma
leitura obsoleta. O resultado real de "isNewer" agora vem do `rowCount` do
próprio `UPDATE`, não de uma checagem especulativa anterior.

### Resultado após os dois fixes (3 execuções consecutivas, 40 chamadas cada)

| Execução | Exceções | Timestamp final = máximo enviado | Linhas de histórico duplicadas |
|---|---|---|---|
| 1 | 0/40 | ✅ sim | 0 |
| 2 | 0/40 | ✅ sim | 0 |
| 3 | 0/40 | ✅ sim | 0 |

Convertido em teste automatizado permanente:
`server/integrations/brgps/db.concurrency.test.ts` (roda como parte de
`npm run test` daqui pra frente).

---

## 3. Itens do checklist pedido, item a item

| Item pedido | Resultado |
|---|---|
| Eventos simultâneos | **PASS** (após fix CRIT-02) — 40 chamadas concorrentes, estado final consistente |
| Ingestão concorrente | **PASS** — mesmo teste; cada chamada com conexão própria |
| Normalização | **PASS** — `mapTagToNormalizedPosition`/`positionFingerprint` já cobertos por `BrGpsMapper.test.ts` (10 testes pré-existentes, não alterados) |
| Identificação do provider | **PASS** — `provider: 'BRGPS'` é tipo literal, nunca `'heile'`/`'jason'` no dado (§1) |
| Identificação do tenant | **PASS** — via JOIN `provider_devices→assets.client_id`, nunca via alias (§1) |
| Deduplicação | **PASS** (após fix CRIT-01) — 15 chamadas idênticas concorrentes → exatamente 1 aplicada, 14 deduplicadas, 0 exceções |
| Timestamps | **PASS** (após fix CRIT-02) — estado final sempre reflete o timestamp cronologicamente mais recente |
| Retry | **PASS** — `BrGpsClient.request()` já tem retry real com backoff (`server/integrations/brgps/BrGpsClient.ts:165-194`), só pra erros transitórios (5xx, timeout, ECONNRESET, erro de timestamp) — não é simulado, é o código que corre em produção |
| Timeout | **PASS** — `AbortController` com `timeoutMs` configurável (padrão 10s), testado por leitura de código (`requestOnce`, linha 130-131) |
| Eventos atrasados | **PASS** (após fix) — testado no mix de 40 chamadas (offsets de 1-70s embaralhados) |
| Eventos fora de ordem | **PASS** (após fix CRIT-02) — mesmo teste |
| Duplicação de evento | **PASS** (após fix CRIT-01) — mesmo teste |
| Indisponibilidade de um provider sem afetar o outro | **Reformulado** (§0) — testado como BRGPS vs. GT06, os dois processos genuinamente independentes que existem (§5) |

---

## 4. Nenhuma chamada real ao fornecedor foi feita

Conforme instrução explícita ("Não enviar chamadas reais aos fornecedores
sem credenciais/ambiente explicitamente configurados"): `BRGPS_ENABLED`
não foi alterado nesta rodada, e todo o teste de concorrência chamou
`BrGpsRepository.applyPosition()` diretamente (a camada de banco), nunca
`BrGpsClient`/`BrGpsAdapter` (a camada HTTP que fala com o fornecedor
real). Nenhum request de rede saiu pra `brgps.com` ou qualquer domínio
externo nesta rodada.

---

## 5. O par que É genuinamente independente: BRGPS vs. GT06

Diferente de "Heile/Jason" (mesmo fornecedor, mesmo processo), **BRGPS**
(`server/brgps-sync`, tags via HTTP polling) e **GT06**
(`server/gt06-listener`, rastreadores via TCP binário) são de fato:

- fornecedores de hardware diferentes;
- protocolos diferentes (HTTP poll vs. TCP stream);
- processos Railway diferentes (`railway.brgps-sync.json` vs.
  `railway.gt06-listener.json`), cada um com seu próprio `Client` Postgres,
  sem estado compartilhado em memória;
- repositórios de banco diferentes (`BrGpsRepository` vs.
  `Gt06Repository`), embora ambos escrevam nas mesmas tabelas
  (`assets`, `asset_route_points`, `system_alerts`).

**Indisponibilidade de um sem afetar o outro**: verificado por leitura de
código — não há acoplamento nenhum entre os dois processos (nenhuma
chamada de um módulo pro outro, nenhum estado compartilhado além do
Postgres). Uma falha de rede/timeout no `BrGpsClient` (já tratada com
retry, §3) não tem como propagar pro `gt06-listener` — são processos Node
separados. **PASS.**

### Achado adicional (fora do escopo do pedido, mas descoberto no processo — não corrigido)

`server/integrations/gt06/db.ts` — comentário no topo do arquivo diz que
"espelha" `server/integrations/brgps/db.ts`, mas o espelhamento é
**parcial**: `Gt06Repository.applyPosition()` **não tem nenhuma proteção
de timestamp** (sobrescreve `telemetry_packet_timestamp` incondicionalmente,
sem checar se a posição recebida é mais nova que a atual) **nem
deduplicação por fingerprint** no insert de `asset_route_points` (sem
coluna de fingerprint, sem `ON CONFLICT`). Mitigado parcialmente pelo fato
de TCP garantir ordem de entrega dentro de uma mesma conexão/dispositivo,
mas não protege contra reconexões, retransmissões do dispositivo, ou duas
sessões concorrentes pro mesmo IMEI. **Não corrigido nesta rodada** —
fora do escopo do prompt (que pediu especificamente sobre "Heile/Jason",
não GT06), e é trabalho não-trivial o suficiente pra merecer uma rodada
própria. Registrado como pendência (§8).

---

## 6. Auditoria — filas, workers, webhooks, cron/jobs, idempotência, correlation IDs, logs

Honestidade técnica (mesmo padrão das rodadas anteriores): reporto o que
existe e o que não existe, sem inventar cobertura.

| Item | Existe? | Detalhe |
|---|---|---|
| **Filas** | **NÃO** | Sem Redis/BullMQ/RabbitMQ/SQS em `package.json`. Ingestão é ou TCP síncrono por conexão (GT06) ou polling HTTP síncrono em loop (BRGPS) — nunca message-queue. |
| **Workers** | **Parcial** | 2 processos standalone de longa duração (`gt06-listener`, `brgps-sync`), cada um **single-instance** por design (`railway.*.json` não configura réplicas). Não são workers de um pool distribuído — não há coordenação/lock distribuído; rodar 2 instâncias do mesmo por engano reintroduziria classes de corrida como as do §2 (agora protegidas a nível de linha do Postgres, então **sobreviveria** a isso — mas é bom que o operador saiba que essa é a rede de segurança, não redundância planejada). |
| **Webhooks** | **NÃO** | Confirmado (já documentado em `SECURITY-GATE-REPORT.md`, reconfirmado aqui): nenhum endpoint HTTP inbound aceita evento de terceiro. BRGPS é consumido via polling outbound; GT06 é TCP inbound, mas protocolo binário próprio, não webhook HTTP. |
| **Cron/jobs** | **NÃO** (não como infraestrutura) | `brgps-sync sync` é um loop `while(true)` in-process com `setTimeout` (`BRGPS_SYNC_INTERVAL_SECONDS`, padrão 15s) — não é cron do SO nem scheduler de plataforma. Interessante: `railway.brgps-sync.json` tem `restartPolicyType: "NEVER"` — diferente da API/GT06 (`ON_FAILURE`) — se esse processo cair, **não reinicia sozinho** até intervenção manual. Achado operacional, não código. |
| **Idempotência** | **Parcial** | BRGPS: sim, real, agora atômica (§2, fingerprint `provider+device+timestamp+lat+lng`). GT06: não tem (achado §5). |
| **Correlation IDs** | **NÃO** | Não existe um ID de correlação gerado por evento/ciclo que amarre logs de início a fim de um processamento. O mais próximo é `session_token`/`request_id` do fluxo de homologação (`homologation_events`), que é um conceito vizinho mas só cobre esse fluxo específico, não a ingestão de posição normal. |
| **Logs** | **Parcial** | `console.log`/`console.warn`/`console.error` estruturados o bastante pra debug manual (inclui contexto: IMEI, endpoint, duração, status), mas não persistidos nem centralizados — mesmo residual já registrado em `SECURITY-GATE-REPORT.md` ("LOGS/AUDITORIA"). `audit_logs` (adicionado em rodada anterior) cobre só ações administrativas via `/rest`, não eventos de ingestão de provider. |

---

## 7. Suíte automatizada

- `npm run lint` (tsc --noEmit): **limpo**
- `npm run test`: **52/52 passando** (51 pré-existentes + 1 novo —
  `server/integrations/brgps/db.concurrency.test.ts`, que sozinho cobre 40
  chamadas concorrentes reais dentro de um único `it()`)
- `npm run build`: não re-executado nesta rodada (nenhuma mudança em
  `src/`, só em `server/integrations/brgps/db.ts` — código de backend, não
  entra no bundle do frontend)

---

## 8. Arquivos criados

```
MULTI-PROVIDER-VALIDATION.md
server/integrations/brgps/db.concurrency.test.ts
```

## 9. Arquivos alterados

```
server/integrations/brgps/db.ts — applyPosition(): dedup por fingerprint
  atômico (ON CONFLICT DO NOTHING) e UPDATE de posição atômico
  (WHERE ... AND timestamp mais antigo), fechando as duas race conditions
  reais encontradas nesta rodada (CRIT-01, CRIT-02)
```

## 10. Resultado final: **PASS**

Com a correção de premissa registrada em §0: não existem "Heile" e "Jason"
como sistemas separados pra provar que operam concorrentemente entre si —
é uma decisão de arquitetura já confirmada com o responsável do projeto,
não uma lacuna desta rodada. O que **é** real e testável — a única
integração de verdade (BRGPS, por trás dos 3 aliases) sob carga
concorrente genuína, e os dois pipelines de ingestão que de fato são
independentes (BRGPS vs. GT06) — foi testado ao vivo, teve **2 race
conditions reais encontradas e corrigidas** (não achados especulativos:
reproduzidas de forma determinística em 3 execuções, com e sem o fix), e
fecha limpo depois da correção: 0 exceções, 0 duplicação de histórico, 0
inconsistência de timestamp, em 3 execuções consecutivas de 40 chamadas
concorrentes cada.

## 11. Riscos / Pendências reais

1. **GT06 não tem proteção de timestamp nem dedup de fingerprint** (§5) —
   descoberto nesta rodada, não corrigido (fora do escopo do pedido sobre
   Heile/Jason/BRGPS). Recomendo uma rodada dedicada, aplicando o mesmo
   padrão do fix desta rodada (`WHERE timestamp < $novo` no UPDATE,
   fingerprint + `ON CONFLICT` no INSERT de `asset_route_points`).
2. **Sem correlation ID nem fila/worker distribuído** (§6) — arquitetura
   atual depende de exatamente 1 instância de cada processo (`brgps-sync`,
   `gt06-listener`) rodando por vez. Os fixes desta rodada tornam o código
   **seguro** mesmo se isso for violado por engano (não corrompe dado),
   mas não há nada impedindo ativamente 2 instâncias simultâneas hoje.
3. **`brgps-sync` não reinicia sozinho se cair** (`restartPolicyType:
   "NEVER"` no Railway) — decisão que pode ser proposital (evitar loop de
   crash silencioso) ou um descuido; vale confirmar com quem configurou.
4. Este relatório cobre especificamente concorrência/isolamento de
   provider — não substitui `RBAC-SECURITY-GATE.md` (autorização/tenant,
   já PASS) nem `UI-E2E-VALIDATION.md` (fluxos de UI, já PASS).
