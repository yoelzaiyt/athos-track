// Testes da lógica que decide o que roda contra um banco real. Sem banco: são
// funções puras de propósito (ver server/db/migrationLedger.ts).
//
// O caso que importa aqui é o cenário real do Postgres do Railway: banco já
// migrado à mão, sem ledger, e atrasado em relação ao repo. Errar a
// classificação nesse cenário significa reaplicar migrations históricas do
// Supabase, que não são reexecutáveis.
import { describe, expect, it } from 'vitest';
import {
  computeDrift,
  isUpToDate,
  resolveBaselineCutoff,
  sha256,
  type LedgerRecord,
  type SqlFile,
} from './migrationLedger.ts';

function file(label: string, sql = `-- ${label}`): SqlFile {
  return { label, sql, checksum: sha256(sql) };
}

function ledger(entries: [string, string, boolean?][]): Map<string, LedgerRecord> {
  return new Map(entries.map(([label, sql, adopted]) => [label, { checksum: sha256(sql), adopted: adopted ?? false }]));
}

describe('sha256', () => {
  it('é estável para o mesmo conteúdo', () => {
    expect(sha256('create table x();')).toBe(sha256('create table x();'));
  });

  it('muda quando o conteúdo muda', () => {
    expect(sha256('create table x();')).not.toBe(sha256('create table y();'));
  });

  it('ignora a diferença CRLF/LF — Windows e o runner Linux do CI dão o mesmo checksum', () => {
    expect(sha256('linha 1\r\nlinha 2\r\n')).toBe(sha256('linha 1\nlinha 2\n'));
  });
});

describe('computeDrift', () => {
  it('banco vazio: tudo pendente, na ordem dos arquivos', () => {
    const files = [file('00_bootstrap.sql'), file('supabase/migrations/a.sql'), file('02_realtime_notify.sql')];
    const drift = computeDrift(files, new Map());

    expect(drift.pending.map((f) => f.label)).toEqual([
      '00_bootstrap.sql',
      'supabase/migrations/a.sql',
      '02_realtime_notify.sql',
    ]);
    expect(drift.changed).toEqual([]);
    expect(drift.unknown).toEqual([]);
    expect(isUpToDate(drift)).toBe(false);
  });

  it('banco em dia: nada pendente, nada divergente', () => {
    const files = [file('a.sql'), file('b.sql')];
    const drift = computeDrift(files, ledger([['a.sql', '-- a.sql'], ['b.sql', '-- b.sql']]));

    expect(drift.pending).toEqual([]);
    expect(drift.changed).toEqual([]);
    expect(drift.unknown).toEqual([]);
    expect(isUpToDate(drift)).toBe(true);
  });

  it('banco atrasado: só os arquivos novos entram em pending (cenário Railway)', () => {
    const files = [file('a.sql'), file('b.sql'), file('c.sql'), file('d.sql')];
    const drift = computeDrift(files, ledger([['a.sql', '-- a.sql'], ['b.sql', '-- b.sql']]));

    expect(drift.pending.map((f) => f.label)).toEqual(['c.sql', 'd.sql']);
    expect(drift.changed).toEqual([]);
  });

  it('arquivo editado depois de aplicado vira changed, NÃO pending (não reaplica sozinho)', () => {
    const files = [file('a.sql', '-- versão nova')];
    const drift = computeDrift(files, ledger([['a.sql', '-- versão antiga']]));

    expect(drift.changed.map((f) => f.label)).toEqual(['a.sql']);
    expect(drift.pending).toEqual([]);
    expect(isUpToDate(drift)).toBe(false);
  });

  it('arquivo adotado via --baseline nunca acusa changed (ninguém afirmou o conteúdo)', () => {
    const files = [file('a.sql', '-- conteúdo atual do repo')];
    const drift = computeDrift(files, ledger([['a.sql', '-- outro conteúdo qualquer', true]]));

    expect(drift.changed).toEqual([]);
    expect(drift.pending).toEqual([]);
    expect(isUpToDate(drift)).toBe(true);
  });

  it('arquivo no ledger e não no repo vira unknown (removido/renomeado)', () => {
    const files = [file('a.sql')];
    const drift = computeDrift(files, ledger([['a.sql', '-- a.sql'], ['sumiu.sql', '-- sumiu.sql']]));

    expect(drift.unknown).toEqual(['sumiu.sql']);
    expect(isUpToDate(drift)).toBe(false);
  });
});

describe('resolveBaselineCutoff', () => {
  const files = [
    file('00_bootstrap.sql'),
    file('supabase/migrations/20260828010000_auth.sql'),
    file('supabase/migrations/20260910100200_register_zaffari_tags.sql'),
    file('02_realtime_notify.sql'),
  ];

  it('sem --baseline-until adota tudo', () => {
    expect(resolveBaselineCutoff(files, null)).toBe(4);
  });

  it('casa por substring (timestamp basta) e é inclusivo', () => {
    expect(resolveBaselineCutoff(files, '20260828010000')).toBe(2);
  });

  it('casa pelo label completo', () => {
    expect(resolveBaselineCutoff(files, 'supabase/migrations/20260910100200_register_zaffari_tags.sql')).toBe(3);
  });

  it('trecho que não bate com nada lança — um typo não pode adotar o banco inteiro', () => {
    expect(() => resolveBaselineCutoff(files, '20990101000000')).toThrow(/não bate com nenhum arquivo/);
  });
});
