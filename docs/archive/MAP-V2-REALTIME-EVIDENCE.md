# MAP-V2-REALTIME-EVIDENCE.md

Evidência de realtime específica do **MAP V2 (MapLibre, POC)**. Não confundir com `REALTIME-MAP-EVIDENCE.md` (evidência já existente, de sessão anterior, validada ao vivo em navegador contra o **V1**/Leaflet — documento preservado sem alteração).

## O que foi verificado nesta sessão (real, não fabricado)

1. **Testes automatizados existentes, rodados de novo, passando (71/71, 9 arquivos)** — incluindo os 3 testes de `server/api/realtime.test.ts` que provam, contra o pipeline real (LISTEN/NOTIFY via `DIRECT_URL` → Socket.IO), que:
   - um `UPDATE` real em `assets` chega no cliente Socket.IO conectado sem F5;
   - um usuário SÃO JOÃO nunca recebe evento de asset ZAFFARI, e vice-versa.
   Esses testes cobrem o **pipeline de dados**, que o V2 reutiliza sem alteração — não foram reescritos para o V2 porque não há nada de V2 nessa camada (`AssetContext`/`realtime.ts` não foram tocados).
2. **Código do `AssetMapV2.tsx` revisado nesta sessão**: a atualização de posição usa `GeoJSONSource.setData()` (efeito que depende de `assetsWithValidPosition`) — nunca `map.remove()`/recriação de layer. Equivalente funcional ao `marker.setLatLng()` do V1.
3. **Type-check (`tsc --noEmit`) e build de produção (`npm run build`) reais, sem erros.**
4. **8 testes unitários novos** (`mapV2GeoJson.test.ts`) cobrindo a conversão de dados que alimenta o `setData()`, incluindo o caso "sem coordenada default".

## O que NÃO foi verificado nesta sessão — não fabricado

- **Nenhum teste visual/E2E real no navegador** foi executado contra o MAP V2 com as 10 tags físicas Zaffari ou as 2 tags São João. Diferente de `REALTIME-MAP-EVIDENCE.md` (V1), que tem prova visual real de sessão anterior, o V2 só tem prova por revisão de código + testes unitários + testes automatizados do pipeline compartilhado — **não uma observação visual ao vivo do marcador se movendo no MAP V2 especificamente**.
- Latência do MAP V2 (vs. os números já medidos do V1 em `END-TO-END-LATENCY.md`) não foi cronometrada.

## Conclusão

**REALTIME (pipeline de dados, compartilhado com V1): PASS** — evidenciado por testes automatizados reais.
**REALTIME (renderização visual no MAP V2 especificamente): NÃO VALIDADO** — requer sessão de teste visual ao vivo com `VITE_MAP_V2_ENABLED=true`, não incluída nesta rodada.
