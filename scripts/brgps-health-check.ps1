# Runs the BRGPS health check (scripts/brgps-health-check.ts) and shows a
# Windows balloon notification if something is wrong. Meant to be triggered
# periodically by a Scheduled Task (see install-brgps-healthcheck-task.ps1).
# Stays quiet on success - only writes to the log and pops a notification on
# an actual ALERT, so it does not spam the user every run.

$ErrorActionPreference = 'Continue'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$logDir = Join-Path $projectRoot 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir 'brgps-health-alerts.log'

$output = & npm run --silent brgps:health-check 2>&1
$exitCode = $LASTEXITCODE
$timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

if ($exitCode -ne 0) {
    $line = "[$timestamp] $output"
    Add-Content -Path $logFile -Value $line

    Add-Type -AssemblyName System.Windows.Forms
    $notify = New-Object System.Windows.Forms.NotifyIcon
    $notify.Icon = [System.Drawing.SystemIcons]::Warning
    $notify.Visible = $true
    $notify.BalloonTipTitle = 'ATHOS Track - BRGPS Sync'
    $notify.BalloonTipText = "$output`nVeja: $logFile"
    $notify.BalloonTipIcon = 'Warning'
    $notify.ShowBalloonTip(15000)
    Start-Sleep -Seconds 16
    $notify.Dispose()
}
