# CSV-EXPORT-REPORT.md

> Rodada: **exportação CSV do DataTable**. Princípio da casa continua valendo —
> **"SE APARECE NA TELA, TEM QUE SER REAL"**: o que o CSV entrega tem que ser o
> mesmo dado que o operador está vendo na tabela, não um arquivo vazio com
> cabeçalho bonito.

## 1. Causa raiz

`src/components/common/DataTable.tsx`, no corpo do `handleExportCSV`:

```ts
const val = typeof c.accessor === 'function' ? '' : row[c.accessor];
```

Toda coluna cujo `accessor` é função exportava **string vazia**. Medição no
código, antes da correção:

| Tipo de coluna | Quantidade |
|---|---|
| `accessor` em função (exportava vazio) | **103** |
| `accessor` por chave (exportava certo) | 6 |

Ou seja: **~94% das células saíam em branco**, em 15 páginas, sem erro nenhum
na tela. O usuário clicava em CSV, recebia o arquivo e só descobria o problema
ao abrir a planilha.

## 2. Achados adicionais no mesmo caminho (todos corrigidos)

| # | Problema | Efeito prático |
|---|---|---|
| 1 | `encodeURI()` **não escapa `#`** | Um único "#" em qualquer célula (nº de OS, observação) truncava o arquivo inteiro naquele ponto, em silêncio |
| 2 | `data:` URI | Limite de tamanho do navegador em listagens grandes |
| 3 | Sem BOM UTF-8 | Excel pt-BR abria como Latin-1: "Patrimônio" virava "PatrimÃ´nio" |
| 4 | Quebra de linha `\n` | RFC 4180 e Excel esperam `\r\n` |
| 5 | Sem proteção contra injeção de fórmula | Valor vindo do banco começando com `=`/`+`/`@`/`-` executa como fórmula no Excel/Sheets |
| 6 | Guard olhava `data.length`, mas exportava `filtered` | Filtrar até zerar e clicar em CSV gerava arquivo só com cabeçalho |
| 7 | Nome do arquivo cru (`${title}_athos_track.csv`) | Título com `/` ou `:` gera nome inválido no Windows |

## 3. Solução

**`src/lib/csvExport.ts`** (novo) — a regra de exportação saiu de dentro do JSX
e virou módulo testável:

- `resolveExportValue()` decide o valor da célula em 3 níveis de precedência:
  1. **`exportAccessor`** da coluna (explícito, sempre ganha);
  2. `accessor` por chave → valor cru da linha;
  3. `accessor` em função → **texto extraído do que seria renderizado**.
- `reactNodeToText()` percorre a árvore do elemento React (que é só objeto — não
  precisa de DOM nem de render) e junta o texto das folhas. Regra de junção:
  sem separador entre textos vizinhos (`{85}%` → `85%`), com espaço entre
  elementos irmãos (`<div>CAR-01</div><div>Carrinho</div>` → `CAR-01 Carrinho`).
  Ícone/componente sem texto contribui vazio.
- `escapeCsvField()` aspeia **todo** campo e duplica aspas internas.
- `neutralizeFormulaInjection()` prefixa `'` em `=`, `+`, `@`, TAB, CR — e em
  `-` **exceto** quando o valor inteiro é número ou lista de números, para não
  poluir coordenada (`-23.55052, -46.63331`), que é o dado mais comum aqui.
- `buildCsvContent()` emite **BOM UTF-8 + CRLF**; `exportable: false` tira
  coluna puramente visual do arquivo.
- `downloadCsv()` usa **Blob + objectURL** (mata os achados 1 e 2).
- `buildCsvFilename()` normaliza o título e carimba a data:
  `athos_track_usuarios_e_perfis_cadastrados_20260912.csv`.

**`Column<T>`** ganhou dois campos opcionais — `exportAccessor` e `exportable`.
Nenhuma coluna existente precisou mudar para voltar a funcionar (o fallback por
extração de texto cobre), mas as tabelas onde o valor bruto é melhor que o
visual passaram a declarar `exportAccessor`.

## 4. As 3 tabelas reais (critério de aceite)

As colunas das três saíram de dentro dos componentes para módulos próprios em
`src/pages/columns/` — assim o teste importa as **definições reais**, não
cópias, sem arrastar o mapa/Leaflet (que exige `window` e não roda em Node).

| Tabela | Módulo | `exportAccessor` declarados | Exemplo de ganho |
|---|---|---|---|
| Carrinhos | `src/pages/columns/cartColumns.tsx` | 7 de 8 | Bateria: faixa real do provider (`Baixa`) em vez de `%` inventado; `Origem` → `API BRGPS_2` |
| Ativos | `src/pages/columns/assetColumns.tsx` | 7 de 8 | Bateria como **número puro** (`87`), que soma/ordena na planilha; sem responsável → célula **vazia**, não `—` |
| Usuários | `src/pages/columns/userColumns.tsx` | 4 de 4 | Papel **cru** (`CLIENT_ADMIN`) para cruzar dados, em vez do rótulo visual |

Efeito colateral bom: rótulos que antes viviam duplicados dentro do JSX viraram
funções únicas (`cartPerimeterLabel`, `rolePermissionsLabel`, `userScopeLabel`),
usadas **pela tela e pelo CSV** — não tem como divergirem.

## 5. Testes

`src/lib/csvExport.test.ts` — **16 casos, todos PASS**.

- Escape: vírgula, aspas internas, quebra de linha, campo vazio.
- Formato: BOM `EF BB BF` verificado **em bytes**, CRLF sem LF solto.
- Acentuação: `Patrimônio`, `Manutenção corretiva — pátio São João (ação nº 3)`.
- Injeção de fórmula: `=1+1`, `+55...`, `@SUM(A1)`, `-2+3+cmd|'/C calc'!A0`
  neutralizados; `-23.55052, -46.63331` e `-15` preservados.
- Regressão original: accessor em função agora exporta texto; `exportAccessor`
  tem precedência; `null`/`undefined` viram célula vazia (não a string "null").
- As 3 tabelas reais, célula a célula, mais uma varredura garantindo que
  **nenhuma linha sai sem nenhuma célula preenchida**.

> **Um teste pegou uma falha real minha durante a rodada:** a primeira versão da
> regra de `-` liberava `-2+3+cmd|calc` (começa com `-` seguido de dígito). O
> critério foi trocado por "o valor inteiro precisa ser número ou lista de
> números" e o caso do payload DDE virou teste permanente.

```
npx vitest run src/lib/csvExport.test.ts  ->  16 passed (16)
npx tsc --noEmit                          ->  OK
npx vite build                            ->  OK (avisos de chunk pré-existentes)
npx vitest run (suíte completa)           ->  155 passed / 9 failed (ver §7)
```

## 6. Validação no navegador real

App rodando local, login real como `ATHOS_ADMIN`, tabela **Usuários** (a única
com dados reais no banco de dev — ver §7). O Blob gerado pelo botão CSV foi
interceptado **em memória**, sem gravar arquivo em disco:

| Verificação | Resultado |
|---|---|
| Nome do arquivo | `athos_track_usuarios_e_perfis_cadastrados_20260912.csv` |
| MIME / tamanho | `text/csv;charset=utf-8` / 867 bytes |
| BOM UTF-8 (`EF BB BF`) | **PASS** |
| CRLF, sem LF solto | **PASS** |
| Linhas de dados / colunas | 7 / 4 |
| Célula vazia por acidente | **nenhuma** (era o bug) |
| Acento no cabeçalho e no dado | **PASS** (`Usuário`, `Permissões do Papel`, `Ação Acentuação`) |
| Aspas escapadas (`""Teste""`) | **PASS** — usuário de teste criado com nome `Ação Acentuação "Teste"` |
| `exportAccessor` em ação | **PASS** (papel cru `ATHOS_ADMIN`, escopo `Todos os clientes`) |
| CSV respeita o filtro da tela | **PASS** — filtro "Homologa": 3 de 7 linhas, todas do filtro |

Usuário de teste removido ao final.

## 7. Achado pré-existente (não relacionado)

A suíte completa fecha em **155 pass / 9 fail**. As 9 falhas são as mesmas já
reportadas em `docs/PASSWORD-RECOVERY-REPORT.md` §5: o banco de dev está com a
tabela **`assets` vazia (0 linhas)** e os testes de `tag-classification` e
`realtime` dependem do fixture de 10 carrinhos ZAFFARI + 2 caixas SÃO JOÃO.
Nenhuma relação com esta rodada.

É também o motivo de a validação em navegador (§6) ter sido feita na tabela de
Usuários e não na de Carrinhos: sem ativo nenhum no banco, a tabela de
Carrinhos abre vazia. Repovoar seria inventar dado — as três tabelas estão
cobertas pelos testes com as definições de coluna reais.

## 8. FILES_CHANGED

| Arquivo | Mudança |
|---|---|
| `src/lib/csvExport.ts` | **novo** — toda a regra de exportação |
| `src/lib/csvExport.test.ts` | **novo** — 16 casos |
| `src/pages/columns/cartColumns.tsx` | **novo** — colunas de Carrinhos + `exportAccessor` |
| `src/pages/columns/assetColumns.tsx` | **novo** — colunas de Ativos + `exportAccessor` |
| `src/pages/columns/userColumns.tsx` | **novo** — colunas de Usuários + `exportAccessor` |
| `src/components/common/DataTable.tsx` | `Column` ganhou `exportAccessor`/`exportable`; export delegado ao módulo; botão desabilitado quando não há linha filtrada |
| `src/pages/CartsModule.tsx` | passa a importar as colunas |
| `src/pages/AssetsModule.tsx` | idem |
| `src/pages/admin/UsersPage.tsx` | idem |

As outras 12 páginas que usam `DataTable` **não precisaram de mudança** — o
fallback por extração de texto já as corrige. Declarar `exportAccessor` nelas
fica como melhoria incremental, tabela a tabela, quando o valor bruto for
melhor que o visual.

## 9. PENDING

| Item | Situação |
|---|---|
| `exportAccessor` nas outras 12 tabelas | Opcional — funcionam pelo fallback; declarar quando o CSV pedir formato diferente do visual |
| Validação em navegador das tabelas de Carrinhos/Ativos com dado real | Bloqueada pelo fixture vazio de `assets` no banco de dev (§7) |
| Commit/push/deploy | **Nada foi commitado** — conforme a convenção do projeto |

---

*Gerado: 2026-09-12 | Branch: `homolog/gt06-tag-3092660181` | Working tree com as mudanças desta rodada e da anterior (recuperação de senha), não commitadas.*
