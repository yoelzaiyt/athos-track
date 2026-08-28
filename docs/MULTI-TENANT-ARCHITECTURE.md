# Multi-Tenant — Arquitetura

> Não cria conceitos novos de tenant — reaproveita o schema que já existia
> (`company_clients`/`company_units`) e o isolamento que a auditoria de
> segurança desta base já implementou e testou. Ver `SECURITY-GATE-REPORT.md`
> (SEC-002, SEC-006, SEC-011, SEC-012) pra evidência completa com testes ao
> vivo — este documento é só o mapa de conceitos, não repete a evidência.

## Mapeamento de termos

O brief que motivou esta rodada usa vocabulário genérico (`tenants`,
`tenant_users`, `TENANT_ADMIN`) que não corresponde 1:1 a tabelas novas —
mapeia pro que já existe:

| Termo do brief | Implementação real neste projeto |
|---|---|
| `tenants` | `company_clients` (já existia; ganhou `enabled_modules jsonb`) |
| `tenant_id` | `client_id` (FK em quase toda tabela operacional) |
| unidade/filial | `company_units` (`unit_id`) |
| `tenant_users` | `user_profiles.client_id` (FK direta, sem tabela de junção — um usuário pertence a 1 client_id) |
| `SUPER_ADMIN` | role `ATHOS_ADMIN` (já existia) |
| `TENANT_ADMIN` | role `CLIENT_ADMIN` (já existia) |
| `OPERATOR` | role `OPERATOR` (já existia, igual) |
| `VIEWER` | role `VIEWER` (já existia, igual) |

Duas roles a mais que o brief não pediu, mas já existiam e continuam
existindo (não removidas): `FLEET_MANAGER`, `CART_MANAGER`, `ASSET_MANAGER`
— hoje têm o mesmo nível de acesso de dado que qualquer não-admin do próprio
tenant (RBAC granular por operação entre essas roles não foi implementado —
ver pendência em `SECURITY-GATE-REPORT.md`, área AUTORIZAÇÃO).

## Tenants criados nesta rodada

- **Zafari** (`company_clients.code = 'ZAFARI'`) — `enabled_modules: ["carts", "assets"]`
- **São João** (`company_clients.code = 'SAO-JOAO'`) — `enabled_modules: ["boxes", "assets"]`

Ambos com uma unidade "Matriz" (`company_units`). `enabled_modules` é lido
hoje só via `/rest/company_clients` — a UI ainda **não** condiciona o menu
lateral por esse campo (pendência: seção "UX INICIAL" do brief, menu
"Carrinhos"/"Caixas" aparece pra todo mundo hoje, não só pro tenant certo).

## Isolamento — onde ele vive

Duas camadas independentes, testadas separadamente uma da outra:

1. **`server/api/rest.ts`** — todo acesso a dado de tenant passa por um
   proxy que injeta `client_id`/`unit_id` do JWT como filtro obrigatório,
   ignorando qualquer valor que o cliente tente mandar (SEC-002/006).
2. **RLS real no Postgres** (`athos_app_rw`, sem `BYPASSRLS`) — segunda
   camada que bloqueia no banco mesmo se a camada 1 tiver um bug (SEC-012).
   Prova executada sem passar pela API nenhuma vez: ver `SECURITY-GATE-REPORT.md`.

Categoria nova `box` (Caixa) em `assets.category` — ver
`supabase/migrations/20260828020000_add_box_category_and_tenants.sql` e o
registro central de ícones em `src/components/common/AssetIconRegistry.tsx`.

## Pendências reais desta frente (não inventar que estão prontas)

- Gerenciador de Tenants (tela admin: criar/editar/ativar tenant, associar
  usuários/providers, ver contagem de ativos/dispositivos) — **não construído**.
- Seletor de tenant pro `ATHOS_ADMIN` (trocar entre Zafari/São João/Visão
  Global na UI) — **não construído**.
- Menu lateral condicionado por `enabled_modules` — **não construído**.
- Testes automatizados A-D da seção 29 do brief (isolamento Zafari/São João,
  SUPER_ADMIN/TENANT_ADMIN) — testado manualmente ao vivo nesta sessão (ver
  SEC-002/006/012), não como suíte automatizada reexecutável.
