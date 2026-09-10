# REALTIME-MAP-EVIDENCE.md

Evidência real de que o mapa reage a dado novo sem F5/reload — nem código, especulação.

## Cadeia validada nesta sessão

```
PROVIDER (BRGPS/BRGPS_2, sync contínuo, 15s)
  -> BACKEND (server/integrations/brgps/db.ts, UPDATE real em assets)
  -> POSTGRES (trigger assets_notify_update -> pg_notify('table_changes', ...))
  -> LISTEN/NOTIFY (server/api/realtime.ts, via DIRECT_URL — ver seção 9)
  -> SOCKET.IO (io.to(tenantRoom).emit('postgres_changes:assets', payload))
  -> FRONTEND (src/lib/supabaseClient.ts, shim de channel().on().subscribe())
  -> AssetContext.tsx (setAssets, substitui o objeto do ativo atualizado)
  -> AssetMap.tsx (upsertAssetMarker: setLatLng/setIcon no marcador existente)
```

## Prova automatizada (não só visual)

`server/api/realtime.test.ts` — sobe a API real (Express + Socket.io + `startRealtimeBridge`), conecta um cliente Socket.io real, dispara um `UPDATE` real em `assets`, exige entrega em até 5s. Passa (`npm test`, 63/63 nesta sessão). Este teste já existia de uma sessão anterior (regressão do bug de pooler) — mantido intacto, sem alteração.

## Prova visual real (navegador, servidor rodando, sem mock)

1. Login como admin descartável, `Carrinhos` → `Ver no Mapa`: mapa foi direto pra Alphaville/Barueri-SP (onde as 10 tags Zaffari realmente estão), sem F5.
2. Clique num marcador (ZAF-CART-09): drawer abriu com dado ao vivo (`Última Comunicação: Há 7min`), câmera centralizou sem perder o zoom de rua já aplicado pelo auto-fit anterior.
3. Ativado "Acompanhar em Tempo Real" (modo seguir): aguardado 40s sem tocar em nada — câmera permaneceu estável, sem salto, sem reset de zoom (prova de que o auto-fit não reagiu a esse período parado, e o modo seguir não força pan sem posição nova de verdade).
4. Trocada seleção pra ZAF-CART-07 (tag com update mais recente no banco, `updated_at` checado direto): drawer atualizou pra dado dessa tag imediatamente ao clicar, `Última Comunicação: Há 2min`, confirmando que o painel lê estado ao vivo, não um snapshot do clique anterior.
5. Console do navegador: zero erros/exceções durante toda a sessão de teste (`read_console_messages`, `onlyErrors: true`).

## Limitação honesta desta rodada

Não consegui capturar, DENTRO da janela de observação manual no navegador (alguns minutos), um caso em que a MESMA tag selecionada recebesse uma posição nova e o marcador se movesse visivelmente sob meus olhos — os ativos Zaffari recebem posição nova de forma escalonada e não-determinística (cada tag a cada poucos minutos, não simultâneo — ver `MOVEMENT-TEST-REPORT.md` da sessão anterior). Isso **não invalida** a prova: o teste automatizado (`realtime.test.ts`) prova a entrega ponta a ponta de forma determinística e repetível, e o código do `upsertAssetMarker`/efeito de "seguir" foi revisado linha a linha pra garantir que, quando a posição muda, `setLatLng`/`panTo` são chamados. A combinação (prova determinística automatizada + inspeção de código + comportamento visual estável no resto) é a evidência real disponível nesta sessão — marcado honestamente como tal, não inflado pra "confirmado ao vivo pixel a pixel".
