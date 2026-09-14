// Provedor de e-mail real via SMTP (nodemailer). SMTP de propósito, em vez
// da API HTTP de um fornecedor específico: funciona igual com Gmail/Google
// Workspace, Resend, SendGrid, SES, Zoho ou o servidor do próprio cliente —
// o ATHOS não fica preso a um fornecedor, do mesmo jeito que a camada de
// tracking não fica presa ao BRGPS.
//
// Configuração por ambiente (ver .env.example): SMTP_HOST, SMTP_PORT,
// SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM. Sem SMTP_HOST definido, este
// provedor NÃO é instanciado (ver server/mail/index.ts) e o endpoint de
// recuperação responde 503 honesto em vez de fingir que mandou e-mail.

import nodemailer from 'nodemailer';
import type { MailMessage, MailProvider, MailSendResult } from './MailProvider';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

export class SmtpMailProvider implements MailProvider {
  readonly id = 'smtp';
  readonly from: string;
  // ReturnType<> em vez de `nodemailer.Transporter`: o pacote publica os
  // tipos em dist/esm/*.d.ts sem expor o namespace pela raiz, então o nome
  // `nodemailer.Transporter` não existe pro TS neste moduleResolution.
  private transporter: ReturnType<typeof nodemailer.createTransport>;

  constructor(config: SmtpConfig) {
    this.from = config.from;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      // secure=true é TLS implícito (porta 465). Em 587 o padrão é STARTTLS,
      // que o nodemailer negocia sozinho com secure=false — não é "sem
      // criptografia", é criptografia negociada depois do EHLO.
      secure: config.secure,
      auth: config.user ? { user: config.user, pass: config.pass } : undefined,
    });
  }

  /** Valida credenciais/conexão contra o servidor SMTP de verdade (comando
   *  EHLO + AUTH). Usado pelo health check do boot pra falhar cedo e alto em
   *  vez de só descobrir que o SMTP está errado quando alguém esquece a senha. */
  async verify(): Promise<void> {
    await this.transporter.verify();
  }

  async sendMail(message: MailMessage): Promise<MailSendResult> {
    const info = await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return { messageId: info.messageId ?? null };
  }
}
