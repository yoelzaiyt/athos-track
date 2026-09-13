# MAP-OPEN-SOURCE-LICENSES.md

Verificado ao vivo via `npm view <pacote> version license deprecated` (registro npm real, nesta sessão) — não fabricado a partir de memória.

| Biblioteca | Versão atual (npm) | Licença | URL oficial | Uso pretendido | Atribuição necessária | Risco | Aprovação |
|---|---|---|---|---|---|---|---|
| `leaflet` | 1.9.4 (já instalada) | BSD-2-Clause | https://leafletjs.com | Engine atual do MAP V1 (mantido, não removido) | Não obrigatória, mas mantida por convenção (`&copy; Leaflet` em créditos de UI, se aplicável) | Baixo — já em produção | **APROVADO** (já em uso) |
| `maplibre-gl` | 6.9.0 | BSD-3-Clause | https://maplibre.org | Engine candidata do MAP V2 (2D vetorial/raster, satélite, híbrido, 3D opcional, clustering nativo) | Não obrigatória (BSD-3 exige preservar aviso de copyright na distribuição, não atribuição visível na UI) | Baixo — projeto ativo, grande base de adotantes corporativos | **PENDENTE** (aguardando autorização para instalar) |
| `ol` (OpenLayers) | 10.10.0 | BSD-2-Clause | https://openlayers.org | Avaliado, **não selecionado** (ver `MAP-ENGINE-EVALUATION.md`) | N/A | N/A | **NÃO ADOTAR** nesta fase |
| `cesium` | 1.145.0 | Apache-2.0 | https://cesium.com/platform/cesiumjs | Avaliado, **DEFERRED** — só se surgir requisito real de globo 3D/terreno em larga escala | Apache-2.0 exige preservar `NOTICE` file se distribuído | Médio — bundle pesado, overkill pro caso de uso atual | **DEFERRED**, não instalar agora |
| `socket.io-client` | 4.8.3 (já instalada) | MIT | https://socket.io | Realtime já em uso (mantido) | Não obrigatória | Baixo — já em produção | **APROVADO** (já em uso) |

## Compatibilidade com produto comercial proprietário

Todas as licenças acima (MIT, BSD-2-Clause, BSD-3-Clause, Apache-2.0) são **permissivas** — nenhuma exige que o código do ATHOS Track seja aberto (nenhuma é copyleft tipo GPL/AGPL). Compatíveis com uso comercial fechado.

## Nenhuma dependência nova foi instalada nesta etapa

Este documento serve para aprovação **antes** de rodar `npm install maplibre-gl` — nenhum `package.json`/`package-lock.json` foi alterado até aqui.
