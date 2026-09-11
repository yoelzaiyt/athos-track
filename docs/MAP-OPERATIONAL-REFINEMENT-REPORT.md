# MAP-OPERATIONAL-REFINEMENT-REPORT.md

## CURRENT_MAP_PROVIDER
OSM (OpenStreetMap) — 2D light + dark (CSS filter); Esri World_Imagery — SATELLITE; Esri imagery + CARTO `voyager_only_labels` — HYBRID; OpenTopoMap — TERRAIN (V1 only). No API keys. Configurado em `src/components/map/MapProvider.ts`.

## MAP_ENGINE
MapLibre GL JS 6.9.0 (V2 POC, behind feature flag `VITE_MAP_V2_ENABLED=true` local / default `false`). Routing: `LiveMap.tsx` → `React.lazy(AssetMapV2)` → `MapV2ErrorBoundary` → `AssetMap` (Leaflet V1 fallback).

## VECTOR_PROVIDER
MapLibre raster mode (raster sources reusing MapProvider TileProviderConfig URLs). No vector tiles in use today — all tile layers are raster XYZ (OSM, Esri, CARTO).

## SATELLITE_PROVIDER
Esri World_Imagery (`server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`). Keyless. maxZoom 19 (confirmed).

## HYBRID_PROVIDER
Esri World_Imagery (base) + CARTO `voyager_only_labels` (overlay, retina-aware `{r}`). Keyless. `basemaps.cartocdn.com` — free CDN.

## MAX_SAFE_ZOOM
19 — OSM/Esri/CARTO tile servers cap at z19. Beyond z19: blank/error tiles (no server-side content). `MAP_MAX_SAFE_ZOOM = 19` enforced in `AssetMapV2.tsx` (Map.maxZoom + source.maxzoom). TERRAIN (OpenTopoMap) maxZoom 17 (V1 only).

## ERRORS_FOUND

| Provider | Error | Status |
|---|---|---|
| Stadia Maps | HTTP 401 "Invalid Authentication" — API key ausente em produção (2D dark / NIGHT) | **FIXED** — OSM + CSS filter `.athos-dark-basemap-filter` (commit `7bc5701`) |
| OSM | No error in production | OK |
| Esri | No error in production; CN coverage unverified | MONITORING — error listener added in V2 (8 errors/30s → auto-fallback) |
| CARTO | No error in production | OK |
| MapLibre raster source (V2) | Tiles beyond z19 → blank (no tile server returns content) | **FIXED** — maxZoom 19 enforced |

## REGIONS_TESTED
BR (manual, dev environment): tiles OK, icons OK, realtime OK. CN (manual, dev environment): **PENDING** — OSM may be slow/blocked by GFW; Esri typically accessible. Satellite tiles from Esri generally reliable in CN.

## BRAZIL_LANGUAGE
`'pt'` — default for BR. Map labels: OSM renders PT place names by default in Brazil (inherent in tile language). CARTO overlay uses default English-ish labels. Application chrome (mode buttons, notices, outlier text, cluster label, V2 badge) — all translated to PT via `src/lib/mapLanguage.ts`.

## CHINA_LANGUAGE
`'en'` — default for CN. Map labels: OSM renders Chinese characters by default in CN (tile-inherent); CARTO overlay default labels (English-ish). Application chrome translated to EN via `src/lib/mapLanguage.ts`. **Recommendation:** for CN deployments requiring EN-only basemap labels, evaluate MapTiler vector tiles (see MAPTILER section below) or use satellite-only mode (no text labels to translate).

## MAPTILER_TESTED
PARCIAL — Evaluation of pricing, licensing, limits, and language capabilities completed. Live tile test PENDING (requires API key, not available in dev environment).

| Criterion | MapTiler (Flex $25/mo) | Current Stack (keyless) |
|---|---|---|
| License | Proprietary (paid) | OSM (ODbL), Esri (free tier), CARTO (free CDN) |
| Cost | $25/mo + overage ($0.15/1k requests) | $0 |
| Max zoom | ~22 (vector) | 19 (raster) |
| Language/locale | Full control (`name:xx` fields in OpenMapTiles, `setLanguage()`) | No control (tile-inherent) |
| CN reliability | WGS84, global CDN | OSM may be throttled in GFW; Esri/CARTO generally OK |
| Free tier | 100k req/mo (non-commercial only) | Unlimited (subject to provider TOS) |
| Integration | Requires API key (env `VITE_MAPTILER_API_KEY`) | Zero config |

## MAPTILER_SELECTED
NO — Mantido como opcional. Justificativa: (1) stack atual keyless satisfaz sem custo; (2) core use case é operational tracking indoors/small areas (Zaffari stores, warehouses) — satellite/OSM sufficient; (3) CN labels via satellite mode or CARTO overlay acceptable for operational use; (4) MapTiler Flex add operational overhead (key mgmt, billing). **Recomendação:** reavaliar se CN deployment exige labels EN em basemap raster ou se zoom >19 é necessário.

## FILES_CHANGED (this session)

| File | Change | Phase |
|---|---|---|
| `src/lib/mapLanguage.ts` | NEW — centralized language resolution (BR→pt, CN→en, default→en) + map UI string dictionaries (PT/EN) | FASE 3/15 |
| `src/lib/mapLanguage.test.ts` | NEW — 10 tests for language resolution and string dictionaries | FASE 3/15 |
| `src/lib/assetVisualResolver.ts` | `resolveStatusVisual` — added `opts.speed` param; speed>0 → MOVIMENTO green (#10b981) when status is online/stopped/in_use | FASE 13 |
| `src/components/map/mapV2GeoJson.ts` | Pass `telemetry.speed` to `resolveStatusVisual` | FASE 13 |
| `src/components/map/AssetMapV2.tsx` | FASE 4: `MAP_MAX_SAFE_ZOOM=19`, Map maxZoom/minZoom, source maxzoom. FASE 5: tile error monitoring (8 errors/30s → auto-fallback to 2D OSM + amber notice). FASE 6: dark circular chip behind rasterized icons (contrast on bright tiles). FASE 7: zoom-dependent `circle-radius` + `icon-size` expressions (grow at low zoom). FASE 15: all UI strings use i18n (`getMapUIStrings`). | FASE 4/5/6/7/15 |

## PENDING

| Item | Phase | Status | Notes |
|---|---|---|---|
| Visual test BR (live browser with real tags) | FASE 17 | PARTIAL (automated smoke OK) | Protocol: load with VITE_MAP_V2_ENABLED=true, 12+ tags, verify tiles load, icons visible, cluster expand, spiderfy, realtime no F5, zoom cap z19, follow asset. Automated checks passed (build with V2 chunk, dev transform sem erro, CSP allow-list completa). Falta a confirmação visual em browser real. |
| Visual test CN (live browser, CN network) | FASE 17 | PENDING | Protocol: verify OSM access (may be slow/blocked), satellite fallback, EN labels, zoom cap z19 |
| MapTiler live tile test with API key | FASE 2 | PENDING | Evaluate vector tile quality, locale switching, CN CDN reliability |
| `docs/OPERATIONAL-REFINEMENT-REPORT.md` (dashboard round FASE 17) | FASE 17 (dashboard) | PENDING | Separate report for dashboard operational refinement round |
| BRGPS interval 15→10s + live measurement | FASE 2 (operational round) | **DONE** | `BRGPS_SYNC_INTERVAL_SECONDS` mudado pra 10 em `.env`, `.env.example` e default do código (`server/brgps-sync/index.ts`). Medição viva 2026-09-11 (conta BRGPS_2): `GET /tag status=200 duration=1026ms`, posição aplicada. Efeito: imprecisão do T3 (polling) cai de ≤15s pra ≤10s. Medição de loop contínuo full pipeline segue pendente (catálogo provider_devices parcial). |
| CSP testing (tile origins whitelisted) | FASE 19 | **DONE** | CSP adicionado em `vercel.json` (SPA, header real testado via servidor estático) + headers de segurança na API (`server/api/index.ts`). Allow-list cobre `tile.openstreetmap.org`, `server.arcgisonline.com`, `basemaps.cartocdn.com`, `tile.opentopomap.org` (com e sem subdomínios `{s}`) em `img-src` e `connect-src`; `www.openstreetmap.org` é link de atribuição (navegação, não recurso). |
| MapTiler CSS for MapLibre (83kB, already in V2 chunk) | FASE 18 | OK | Already included; no change needed |

## SECURITY
All tile sources are HTTPS. No client-side secrets (grep verified). **CSP FASE 19 concluído**: `Content-Security-Policy` em `vercel.json` + security headers na API; allow-list de origens OSM/Esri/CARTO verificada (todas as origens de `MapProvider.ts` cobertas em `img-src`/`connect-src`). MapLibre worker excluded from Vite optimizeDeps (worker fix, already documented).

## PERFORMANCE
V2 raster mode: ~1042 kB / 284 kB gzip (MapLibre chunk, lazy-loaded only when flag=true). Realtime via incremental `setData()` (no map recreation). Icon pre-rasterization on mount (warmupCatalog). Clustering via supercluster (clusterRadius 48, clusterMaxZoom 16, spiderfy ≤12 members). Tile error monitoring with throttled fallback (no spam).

## RECOMMENDATION
**V2 POC continues** — zoom cap fixed, error fallback added, icons contrasted, language centralized. Next: visual validation BR/CN, then consider promoting to default. V1 (Leaflet) remains production fallback behind feature flag.

---

*Generated: 2026-09-11 | Git HEAD: session uncommitted | Engine: MapLibre GL JS 6.9.0*
