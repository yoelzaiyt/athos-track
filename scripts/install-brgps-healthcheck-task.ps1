# Registers a Windows Scheduled Task that runs the BRGPS health check
# (scripts/brgps-health-check.ps1) every 6 hours, while the user is logged
# on. Only pops a notification when something is actually wrong (status !=
# HEALTHY or the last successful sync is older than 120s) - does not spam on
# every successful run.
#
# Usage: powershell -File scripts/install-brgps-healthcheck-task.ps1

$ErrorActionPreference = 'Stop'
$taskName = 'ATHOS-BRGPS-HealthCheck'
$checkScript = Join-Path $PSScriptRoot 'brgps-health-check.ps1'

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument ('-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $checkScript + '"')

$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Hours 6) -RepetitionDuration (New-TimeSpan -Days 3650)

$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 5) `
    -DontStopOnIdleEnd -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -StartWhenAvailable -MultipleInstances IgnoreNew

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
    -Settings $settings -Description 'Checks BRGPS sync health every 6h and notifies on failure (ATHOS Track).' | Out-Null

Write-Output ("Task '" + $taskName + "' registered. Runs every 6h while logged on.")
