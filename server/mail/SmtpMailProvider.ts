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

import { lookup } from 'node:dns/promises';
import nodemailer from 'nodemailer';
import type { MailMessage, MailProvider, MailSendResult } from './MailProvider';

// Conecta sempre por IPv4. O nodemailer escolhe IPv6 quando a máquina tem
// qualquer interface IPv6 — e o container do Railway tem (rede privada), mas
// não tem rota IPv6 pra internet: smtp.gmail.com falhava com ENETUNREACH.
// Resolvemos o IPv4 aqui e mantemos o nome original em tls.servername, pra
// validação do certificado continuar sendo contra o host de verdade.
async function resolveIpv4(host: string): Promise<string> {
  const { address } = await lookup(host, { family: 4 });
  return address;
}

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
  private readonly config: SmtpConfig;

  constructor(config: SmtpConfig) {
    this.from = config.from;
    this.config = config;
  }

  // Um transporter por envio: o IP do servidor SMTP pode mudar entre um
  // pedido e outro (Gmail roda atrás de vários), e o volume aqui é baixo.
  private async createTransport(): Promise<ReturnType<typeof nodemailer.createTransport>> {
    const { config } = this;
    return nodemailer.createTransport({
      host: await resolveIpv4(config.host),
      port: config.port,
      // secure=true é TLS implícito (porta 465). Em 587 o padrão é STARTTLS,
      // que o nodemailer negocia sozinho com secure=false — não é "sem
      // criptografia", é criptografia negociada depois do EHLO.
      secure: config.secure,
      tls: { servername: config.host },
      auth: config.user ? { user: config.user, pass: config.pass } : undefined,
    });
  }

  /** Valida credenciais/conexão contra o servidor SMTP de verdade (comando
   *  EHLO + AUTH). Usado pelo health check do boot pra falhar cedo e alto em
   *  vez de só descobrir que o SMTP está errado quando alguém esquece a senha. */
  async verify(): Promise<void> {
    await (await this.createTransport()).verify();
  }

  async sendMail(message: MailMessage): Promise<MailSendResult> {
    const transporter = await this.createTransport();
    const info = await transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return { messageId: info.messageId ?? null };
  }
}
