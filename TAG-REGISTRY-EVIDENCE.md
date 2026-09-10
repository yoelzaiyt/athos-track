# TAG-REGISTRY-EVIDENCE.md

Sessão: 2026-09-10. Evidência coletada por consulta real ao Postgres do Supabase (`DIRECT_URL`), após aplicar as 6 migrations pendentes via `scripts/supabase-apply-migration.ts`.

## ZAFFARI — 10/10 cadastradas

| TAG ID | TENANT | TIPO | AUTH | ENABLED | CONEXÃO | LAST SEEN | LOCALIZAÇÃO | RESULTADO |
|---|---|---|---|---|---|---|---|---|
| 3092524960 | ZAFFARI | CARRINHO | AUTHORIZED | true | OFFLINE | — | Aguardando primeiro sinal | cadastrada |
| 3092524712 | ZAFFARI | CARRINHO | AUTHORIZED | true | OFFLINE | — | Aguardando primeiro sinal | cadastrada |
| 3092533124 | ZAFFARI | CARRINHO | AUTHORIZED | true | OFFLINE | — | Aguardando primeiro sinal | cadastrada |
| 3092524666 | ZAFFARI | CARRINHO | AUTHORIZED | true | OFFLINE | — | Aguardando primeiro sinal | cadastrada |
| 3092533106 | ZAFFARI | CARRINHO | AUTHORIZED | true | OFFLINE | — | Aguardando primeiro sinal | cadastrada |
| 3092524840 | ZAFFARI | CARRINHO | AUTHORIZED | true | OFFLINE | — | Aguardando primeiro sinal | cadastrada |
| 3092524939 | ZAFFARI | CARRINHO | AUTHORIZED | true | OFFLINE | — | Aguardando primeiro sinal | cadastrada |
| 3092533107 | ZAFFARI | CARRINHO | AUTHORIZED | true | OFFLINE | — | Aguardando primeiro sinal | cadastrada |
| 3092524906 | ZAFFARI | CARRINHO | AUTHORIZED | true | OFFLINE | — | Aguardando primeiro sinal | cadastrada |
| 3092533120 | ZAFFARI | CARRINHO | AUTHORIZED | true | OFFLINE | — | Aguardando primeiro sinal | cadastrada |

Todas: `category='cart'`, `status='awaiting_first_signal'` (valor novo, adicionado ao `assets_status_check` nesta sessão), `provider=null` (ainda não vinculadas — nenhuma apareceu no catálogo do fornecedor BRGPS na consulta real feita nesta sessão), `telemetry_latitude`/`telemetry_longitude`=null (nenhuma coordenada fabricada), tenant ZAFFARI (`2c267371-3bf7-4477-a0a2-99f4d53b6800`), unidade Matriz.

Códigos internos: `ZAF-CART-01` a `ZAF-CART-10`, na mesma ordem da lista acima.

"AUTH"/"ENABLED" não são colunas dedicadas no schema hoje (o schema usa `status` + a própria existência da linha como sinal de autorização — nunca há asset para dispositivo não autorizado, seção 12 do brief, código pré-existente). Marcadas AUTHORIZED/true aqui porque a linha foi criada deliberadamente por um admin (esta migration), o que é a definição operacional de "autorizado" já em uso no resto do sistema.

## SÃO JOÃO — 2/2 preservadas (transferidas, não recriadas)

| TAG ID | TENANT | TIPO | AUTH | ENABLED | CONEXÃO | LAST SEEN | LOCALIZAÇÃO | RESULTADO |
|---|---|---|---|---|---|---|---|---|
| 1603000067 (CAR-01) | SAO-JOAO | CARRINHO | AUTHORIZED | true | ONLINE | 2026-09-02T21:22:59Z | 29.2025637, 119.8347123 | preservada (transferida de DEMO-01) |
| 3092524777 (CAR-03) | SAO-JOAO | CARRINHO | AUTHORIZED | true | ONLINE | 2026-09-09T16:47:01Z | 13.8445642, 100.5077592 | preservada (transferida de DEMO-01) |

**Ressalva importante, herdada de `docs/HARDWARE-CATALOG.md` e não resolvida nesta sessão**: a posição retornada por essas 2 tags é consistente com dado de demonstração do fornecedor (coordenadas em Bangkok/Tailândia e região da China, não Brasil) — não confirmado com o fornecedor que essas IDs correspondem às unidades físicas reais em mãos do São João. Essa pendência é anterior a esta sessão; aqui só corrigimos o TENANT (estavam em DEMO-01), não a origem do dado de posição em si.

**TOTAL: 12 tags (10 Zaffari + 2 São João).**

Query de verificação usada (leitura, sem escrita):
```sql
select a.code, a.imei, a.category, a.status, a.provider, c.code as tenant
from assets a join company_clients c on c.id = a.client_id
where c.code in ('ZAFFARI','SAO-JOAO') order by tenant, a.code;
```
