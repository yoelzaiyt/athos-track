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

# Two triggers: AtLogOn covers the normal case, and a repeating trigger every
# 5 minutes re-arms the daemon if it ever dies for a reason that does not
# involve a fresh logon (observed once during development: the daemon process
# was gone entirely, with no corresponding logon event, cause unconfirmed).
# MultipleInstances=IgnoreNew means a live daemon is left alone - Task
# Scheduler only starts a new one when the previous run has actually ended.
$logonTrigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$repeatTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)

$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
    -DontStopOnIdleEnd -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -StartWhenAvailable -MultipleInstances IgnoreNew

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @($logonTrigger, $repeatTrigger) `
    -Settings $settings -Description 'Continuous BRGPS sync (ATHOS Track) - restarts itself on logon and re-arms every 5min if it ever dies.' | Out-Null

Write-Output ("Task '" + $taskName + "' registered. Triggers: logon of " + $env:USERNAME + ", plus a 5min re-arm check.")
