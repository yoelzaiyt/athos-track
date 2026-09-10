# Auto-restart wrapper for the BRGPS sync process (server/brgps-sync/index.ts sync).
# Not a real Windows service - just a loop that restarts the process if it
# exits (crash, fatal error, etc). Registered as a Scheduled Task (see
# scripts/install-brgps-sync-task.ps1) so it also comes back on logon/boot
# without needing an open terminal.
#
# -Account 2 runs the second BRGPS account (China endpoint, BRGPS2_* env —
# ativada em 2026-09-10, serve as 10 tags Zaffari). Sem o parametro, roda a
# conta 1 (default, serve as tags Sao Joao) - mesmo comportamento de sempre.
# Achado ao vivo em 2026-09-10: nenhuma das duas contas tinha ESTE daemon
# rodando de verdade (a Scheduled Task nunca tinha sido instalada), entao
# nenhuma tag nunca recebia posicao nova sozinha - so quando alguem rodava
# sync-once manualmente. As duas contas precisam de UM daemon cada (duas
# Scheduled Tasks, ver install-brgps-sync-task.ps1), nao um so cobrindo as
# duas, porque "npm run brgps:sync" so aceita uma conta por processo.
#
# Manual use (without installing the task):
#   powershell -File scripts/brgps-sync-daemon.ps1              # conta 1
#   powershell -File scripts/brgps-sync-daemon.ps1 -Account 2   # conta 2

param(
    [ValidateSet('1', '2')]
    [string]$Account = '1'
)

$ErrorActionPreference = 'Continue'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$suffix = if ($Account -eq '2') { '-account2' } else { '' }
$npmArgs = if ($Account -eq '2') { 'npm run brgps:sync -- --account=2' } else { 'npm run brgps:sync' }

$logDir = Join-Path $projectRoot 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir ('brgps-sync' + $suffix + '.log')

function Write-Log($msg) {
    $line = "[" + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + "] " + $msg
    Add-Content -Path $logFile -Value $line
}

Write-Log ("daemon started for account " + $Account + " (auto-restart enabled)")

while ($true) {
    Write-Log ("starting '" + $npmArgs + "'...")
    # Via cmd.exe /c: Start-Process does not reliably launch .cmd/.bat (npm.cmd)
    # when stdout/stderr are redirected.
    $proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $npmArgs `
        -WorkingDirectory $projectRoot -NoNewWindow -PassThru `
        -RedirectStandardOutput (Join-Path $logDir ('brgps-sync' + $suffix + '.out.log')) `
        -RedirectStandardError (Join-Path $logDir ('brgps-sync' + $suffix + '.err.log'))

    Wait-Process -Id $proc.Id -ErrorAction SilentlyContinue

    Write-Log ("process exited (code " + $proc.ExitCode + ") - restarting in 5s...")
    Start-Sleep -Seconds 5
}
