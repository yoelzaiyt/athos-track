# MAP-SECURITY-GATE.md

Security gate da nova superfície (MAP V2 / `AssetMapV2.tsx`, `mapV2GeoJson.ts`, `LiveMap.tsx`), seção 38 do brief.

| Item | Resultado | Evidência |
|---|---|---|
| XSS em popups | **N/A nesta POC** — o V2 ainda não renderiza popups com conteúdo livre (não há `bindPopup`/`innerHTML`/`dangerouslySetInnerHTML` em nenhum dos 3 arquivos novos, confirmado por grep). Seleção de ativo hoje só chama `onSelectAsset`/`setSelectedAsset`, sem renderizar HTML dinâmico no próprio mapa. | grep real, 0 ocorrências |
| Injection em labels | **N/A** — mesmo motivo acima; texto de nome/categoria só é usado como propriedade de feature GeoJSON consumida por expressões de estilo do MapLibre (`['get', 'color']` etc.), nunca interpolado em string HTML | Código revisado |
| Acesso cross-tenant | **PASS, herdado** — V2 não faz nenhuma requisição própria; consome só `useAssets()`/`AssetContext`, cujo isolamento de tenant (rooms Socket.IO + RLS server-side) já é coberto por `server/api/realtime.test.ts` (3 testes reais, passando nesta sessão) | Teste automatizado real |
| Websocket authorization | **PASS, herdado** — mesmo socket/handshake JWT do V1, nenhuma conexão própria criada pelo V2 | Código revisado, nenhum `io(...)`/`getSocket()` novo em `AssetMapV2.tsx` |
| Secrets | **PASS** — nenhuma API key/token/secret hardcoded nos 3 arquivos novos (grep real, único `import.meta.env.*` é a flag de feature, não um segredo) | grep real |
| Provider API exposure | **PASS** — tiles reutilizam exatamente as mesmas URLs já usadas pelo V1 (`mapProvider.getTileConfig()`), nenhum novo provider/endpoint introduzido | Código revisado |
| Signed URLs | N/A — não aplicável a tiles raster públicos já em uso | — |
| CSP | **NÃO TESTADO** — não fabricado; exigiria testar a CSP real do app contra as origens de tile (`server.arcgisonline.com`, `tile.openstreetmap.org`, `tiles.stadiamaps.com`, `basemaps.cartocdn.com`) e contra o worker/wasm que o MapLibre pode usar internamente. Mesmas origens já usadas pelo V1, então o risco incremental é baixo, mas não medido nesta sessão. |
| Dependências | **PASS** — `npm audit` após instalar `maplibre-gl`: 5 vulnerabilidades moderadas, todas pré-existentes (vitest/express/body-parser/qs), nenhuma nova | `npm audit --json`, real |
| Supply chain | **PASS** — `maplibre-gl@6.9.0`, licença BSD-3-Clause confirmada ao vivo via `npm view`, projeto ativo e amplamente adotado | `npm view maplibre-gl`, real |

## Conclusão

**SECURITY GATE: PASS nos itens aplicáveis à superfície atual da POC (sem popups/HTML dinâmico), com uma lacuna real não testada: CSP.** Recomendo testar CSP antes de qualquer promoção a default — não incluído nesta rodada porque exigiria acesso ao ambiente de produção/staging real, fora do escopo de uma sessão de desenvolvimento local.
