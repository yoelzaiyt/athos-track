# OPERATIONAL-MAP-ARCHITECTURE.md

Arquitetura do MAP V2 (POC), como construído nesta sessão. Complementa `MAP-V1-AUDIT-BASELINE.md` (arquitetura atual/V1) — não repete o que já está lá.

## Visão geral

```
useAssets() (AssetContext — mesma fonte do V1, Socket.IO + LISTEN/NOTIFY já existentes)
        │
        ▼
AssetMapV2.tsx (componente React, MapLibre GL JS)
        │
        ├── mapV2GeoJson.ts  → funções puras: assetsToGeoJson(), geofenceToGeoJsonFeature(), circlePolygon()
        ├── MapProvider.ts   → reutilizado (mesmas URLs de tile raster do V1, sem duplicar provider)
        └── AssetIconRegistry.tsx → reutilizado (cor por categoria, sem duplicar taxonomia visual)
```

## Isolamento V1/V2

- `LiveMap.tsx` decide V1 vs V2 via `VITE_MAP_V2_ENABLED` (opt-in explícito, default `false`).
- `AssetMapV2` é carregado via `React.lazy()` — o bundle do MapLibre só é baixado quando a flag está ativa (medido: chunk separado de 1.033 kB / 281,94 kB gzip, ver `MAP-ENGINE-EVALUATION.md`).
- `AssetMap.tsx` (V1) **não foi alterado**. `HistoryPage.tsx` continua importando `AssetMap` diretamente, fora do alcance da flag (decisão consciente — histórico/replay não faz parte do escopo desta POC).

## Fluxo de dados (idêntico ao V1, engine diferente)

```
PROVIDER → ATHOS BACKEND → POSTGRES → LISTEN/NOTIFY → SOCKET.IO → AssetContext (useAssets)
    → AssetMapV2 (assetsToGeoJson) → GeoJSONSource.setData() → MapLibre re-renderiza só os pontos alterados
```

Nenhuma parte do pipeline de dados foi duplicada ou reimplementada — o V2 é só uma nova camada de apresentação sobre o mesmo `useAssets()`/`AssetContext` que o V1 usa, herdando automaticamente:
- Isolamento de tenant (rooms Socket.IO `client:<id>`, já coberto por `server/api/realtime.test.ts`, 3 testes reais passando).
- Atualização incremental sem F5 (troca de fonte de dados via `setData()`, nunca recria mapa/estilo).

## O que é MapLibre-nativo (não existia no V1)

- **Clustering**: `GeoJSONSource` com `cluster: true`/`clusterRadius: 48` (usa `supercluster` internamente) — substitui o flood-fill manual em pixel de tela do V1. Decisão consciente, documentada em `MAP-V2-POC-REPORT.md` (não é um bug, é escolha de engine).
- **Troca de modo sem recriar mapa**: `map.setStyle()` + `jumpTo()` pra preservar câmera, depois `wireSourcesAndLayers()` re-registra fontes/camadas (MapLibre remove sources/layers customizadas ao trocar de style).

## Escopo desta POC — dentro e fora

**Dentro** (implementado e verificado por type-check/build/testes unitários):
2D, Satélite, Híbrido; realtime incremental; clustering nativo; geofence (círculo aproximado + polígono, somente leitura); `fitToVisibleAssets()` genérico por `asset_type`; clique-para-focar; modo "seguir ativo"; tela cheia.

**Fora** (permanece só no V1, não removido nem quebrado):
edição de geofence, floor plan overlay, modo de desenho de polígono/ponto, replay/histórico de trilha, painel de navegação/rotas (Waze/Google Maps), 3D real.

## 3D — DEFERRED, não fabricado como implementado

MapLibre suporta pitch/extrusão de prédios e (v4+) projeção de globo, mas **nenhuma fonte de dados de elevação/edifícios está disponível hoje neste projeto** (não fabricado: nenhuma pesquisa de provedor de terreno/3D Tiles foi feita nesta sessão). Marcado `DEFERRED` no critério de aceite — não `PASS`, não `FAIL`.
