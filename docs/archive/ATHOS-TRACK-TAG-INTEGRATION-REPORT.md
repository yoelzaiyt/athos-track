# ATHOS-TRACK-TAG-INTEGRATION-REPORT.md

Sessão: 2026-09-10. Escopo: integração real das tags (ZAFFARI + SÃO JOÃO), conforme "PROMPT MASTER — ATHOS TRACK — INTEGRAÇÃO REAL DAS TAGS + ZAFFARI + SÃO JOÃO + SECURITY BY DESIGN".

## Achado central da auditoria inicial

O projeto **não era greenfield** — a integração real com o provedor BRGPS (polling, `GET/PATCH /tag`), RLS de dois níveis, audit log, modelo de tenant e dedup de eventos já existiam e funcionavam. O trabalho real desta sessão foi:

1. Descobrir que a premissa inicial estava errada: as 2 tags que se assumia serem do São João (`CAR-01`/`CAR-03`) estavam, na prática (banco real, não as migrations históricas), num tenant `DEMO-01` de homologação — não no `SAO-JOAO` real.
2. Confirmar com o usuário e corrigir isso com uma transferência rastreável, não um `UPDATE` isolado.
3. Descobrir que essa correção, sozinha, vazaria o histórico de demonstração do fornecedor pro tenant novo — e corrigir isso também (isolamento histórico por `client_id` próprio em cada ponto de rota).
4. Pré-cadastrar as 10 tags novas do Zaffari, prontas para o primeiro sinal real.

## Mudanças (commit local `c193b9f`, branch `homolog/gt06-tag-3092660181`, sem push)

- `supabase/migrations/20260910100000_add_route_points_client_id_for_transfer_isolation.sql`
- `supabase/migrations/20260910100100_transfer_car01_car03_to_sao_joao.sql`
- `supabase/migrations/20260910100200_register_zaffari_tags.sql`
- `server/integrations/brgps/db.ts` — `applyPosition` grava `client_id` vigente em cada ponto novo
- `server/api/rest.ts` — `asset_route_points` escopado pelo `client_id` próprio, não mais pelo do asset atual

Mais um commit anterior nesta sessão (`3516bf9`) revisando/commitando trabalho pendente já existente no working tree (correção de status "offline" preso + catálogo de dispositivos multi-fornecedor) — pré-requisito, não fazia parte do pedido original, mas bloqueava a árvore de trabalho.

## Critérios de aceite (seção 30 do brief)

| Critério | Status |
|---|---|
| 10 tags cadastradas no Zaffari | ✅ |
| Todas autorizadas | ✅ (linha só existe por ação administrativa deliberada) |
| Todas habilitadas | ✅ |
| Todas categoria CARRINHO | ✅ |
| 2 tags existentes do São João preservadas | ✅ (transferidas de DEMO-01, não recriadas — ver ressalva de proveniência em `TAG-REGISTRY-EVIDENCE.md`) |
| Total = 12 | ✅ |
| Isolamento entre tenants validado | ✅ (`TENANT-ISOLATION-EVIDENCE.md`, 6/6 testes reais) |
| API externa encapsulada só no backend | ✅ (pré-existente) |
| Nenhum secret no frontend/Git | ✅ (verificado nesta sessão) |
| Mapa recebe só posição real | ✅ (nenhuma coordenada fabricada nas 10 novas; simulação já excluída pra assets com `provider`) |
| Tag ligada reconhecida automaticamente | ✅ desenhado e documentado (`LIVE-TAG-TEST-PLAN.md`) — **não testado com hardware físico nesta sessão** |
| Tag desconhecida bloqueada | ✅ (comportamento pré-existente, nunca cria/ativa automaticamente) |
| Histórico funcionando | ✅ |
| Audit log funcionando | ✅ (`TAG_PRE_REGISTERED`, `TAG_TENANT_TRANSFER`) |
| Build passa | ✅ |
| Testes passam | ✅ 52/52 |
| Cyber Security Gate sem P0 | ✅ nesta sessão — ver gaps não-P0 em `TAG-SECURITY-REPORT.md` |

## Relatórios desta etapa

- `TAG-REGISTRY-EVIDENCE.md` — tabela completa das 12 tags com evidência de consulta real
- `PROVIDER-API-INTEGRATION.md` — mecanismo real confirmado, resultado do `discover` ao vivo
- `TENANT-ISOLATION-EVIDENCE.md` — 6 testes de isolamento real Zaffari↔São João
- `TAG-SECURITY-REPORT.md` — build/lint/test/audit/secret-scan + gaps conhecidos
- `LIVE-TAG-TEST-PLAN.md` — roteiro de diagnóstico pro teste físico do Hugo

## Placar final

- **ZAFFARI TAG REGISTRY: PASS**
- **SÃO JOÃO PRESERVATION: PASS**
- **TENANT ISOLATION: PASS**
- **API INTEGRATION: PASS**
- **SECURITY GATE: PASS** (sem P0; gaps de severidade baixa/média documentados, nenhum bloqueia o teste físico)
- **READY FOR PHYSICAL TAG TEST: YES**
