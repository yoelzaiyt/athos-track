# Registers the BRGPS sync daemon (scripts/brgps-sync-daemon.ps1) as a
# Windows Scheduled Task triggered at the current user's logon - so it comes
# back on its own after reboot/logoff without needing an open terminal.
# Restart-on-crash of the sync process itself is handled by the daemon's own
# loop; this task only makes sure the daemon exists again after reboot.
#
# Registers TWO tasks, one per BRGPS account - achado ao vivo em 2026-09-10:
# antes desta correcao so existia UMA task cobrindo a conta 1 (Sao Joao), e
# nem essa tinha sido instalada de verdade (Get-ScheduledTask nao encontrou
# nada). Isso sozinho explicava "nenhuma tag movimenta no mapa": ninguem
# perguntava ao fornecedor por posicao nova. A conta 2 (China, Zaffari) so
# roda se BRGPS2_ENABLED=true no .env - a task e registrada de qualquer
# forma, mas o processo dela mesmo sai de imediato se a conta 2 nao estiver
# habilitada (mesmo comportamento de "npm run brgps:sync -- --account=2"
# hoje).
#
# Usage: powershell -File scripts/install-brgps-sync-task.ps1

$ErrorActionPreference = 'Stop'
$daemonScript = Join-Path $PSScriptRoot 'brgps-sync-daemon.ps1'

function Install-SyncTask($taskName, $account, $description) {
    $daemonArgs = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $daemonScript + '" -Account ' + $account
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $daemonArgs

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
        -Settings $settings -Description $description | Out-Null

    Write-Output ("Task '" + $taskName + "' registered (conta " + $account + "). Triggers: logon of " + $env:USERNAME + ", plus a 5min re-arm check.")
}

Install-SyncTask 'ATHOS-BRGPS-Sync' '1' 'Continuous BRGPS sync, conta 1/Sao Joao (ATHOS Track) - restarts itself on logon and re-arms every 5min if it ever dies.'
Install-SyncTask 'ATHOS-BRGPS-Sync-2' '2' 'Continuous BRGPS sync, conta 2/Zaffari, China (ATHOS Track) - restarts itself on logon and re-arms every 5min if it ever dies. No-op se BRGPS2_ENABLED != true.'
