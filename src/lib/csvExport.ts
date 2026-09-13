// Geração de CSV do DataTable (src/components/common/DataTable.tsx).
//
// Motivo de existir separado do componente: o export estava quebrado de forma
// silenciosa — `typeof c.accessor === 'function' ? '' : row[c.accessor]`
// mandava string vazia pra TODA coluna cujo accessor é função, que é a
// esmagadora maioria (103 de 109 colunas do app). O usuário baixava um CSV
// com cabeçalho certo e corpo vazio, sem nenhum erro na tela.
//
// Aqui a regra de qual valor vai pro CSV fica isolada e testável (ver
// csvExport.test.ts), em vez de embutida no meio do JSX.

import React from 'react';

export interface CsvColumnLike<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  /** Valor bruto pro CSV, quando o que aparece na tela não serve (ícone,
   *  badge sem texto, componente próprio) ou quando se quer um formato
   *  diferente do visual (data ISO em vez de "há 5 min", por exemplo).
   *  Tem precedência sobre tudo. */
  exportAccessor?: (row: T) => string | number | boolean | null | undefined;
  /** `false` tira a coluna do CSV — pra coluna puramente visual (miniatura,
   *  semáforo, barra de progresso) que não tem valor textual nenhum. */
  exportable?: boolean;
}

/** Texto puro de um ReactNode — é o fallback quando a coluna não declara
 *  `exportAccessor`. Percorre a árvore do elemento (que em React é só um
 *  objeto, não precisa de DOM nem de render) e junta o texto das folhas.
 *
 *  O que NÃO dá pra extrair daqui: o texto que um COMPONENTE gera dentro do
 *  próprio render (`<StatusBadge status={x} />`), porque ele só existiria
 *  depois de renderizado. Para esses casos a coluna precisa declarar
 *  `exportAccessor` — é justamente o escape hatch. */
export function reactNodeToText(node: React.ReactNode): string {
  const raw = collectText(node);
  // Colapsa o espaço em branco do JSX (indentação, quebras de linha) num
  // espaço só, pra não vazar a formatação do código-fonte pro CSV.
  return raw.replace(/\s+/g, ' ').trim();
}

/** `true` quando o pedaço veio de um elemento (e não de um texto solto) —
 *  usado pra decidir se dois pedaços vizinhos precisam de espaço entre eles. */
interface TextPart {
  text: string;
  fromElement: boolean;
}

function collectParts(node: React.ReactNode): TextPart[] {
  if (node === null || node === undefined || typeof node === 'boolean') return [];
  if (typeof node === 'string') return [{ text: node, fromElement: false }];
  if (typeof node === 'number') return [{ text: String(node), fromElement: false }];

  if (Array.isArray(node)) {
    return node.flatMap((child) => collectParts(child));
  }

  if (React.isValidElement(node)) {
    const children = (node.props as { children?: React.ReactNode })?.children;
    const text = joinParts(collectParts(children));
    return text ? [{ text, fromElement: true }] : [];
  }

  return [];
}

/** Junta os pedaços SEM separador entre texto e texto (pra `{valor}%` sair
 *  "85%", não "85 %") mas COM espaço entre dois elementos vizinhos (pra
 *  `<div>{code}</div><div>{name}</div>` sair "CAR-01 Carrinho 1", não
 *  "CAR-01Carrinho 1"). */
function joinParts(parts: TextPart[]): string {
  let out = '';
  let previous: TextPart | null = null;
  for (const part of parts) {
    if (!part.text) continue;
    if (previous && previous.fromElement && part.fromElement) out += ' ';
    out += part.text;
    previous = part;
  }
  return out;
}

function collectText(node: React.ReactNode): string {
  return joinParts(collectParts(node));
}

/** Valor de uma célula no CSV, na ordem de precedência:
 *  1. `exportAccessor` (explícito, sempre ganha);
 *  2. accessor por chave -> valor cru da linha;
 *  3. accessor em função -> texto extraído do que seria renderizado. */
export function resolveExportValue<T extends Record<string, unknown>>(column: CsvColumnLike<T>, row: T): string {
  if (column.exportAccessor) {
    const value = column.exportAccessor(row);
    return value === null || value === undefined ? '' : String(value);
  }
  if (typeof column.accessor === 'function') {
    return reactNodeToText(column.accessor(row));
  }
  const value = row[column.accessor];
  return value === null || value === undefined ? '' : String(value);
}

/** Neutraliza injeção de fórmula: uma célula que começa com `=`, `+`, `@`,
 *  TAB ou CR é interpretada como FÓRMULA por Excel/Sheets — um valor vindo
 *  do banco (nome de ativo, observação digitada por usuário) viraria código
 *  executável na máquina de quem abre a planilha. Prefixar com aspa simples
 *  força o tratamento como texto.
 *
 *  `-` é o caso delicado: coordenada (`-23.55052, -46.63331`) é o dado mais
 *  comum deste sistema e não pode ser poluída com uma aspa na frente, mas
 *  `-2+3+cmd|'/C calc'!A0` também começa com `-` e dígito — a clássica carga
 *  de DDE. Por isso a exceção não olha só o primeiro caractere: o valor
 *  inteiro precisa ser número, ou lista de números separada por vírgula.
 *  Qualquer outra coisa começando com `-` é neutralizada. */
const NUMERIC_OR_COORDINATE = /^-?\d+(?:[.,]\d+)?(?:\s*,\s*-?\d+(?:[.,]\d+)?)*$/;

export function neutralizeFormulaInjection(value: string): string {
  if (!value) return value;
  const first = value[0];
  if (first === '=' || first === '+' || first === '@' || first === '\t' || first === '\r') {
    return `'${value}`;
  }
  if (first === '-') return NUMERIC_OR_COORDINATE.test(value) ? value : `'${value}`;
  return value;
}

/** Um campo CSV. Sempre entre aspas — é o formato mais à prova de bala:
 *  vírgula, ponto e vírgula, aspas e quebra de linha dentro do valor passam
 *  a ser inofensivos, sem precisar decidir campo a campo. */
export function escapeCsvField(value: string): string {
  return `"${neutralizeFormulaInjection(value).replace(/"/g, '""')}"`;
}

export const UTF8_BOM = '\uFEFF';

/** Monta o CSV inteiro.
 *
 *  BOM UTF-8 no começo: sem ele o Excel (pt-BR, Windows) abre o arquivo como
 *  ANSI/Latin-1 e "Patrimônio"/"Ações" viram "PatrimÃ´nio"/"AÃ§Ãµes". É o
 *  motivo nº 1 de "o CSV veio com acento errado".
 *
 *  Quebra de linha CRLF: é o que o RFC 4180 manda e o que o Excel espera. */
export function buildCsvContent<T extends Record<string, unknown>>(columns: CsvColumnLike<T>[], rows: T[]): string {
  const exported = columns.filter((c) => c.exportable !== false);
  const headerLine = exported.map((c) => escapeCsvField(c.header)).join(',');
  const bodyLines = rows.map((row) => exported.map((c) => escapeCsvField(resolveExportValue(c, row))).join(','));
  return UTF8_BOM + [headerLine, ...bodyLines].join('\r\n') + '\r\n';
}

/** Nome de arquivo seguro a partir do título da tabela (que é texto livre,
 *  com acento, barra e dois-pontos — caracteres que o Windows recusa). */
export function buildCsvFilename(title: string | undefined, now: Date = new Date()): string {
  const base = (title || 'export')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // tira acento do NOME DO ARQUIVO (não do conteúdo)
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase() || 'export';
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `athos_track_${base}_${stamp}.csv`;
}

/** Dispara o download no navegador.
 *
 *  Blob + objectURL em vez do `data:` URI + `encodeURI()` que existia antes:
 *  além do limite de tamanho da data URI, `encodeURI` NÃO escapa `#` — um
 *  único "#" em qualquer célula (número de ordem de serviço, observação)
 *  truncava o arquivo inteiro naquele ponto, silenciosamente. */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
