# MAP-ENGINE-EVALUATION.md

Avaliação técnica dos 3 candidatos citados no prompt, antes de instalar qualquer um. Nenhuma dependência nova foi instalada nesta etapa. Critérios: licença, manutenção, uso comercial, impacto no bundle, adequação ao caso de uso real (ativos indoor/pequena área — carrinhos numa loja, caixas em depósito — não terreno 3D em larga escala).

## 1. MapLibre GL JS

| Critério | Avaliação |
|---|---|
| Licença | **BSD-3-Clause** (permissiva, uso comercial livre, sem copyleft) |
| Origem | Fork comunitário do Mapbox GL JS v1, criado quando a Mapbox fechou a licença (dez/2020) |
| Manutenção | Ativa, releases frequentes, mantida pela MapLibre Organization com apoio de AWS, Meta, Stadia Maps, Microsoft entre outros |
| Uso comercial | Permitido sem restrição pela licença |
| Vetorial/raster | Suporta ambos (tiles raster XYZ como os já usados hoje E vector tiles via WebGL) |
| Clustering nativo | Sim — `GeoJSONSource` com `cluster: true` (usa supercluster internamente), elimina a necessidade de reimplementar clustering manual |
| 3D | Suporta pitch/bearing, extrusão de prédios (`fill-extrusion`), terreno via raster-dem, e (a partir da v4, 2024) projeção de globo 3D real — cobre "3D opcional" sem exigir engine separada |
| Atualização incremental | Fontes `GeoJSONSource.setData()` atualizam dados sem recriar o mapa/estilo — adequado ao requisito de mover marcador sem re-render completo |
| Bundle | ~800KB–1MB gzip (núcleo) — impacto moderado, maior que Leaflet puro |
| Risco/manutenção de terceiros | Baixo — projeto grande, muitos consumidores corporativos, vulnerabilidades históricas foram corrigidas rapidamente |

## 2. OpenLayers

| Critério | Avaliação |
|---|---|
| Licença | **BSD-2-Clause** (permissiva) |
| Origem | Projeto GIS open source maduro (~15+ anos) |
| Manutenção | Ativa, mas cadência mais "enterprise GIS" que "mapa operacional web" |
| Vetorial/raster | Ambos, incluindo camadas WebGL mais recentes |
| Clustering nativo | Sim (`ol/source/Cluster`) |
| 3D | **Não tem** suporte nativo a 3D/globo — só 2D/2.5D limitado |
| Projeções/CRS | Suporte superior a qualquer CRS via proj4 — útil se precisarmos de sistemas de coordenadas não-WGS84 no futuro, o que não é o caso hoje |
| Bundle | Comparável ou maior que MapLibre, API mais extensa e verbosa |
| Adequação ao caso de uso | Redundante com MapLibre para o problema atual (ativos indoor, WGS84 padrão); sua vantagem (CRS arbitrário, GIS avançado) não é uma necessidade hoje |

## 3. CesiumJS

| Critério | Avaliação |
|---|---|
| Licença | **Apache License 2.0** (permissiva) |
| Origem | Cesium GS Inc. (parte da Bentley Systems) |
| Manutenção | Ativa, forte foco em terreno/globo 3D fotorealista, 3D Tiles |
| 3D | Engine de globo 3D verdadeiro — muito superior a MapLibre para terreno em larga escala, aviação, defesa, cidades inteiras em 3D |
| Bundle | Pesado (~2–3MB+ gzip), API voltada a cenas 3D completas |
| Adequação ao caso de uso | **Overkill** para carrinhos dentro de uma loja Zaffari ou caixas em depósito — não há requisito de terreno/globo/elevação real hoje |

## Recomendação

**MapLibre GL JS** como engine do MAP V2.

Motivo: é a única opção que cobre 2D + satélite + híbrido + 3D opcional (via extrusão/terreno/globo) **sem** trocar de paradigma para um motor de globo 3D pesado (Cesium) nem adotar a superfície de API mais ampla do OpenLayers para capacidades de GIS (CRS arbitrário, projeções) que este projeto não precisa. Clustering nativo via `supercluster` também elimina reimplementar o algoritmo de flood-fill em pixels da tela hoje usado no V1 (a auditoria de arquitetura atual, em andamento, vai confirmar as características exatas dessa implementação atual antes de decidirmos se ela é substituída ou mantida como fallback).

**OpenLayers**: não selecionado — redundante pra este caso de uso.
**CesiumJS**: **DEFERRED** — só reconsiderar se/quando surgir um requisito real de rastreamento em larga escala outdoor (frotas cobrindo cidades inteiras, terreno) que justifique o custo de bundle e complexidade.

## Impacto no bundle — medido, não fabricado

`maplibre-gl@6.9.0` instalado (`npm view maplibre-gl version license` confirmou versão/licença ao vivo do registro npm antes da instalação). Build real (`npm run build`) com `AssetMapV2.tsx` carregado via `React.lazy()`/import dinâmico (não estático):

| Chunk | Tamanho | Gzip |
|---|---|---|
| `AssetMapV2-*.js` (MapLibre + código V2, só carregado se `VITE_MAP_V2_ENABLED=true`) | 1.033,46 kB | 281,94 kB |
| `AssetMapV2-*.css` | 83,04 kB | 10,52 kB |
| `index-*.js` (bundle principal, V1 permanece aqui) | 1.564,65 kB | 417,97 kB |

**Usuários em V1 (flag off, produção) não baixam o chunk do MapLibre** — confirmado pela separação de chunk no output real do build, não uma suposição.

## Segurança / supply chain — checado, não fabricado

- `npm view maplibre-gl version license deprecated` → `6.9.0`, `BSD-3-Clause`, sem flag de deprecated.
- `npm audit` após a instalação: **5 vulnerabilidades moderadas**, todas em `vitest`/`express`/`body-parser`/`qs` — **nenhuma nova vulnerabilidade introduzida por `maplibre-gl`** (confirmado via `npm audit --json`, nenhum pacote da árvore do maplibre-gl aparece na lista).
