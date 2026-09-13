// Lógica de decisão do ledger de migrations, separada de server/db/migrate.ts
// de propósito: é a parte que decide O QUE vai rodar contra um banco real, e
// precisa ser testável sem banco nenhum (migrate.ts conecta no Postgres e roda
// main() no import, então não dá pra importar de um teste).
//
// Ver server/db/migrate.ts para os modos de uso e a trava de segurança.

import { createHash } from 'node:crypto';

export interface SqlFile {
  label: string;
  sql: string;
  checksum: string;
}

export interface LedgerRecord {
  checksum: string;
  adopted: boolean;
}

export interface Drift {
  /** No repo e ainda não no ledger — vai ser aplicado, na ordem desta lista. */
  pending: SqlFile[];
  /** Já aplicado, mas o arquivo no repo mudou depois. O banco não reflete o repo. */
  changed: SqlFile[];
  /** No ledger e não no repo — arquivo removido/renomeado depois de aplicado. */
  unknown: string[];
}

/**
 * Checksum curto do conteúdo do arquivo. Normaliza CRLF -> LF: o mesmo arquivo
 * checado out no Windows e no runner Linux do CI não pode gerar checksums
 * diferentes e parecer "alterado depois de aplicado".
 */
export function sha256(text: string): string {
  return createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex').slice(0, 16);
}

/**
 * Compara os arquivos do repo com o que o ledger diz estar aplicado.
 *
 * Arquivos adotados via --baseline (`adopted: true`) nunca entram em `changed`:
 * ninguém afirmou que o conteúdo do arquivo corresponde ao que rodou no banco
 * (o SQL não foi executado por nós), então acusar divergência de checksum ali
 * seria um falso positivo garantido.
 */
export function computeDrift(files: SqlFile[], applied: Map<string, LedgerRecord>): Drift {
  const pending = files.filter((f) => !applied.has(f.label));

  const changed = files.filter((f) => {
    const rec = applied.get(f.label);
    return rec !== undefined && !rec.adopted && rec.checksum !== f.checksum;
  });

  const unknown = [...applied.keys()].filter((label) => !files.some((f) => f.label === label));

  return { pending, changed, unknown };
}

/** Nada pendente e nada divergente. */
export function isUpToDate(drift: Drift): boolean {
  return drift.pending.length === 0 && drift.changed.length === 0 && drift.unknown.length === 0;
}

/**
 * Corte do --baseline-until=<trecho>: devolve quantos arquivos, a partir do
 * começo, devem ser marcados como aplicados. Casa por substring do label, para
 * aceitar tanto `20260828010000` quanto o nome completo do arquivo.
 *
 * Lança se o trecho não bater com nada — adotar silenciosamente o banco inteiro
 * por causa de um typo no argumento seria o pior resultado possível aqui.
 */
export function resolveBaselineCutoff(files: SqlFile[], until: string | null): number {
  if (until === null) return files.length;

  const idx = files.findIndex((f) => f.label.includes(until));
  if (idx === -1) {
    throw new Error(`--baseline-until=${until} não bate com nenhum arquivo. Rode --check para ver a lista.`);
  }
  return idx + 1;
}
