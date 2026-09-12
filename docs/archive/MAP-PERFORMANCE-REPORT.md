# MAP-PERFORMANCE-REPORT.md

## Medido nesta sessão

- **Bundle**: chunk do MAP V2 isolado via lazy-load, 1.033,46 kB / 281,94 kB gzip — não carregado por usuários em V1 (medido no build real, ver `MAP-ENGINE-EVALUATION.md`).
- **Build/type-check**: sem erros, tempo de build ~9-11s (inalterado de forma relevante pelo V2).
- **Volume de dados testado**: apenas o volume real do baseline hoje (10 tags Zaffari + 2 São João = 12 ativos) — via os testes unitários e a arquitetura (clustering nativo `supercluster`, usado pelo MapLibre, é a mesma lib usada por aplicações de mapas com dezenas de milhares de pontos em produção — fato de terceiros, não medição própria).

## NÃO medido nesta sessão — não fabricado

- **Nenhum teste de carga foi executado** com centenas/milhares de ativos simulados. O brief pede avaliação de escala (seção 30/31: centenas → milhares → dezenas de milhares), e isso exigiria gerar um dataset sintético e medir FPS/tempo de `setData()`/uso de memória — não feito nesta rodada.
- **PostGIS**: não avaliado nesta sessão (seção 32 do brief). Seria relevante só se/quando o volume de geofences/queries espaciais justificar — hoje o motor de geofence do servidor já é performático o suficiente pro volume atual (12 ativos, poucas geofences), então **não instalar sem necessidade real medida**, conforme a própria regra do brief.

## Conclusão

**PERFORMANCE: NÃO MEDIDO EM ESCALA.** A arquitetura escolhida (GeoJSON source + clustering nativo do MapLibre) é reconhecidamente adequada para milhares de pontos (fato de biblioteca, não medição própria deste projeto), mas nenhum teste de carga real foi rodado aqui. Recomendo tratar isso como item pendente antes de qualquer promoção do V2 a default, não assumir PASS por analogia.
