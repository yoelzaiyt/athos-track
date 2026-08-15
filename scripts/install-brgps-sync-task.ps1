# Registers the BRGPS sync daemon (scripts/brgps-sync-daemon.ps1) as a
# Windows Scheduled Task triggered at the current user's logon - so it comes
# back on its own after reboot/logoff without needing an open terminal.
# Restart-on-crash of the sync process itself is handled by the daemon's own
# loop; this task only makes sure the daemon exists again after reboot.
#
# Usage: powershell -File scripts/install-brgps-sync-task.ps1

$ErrorActionPreference = 'Stop'
$taskName = 'ATHOS-BRGPS-Sync'
$daemonScript = Join-Path $PSScriptRoot 'brgps-sync-daemon.ps1'

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument ('-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $daemonScript + '"')

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
    -DontStopOnIdleEnd -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -StartWhenAvailable

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
    -Settings $settings -Description 'Continuous BRGPS sync (ATHOS Track) - restarts itself on logon.' | Out-Null

Write-Output ("Task '" + $taskName + "' registered. Trigger: logon of " + $env:USERNAME + ".")
