// Ativos com telemetria real (provider externo, ex.: BRGPS) gravam
// telemetry_last_communication como timestamp ISO real (não um rótulo
// congelado tipo "Agora"), já que não passam pela simulação client-side de
// 4s do AssetContext. Isto formata esse ISO como tempo relativo em pt-BR na
// hora da renderização, em vez de guardar um rótulo que ficaria desatualizado.
export function formatRelativeTimePtBr(value: string | undefined): string {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value; // já é um rótulo tipo "Agora" (mock)

  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);

  if (diffSec < 5) return 'Agora';
  if (diffSec < 60) return `Há ${diffSec}s`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `Há ${diffMin}min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `Há ${diffH}h`;
  const diffDays = Math.round(diffH / 24);
  return `Há ${diffDays}d`;
}

const BRASILIA_TIMEZONE = 'America/Sao_Paulo';

/**
 * Data e hora absolutas no fuso de Brasília (dd/MM/aaaa HH:mm), para onde o
 * relativo não serve — relatório exportado, por exemplo, em que "Há 5min" não
 * diz nada depois de aberto no dia seguinte. Os timestamps chegam em UTC do
 * banco; imprimi-los crus faz um pacote das 21:13 aparecer como o dia
 * seguinte, que foi exatamente o bug relatado.
 */
export function formatDateTimeBrasilia(value: string | undefined): string {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value; // rótulo tipo "Agora"/"Nunca comunicou"

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: BRASILIA_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}
