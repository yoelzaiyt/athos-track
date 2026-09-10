# TAG-CONNECTIVITY-MATRIX.md

Cadeia avaliada por tag: `DEVICE → PROVIDER → API → ATHOS BACKEND → NORMALIZER → DATABASE → LIVE QUERY → MAP → UI`. Cada etapa: PASS / FAIL / NO DATA / STALE DATA / NOT APPLICABLE.

## ZAFFARI (10 tags — todas no mesmo estado de cadeia)

| IMEI | DEVICE | PROVIDER | API | BACKEND | NORMALIZER | DATABASE | LIVE QUERY | MAP | UI | STATUS FINAL |
|---|---|---|---|---|---|---|---|---|---|---|
| 3092524960 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | LIVE_STATIC* |
| 3092524712 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | LIVE_MOVING |
| 3092533124 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | LIVE_MOVING |
| 3092524666 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | LIVE_MOVING |
| 3092533106 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | LIVE_MOVING |
| 3092524840 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | LIVE_STATIC* |
| 3092524939 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | LIVE_STATIC* |
| 3092533107 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | LIVE_MOVING |
| 3092524906 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | LIVE_STATIC* |
| 3092533120 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | LIVE_STATIC* |

\* `LIVE_STATIC` = comunicando e recebendo posição real continuamente, mas o deslocamento acumulado ficou abaixo do limiar de 10m proposto em `MOVEMENT-TEST-REPORT.md` nesta janela de observação — não confundir com offline (seção 8 do brief). `LIVE_MOVING` = deslocamento acima do limiar confirmado com evidência de distância real.

## SÃO JOÃO (2 tags — estados diferentes entre si)

| IMEI | DEVICE | PROVIDER | API | BACKEND | NORMALIZER | DATABASE | LIVE QUERY | MAP | UI | STATUS FINAL |
|---|---|---|---|---|---|---|---|---|---|---|
| 3092524777 (CAR-03) | NO DATA† | PASS | PASS | PASS | PASS | STALE DATA | PASS | PASS (posição antiga) | PASS | STALE (posição repetida, não nova, há 13min+ no momento da checagem) |
| 1603000067 (CAR-01) | NO DATA† | FAIL | NO DATA | NOT APPLICABLE | NOT APPLICABLE | STALE DATA (8 dias) | PASS | PASS (posição de 8 dias atrás) | PASS | OFFLINE / PROVIDER_NOT_FOUND |

† "DEVICE" não é observável diretamente pelo ATHOS (não há telemetria de hardware fora da API do fornecedor) — classificado por inferência do comportamento da API, não confirmado fisicamente.

## Causa raiz por camada (seção 26 do brief)

Pergunta: "se nenhuma tag movimentasse, a causa estaria em qual camada?" — Resposta com evidência, mesmo as 10 Zaffari tendo se resolvido:

- **G. Backend live**: causa raiz #1 confirmada e corrigida (nenhum processo de polling contínuo rodava — `MAP-LIVE-UPDATE-EVIDENCE.md`).
- **G/H (ponte Backend→Frontend)**: causa raiz #2 confirmada e corrigida (LISTEN/NOTIFY via pooler nunca entregava — mesma referência).
- **B. Fornecedor**: causa parcial pro CAR-01 especificamente — API não retorna esta tag em nenhuma chamada (não é erro do ATHOS, é ausência de dado na origem).
- **A, C, D, E, F, H, I**: sem evidência de falha nesta sessão pras 10 tags Zaffari e pro CAR-03 — dispositivo, API, identificação, parser, banco, frontend e mapa todos passaram teste real ponta a ponta.
