// Camada de e-mail desacoplada, no mesmo espírito de
// server/integrations/shared/TrackingProvider.ts: o resto do backend nunca
// fala "nodemailer" nem "SMTP" — só pede `sendMail(...)` a um MailProvider.
// Hoje existe uma implementação real (SMTP, server/mail/SmtpMailProvider.ts)
// e uma de captura usada nos testes; amanhã, se entrar um provedor HTTP
// (Resend/SES API), ele implementa esta mesma interface sem tocar em
// routes-auth.ts.

export interface MailMessage {
  to: string;
  subject: string;
  /** Corpo em texto puro — sempre enviado junto do HTML (clientes que
   *  bloqueiam HTML, leitores de tela, filtros de spam que penalizam
   *  mensagens só-HTML). */
  text: string;
  html: string;
}

export interface MailSendResult {
  /** Identificador do provedor (Message-ID no SMTP) — vai pro audit log como
   *  prova de que a mensagem SAIU daqui, sem conteúdo sensível junto. */
  messageId: string | null;
}

export interface MailProvider {
  /** Id curto do provedor, pra log/auditoria ('smtp', 'capture', ...). */
  readonly id: string;
  /** Remetente efetivo (From) — usado na UI/log pra dizer de onde o e-mail sai. */
  readonly from: string;
  sendMail(message: MailMessage): Promise<MailSendResult>;
}
