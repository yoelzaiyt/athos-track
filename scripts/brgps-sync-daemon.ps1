# Auto-restart wrapper for the BRGPS sync process (server/brgps-sync/index.ts sync).
# Not a real Windows service - just a loop that restarts the process if it
# exits (crash, fatal error, etc). Registered as a Scheduled Task (see
# scripts/install-brgps-sync-task.ps1) so it also comes back on logon/boot
# without needing an open terminal.
#
# Manual use (without installing the task): powershell -File scripts/brgps-sync-daemon.ps1

$ErrorActionPreference = 'Continue'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$logDir = Join-Path $projectRoot 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir 'brgps-sync.log'

function Write-Log($msg) {
    $line = "[" + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + "] " + $msg
    Add-Content -Path $logFile -Value $line
}

Write-Log "daemon started (auto-restart enabled)"

while ($true) {
    Write-Log "starting 'npm run brgps:sync'..."
    # Via cmd.exe /c: Start-Process does not reliably launch .cmd/.bat (npm.cmd)
    # when stdout/stderr are redirected.
    $proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm run brgps:sync" `
        -WorkingDirectory $projectRoot -NoNewWindow -PassThru `
        -RedirectStandardOutput (Join-Path $logDir 'brgps-sync.out.log') `
        -RedirectStandardError (Join-Path $logDir 'brgps-sync.err.log')

    Wait-Process -Id $proc.Id -ErrorAction SilentlyContinue

    Write-Log ("process exited (code " + $proc.ExitCode + ") - restarting in 5s...")
    Start-Sleep -Seconds 5
}
