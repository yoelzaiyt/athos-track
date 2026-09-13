# TAG-SECURITY-REPORT.md

Cyber Security Gate desta etapa (integração de tags), 2026-09-10. Não substitui `SECURITY-GATE-REPORT.md`/`RBAC-SECURITY-GATE.md` (rodadas anteriores, mais amplas) — aqui só o que foi verificado nesta sessão, com evidência.

## Checks executados

| Check | Comando | Resultado |
|---|---|---|
| Static analysis (typecheck) | `npm run lint` (`tsc --noEmit`) | **PASS**, sem erros |
| Build | `npm run build` | **PASS** (avisos pré-existentes de bundle size/CSS import, não relacionados a esta mudança) |
| Testes automatizados | `npm test` | **PASS** — 52/52 (6 arquivos), incluindo RBAC ofensivo e concorrência real de 40 conexões contra `applyPosition` |
| Isolamento de tenant (real, ZAFFARI/SAO-JOAO) | ver `TENANT-ISOLATION-EVIDENCE.md` | **PASS** — 6/6 testes ao vivo |
| Dependency audit | `npm audit --production` | **3 vulnerabilidades moderadas pré-existentes** (`qs` via `body-parser`→`express` 4.22.2), não introduzidas por esta sessão. `npm audit fix` disponível, não aplicado (fora de escopo — mudança em `express` não pedida, risco de regressão sem teste dedicado) |
| Secret scan | `git show HEAD \| grep -i "token\|secret\|password\|api_key\|bearer"` | **PASS** — nenhum valor de secret no diff commitado, só 1 referência a nome de coluna (`api_key`, sem valor) |
| `.env` fora do Git | `.gitignore` + `git ls-files` | **PASS** — `.env*` ignorado, só `.env.example` versionado, `.env` real não rastreado |
| Negative test (SQL injection) | já coberto por `rbac.test.ts` (`id;drop table assets;--` na coluna de order) | **PASS** (pré-existente, não regrediu) |

## Gaps conhecidos, não corrigidos nesta sessão (marcados, não inventados)

- **Rate limiting genérico ausente em `/rest/*` e `/providers/*`** (seção 18 do brief). Só `/auth/login` tem rate limit real (por IP e por e-mail, `SEC-007`). Não implementei um limite às cegas para não arriscar bloquear o teste físico real do Hugo sem dado de carga — precisa de uma decisão dimensionada com tráfego real, não um número arbitrário.
- **RBAC**: papéis reais no schema são `ATHOS_ADMIN, CLIENT_ADMIN, FLEET_MANAGER, CART_MANAGER, ASSET_MANAGER, OPERATOR, VIEWER` — difere nominalmente do brief (`ATHOS_SUPER_ADMIN`, `MANAGER` genérico, `SERVICE_ACCOUNT`). Já documentado como gap conhecido em `MULTI-TENANT-ARCHITECTURE.md`, anterior a esta sessão — não renomeei papéis em produção sem confirmação explícita do usuário (risco de quebrar sessões/tokens existentes).
- **Proteção de screenshot/watermark forense** (seção 16) e **storage de imagens com signed URL** (seção 17) — não avaliados nesta sessão; o escopo pedido (tags/tenants) não envolveu telas classificadas como altamente sensíveis nem upload de imagem/documento novo.
- **`npm audit` — 3 vulnerabilidades moderadas em `qs`** — pendente, não corrigido (ver acima).

## Sem P0 aberto nesta sessão

Nenhum problema crítico (P0) foi encontrado no que foi implementado. Os gaps acima são de severidade baixa/média e pré-existentes ou fora do escopo direto de "tags + tenants".
