# MAP-V1-AUDIT-BASELINE.md

Auditoria somente-leitura do mapa atual (V1) antes de qualquer escolha de engine ou código do MAP V2 POC. Nenhum arquivo existente foi alterado. Git HEAD no momento da auditoria: `d1e1185065a065ee389b285d3e824947846f381e`, branch `homolog/gt06-tag-3092660181`, working tree limpo.

## 1. Biblioteca de mapa atual

`leaflet` **^1.9.4** (`package.json:39`), com `@types/leaflet` **^1.9.22** (`package.json:57`). **Não é `react-leaflet`** — confirmado por grep, não existe essa dependência. É Leaflet puro (`L.map()`, `L.marker()`, `L.tileLayer()`) manipulado imperativamente dentro de `useEffect`/`useRef` em `src/components/map/AssetMap.tsx`.

## 2. Basemaps por modo (`src/components/map/MapProvider.ts`)

7 modos já implementados via `L.tileLayer` XYZ (raster, não vetorial):

| Modo | URL | Risco de API key |
|---|---|---|
| 2D (claro) | OSM clássico (`tile.openstreetmap.org`) | Nenhum |
| 2D (escuro) | Stadia Maps `alidade_smooth_dark` | **Risco ativo em produção** — comentário no próprio código (`MapProvider.ts:46-47,109-113`) diz que o free tier da Stadia só funciona sem chave quando `Referer` é localhost; em produção (domínio real) quebra sem `VITE_STADIA_API_KEY`. **Confirmado por grep: `VITE_STADIA_API_KEY` não é lido em nenhum lugar do código hoje** — é só uma instrução em comentário, a variável não existe implementada. Ou seja, isso é um risco real e não mitigado, não hipotético. |
| SATELLITE | Esri World_Imagery (`server.arcgisonline.com`) | Nenhum (uso público documentado pela Esri) |
| HYBRID | Esri World_Imagery + overlay de labels CARTO (`voyager_only_labels`) | Comentário (`MapProvider.ts:43-44`) já registra que a CARTO descontinuou acesso anônimo aos estilos Voyager/Dark — **mas o overlay de labels usado aqui é `voyager_only_labels`, que pode estar sob a mesma exigência de key; não testado nesta auditoria se está quebrado agora** (não fabrico esse dado — precisa teste real de rede). |
| STREETS | OSM clássico | Nenhum |
| TERRAIN | OpenTopoMap | Nenhum |
| NIGHT | Stadia Maps (mesma URL do 2D escuro) | Mesmo risco do item 2D escuro |
| TRAFFIC | OSM clássico + camada de congestionamento **mock**, desenhada pelo próprio `AssetMap.tsx` (comentário linha 124 de `MapProvider.ts`: "base de ruas clara + camada de congestionamento (mock)") | N/A — é dado fictício assumido como tal, não fingido de real |

## 3. Realtime

**Mecanismo real:** Socket.IO (`socket.io` + `socket.io-client` ^4.8.3, `package.json:48-49`), **não é polling do frontend**.

- Client: `src/lib/supabaseClient.ts` — arquivo com nome legado ("supabaseClient") mas que hoje é só um shim HTTP+Socket.IO que imita a API do `supabase-js` (comentário linhas 1-10) para não exigir reescrever `AssetContext.tsx`/`AuthContext.tsx`. `getSocket()` (linha 39-44) conecta com `io(API_URL, { transports: ['websocket'], auth: { token: authToken } })` — **JWT obrigatório no handshake (SEC-003)**.
- Server: `server/api/realtime.ts`. Usa `LISTEN table_changes` numa conexão Postgres dedicada via **`DIRECT_URL`** (não `DATABASE_URL`/PgBouncer) — comentário linhas 63-73 documenta explicitamente que essa foi a causa raiz de updates não chegarem sem F5 (testado ao vivo em 2026-09-10, LISTEN via pooler nunca recebia o NOTIFY).
- **Isolamento por tenant confirmado real**: `authenticateSocket()` (`realtime.ts:24-47`) resolve o JWT, e cada socket entra na room `client:<client_id>` (função `tenantRoom`, linha 20-22) ou, se `ATHOS_ADMIN`, na room `admins` (recebe tudo). Cada evento é emitido só para `io.to(tenantRoom(clientId)).to('admins')` (linha 99) — nunca broadcast geral. Se o `client_id` da linha não puder ser resolvido, vai só para `admins`, nunca broadcast (linhas 100-104).
- **Atualização incremental confirmada**: em `AssetMap.tsx:1347-1370`, se o marker já existe (`markersRef.current[asset.id]`), o código só faz `marker.setLatLng()`/`setIcon()`/`setTooltipContent()` — **não remove/recria o marcador** (comentário explícito linha 1349-1350: "isso é o que elimina o 'piscar'"). Mapa inteiro nunca é recriado por posição nova.

## 4. Clustering

**Confirmado: é a abordagem "screen-pixel flood-fill"**, não uma lib (`leaflet.markercluster`/`supercluster` não estão em `package.json` — confirmado por grep).

Localização: `AssetMap.tsx:1081-1303` (bloco "Render Assets & Clustering Logic"). Algoritmo:
- Converte cada asset visível para coordenada de tela (`map.latLngToContainerPoint`), não lat/lng — clustering é por proximidade visual na tela atual, não por distância geográfica fixa (linha 1119-1120, comentário: evita ativos próximos caírem em clusters vizinhos por estarem nos dois lados de uma borda de grade).
- `CLUSTER_RADIUS_PX = 48` (linha 1124) — flood-fill simples sobre a matriz de distâncias de tela (BFS/DFS por `visited[]`, linhas 1137-1156).
- Recalcula **a cada render do efeito** (dependências incluem `displayAssets`, `layers.clusters`, `mapZoom` — linha ~1393-1403), ou seja, recomputa clusters em qualquer novo tick de posição, não só em mudança de zoom. Para 10-12 ativos isso é O(n²) trivial; não teria sido avaliado para milhares (ver seção 30 do novo brief, ainda não medido).
- Overlap/sobreposição exata: tratado por popup de lista (spiderfy funcional, não geométrico) — `clusterMarker.bindPopup(listHtml)` (linha 1249) mostra "N ativos nesta coordenada" com lista clicável, cada item leva ao asset individual (linhas 1235-1275). Não fabrica posições diferentes para pontos idênticos.

## 5. Geofence

- **Renderização**: `AssetMap.tsx:739-774` — desenha `L.circle` (tipo `circle`) ou `L.polygon` (tipo `polygon`) a partir de `sourceGeofences`, limpando e redesenhando a cada mudança da lista/flag `layers.geofences`.
- **Cálculo INSIDE/OUTSIDE**: real, servidor, `server/integrations/shared/geofenceEngine.ts` — `isInsideGeofence()` (linha 41-47). Círculo: haversine manual (linha 18-26, sem lib) comparado ao raio. Polígono: ray-casting manual (`pointInPolygon`, linhas 28-39). **Nenhuma lib turf.js usada** (confirmado, não está em `package.json`).
- **Gap real vs. o novo brief (seção 18)**: o motor atual só produz um booleano dentro/fora, refletido no app como status `'out_of_geofence'` (visto em `AssetMap.tsx:1558,2037` e no state machine de `assets.status`). **Não existe hoje um estado `NEAR_BOUNDARY` nem `UNKNOWN` considerando accuracy** — é binário. Isso é uma lacuna real a preencher se o novo brief for adotado, não algo já implementado.
- Geofence ≠ posição: confirmado por auditoria anterior (`LOCATION-ACCURACY-REPORT.md`, já existente) — o marcador nunca usa centro de geofence como posição.

## 6. Filtro por asset_type / `fitToVisibleAssets`

**Já é genérico, sem código específico de carrinho.** `AssetMap.tsx:410-433`:

```ts
// focusAssetType/fitToVisibleAssets (seções 4/26 do brief) — genérica por
// design: opera sobre `displayAssets`/`assetsWithValidPosition`, que já são
// filtrados por category/tenant/unit/status sem nenhum "if (categoria ===
// cart)" hardcoded.
const fitToVisibleAssets = useCallback(() => {
  const map = mapInstanceRef.current;
  if (!map) return;
  if (assetsWithValidPosition.length === 0) return;
  if (assetsWithValidPosition.length === 1) {
    const a = assetsWithValidPosition[0];
    map.flyTo([a.telemetry.latitude, a.telemetry.longitude], 16, { duration: 1.0 });
    return;
  }
  const bounds = L.latLngBounds(assetsWithValidPosition.map(a => [a.telemetry.latitude, a.telemetry.longitude]));
  map.fitBounds(bounds, { padding: [60, 60], maxZoom: 17 });
}, [assetsWithValidPosition]);

const focusAssetType = useCallback((assetType: AssetCategory | 'all') => {
  setFilterCategory(assetType);
}, []);
```

`AssetCategory` (`src/types/index.ts:58-68`) já cobre `cart | vehicle | truck | forklift | asset | bike | cargo | box | tag | agro` — e existem páginas dedicadas reais por tipo (`CartsModule.tsx`, `BoxesModule.tsx`, `ForkliftsModule.tsx`, `BicyclesModule.tsx`, `AgroModule.tsx`, `FleetModule.tsx`, `TagsModule.tsx`, `AssetsModule.tsx`), todas chamando o mesmo `setSelectedAsset` genérico do `AssetContext`. **A abstração por asset_type pedida na seção 1 do novo brief já existe hoje, não precisa ser criada do zero.**

## 7. Clique-para-focar (lista/tabela → mapa)

**Existe e é genérico.** Confirmado por grep de `setSelectedAsset(`: usado em `Header.tsx:417`, `LiveMapPage.tsx:73`, e via prop `onRowClick`/`onSelectAsset` em `CartsModule.tsx:245`, `BoxesModule.tsx:132`, `ForkliftsModule.tsx:139`, `BicyclesModule.tsx:126`, `AgroModule.tsx:315`, `FleetModule.tsx:665`, `AssetsModule.tsx:141`, `TagsModule.tsx:290`. O efeito que reage (`AssetMap.tsx:1405-1426`) dispara `map.flyTo()` só quando o **ID** selecionado muda (não a cada tick de posição do mesmo ativo já selecionado — via `prevSelectedIdRef`). Se a tag não tem posição real, **não navega para coordenada default** (linha 1421-1424, comentário explícito citando a seção 1 do brief anterior) — mostra "Sem localização real disponível" no drawer.

## 8. Modo "Seguir Ativo"

**Já implementado, não é gap.** `AssetMap.tsx:1428-1440`: `isFollowing` (state, default = prop `enableFollowMode`) — quando ligado, um efeito separado reage só à posição (lat/lng) do ativo selecionado mudando e usa `map.panTo()` (mantém o zoom do usuário, sem o "salto" que `flyTo` causaria a cada tick). Desativado automaticamente em `map.on('dragstart', ...)` (linha 500-502) — arrastar o mapa manualmente sai do modo seguir. Toggle visível na UI (linha 1873-1879).

## 9. Suporte 3D

**NOT IMPLEMENTED.** Leaflet não tem 3D nativo; nenhuma lib 3D (CesiumJS, Mapbox GL, MapLibre GL, deck.gl) está em `package.json` (grep confirmado). Nenhum código de terreno/extrusão/globo encontrado.

## 10. Dependências npm relacionadas a mapa (grep completo em `package.json`)

- `leaflet` ^1.9.4
- `@types/leaflet` ^1.9.22
- `socket.io` ^4.8.3 (servidor)
- `socket.io-client` ^4.8.3 (frontend)
- **Ausentes** (confirmado, não instalados): `react-leaflet`, `leaflet.markercluster`, `supercluster`, `@turf/turf`/`turf`, `mapbox-gl`, `maplibre-gl`, `cesium`, `deck.gl`.

## 11. Convenção de feature flag já usada no projeto

Padrão real já em uso: `<NOME>_ENABLED="false"` em `.env`/`.env.example`, lido só no lado servidor (ex.: `BRGPS_ENABLED`/`BRGPS2_ENABLED`, `.env.example:68-83`, checado em `server/brgps-sync/index.ts` e `server/api/index.ts`). Para uma flag **client-side** (Vite só expõe `import.meta.env.VITE_*` no bundle), o precedente real é `VITE_DEMO_MODE` (`src/components/homologation/EndpointCard.tsx:3`: `(import.meta.env.VITE_DEMO_MODE ?? 'true') !== 'false'`) — **esse é o padrão a seguir para `VITE_MAP_V2_ENABLED`**, não o padrão server-side `_ENABLED` puro, se a intenção for alternar entre V1/V2 no frontend.

## 12. Cobertura de testes existente

**NOT FOUND** — nenhum arquivo de teste dedicado a `AssetMap.tsx` ou ao mapa em geral (`find`/`Glob` por `*assetmap*`/`*map*.test.*` só retornou o próprio `AssetMap.tsx` e um teste não relacionado, `BrGpsMapper.test.ts`, que testa o mapeamento de payload do fornecedor BRGPS, não o componente de mapa). Baseline de testes automatizados do mapa hoje: **zero**.

## Achados que exigem atenção antes de prosseguir

1. **Risco de basemap já ativo, não hipotético**: `VITE_STADIA_API_KEY` não existe implementado — em produção, os modos 2D-escuro e NIGHT (ambos Stadia Maps) provavelmente já falham fora de localhost. Isso é anterior ao MAP V2 e deveria ser corrigido independentemente (ou a POC V2 herdaria o mesmo problema se reusar os mesmos tiles).
2. **Muito do escopo do novo brief já existe em V1**: abstração por `asset_type`, `fitToVisibleAssets()` genérico, clique-para-focar, modo seguir, clustering flood-fill com spiderfy funcional, atualização incremental de marcador (sem F5, sem recriar mapa), isolamento de tenant real via Socket.IO rooms + JWT, GPS accuracy circle. Recomendo que o MAP V2 POC foque no que realmente falta (engine 2D/satélite/híbrido/3D vetorial, licenciamento formal, camadas futuras tipo tráfego real/aeronaves, hardening de performance para milhares de ativos) em vez de reconstruir o que já funciona.
3. **Gap real de geofence**: falta o estado `NEAR_BOUNDARY`/`UNKNOWN` considerando accuracy (hoje é só booleano dentro/fora).
4. **Zero teste automatizado do mapa hoje** — qualquer POC V2 parte de uma baseline de cobertura zero, não de uma regressão.
