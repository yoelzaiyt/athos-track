# PASSWORD-RECOVERY-REPORT.md

> Rodada SEC-010 **fase 2** — recuperação de senha real (endpoint + token de
> uso único com expiração + envio real de e-mail + tela de redefinição +
> invalidação do token após uso). Mesmo princípio das rodadas anteriores:
> **"SE APARECE NA TELA, TEM QUE SER REAL"** — sem SMTP configurado, a API
> responde 503 dizendo que não está disponível, em vez de fingir um envio.

## 0. Correção do enunciado (auditoria antes de mexer)

O brief descrevia `src/pages/Login.tsx:192` exibindo
`alert('Instruções de recuperação foram enviadas...')`. **Esse `alert()` não
existia mais no código**: ele já havia sido substituído (SEC-010 fase 1, ver
`SECURITY-GATE-REPORT.md`, marcado PASS) por uma mensagem honesta —
*"Recuperação automática de senha ainda não está disponível..."*. O que de
fato faltava, e é o que esta rodada entrega, é o fluxo funcional: até aqui
redefinir senha exigia um humano rodando `scripts/provision-user-password.ts`.

## 1. O que foi construído

| Camada | Arquivo | Papel |
|---|---|---|
| Banco | `supabase/migrations/20260912000000_add_password_reset_tokens.sql` | Tabela `password_reset_tokens` (hash, expiração, uso único, motivo de consumo, IP). RLS ligada **sem policy** + `revoke all` de `athos_app_rw`/`anon`/`authenticated` |
| Núcleo | `server/api/passwordReset.ts` | Geração do token (CSPRNG 256 bits), SHA-256, TTL, política de senha, URL pública, corpo do e-mail (HTML + texto) |
| E-mail | `server/mail/MailProvider.ts`, `SmtpMailProvider.ts`, `index.ts` | Camada desacoplada no espírito do `TrackingProvider`: SMTP genérico (nodemailer), sem lock-in de fornecedor; `null` quando não configurado |
| API | `server/api/routes-auth.ts` | `POST /auth/password-reset/request \| validate \| confirm` + freios por IP e por e-mail + auditoria |
| API | `server/api/index.ts` | Log de boot dizendo se a recuperação está ATIVA ou INATIVA (e por quê) |
| Front | `src/pages/ResetPasswordPage.tsx` | Tela pública `/redefinir-senha?token=...` (valida o link no mount, define a senha nova) |
| Front | `src/pages/Login.tsx` | Painel real de "Recuperar senha" dentro do card de login |
| Front | `src/App.tsx`, `src/lib/supabaseClient.ts` | Rota pública + os 3 métodos no shim de auth |
| Config | `.env.example` | `SMTP_*`, `MAIL_FROM`, `APP_PUBLIC_URL`, `PASSWORD_RESET_TTL_MINUTES` |

Dependência nova: **`nodemailer@^10.0.9`** (única adição ao `package.json`).

## 2. Decisões de segurança (e o porquê)

- **O banco nunca vê o token.** Guarda-se só o SHA-256; o valor em claro existe
  apenas no e-mail do dono da conta. Dump/backup/DBA não redefinem senha de
  ninguém. SHA-256 puro basta: o token tem 256 bits de entropia real (não é
  senha, não há ataque de dicionário).
- **Uso único, com trava de concorrência.** O `UPDATE ... where id = $1 and
  used_at is null returning id` dentro da transação garante que duas
  confirmações simultâneas com o mesmo link só deixem uma passar.
- **Tudo ou nada.** Trocar a senha, consumir o token e revogar as sessões
  acontecem na mesma transação.
- **Redefinir senha EXPULSA o invasor:** `session_version + 1` (SEC-008) —
  qualquer token JWT já emitido para a conta morre na hora, em qualquer
  dispositivo. Verificado ao vivo (ver §4).
- **Pedir link novo invalida o anterior** (`consumed_reason = 'superseded'`):
  no máximo um link vivo por conta.
- **Sem oráculo de contas.** E-mail inexistente, conta desativada e cota
  estourada recebem exatamente a mesma resposta 202 + mensagem genérica.
- **Freios:** 20 req/15min por IP (os três endpoints) e 3 e-mails/15min por
  conta.
- **Tabela fora do proxy REST.** `password_reset_tokens` não entra em
  `ALLOWED_TABLES` de `server/api/rest.ts`; só o pool superusuário a toca.
  RLS ligada sem policy + revoke explícito são a segunda camada (a migration
  de RLS tem `alter default privileges ... grant`, que senão daria acesso
  automático à role de aplicação).
- **Auditoria** em `audit_logs` (`PASSWORD_RESET_REQUESTED` /
  `PASSWORD_RESET_COMPLETED`), com o `token_id` e o `message_id` do SMTP —
  **nunca** o token ou o link.
- **Desbloqueio do rate limit de login:** quem acabou de recuperar a conta não
  fica preso ao limitador de tentativas (SEC-007) das senhas erradas de antes.

**Trade-off assumido e documentado:** quando o envio falha de verdade (SMTP
fora), a API responde **502** com a verdade, em vez de 202. Isso só acontece
para e-mail que existe, então com o SMTP quebrado um atacante poderia inferir
existência de conta. Escolha consciente: melhor do que deixar o usuário
legítimo esperando pra sempre um e-mail que nunca vai chegar.

**Política da senha nova:** mínimo 8 caracteres, com pelo menos uma letra e um
número. Vale só para senhas definidas por este fluxo — as senhas já existentes
continuam entrando normalmente pelo `/auth/login` (o script de provisionamento
segue com o mínimo de 6).

## 3. Testes automatizados

`server/api/password-reset.test.ts` — **13 casos, todos PASS**. Integração
real (Express de verdade em porta efêmera, Postgres de dev), no padrão do
`rbac.test.ts`. O único ponto substituído é o provedor de e-mail, trocado por
um de captura (`setMailProviderOverride`) para o teste conseguir ler o link.

Cobertura: fluxo completo (login antes → pedido → e-mail → validação →
confirmação → login novo); senha antiga rejeitada; sessão anterior revogada;
token em claro ausente do banco; reuso bloqueado; link novo invalida o
anterior; expirado; inventado; malformado; conta inexistente e conta
desativada com resposta idêntica; 503 sem SMTP; 502 com SMTP quebrado +
token invalidado; cota de 3 e-mails; auditoria sem token.

```
npx vitest run server/api/password-reset.test.ts   ->  13 passed (13)
npx tsc --noEmit                                    ->  OK
npx vite build                                      ->  OK (avisos de chunk pré-existentes)
```

## 4. Verificação ao vivo (browser real + SMTP real)

Feito com a API e o Vite locais, SMTP apontando para uma conta descartável
**real** (Ethereal — handshake, AUTH e DATA de verdade), usuário de teste
criado e removido ao final.

| Passo | Evidência | Resultado |
|---|---|---|
| Boot da API | `[api] Recuperação de senha ATIVA — e-mail via smtp, links apontando para http://localhost:3000.` | PASS |
| SMTP real | `verify()` OK; resposta do servidor `250 Accepted [STATUS=new MSGID=...]`; preview do e-mail renderizado: https://ethereal.email/message/aqX4CnS9RyYbpR8AaqX4DV31x4oQTDMWAAAAAQa3.UN-AiZbYBniVr7ad4A | PASS |
| Painel "Recuperar senha" no login | Abre no card, aceita e-mail, responde com a mensagem genérica | PASS |
| Envio disparado pela UI | `audit_logs`: `PASSWORD_RESET_REQUESTED` / success / `mail_provider: smtp` / `message_id: <cfbcacdc-...@athostrack.com.br>` | PASS |
| Token no banco | 1 linha, só hash, `expires_at` +30min, `requested_ip 127.0.0.1`, `used_at null` | PASS |
| Tela `/redefinir-senha` | Mostra e-mail mascarado (`ui**********@example.com`) e a validade | PASS |
| Senhas diferentes | "As duas senhas não são iguais." | PASS |
| Redefinição | "Senha redefinida. As sessões antigas desta conta foram encerradas." | PASS |
| Reabrir o mesmo link | "Este link de redefinição não é mais válido..." | PASS |
| Login senha nova / senha antiga | `200` / `401` | PASS |
| Revogação de sessão | `session_version` 1 → 2 | PASS |
| Auditoria final | `PASSWORD_RESET_REQUESTED` + `PASSWORD_RESET_COMPLETED`, sem token no `detail` | PASS |

Limpeza: usuário de teste, tokens e entradas de auditoria removidos
(`password_reset_tokens` voltou a 0 linhas).

## 5. Achado NÃO relacionado (pré-existente)

`npx vitest run` completo: **139 passed / 9 failed (148)**. As 9 falhas estão
em `server/api/tag-classification.test.ts` e `server/api/realtime.test.ts` e
**não têm relação com esta rodada** — confirmado removendo o arquivo de teste
novo e rodando os dois arquivos isolados: as mesmas 9 falham.

Causa raiz: **o banco de dev está com a tabela `assets` vazia (0 linhas)**, e
esses testes dependem do fixture vivo (10 carrinhos ZAFFARI + 2 caixas
SÃO JOÃO). `company_clients` (DEMO-01, SAO-JOAO, ZAFFARI) e os usuários de
homologação continuam lá; os ativos sumiram em algum momento entre
2026-09-11 e hoje. **Não repovoei nada** — inventar ativo seria exatamente o
que o princípio da rodada proíbe. Decisão de como restaurar (re-rodar as
migrations de seed `20260910100200_register_zaffari_tags.sql` /
`20260910110000_link_zaffari_tags_to_brgps2_devices.sql`, ou reimportar do
provider) fica pra você.

Nota de lado: a tabela `animals` **existe** neste banco — a pendência antiga
`relation "animals" does not exist` não se reproduz mais aqui.

## 6. PENDING

| Item | Bloqueio |
|---|---|
| **SMTP de produção** (`SMTP_HOST/PORT/USER/PASS`, `MAIL_FROM`, `APP_PUBLIC_URL`) no Railway e no `.env` local | Credenciais só você tem. Enquanto não existirem, o endpoint responde 503 honesto — o fluxo não "meio funciona" |
| SPF/DKIM do domínio remetente | Sem isso o e-mail cai em spam. Depende do provedor escolhido |
| Migration aplicada **só no banco de dev** | Falta aplicar em produção quando for a hora (`npx tsx scripts/apply-migration.ts 20260912000000_add_password_reset_tokens.sql`) |
| Fixture de `assets` do dev vazio (§5) | Decisão sua |
| Commit/push/deploy | **Nada foi commitado** — conforme a convenção do projeto |

---

*Gerado: 2026-09-12 | Branch: `homolog/gt06-tag-3092660181` | Working tree com as mudanças desta rodada, não commitadas.*
