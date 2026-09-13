# Arquitetura do mapa — ATHOS Track

Documento único e vivo sobre a camada de mapa. Consolida 14 relatórios de sessão
(`MAP-*.md`, `OPERATIONAL-MAP-ARCHITECTURE.md`, `REALTIME-MAP-EVIDENCE.md`), hoje em
`docs/archive/`. Atualize **este** arquivo em vez de criar um relatório novo.

Última revisão: 2026-09-11.

---

## 1. Estado atual

Duas engines coexistem atrás de uma feature flag. V1 é o padrão em produção.

| | V1 (padrão) | V2 (POC, opt-in) |
|---|---|---|
| Engine | Leaflet 1.9.4 puro (não `react-leaflet`) | MapLibre GL JS 6.9.0 |
| Componente | `src/components/map/AssetMap.tsx` | `src/components/map/AssetMapV2.tsx` |
| Flag | — | `VITE_MAP_V2_ENABLED` (default `false`) |
| Clustering | flood-fill manual em pixels de tela | `supercluster` nativo (`cluster: true`) |
| Bundle | no `index-*.js` principal | chunk isolado, ~1.042 kB / 284 kB gzip, `React.lazy` |

Roteamento: `LiveMap.tsx` → (flag on) `React.lazy(AssetMapV2)` dentro de
`MapV2ErrorBoundary` → fallback `AssetMap`. `HistoryPage.tsx` importa `AssetMap`
direto, fora do alcance da flag (replay/histórico nunca fez parte da POC V2).

Com a flag desligada, o chunk do MapLibre não é baixado — confirmado na separação
de chunks do build real.

## 2. Basemaps (`src/components/map/MapProvider.ts`)

Todos raster XYZ, **todos keyless**. Não há vector tiles em uso.

| Modo | Provedor | Zoom máx. |
|---|---|---|
| 2D claro / STREETS | OpenStreetMap (`tile.openstreetmap.org`) | 19 |
| 2D escuro / NIGHT | OSM + filtro CSS `.athos-dark-basemap-filter` | 19 |
| SATELLITE | Esri World_Imagery (`server.arcgisonline.com`) | 19 |
| HYBRID | Esri World_Imagery + labels Esri `World_Boundaries_and_Places` | 19 |
| TERRAIN | OpenTopoMap (só V1) | 17 |
| TRAFFIC | OSM + camada de congestionamento **mock** (assumida como fictícia) | 19 |

`MAP_MAX_SAFE_ZOOM = 19` é imposto no V2 (`Map.maxZoom` + `source.maxzoom`):
acima de z19 nenhum desses servidores devolve conteúdo, só tile vazio.

### Stadia Maps — removido (era o bug do "mapa quebrado")

Os modos 2D escuro e NIGHT usavam Stadia Maps sem API key. Em produção a Stadia
devolve uma **imagem** de erro 401 "Invalid Authentication" (não um erro silencioso),
preenchendo a tela com um grid de tiles de erro. Reproduzido ao vivo: 16/16 requests
com `statusCode: 401`. `VITE_STADIA_API_KEY` nunca existiu implementada — era só um
comentário no código.

Correção (commit `7bc5701`): trocado pelo próprio OSM + filtro CSS
`invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%)`. Validado com 350
requests a `tile.openstreetmap.org`, 100% status 200. Não voltar a Stadia sem conta paga.

### CARTO — também removido

O overlay de labels do modo HYBRID usava CARTO `voyager_only_labels`. A CARTO
passou a estampar "API KEY REQUIRED" nos tiles anônimos, então o commit `0b41967`
trocou por Esri `World_Boundaries_and_Places`, que é keyless e do mesmo provedor
da imagem de satélite. **Não há mais nenhuma referência a `cartocdn` no código** —
a origem continua na allow-list da CSP em `vercel.json`, hoje sem uso.

## 3. Realtime

Socket.IO, **não polling do frontend**.

```
PROVIDER → ATHOS BACKEND → POSTGRES → LISTEN/NOTIFY → SOCKET.IO
    → AssetContext (useAssets) → AssetMap / AssetMapV2
```

- Client: `src/lib/supabaseClient.ts` — nome legado; hoje é um shim HTTP+Socket.IO
  que imita a API do `supabase-js` para não exigir reescrever os contexts.
  JWT obrigatório no handshake (SEC-003).
- Server: `server/api/realtime.ts` — `LISTEN table_changes` numa conexão dedicada via
  **`DIRECT_URL`**, nunca `DATABASE_URL`. **LISTEN/NOTIFY não sobrevive ao pooler
  PgBouncer em modo transação** — essa foi a causa raiz de "preciso dar F5 pra ver
  posição nova". Há teste de regressão permanente (`server/api/realtime.test.ts`).
- Isolamento de tenant: cada socket entra na room `client:<client_id>`, ou `admins`
  se `ATHOS_ADMIN`. Emissão sempre `io.to(tenantRoom(clientId)).to('admins')` —
  nunca broadcast geral. `client_id` não resolvível vai só para `admins`.
- Atualização incremental: marcador existente recebe `setLatLng`/`setIcon`/
  `setTooltipContent` (V1) ou `GeoJSONSource.setData()` (V2). O mapa nunca é recriado
  por posição nova — é isso que elimina o "piscar".

V2 não abre conexão própria: consome o mesmo `useAssets()`, herdando isolamento e
realtime já validados.

## 4. Navegação e câmera

Regras que custaram cinco bugs para chegar ao estado atual — não regredir:

- `flyTo` dispara **só quando o ID selecionado muda**, nunca a cada tick de posição.
- Modo "seguir ativo" usa `panTo` (preserva o zoom do usuário), em efeito separado;
  desliga automaticamente no `dragstart`.
- A seleção é **derivada por ID a cada render** (`sourceAssets.find(...)`), nunca um
  snapshot em `useState` — snapshot deixava o drawer e o follow presos na posição do clique.
- Auto-fit (`fitToVisibleAssets`) é keyed pelo **conjunto de IDs visíveis**, então
  reenquadra quando um ativo entra/sai do filtro e não quando um ativo visível só se move.
- `selectedAsset` vem do `AssetContext` **global** e sobrevive à troca de página: uma
  seleção só conta como relevante se pertence ao `sourceAssets` da instância atual do
  mapa. Sem esse guard, a página de Caixas ficava presa na visão da página de Carrinhos.
- Sem posição real, **não navega para coordenada default** — mostra "Sem localização
  real disponível" no drawer.

`focusAssetType`/`fitToVisibleAssets` são genéricos sobre `AssetCategory`
(`cart | vehicle | truck | forklift | asset | bike | cargo | box | tag | agro`).
Não existe nenhum `if (categoria === 'cart')` no código.

## 5. Clustering e sobreposição

O clustering roda **sempre que há ≥2 ativos com posição válida** (o gate antigo de
>25 ativos escondia a sobreposição: 10 tags empilhadas no mesmo pixel pareciam ~5
marcadores "faltando").

Clique no cluster decide por distância real (Haversine) entre os membros:
- **≤15m** → abre lista de ativos daquele ponto, cada item clicável (zoom nunca
  separaria coordenadas efetivamente idênticas).
- **>15m** → `flyTo` com +3 níveis de zoom.

Cuidado conhecido: a recriação dos marcadores de cluster a cada tick de realtime
disparava `popupclose` e fechava a lista sozinha em <1s. A intenção de popup é
capturada **antes** do passo de limpeza e só é zerada por ação explícita do usuário.

## 6. Geofence

- Render: `L.circle` / `L.polygon` a partir de `sourceGeofences`.
- Cálculo INSIDE/OUTSIDE: servidor, `server/integrations/shared/geofenceEngine.ts`.
  Haversine manual para círculo, ray-casting manual para polígono. **Sem turf.js.**
- **Gap real**: o motor é binário (dentro/fora → status `out_of_geofence`). Não existe
  `NEAR_BOUNDARY` nem `UNKNOWN` considerando accuracy.
- No V2 a geofence é somente leitura (círculo aproximado por polígono).

Posição nunca usa centro de geofence como coordenada.

## 7. Licenças

Todas permissivas, compatíveis com produto comercial fechado. Nenhuma copyleft.

| Pacote | Versão | Licença | Situação |
|---|---|---|---|
| `leaflet` | 1.9.4 | BSD-2-Clause | em uso (V1) |
| `maplibre-gl` | 6.9.0 | BSD-3-Clause | em uso (V2, atrás de flag) |
| `socket.io-client` | 4.8.3 | MIT | em uso |
| `ol` (OpenLayers) | 10.10.0 | BSD-2-Clause | avaliado, **não adotar** — redundante |
| `cesium` | 1.145.0 | Apache-2.0 | **DEFERRED** — overkill, ~2-3MB gzip |

MapLibre foi escolhido por cobrir 2D + satélite + híbrido + 3D opcional sem trocar
para um motor de globo pesado (Cesium) nem adotar a superfície de GIS do OpenLayers
(CRS arbitrário) que este projeto não precisa.

MapTiler avaliado e **não adotado**: $25/mo + overage, ganho real só se o deployment
CN exigir labels EN em basemap raster ou se zoom >19 virar requisito.

## 8. Segurança

- Todas as origens de tile são HTTPS, keyless, sem secret client-side.
- CSP em `vercel.json` + security headers na API (`server/api/index.ts`). Allow-list
  cobre `tile.openstreetmap.org`, `server.arcgisonline.com` e
  `tile.opentopomap.org` (com e sem subdomínios `{s}`) em `img-src` e `connect-src`,
  mais o host da API Railway em `connect-src`.
- V2 não renderiza HTML dinâmico no mapa (sem `bindPopup`/`innerHTML`/
  `dangerouslySetInnerHTML`) — XSS em popup/label é N/A nessa superfície. O V1 usa
  `bindPopup` com HTML de lista: qualquer campo novo ali precisa ser escapado.
- `npm audit`: vulnerabilidades moderadas pré-existentes (vitest/express/body-parser/
  qs). Nenhuma introduzida pelo MapLibre.
- Worker do MapLibre excluído do `optimizeDeps` do Vite.

## 9. Pendências reais

| Item | Situação |
|---|---|
| Teste de carga em escala (centenas → milhares de ativos) | **nunca executado.** Baseline real é 12 ativos. Não assumir PASS por analogia com o supercluster |
| Validação visual em browser real do V2 (BR) | parcial — smoke automatizado OK, falta confirmação visual |
| Validação em rede CN | pendente — OSM pode ser lento/bloqueado pelo GFW; Esri normalmente acessível |
| Testes automatizados de UI do mapa | **zero.** `vitest.config.ts` usa `environment: 'node'`, sem jsdom/testing-library |
| 3D | **não implementado.** MapLibre suporta extrusão/terreno/globo, mas não há fonte de elevação/edifícios neste projeto |
| `NEAR_BOUNDARY`/`UNKNOWN` em geofence | não implementado (ver §6) |
| PostGIS | não avaliado. Não instalar sem necessidade medida |

Promover o V2 a default depende de: validação visual BR + teste de carga.

## 10. Histórico

Os relatórios de sessão que originaram este documento estão em `docs/archive/`
(`MAP-401-ROOT-CAUSE.md`, `MAP-V1-AUDIT-BASELINE.md`, `MAP-ENGINE-EVALUATION.md`,
`MAP-V2-POC-REPORT.md`, `MAP-MARKER-VISIBILITY.md`, `MAP-NAVIGATION-REPORT.md`,
e os demais `MAP-*`). Eles contêm as evidências brutas — screenshots descritos,
contagens de request, snapshots de banco — de cada correção citada aqui.
