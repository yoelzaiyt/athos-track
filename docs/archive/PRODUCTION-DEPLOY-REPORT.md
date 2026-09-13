# ATHOS TRACK — Production Deploy Report (Vercel)

> Gerado em: 2026-08-28. Pré-condição do prompt ("só executar se
> `FINAL-PRE-PRODUCTION-GATE.md` estiver PASS") — o gate tinha fechado com
> **STOP** por um P0 (secret exposto), já corrigido nesta mesma sessão; você
> confirmou explicitamente prosseguir com commit+push depois da correção
> (ver `FINAL-PRE-PRODUCTION-GATE.md` §3 e §9). Considerei essa confirmação
> como a autorização equivalente a "PASS" pra este prompt.

---

## Resultado final

```
VERCEL:            PASS   (deploy real, build limpo, shell e roteamento verificados ao vivo)
SUPABASE:          N/A    (frontend não fala com Supabase diretamente — só com a API própria, que não está publicada)
SÃO JOÃO:          BLOQUEADO (esperado)  — shell/URL funcionam, login falha por falta de backend
AFRIN / GRUPO ZAFFARI: BLOQUEADO (esperado)  — idem
TENANT ISOLATION:  PASS   (na camada que dá pra testar sem backend — ver §5)
SECURITY:          PASS   (nenhum segredo no frontend/Git/relatório; 1 erro de config achado e corrigido)
PRODUCTION:        NÃO PRONTO — falta publicar o backend (fora do escopo autorizado deste prompt)
```

**Isto não é uma falha do deploy** — é o resultado esperado e confirmado
por você antes de eu prosseguir (pergunta feita nesta sessão: *"Já existe
um backend rodando em algum lugar público?"* → resposta: *"Não existe
ainda — só faça o frontend por agora"*, com a ressalva explícita de que os
smoke tests de login/dados/isolamento **vão falhar por falta de backend,
não por bug**). O restante deste relatório documenta exatamente isso, sem
maquiar.

---

## 1. Constatação crítica: arquitetura Vercel-only não fecha o app

Este projeto foi desenhado com **frontend na Vercel e backend na Railway**
(`docs/deploy/RAILWAY_VERCEL.md`, `railway.api.json`) — não é um app
full-stack rodando inteiro na Vercel. O frontend (`src/lib/
supabaseClient.ts`) fala **só** com a API Express própria via
`VITE_API_URL`; nunca fala com o Supabase/Postgres diretamente. Como este
prompt autorizou só o deploy na Vercel (não na Railway), e não havia
backend público configurado, o resultado é: **o site carrega e funciona
até a tela de login; qualquer coisa que dependa de dado real (login,
dashboard, ativos, mapas, alertas, histórico, logout de sessão real,
isolamento de dado) fica bloqueada**, porque não existe API pra responder.

`VITE_API_URL` foi configurado com um domínio placeholder,
propositalmente inválido (`https://athos-track-api-not-deployed.example.invalid`
— TLD `.invalid`, reservado pela IANA especificamente pra nunca resolver)
em vez de deixar vazio (o app quebraria com tela branca — `supabaseClient.ts`
lança exceção se a env var estiver ausente) ou apontar pra `localhost`
(nunca resolveria no navegador de um usuário real, e seria confuso).

---

## 2. URLs e identificação do deploy

| Item | Valor |
|---|---|
| URL de produção (canônica) | `https://athos-track-eight.vercel.app` |
| URL alternativa (escopo do time) | `https://athos-track-yoelzaiyts-projects.vercel.app` |
| URL São João | `https://athos-track-eight.vercel.app/sao-joao` |
| URL Afrin / **Grupo Zaffari** | `https://athos-track-eight.vercel.app/grupo-zaffari` |
| Deployment ID | `dpl_EyqYFnd5aACagaqUFqLrCoRxUNnF` |
| Projeto Vercel | `yoelzaiyts-projects/athos-track` (criado nesta rodada, conectado ao GitHub `yoelzaiyt/athos-track`) |
| Commit implantado | `c748a57` (`fix: correct vercel.json build config after project link`) |
| Branch | `master` |

> O prompt pediu URL no padrão `.../afrin`. O nome real do tenant é
> **Grupo Zaffari** (corrigido numa rodada anterior desta sessão, a pedido
> seu explícito) — o slug real em `company_clients.slug` é `grupo-zaffari`,
> não `afrin`. Usei o slug real pra manter consistência com o resto do
> sistema (é o mesmo slug que `ClientsPage.tsx`, migrations e todos os
> relatórios anteriores já usam) em vez de reintroduzir o nome já corrigido
> como errado.

---

## 3. O que foi feito

1. **Roteamento por tenant** (`src/App.tsx`, commit `829a0f8`) — não
   existia nenhuma rota por URL antes desta rodada (app 100% SPA por
   estado interno, achado documentado em `UI-E2E-VALIDATION.md`).
   Implementado: depois do login, redireciona pra `/<slug-do-próprio-tenant>`;
   trocar o slug manualmente na URL redireciona de volta pro slug correto
   — **nunca concede acesso a dado de outro tenant**, porque isso nunca
   dependeu da URL: continua 100% decidido pelo JWT/RBAC/RLS já testados
   exaustivamente em `RBAC-SECURITY-GATE.md`. Testado ao vivo (local, antes
   do deploy) nos 3 cenários: login → redireciona certo; troca manual de
   slug logado → volta sozinho; slug de tenant deslogado → tela de login
   normal, sem vazar nada.
2. **Achado e corrigido antes do deploy**: `vercel link` auto-detectou uma
   configuração de "services" e sobrescreveu `vercel.json` com um
   `buildCommand` que só fazia `echo` (não construía nada de verdade —
   parece ter copiado a string de configuração do serviço da API do
   Railway por engano). Corrigido pra um `buildCommand`/`outputDirectory`
   explícitos e corretos antes de qualquer deploy real (commit `c748a57`).
3. **Projeto Vercel novo criado** (`athos-track`), conectado ao repositório
   GitHub.
4. **Environment Variables configuradas** nos 3 ambientes (Production,
   Preview, Development) — só `VITE_API_URL` (placeholder, ver §1).
   **Nenhuma outra variável foi configurada nesta Vercel**, de propósito:
   como o app não roda nenhum código server-side na Vercel (é só um
   build estático — `vite build` → `dist/`), não existe "secret
   server-side" nenhum pra esta camada. `JWT_SECRET`/`DATABASE_URL`/
   `BRGPS_API_TOKEN`/`APP_DATABASE_URL` são segredos do **backend**, e
   pertencem ao deploy da API (Railway), não a este.
5. **Deploy de produção real**, build rodou ao vivo na Vercel (`vite
   build`, 2378 módulos, mesmos warnings pré-existentes de sempre — CSS
   `@import`/tamanho de bundle), sem erro.
6. **Nenhum segredo em lugar nenhum**: nada foi escrito em código,
   `vercel.json`, Git, ou neste relatório. `.env.local` que o `vercel
   link` criou localmente (token OIDC da Vercel) está coberto por
   `.gitignore` (`.env*`) — confirmado, nunca chegou a ser staged.

---

## 4. Smoke test real (contra a URL de produção ao vivo)

| Item pedido | Resultado | Nota |
|---|---|---|
| Vercel build | ✅ PASS | build real na infraestrutura da Vercel, sem erro |
| Migrations | N/A nesta rodada | nenhuma migration nova; as 19 existentes já confirmadas aplicadas no `FINAL-PRE-PRODUCTION-GATE.md` — este deploy não toca banco nenhum (é só o frontend estático) |
| Conexão Supabase | N/A | o frontend nunca fala com Supabase diretamente (ver §1) — não há "conexão" pra validar nesta camada |
| Shell / carregamento inicial | ✅ PASS | tela de login carrega, mundo animado/branding renderiza, sem tela branca, sem erro no console |
| Login | ❌ BLOQUEADO (esperado) | formulário funciona, submete, e devolve **"Credenciais inválidas"** — não é o comportamento correto de verdade (deveria ser um erro de rede, não de credencial), porque a mensagem de erro do app não distingue "API fora do ar" de "senha errada" (achado real, ver §6) — mas não crasha, não trava, não vaza nada |
| Dashboard, dados, mapas, ativos, carrinhos/caixas, alertas, histórico | ❌ BLOQUEADO (esperado) | inalcançáveis sem login — consequência direta de não haver backend, não um bug destas telas (já testadas exaustivamente contra o backend local em `UI-E2E-VALIDATION.md`) |
| Logout | N/A | não dá pra testar logout de uma sessão que nunca autenticou |
| URL São João carrega | ✅ PASS | `/sao-joao` resolve via rewrite SPA, mostra o shell normal |
| URL Afrin/Zaffari carrega | ✅ PASS | `/grupo-zaffari` idem |
| Isolamento: trocar slug na URL não concede acesso | ✅ PASS | verificado ao vivo antes do deploy (mesmo código); estruturalmente impossível dar acesso via URL, porque a URL nunca é lida por nenhuma rota da API — só o RBAC/JWT decide dado |
| Logs por erros | ✅ verificado | console do navegador limpo (sem exceção JS); a única "falha" visível é o próprio fetch de login demorando ~8s pra desistir (timeout de DNS do domínio placeholder — comportamento do domínio de teste escolhido, não do código) |

---

## 5. Isolamento multi-tenant — o que este deploy prova e o que não prova

**Prova** (nível de roteamento/URL, testado ao vivo): trocar
`sao-joao` → `grupo-zaffari` na URL nunca concede acesso a nada — a URL é
puramente cosmética, sem nenhum caminho de código que leia o slug pra
decidir autorização.

**Não prova** (porque não há backend pra testar): que o *dado* de São
João e Grupo Zaffari continua isolado em produção — essa prova já existe,
mas foi feita contra o **backend local** (`RBAC-SECURITY-GATE.md`: 12/12
ataques bloqueados; `server/api/rbac.test.ts`: 22 testes automatizados
rodando a cada `npm run test`). O mecanismo é o mesmo código que seria
publicado no Railway — não muda pelo deploy do frontend — mas
tecnicamente não foi reexecutado contra uma API "de produção" porque ela
não existe ainda.

---

## 6. Problemas encontrados

1. **`vercel link` corrompeu `vercel.json`** (§3.2) — encontrado e
   corrigido antes do deploy real, não impactou a URL pública.
2. **Mensagem de erro de login não distingue "API fora do ar" de "senha
   errada"** — achado nesta rodada, não corrigido (o comportamento
   correto — "servidor indisponível, tente novamente" vs. "credenciais
   inválidas" — exigiria o frontend inspecionar o *tipo* de erro do
   `fetch` em `apiFetch()`/`supabaseClient.ts`, hoje tudo cai no mesmo
   texto genérico). Não é um bug introduzido por este deploy (o mesmo
   comportamento já existia localmente sempre que a API estava fora do
   ar), só ficou mais visível aqui porque é o estado permanente deste
   ambiente até o backend existir. Fica como pendência.
3. **Sem backend publicado** — bloqueador conhecido e confirmado por você
   antes de eu prosseguir, não é uma falha desta rodada.

---

## 7. Testes (reexecutados antes do deploy, mesmo resultado do gate anterior)

- `npm run lint`: PASS
- `npm run test`: 52/52 PASS
- `npm run build`: PASS (idêntico ao que rodou na Vercel)
- Nenhum segredo, chave ou token aparece neste relatório — confirmado por
  revisão antes de salvar o arquivo.

---

## 8. Próximos passos pra "PRODUCTION: READY" de verdade

1. Publicar a API (`server/api`) na Railway — 3 serviços já configurados
   no repo (`railway.api.json`, `railway.brgps-sync.json`,
   `railway.gt06-listener.json`), só falta o deploy real (fora do escopo
   autorizado neste prompt — "Ainda não fazer deploy na Vercel" virou
   "faça", mas Railway nunca foi mencionado).
2. Atualizar `VITE_API_URL` na Vercel (`Production`/`Preview`) pra a URL
   pública real da API assim que ela existir, e rodar `vercel deploy
   --prod` de novo (ou push — o projeto já está conectado ao GitHub).
3. Rodar este mesmo smoke test de novo com login real — essa é a hora de
   validar São João/Afrin ponta a ponta contra produção de verdade.
4. Resolver a pendência §6.2 (mensagem de erro genérica) se quiser uma UX
   melhor pro dia em que a API cair de verdade em produção.

**Sem deploy na Vercel além do que já foi feito.** Deploy na Railway não
foi executado (fora do escopo deste prompt, e sem credenciais/acesso
Railway configurados neste ambiente).
