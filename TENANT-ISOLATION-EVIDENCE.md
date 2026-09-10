# TENANT-ISOLATION-EVIDENCE.md

Teste ao vivo, real, contra a API Express real (não mock) e o Postgres real do Supabase, feito nesta sessão (2026-09-10). Complementa a suíte automatizada genérica `server/api/rbac.test.ts` (22 testes, tenants sintéticos `RBACTEST-*`, 52/52 passando via `npm test`), com um teste específico dos tenants **reais** ZAFFARI e SAO-JOAO.

Método: 2 usuários VIEWER descartáveis criados (`livetest-zaffari@example.com`, `livetest-saojoao@example.com`), um por tenant real, login via `/auth/login` (JWT real), ataques via `/rest/*` (mesmo proxy que o frontend usa), depois **apagados** — não alterou nenhum dado de tag/tenant.

| # | Teste | Esperado | Resultado |
|---|---|---|---|
| 1 | Usuário ZAFFARI tenta ler asset do SAO-JOAO por IMEI direto (`GET /rest/assets?eq_imei=1603000067`) | vazio | **`[]` — PASS** |
| 2 | Usuário SAO-JOAO tenta ler asset do ZAFFARI por IMEI direto (`GET /rest/assets?eq_imei=3092524960`) | vazio | **`[]` — PASS** |
| 3 | Usuário ZAFFARI lista todos os assets (`GET /rest/assets`) | só os 10 próprios, nunca CAR-01/CAR-03 | **10 tags ZAF-CART-01..10, nenhuma vazada — PASS** |
| 4 | Usuário SAO-JOAO lista todos os assets | só os 2 próprios, nunca ZAF-CART-* | **CAR-01, CAR-03, nenhuma vazada — PASS** |
| 5 | Usuário ZAFFARI lê `asset_route_points` de CAR-01 (histórico do São João) | vazio | **`[]` — PASS** |
| 6 | Usuário SAO-JOAO lê `asset_route_points` de CAR-01 (histórico demo pré-transferência, tenant DEMO-01) | vazio (histórico antigo não deve "virar" do São João automaticamente) | **`[]` — PASS**: os 20 pontos antigos continuam existindo no banco (nada foi apagado), mas com `client_id=DEMO-01` gravado no momento da coleta — corretamente invisíveis pro São João até que pontos NOVOS sejam gravados sob o tenant certo. |

Todos os 6 testes confirmam isolamento nas duas direções (Zaffari→São João e São João→Zaffari), tanto por leitura direta quanto por listagem, e a correção de isolamento histórico da migration `20260910100000` se comporta como projetado.

## O que ainda não foi testado ao vivo

- RLS a nível de banco isoladamente (sem passar pela API) — a suíte usa a role `athos_app_rw` (sem `BYPASSRLS`) através da API, que já é o caminho real de qualquer usuário; uma conexão direta como essa role, sem a API, não foi testada separadamente nesta sessão (redundante com o que já foi validado, mas não idêntico).
- RBAC granular (MANAGER/OPERATOR/CLIENT_ADMIN) especificamente nos tenants ZAFFARI/SAO-JOAO — a suíte genérica (`rbac.test.ts`) já cobre esses papéis com tenants sintéticos; não foi refeita com os tenants reais nesta sessão.
