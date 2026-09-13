# MAP-401-ROOT-CAUSE.md

Diagnóstico Fase 1/2 do prompt "AUDITORIA E CORREÇÃO COMPLETA DOS MAPAS + TEMPO REAL", reproduzido ao vivo em produção (`https://athos-track-eight.vercel.app`, login `admin@athostrack.com.br`) nesta sessão.

## Diagnóstico (formato exigido)

```
MAP_LIBRARY = Leaflet 1.9.4 (puro, não react-leaflet) — src/components/map/AssetMap.tsx
TILE_PROVIDER_2D (claro) = OpenStreetMap padrão (tile.openstreetmap.org) — sem chave, OK
TILE_PROVIDER_2D (escuro) = Stadia Maps (tiles.stadiamaps.com/alidade_smooth_dark) — QUEBRADO
TILE_PROVIDER_SATELLITE = Esri World_Imagery (server.arcgisonline.com) — sem chave, OK
TILE_PROVIDER_HYBRID (overlay de labels) = CARTO (basemaps.cartocdn.com/voyager_only_labels) — sem chave, OK
REALTIME_METHOD = Socket.IO (socket.io-client 4.8.3) sobre um shim que imita supabase-js
  (.channel().on('postgres_changes').subscribe()), autenticado via JWT no handshake
401_SOURCE = tiles.stadiamaps.com — 100% dos tiles do modo "2D escuro" e "NIGHT" retornam
  HTTP 401 real "Invalid Authentication" em produção (confirmado ao vivo, ver evidência abaixo)
CURRENT_MAX_ZOOM = 19 (todos os modos exceto TERRAIN=17)
CURRENT_FAILURE_CAUSE = Stadia Maps exige API key paga/gratuita para domínios de produção;
  o projeto nunca implementou VITE_STADIA_API_KEY (só existia como comentário/instrução no
  código) — os tiles vinham sem chave, e a Stadia responde com uma IMAGEM de erro 401
  (não um erro silencioso), fazendo o mapa 2D escuro parecer "quebrado"/"em blocos"
```

## Evidência ao vivo (reproduzida, não fabricada)

1. Login em produção com as credenciais fornecidas pelo usuário.
2. Aba "Mapa ao Vivo", modo "2D" (tema escuro, automático por horário de Brasília — ver `getBrasiliaAutoMapTheme()`).
3. Screenshot capturado: a tela inteira preenchida por um grid de tiles idênticos, cada um mostrando literalmente **"401 Error / Invalid Authentication"** com um QR code apontando para `docs.stadiamaps.com/authentication`.
4. `read_network_requests` (filtro `stadiamaps`) confirmou **16 de 16 requisições** com `statusCode: 401`, todas para `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}@2x.png`.
5. Em paralelo, o overlay de labels do modo Híbrido (`basemaps.cartocdn.com/voyager_only_labels`) retornou **200 em 100%** das requisições testadas — não estava quebrado (isso resolve uma dúvida em aberto da auditoria anterior, `MAP-V1-AUDIT-BASELINE.md`, que não tinha testado isso ao vivo).
6. Satélite (Esri) testado em zoom máximo (19) sobre a região real das tags Zaffari (Alphaville/Barueri) — permaneceu nítido, sem blocos, sem erro, em todos os níveis de zoom testados.

## Correção aplicada

Não trocamos de provedor "no escuro" nem tentamos mascarar o erro. Como a Stadia exige conta/billing (ação que só o usuário pode fazer, fora do escopo desta sessão), a correção usa o **mesmo provedor que já funciona sem chave** (OpenStreetMap, já usado no modo 2D claro) e aplica um filtro CSS (`invert + hue-rotate`) só nos modos "2D escuro"/"NIGHT" pra simular um basemap escuro — sem depender de nenhum provedor pago/autenticado.

**Arquivos alterados:**
- `src/components/map/MapProvider.ts` — modos `2D` (tema escuro) e `NIGHT`: URL trocada de Stadia para OSM + novo campo `tileClassName: 'athos-dark-basemap-filter'`.
- `src/components/map/AssetMap.tsx` — `L.tileLayer(...)` agora repassa `className: tileConfig.tileClassName` pro container do tile layer.
- `src/index.css` — nova classe `.athos-dark-basemap-filter { filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%); }`.

**Verificação real, não assumida:**
- `npx tsc --noEmit` — sem erros.
- Testado ao vivo no dev server local (`localhost:3000`), 2D escuro, mesma área geográfica: **350 requisições a `tile.openstreetmap.org`, 100% status 200**, mapa renderizado corretamente (ruas, nomes, parques, prédios legíveis) em zoom baixo e em zoom bem alto (nível de lote/prédio individual) — sem blocos, sem tiles ausentes, sem erro 401.
- **Ainda não aplicado em produção** — a correção está no working tree local, não commitada nem deployada (nenhum push/deploy foi feito nesta sessão, conforme regra "não fazer push remoto automaticamente").

## O que isso NÃO explica

Este achado resolve o **erro 401 e a renderização quebrada do modo 2D escuro/NIGHT**. Não explica, por si só, a queixa de "preciso dar F5 pra ver posição nova" — essa é uma cadeia diferente (Postgres → Socket.IO → React), investigada separadamente em `MAP-REALTIME-LIVE-OBSERVATION.md`.
