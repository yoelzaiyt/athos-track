# MAP-MARKER-VISIBILITY.md

## A pergunta central: "por que vejo ~5 marcadores com 10 tags ligadas?"

**Resposta comprovada, não suposta**: as 10 tags têm coordenadas reais muito próximas umas das outras (algumas exatamente idênticas), e o mecanismo de clustering do mapa nunca ativava com apenas 10 ativos (o gate antigo só ligava acima de 25). Sem cluster, marcadores exatamente sobrepostos ficam um em cima do outro, indistinguíveis — dando a impressão de "faltam tags" quando na verdade as 10 estão lá, só empilhadas no mesmo pixel.

## Teste de sobreposição (seção 3) — snapshot real, 2026-09-10T21:13:08Z

| Par | Distância |
|---|---|
| CART-01 ↔ CART-03 | 0,0m (idêntica) |
| CART-01 ↔ CART-05 | 0,0m (idêntica) |
| CART-03 ↔ CART-05 | 0,0m (idêntica) |
| CART-02 ↔ CART-06 | 0,0m (idêntica) |
| CART-04 ↔ CART-08 | 0,0m (idêntica) |
| ... (35 pares no total) | 13,5m – 72,4m |
| CART-07 ↔ todas as outras 9 | **~21.000m** (outlier real) |

Resumo por limiar (todas as 45 combinações entre as 10):
- **Coordenada idêntica (0,0m)**: 5 pares
- **≤10m**: 5 pares
- **≤50m**: 30 pares
- **≤100m**: 34 pares
- **>20km**: 9 pares (todos envolvendo CART-07, ver observação abaixo)

**Achado adicional não esperado**: nesta sessão, `ZAF-CART-07` passou a reportar uma coordenada real ~21km distante das outras 9 (região próxima a Osasco/SP-015, vs. Alphaville/Barueri onde as outras 9 estão). O timestamp é recente (não é dado congelado) — é uma posição nova de verdade, não um erro de exibição. Não afirmamos se é deslocamento físico real do carrinho ou uma característica de precisão do fornecedor para aquele dispositivo especificamente — fica registrado como observação para confirmação com o fornecedor/Hugo, não escondido nem "corrigido" artificialmente.

## Correção aplicada

`AssetMap.tsx`: o agrupamento por proximidade em pixels (flood-fill já existente) agora roda **sempre** que há ≥2 ativos com posição válida — não mais só acima de 25 ativos. Resultado: o mapa agora mostra um badge com contagem real (`[9]`, `[6]`, `[2]`, etc.) em vez de esconder a sobreposição.

## Clique no cluster — zoom vs. lista (seção 3/28)

Implementado: calcula a maior distância real (Haversine) entre membros do grupo.
- Se ≤15m (zoom nunca vai separar coordenadas efetivamente idênticas): abre uma **lista** com os ativos daquele ponto, cada um clicável.
- Se >15m (zoom vai realmente separar): dá zoom (`flyTo`, +3 níveis).

Testado ao vivo: cluster de 6 tags idênticas → lista com 6 itens abre corretamente. Cluster de 9 tags espalhadas em até 72m → zoom progressivo (9 → 7+2 → ...) conforme esperado — como as distâncias reais formam uma cadeia contígua (A perto de B, B perto de C, mesmo que A e C estejam mais longe entre si), a separação completa em pixels só ocorre em zoom bem alto (~z18), o que é matematicamente correto, não um bug.

## Bug encontrado e corrigido durante o teste: popup fechava sozinho

Achado ao vivo: a lista abria e desaparecia sozinha em menos de 1 segundo. Causa: o efeito de renderização recria os marcadores de cluster a cada tick de realtime (que chega a cada poucos segundos com as 10 tags ativas) — remover o marcador antigo disparava `popupclose` nele, zerando a referência de controle **antes** do marcador novo poder checar se devia reabrir. Corrigido capturando a intenção (popup aberto, de qual grupo) **antes** do passo de limpeza, e só limpando essa referência por ação explícita do usuário (escolher um item da lista, ou clicar fora no mapa) — nunca por remoção/recriação automática do marcador.

## Prova das 10 tags (seção 4) — ver `10-TAGS-LIVE-AUDIT.md` pra tabela completa por tag.
