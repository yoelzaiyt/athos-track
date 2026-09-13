# Registers the Trello MCP server (@delorenj/mcp-server-trello) into Claude Code
# at USER scope, so every session on this machine can read/write Trello boards.
#
# The script refuses to register anything until both credentials are proven
# valid against the live Trello API, and it resolves the ATHOS TRACK board's
# real 24-char id from its short link instead of trusting the short form.
#
# It also provisions the workflow lists (Em andamento / Revisão-Teste /
# Finalizado) on that board, idempotently: it never renames, reorders or deletes
# a list that is already there - it only appends the ones that are missing.
#
# Credentials are written to %USERPROFILE%\.claude.json (user scope), which is
# outside every git repository - nothing lands in a commit.
#
# Usage:
#   powershell -File scripts/install-trello-mcp.ps1
#   powershell -File scripts/install-trello-mcp.ps1 -ApiKey abc... -Token def...
#   powershell -File scripts/install-trello-mcp.ps1 -SkipLists
#   powershell -File scripts/install-trello-mcp.ps1 -WhatIfLists   # so mostra o plano

param(
    [string]$ApiKey,
    [string]$Token,
    [string]$BoardShortLink = 'ZVnpidZi',   # https://trello.com/b/ZVnpidZi/athos-track
    [string]$ServerName     = 'trello',
    [string]$Package        = '@delorenj/mcp-server-trello@1.8.1',
    [string[]]$Workflow     = @('Em andamento', 'Revisão/Teste', 'Finalizado'),
    [switch]$SkipLists,
    [switch]$WhatIfLists
)

$ErrorActionPreference = 'Stop'
$api = 'https://api.trello.com/1'

function Fail($msg) { Write-Host "  FALHOU: $msg" -ForegroundColor Red; exit 1 }
function Ok($msg)   { Write-Host "  OK: $msg" -ForegroundColor Green }
function Step($n, $msg) { Write-Host "`n[$n] $msg" -ForegroundColor Cyan }

# Compara nomes sem acento e sem caixa, pra nao criar uma "Revisão/Teste"
# duplicando uma "Revisao/Teste" que ja exista escrita sem acento.
function Norm($t) {
    $chars = ([string]$t).Normalize([Text.NormalizationForm]::FormD).ToCharArray() |
        Where-Object { [Globalization.CharUnicodeInfo]::GetUnicodeCategory($_) -ne 'NonSpacingMark' }
    (-join $chars).ToLowerInvariant().Trim()
}

# --- 0. credenciais -------------------------------------------------------
if (-not $ApiKey) { $ApiKey = Read-Host 'TRELLO_API_KEY' }
if (-not $Token)  { $Token  = Read-Host 'TRELLO_TOKEN'   }
$ApiKey = $ApiKey.Trim(); $Token = $Token.Trim()
if (-not $ApiKey -or -not $Token) { Fail 'API key e token sao obrigatorios.' }

$auth = "key=$ApiKey&token=$Token"

# --- 1. npx ---------------------------------------------------------------
Step 1 'Localizando o npx'
$npx = (Get-Command npx.cmd -ErrorAction SilentlyContinue).Source
if (-not $npx) { $npx = 'C:\Program Files\nodejs\npx.cmd' }
if (-not (Test-Path $npx)) { Fail "npx.cmd nao encontrado em '$npx'. Instale o Node.js." }
Ok $npx

# --- 2. validar credenciais ----------------------------------------------
Step 2 'Validando credenciais contra a API do Trello'
try {
    $me = Invoke-RestMethod -Uri "$api/members/me?$auth" -Method Get
} catch {
    Fail "credenciais rejeitadas pelo Trello ($($_.Exception.Message)). Confira a key e gere um token novo."
}
Ok "autenticado como '$($me.username)' ($($me.fullName))"

# --- 3. resolver o id real do board --------------------------------------
Step 3 "Resolvendo o board '$BoardShortLink'"
try {
    $board = Invoke-RestMethod -Uri "$api/boards/$BoardShortLink`?fields=id,name,url&$auth" -Method Get
} catch {
    Fail "nao consegui ler o board '$BoardShortLink' ($($_.Exception.Message)). O token tem acesso a ele?"
}
$boardId = $board.id
Ok "$($board.name) -> $boardId"

# --- 4. provisionar as listas de workflow --------------------------------
Step 4 'Provisionando as listas de workflow'
$existing = @(Invoke-RestMethod -Uri "$api/boards/$boardId/lists?fields=name,id,pos&$auth" -Method Get)
Write-Host ("  board hoje: " + $(if ($existing) { ($existing.name -join ' | ') } else { '(nenhuma lista)' })) -ForegroundColor DarkGray

if ($SkipLists) {
    Write-Host '  pulado (-SkipLists)' -ForegroundColor Yellow
} else {
    $pos = 0
    if ($existing) { $pos = ($existing | Measure-Object -Property pos -Maximum).Maximum }
    foreach ($name in $Workflow) {
        $hit = $existing | Where-Object { (Norm $_.name) -eq (Norm $name) } | Select-Object -First 1
        if ($hit) {
            Write-Host ("  = ja existe: {0}" -f $hit.name) -ForegroundColor DarkGray
        } elseif ($WhatIfLists) {
            Write-Host ("  ~ criaria:   {0}" -f $name) -ForegroundColor Yellow
        } else {
            $pos += 16384
            $new = Invoke-RestMethod -Uri "$api/lists?$auth" -Method Post -Body @{
                name = $name; idBoard = $boardId; pos = $pos
            }
            Write-Host ("  + criada:    {0}" -f $new.name) -ForegroundColor Green
            $existing += $new
        }
    }
}

# --- 5. registrar o MCP ---------------------------------------------------
Step 5 "Registrando o MCP '$ServerName' no escopo user"
& claude mcp remove $ServerName --scope user 2>$null | Out-Null
& claude mcp add $ServerName `
    --scope user `
    -e "TRELLO_API_KEY=$ApiKey" `
    -e "TRELLO_TOKEN=$Token" `
    -e "TRELLO_BOARD_ID=$boardId" `
    -- $npx -y $Package
if ($LASTEXITCODE -ne 0) { Fail "'claude mcp add' retornou $LASTEXITCODE." }
Ok "registrado ($Package via npx)"

# --- 6. smoke test --------------------------------------------------------
Step 6 'Smoke test: estado final do board'
$lists = @(Invoke-RestMethod -Uri "$api/boards/$boardId/lists?fields=name,id&$auth" -Method Get)
foreach ($l in $lists) {
    $n = @(Invoke-RestMethod -Uri "$api/lists/$($l.id)/cards?fields=id&$auth" -Method Get).Count
    Write-Host ("  - {0,-28} {1} card(s)" -f $l.name, $n)
}

Write-Host "`nPronto. Reinicie o Claude Code e rode 'claude mcp list' para confirmar." -ForegroundColor Green
Write-Host "Board padrao:       $($board.name) ($boardId)"
Write-Host "Listas de workflow: $($Workflow -join ' -> ')"
