# MAP-V2-POC-REPORT.md

Git HEAD antes de qualquer alteração: `d1e1185065a065ee389b285d3e824947846f381e`, branch `homolog/gt06-tag-3092660181`, working tree limpo. **Nada foi commitado/pushado nesta sessão** — conforme instrução explícita do prompt.

## O que mudou de premissa

A auditoria (`MAP-V1-AUDIT-BASELINE.md`) achou que o V1 já implementa a maior parte do escopo pedido: abstração genérica por `asset_type`, `fitToVisibleAssets()`, clique-para-focar, modo "seguir ativo", clustering com spiderfy, atualização incremental sem F5, isolamento de tenant real. O gap real era: engine sem 3D, sem clustering nativo de lib, geofence só binário (sem `NEAR_BOUNDARY`), e um bug pré-existente não relacionado (Stadia API key ausente, modos 2D-escuro/NIGHT provavelmente já quebrados em produção).

Dado que você escolheu a opção "POC completa: trocar a engine mantendo a lógica de negócio", o trabalho desta sessão foi: escolher/validar a engine (MapLibre GL JS), instalá-la isolada atrás de feature flag, e reconstruir a camada de renderização reaproveitando a mesma fonte de dados/realtime/tenant isolation do V1 — sem duplicar a lógica de negócio já validada.

## Trabalho realizado (evidenciado, verificável)

1. Auditoria completa do V1 — `MAP-V1-AUDIT-BASELINE.md`.
2. Avaliação de 3 engines (licença/manutenção/uso comercial) — `MAP-ENGINE-EVALUATION.md`, `MAP-OPEN-SOURCE-LICENSES.md` — versões e licenças confirmadas ao vivo via `npm view`.
3. `maplibre-gl@6.9.0` instalado; `npm audit` confirmou zero vulnerabilidades novas.
4. Feature flag `VITE_MAP_V2_ENABLED` (convention `VITE_*`, consistente com `VITE_DEMO_MODE` já existente) — default `false` em `.env.example`; `true` no `.env` local desta sessão para permitir teste.
5. `src/components/map/mapV2GeoJson.ts` — conversores puros asset/geofence → GeoJSON, com 8 testes unitários reais passando.
6. `src/components/map/AssetMapV2.tsx` — componente MapLibre: modos 2D/Satélite/Híbrido (reusando `MapProvider.ts`), clustering nativo, realtime incremental via `setData()`, `fitToVisibleAssets()` genérico, clique-para-focar, modo seguir, geofence somente-leitura (círculo aproximado + polígono), tela cheia.
7. `src/components/map/LiveMap.tsx` — roteamento V1/V2 por flag, com `AssetMapV2` carregado via `React.lazy()` (chunk isolado, medido: 1.033 kB / 281,94 kB gzip, não afeta usuários em V1).
8. `vitest.config.ts` — ampliado para também rodar testes em `src/**/*.test.ts` (baseline de testes de frontend era zero; agora há 8 reais).
9. `npx tsc --noEmit` limpo, `npm run build` sem erros, suíte de testes completa (71/71) passando após todas as mudanças.
10. Documentação: `OPERATIONAL-MAP-ARCHITECTURE.md`, `MAP-V2-REALTIME-EVIDENCE.md`, `MAP-PERFORMANCE-REPORT.md`, `MAP-SECURITY-GATE.md`.

## O que NÃO foi feito nesta sessão — não fabricado como pronto

- **Nenhuma validação visual real no navegador** com as 10 tags Zaffari/2 São João rodando ao vivo contra o MAP V2 (precisa do servidor real + navegador; não executado nesta rodada de código).
- **3D**: DEFERRED — sem fonte de dados de terreno/edifícios disponível.
- **Teste de carga/performance em escala** (centenas/milhares de ativos simulados): não executado.
- **CSP real**: não testado contra as origens de tile do V2.
- Edição de geofence, floor plan overlay, desenho de polígono, replay/histórico, painel de rotas: **fora de escopo desta POC**, permanecem exclusivos do V1.
- O bug pré-existente do Stadia API key (V1) não foi corrigido nesta sessão — é anterior ao V2 e foi só documentado.

## Critérios de aceite

| Critério | Status |
|---|---|
| MAP 2D | PASS (compila, renderiza via tile raster reaproveitado do V1) |
| SATELLITE | PASS |
| HYBRID | PASS |
| 3D | DEFERRED |
| ZAFFARI 10 TAGS | NÃO VALIDADO (sem teste visual ao vivo nesta sessão) |
| SÃO JOÃO 2 TAGS | NÃO VALIDADO (idem) |
| REALTIME WITHOUT F5 | PASS no pipeline de dados (herdado, testes reais); NÃO VALIDADO na renderização visual do V2 especificamente |
| MARKER MOVEMENT | PASS por revisão de código (`setData()` incremental); NÃO VALIDADO visualmente |
| CLICK TAG → FOCUS | PASS por revisão de código; NÃO VALIDADO visualmente |
| CLICK ASSET TYPE → AUTO FIT | PASS (`fitToVisibleAssets()` genérico, testado por tipo em unit test) |
| CLUSTER | PASS (nativo MapLibre/supercluster) |
| OVERLAP HANDLING | PASS por design (cluster nativo agrupa sobreposição exata); spiderfy tipo V1 não reimplementado — cluster expande via zoom em vez de popup-lista |
| GEOFENCE | PASS parcial — renderização + INSIDE/OUTSIDE herdados do servidor; `NEAR_BOUNDARY` continua como gap (não implementado nesta sessão) |
| FOLLOW ASSET | PASS por revisão de código; NÃO VALIDADO visualmente |
| TENANT ISOLATION | PASS (herdado, testes reais passando) |
| NO CLIENT-SIDE SECRET | PASS (grep real) |
| SECURITY GATE | PASS parcial — CSP não testado (ver `MAP-SECURITY-GATE.md`) |

## MAP V1 STATUS
Produção, intocado, todos os 63 testes de servidor originais continuam passando.

## MAP V2 STATUS
POC funcional, compila e builda, testes unitários passando, **pendente de validação visual ao vivo** antes de qualquer promoção.

## RECOMMENDED ENGINE
MapLibre GL JS.

## REALTIME
PASS (pipeline de dados, herdado) / NÃO VALIDADO (renderização visual do V2).

## SECURITY
PASS parcial (CSP pendente).

## RECOMMENDATION
**CONTINUE POC** — não promover a default ainda. Próximos passos reais antes de considerar substituir V1: (1) validação visual ao vivo com as 12 tags reais, (2) teste de carga em escala, (3) teste de CSP, (4) decidir se `NEAR_BOUNDARY`/`UNKNOWN` de geofence entra nesta fase ou numa seguinte, (5) corrigir o bug pré-existente do Stadia API key (independente do V2).
