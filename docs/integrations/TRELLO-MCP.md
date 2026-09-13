# Trello via MCP — instalado, **aguardando credenciais**

> Integração de **ferramental**, não de produto: liga o Claude Code ao board
> Trello do projeto pra ler/criar cards, listas e checklists durante as sessões.
> Não faz parte do runtime do ATHOS Track — nenhum código de `server/` ou
> `src/` depende disso, e nada aqui roda em produção.
>
> Board alvo: [ATHOS TRACK](https://trello.com/b/ZVnpidZi/athos-track)
> (short link `ZVnpidZi`), padronizado em `Em andamento` → `Revisão/Teste` →
> `Finalizado`. Registrado em 2026-09-12.

## Estado atual

| Item | Estado |
|---|---|
| Pacote MCP escolhido | `@delorenj/mcp-server-trello@1.8.1` — ✅ baixado e cache do npx aquecido |
| Compatibilidade com Node 24.16.0 | ✅ verificada (o binário sobe e falha só por falta de env) |
| Script de instalação | ✅ `scripts/install-trello-mcp.ps1` (UTF-8 BOM, parse validado no pwsh 7 e 5.1, caminho de falha testado) |
| `TRELLO_API_KEY` / `TRELLO_TOKEN` | ❌ **não gerados ainda** — único passo pendente, depende do login do usuário |
| Provisionamento das listas de workflow | ✅ implementado e testado em 3 cenários (seco, com API simulada) |
| Servidor registrado no Claude Code | ❌ ainda não (o script recusa registrar sem credencial válida) |
| Listas criadas no board real | ❌ ainda não — depende do token |

## Por que este pacote

Existem dois no npm. `mcp-server-trello` (sem escopo) está em 1.0.4 e parado;
`@delorenj/mcp-server-trello` está em 1.8.1, expõe 57 ferramentas (cards, listas,
checklists, anexos, comentários, custom fields, workspaces), tem rate limiting
embutido e roda com `npx` sem exigir `bun` instalado — que é o nosso caso, já que
esta máquina não tem `bun`.

`@modelcontextprotocol/server-trello` **não existe** (404 no registry); não caia
nessa suposição.

## Credenciais — como gerar

1. https://trello.com/power-ups/admin → `Criar novo Power-Up`
2. Aba **API Key** → `Gerar nova chave de API` → copiar a chave (~32 chars)
3. No link **`Token`** ao lado da chave → `Permitir` → copiar o token (~64+ chars)

Escopo do token: **conta inteira**, leitura e escrita — não dá pra emitir um
token restrito a um único board pela UI do Trello. Se isso incomodar, o servidor
aceita `TRELLO_ALLOWED_WORKSPACES=<id1>,<id2>` pra limitar o alcance por
workspace depois do registro.

## Instalação

```powershell
powershell -File scripts/install-trello-mcp.ps1
# ou, não-interativo:
powershell -File scripts/install-trello-mcp.ps1 -ApiKey <key> -Token <token>
```

O script executa, nesta ordem, e **aborta no primeiro erro sem registrar nada**:

1. localiza o `npx.cmd` (fallback para `C:\Program Files\nodejs\npx.cmd`)
2. valida as credenciais em `GET /1/members/me` — 401 aqui encerra tudo
3. resolve o **id real de 24 chars** do board a partir do short link `ZVnpidZi`
4. provisiona as listas `Em andamento` / `Revisão/Teste` / `Finalizado`
5. `claude mcp add trello --scope user` com as 3 env vars
6. smoke test: lista as colunas do board e conta os cards de cada uma

O passo 3 existe porque o short link (`ZVnpidZi`) e o id canônico do board são
coisas diferentes; gravar o short link em `TRELLO_BOARD_ID` funciona em alguns
endpoints e quebra em outros. Resolvemos uma vez e gravamos a forma canônica.

## Listas de workflow

O board é padronizado em três colunas, provisionadas pelo próprio instalador:

```
Em andamento  ->  Revisão/Teste  ->  Finalizado
```

O provisionamento é **idempotente e não-destrutivo**:

- compara os nomes **sem acento e sem caixa**, então uma `Revisao/Teste` que já
  exista escrita sem acento é reconhecida e **não** vira uma duplicata;
- cria só o que falta, anexando ao final (`pos` = maior atual + 16384);
- **nunca** renomeia, reordena ou arquiva lista existente — colunas próprias do
  board (um `Backlog`, por exemplo) ficam intactas.

Testado nos três cenários antes da entrega: board vazio (cria 3), board que já
tem as três em grafia diferente (cria 0), board parcial com lista alheia
(cria só as 2 que faltam, preserva a alheia).

Para mudar os nomes ou pular a etapa:

```powershell
# outros nomes
powershell -File scripts/install-trello-mcp.ps1 -Workflow 'A fazer','Em andamento','Concluído'

# ver o plano sem escrever nada no Trello
powershell -File scripts/install-trello-mcp.ps1 -WhatIfLists

# não mexer nas listas, só registrar o MCP
powershell -File scripts/install-trello-mcp.ps1 -SkipLists
```

## Onde as credenciais ficam

Escopo `user` → `C:\Users\wordi\.claude.json`.

Isso é **fora de qualquer repositório git**, então o token não entra em commit.
Não coloque as chaves no `.env` deste projeto: o `.gitignore` cobre `.env*`
(linha 7), mas o MCP é global da máquina e não do repo — o lugar certo é o
escopo user.

## Configuração resultante

```json
{
  "mcpServers": {
    "trello": {
      "command": "C:\Program Files\nodejs\npx.cmd",
      "args": ["-y", "@delorenj/mcp-server-trello@1.8.1"],
      "env": {
        "TRELLO_API_KEY": "<key>",
        "TRELLO_TOKEN": "<token>",
        "TRELLO_BOARD_ID": "<id canônico resolvido no passo 3>"
      }
    }
  }
}
```

O caminho completo do `npx.cmd` é intencional, não preguiça: é o mesmo padrão já
usado pelo `mobile-mcp` nesta máquina, porque o MCP sobe num ambiente sem o PATH
do shell interativo e o `npx` pelado não resolve.

`TRELLO_BOARD_ID` é só o **default** — as ferramentas aceitam um `boardId` por
chamada, então outros boards continuam acessíveis.

## Verificação pós-instalação

```powershell
claude mcp list          # deve mostrar 'trello: ... - Connected'
```

Se aparecer `Failed to connect`, rode o binário na mão pra ver o erro real:

```powershell
$env:TRELLO_API_KEY='<key>'; $env:TRELLO_TOKEN='<token>'
npx -y @delorenj/mcp-server-trello@1.8.1
```

Sem as env vars ele morre com
`Error: TRELLO_API_KEY and TRELLO_TOKEN environment variables are required` —
esse erro específico significa que as env não chegaram ao processo, não que a
credencial está errada.

## Desinstalar

```powershell
claude mcp remove trello --scope user
```

Revogue o token em https://trello.com/my/account → seção **Tokens**.
Remover o MCP **não** revoga o token.
