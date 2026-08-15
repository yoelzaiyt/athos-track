// Mascara o IMEI para exibição no console de homologação: mantém os 2
// primeiros e os 4 últimos dígitos, substitui o resto por asteriscos.
export function maskImei(imei: string): string {
  const digits = imei.trim();
  if (digits.length <= 6) return '*'.repeat(digits.length);
  const prefix = digits.slice(0, 2);
  const suffix = digits.slice(-4);
  const maskedLength = digits.length - prefix.length - suffix.length;
  return `${prefix}${'*'.repeat(maskedLength)}${suffix}`;
}
