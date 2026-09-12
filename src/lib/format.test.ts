import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatRelativeTimePtBr, formatDateTimeBrasilia } from './format';

afterEach(() => {
  vi.useRealTimers();
});

describe('formatDateTimeBrasilia', () => {
  // O bug relatado: pacote das 21:13 de 11/09 (00:13Z do dia 12) aparecia como
  // 2026-09-12 na interface, porque o ISO em UTC era impresso cru.
  it('converte UTC para o fuso de Brasília, mantendo o dia local', () => {
    expect(formatDateTimeBrasilia('2026-09-12T00:13:21.000Z')).toBe('11/09/2026, 21:13');
  });

  it('não muda o dia quando o horário local fica no mesmo dia do UTC', () => {
    expect(formatDateTimeBrasilia('2026-09-11T14:30:00.000Z')).toBe('11/09/2026, 11:30');
  });

  it('usa 24h em vez de AM/PM', () => {
    expect(formatDateTimeBrasilia('2026-09-11T23:45:00.000Z')).toBe('11/09/2026, 20:45');
  });

  it('devolve rótulos não-ISO intactos (ativos simulados)', () => {
    expect(formatDateTimeBrasilia('Agora')).toBe('Agora');
    expect(formatDateTimeBrasilia('Nunca comunicou')).toBe('Nunca comunicou');
  });

  it('devolve travessão para valor ausente', () => {
    expect(formatDateTimeBrasilia(undefined)).toBe('—');
    expect(formatDateTimeBrasilia('')).toBe('—');
  });
});

describe('formatRelativeTimePtBr', () => {
  // O relativo compara instantes, então o fuso do ISO não influencia: o mesmo
  // pacote "do dia seguinte" em UTC continua sendo "Há 5min".
  it('não é afetado pelo fuso do timestamp', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-12T00:18:21.000Z'));
    expect(formatRelativeTimePtBr('2026-09-12T00:13:21.000Z')).toBe('Há 5min');
  });

  it('devolve rótulos não-ISO intactos', () => {
    expect(formatRelativeTimePtBr('Agora')).toBe('Agora');
    expect(formatRelativeTimePtBr('Nunca comunicou')).toBe('Nunca comunicou');
  });

  it('devolve travessão para valor ausente', () => {
    expect(formatRelativeTimePtBr(undefined)).toBe('—');
  });
});
