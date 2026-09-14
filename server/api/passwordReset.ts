// Núcleo do fluxo de recuperação de senha (SEC-010 fase 2). Fica separado de
// routes-auth.ts porque é a parte testável sem HTTP: geração/hash do token,
// política de senha, URL do link e o corpo do e-mail.
//
// Modelo de ameaça que orientou as decisões:
//   * O token é um segredo de 256 bits gerado por CSPRNG — não derivado de
//     e-mail/id/timestamp, então não dá pra adivinhar sabendo quem é a vítima.
//   * O banco guarda só o SHA-256 do token. Vazar o banco não dá poder de
//     redefinir senha de ninguém (é o mesmo motivo de a senha ser bcrypt).
//     SHA-256 puro basta aqui — diferente de senha, o token tem 256 bits de
//     entropia real, então não existe ataque de dicionário contra ele.
//   * Comparação por igualdade de hash (e não do token em claro), com lookup
//     direto pelo hash — sem varrer linha a linha, sem comparação de segredo
//     em tempo variável.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Validade do link. Curta de propósito: é tempo de ir no e-mail e clicar,
 *  não uma credencial de longa duração. Configurável pra quem opera em
 *  ambiente com entrega de e-mail lenta. */
export const RESET_TTL_MINUTES = Math.max(5, Number(process.env.PASSWORD_RESET_TTL_MINUTES) || 30);

export interface GeneratedResetToken {
  /** Valor em claro — vai SÓ no e-mail do dono da conta. Nunca logar, nunca
   *  gravar no banco, nunca devolver numa resposta HTTP. */
  token: string;
  tokenHash: string;
  expiresAt: Date;
}

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function generateResetToken(now: Date = new Date()): GeneratedResetToken {
  // base64url: cabe numa URL sem escaping e sem os caracteres que alguns
  // clientes de e-mail quebram em duas linhas.
  const token = randomBytes(32).toString('base64url');
  return {
    token,
    tokenHash: hashResetToken(token),
    expiresAt: new Date(now.getTime() + RESET_TTL_MINUTES * 60_000),
  };
}

/** Comparação de hashes em tempo constante — os dois lados têm o mesmo
 *  tamanho (SHA-256 hex), então timingSafeEqual nunca lança aqui. */
export function resetTokenHashMatches(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

export const MIN_PASSWORD_LENGTH = 8;

/** Política da senha NOVA (não muda nada pras senhas já existentes, que
 *  seguem entrando pelo /auth/login normalmente). Devolve a mensagem de erro
 *  em PT, ou null quando a senha passa. */
export function validateNewPassword(password: unknown): string | null {
  if (typeof password !== 'string') return 'Informe a nova senha.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (password.length > 200) return 'A senha é longa demais (máximo 200 caracteres).';
  if (!/[A-Za-zÀ-ÿ]/.test(password)) return 'A senha precisa ter pelo menos uma letra.';
  if (!/[0-9]/.test(password)) return 'A senha precisa ter pelo menos um número.';
  return null;
}

/** Base pública do frontend, usada pra montar o link do e-mail.
 *  APP_PUBLIC_URL é a fonte de verdade; na falta dela, cai no primeiro
 *  domínio de CORS_ORIGIN (que já é, por definição, a origem do frontend
 *  autorizado) — nunca em localhost adivinhado nem em '*'. */
export function resolveAppPublicUrl(): string | null {
  const explicit = process.env.APP_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  const corsRaw = process.env.CORS_ORIGIN?.trim();
  if (!corsRaw || corsRaw === '*') return null;
  const first = corsRaw.split(',')[0]?.trim();
  if (!first || !/^https?:\/\//i.test(first)) return null;
  return first.replace(/\/+$/, '');
}

/** Rota pública do SPA que recebe o token (ver src/App.tsx). */
export const RESET_PAGE_PATH = '/redefinir-senha';

export function buildResetLink(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${RESET_PAGE_PATH}?token=${encodeURIComponent(token)}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface ResetEmailParts {
  subject: string;
  text: string;
  html: string;
}

/** Corpo do e-mail. Sem imagem remota, sem tracking pixel, sem JS — só
 *  HTML inline simples (o que passa em cliente corporativo/Outlook) e a
 *  versão texto equivalente. O link aparece também em texto puro porque
 *  muitos clientes corporativos reescrevem/quebram <a href>. */
export function buildResetEmail(params: {
  recipientName: string | null;
  link: string;
  expiresAt: Date;
  ttlMinutes?: number;
}): ResetEmailParts {
  const ttl = params.ttlMinutes ?? RESET_TTL_MINUTES;
  const saudacao = params.recipientName ? `Olá, ${params.recipientName}` : 'Olá';
  const validade = params.expiresAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const text = [
    `${saudacao},`,
    '',
    'Recebemos um pedido para redefinir a senha da sua conta no ATHOS TRACK.',
    '',
    'Abra o link abaixo para escolher uma nova senha:',
    params.link,
    '',
    `Este link vale por ${ttl} minutos (até ${validade}, horário de Brasília) e só pode ser usado uma vez.`,
    '',
    'Se não foi você que pediu, ignore este e-mail: sua senha atual continua valendo e nada foi alterado.',
    '',
    'ATHOS TRACK',
  ].join('\n');

  const html = `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px;background:#0f172a;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#111827;border:1px solid #1f2937;border-radius:14px;padding:28px;color:#e2e8f0;">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;color:#22d3ee;text-transform:uppercase;">ATHOS TRACK</p>
    <h1 style="margin:0 0 18px;font-size:19px;color:#f8fafc;">Redefinição de senha</h1>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.6;">${escapeHtml(saudacao)}, recebemos um pedido para redefinir a senha da sua conta.</p>
    <p style="margin:0 0 22px;font-size:14px;line-height:1.6;">Clique no botão abaixo para escolher uma nova senha:</p>
    <p style="margin:0 0 22px;">
      <a href="${escapeHtml(params.link)}" style="display:inline-block;background:#0891b2;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px;">Redefinir minha senha</a>
    </p>
    <p style="margin:0 0 18px;font-size:12px;line-height:1.6;color:#94a3b8;">Se o botão não funcionar, copie e cole este endereço no navegador:<br>
      <span style="color:#67e8f9;word-break:break-all;">${escapeHtml(params.link)}</span></p>
    <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#94a3b8;">O link vale por ${ttl} minutos (até ${escapeHtml(validade)}, horário de Brasília) e só pode ser usado uma vez.</p>
    <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">Se não foi você que pediu, ignore este e-mail — sua senha atual continua valendo e nada foi alterado.</p>
  </div>
</body></html>`;

  return { subject: 'ATHOS TRACK — redefinição de senha', text, html };
}
