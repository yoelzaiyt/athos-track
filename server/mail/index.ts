// Registro do provedor de e-mail ativo. Uma instância só por processo,
// criada preguiçosamente a partir do ambiente — e NULA quando o SMTP não
// está configurado, porque o comportamento honesto nesse caso é o endpoint
// de recuperação responder "indisponível" (503), não fingir um envio.

import { SmtpMailProvider } from './SmtpMailProvider';
import type { MailProvider } from './MailProvider';

export type { MailMessage, MailProvider, MailSendResult } from './MailProvider';
export { SmtpMailProvider } from './SmtpMailProvider';

let cached: MailProvider | null | undefined;
let override: MailProvider | null | undefined;

function buildFromEnv(): MailProvider | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  const port = Number(process.env.SMTP_PORT) || 587;
  const from = process.env.MAIL_FROM;
  if (!from) {
    console.warn('[mail] SMTP_HOST definido mas MAIL_FROM ausente — provedor de e-mail NÃO ativado.');
    return null;
  }

  return new SmtpMailProvider({
    host,
    port,
    // Default coerente com a porta: 465 = TLS implícito, resto = STARTTLS.
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    user: process.env.SMTP_USER || undefined,
    pass: process.env.SMTP_PASS || undefined,
    from,
  });
}

/** Provedor ativo, ou null quando não há SMTP configurado neste ambiente. */
export function getMailProvider(): MailProvider | null {
  if (override !== undefined) return override;
  if (cached === undefined) cached = buildFromEnv();
  return cached;
}

export function isMailConfigured(): boolean {
  return getMailProvider() !== null;
}

/** Injeta um provedor (testes de integração capturam a mensagem em vez de
 *  mandar e-mail de verdade). `undefined` devolve o comportamento normal. */
export function setMailProviderOverride(provider: MailProvider | null | undefined): void {
  override = provider;
}
