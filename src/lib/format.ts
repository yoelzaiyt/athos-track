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
