# MAP-LIVE-UPDATE-EVIDENCE.md

## A causa raiz de "nenhuma movimentação aparece no mapa" — duas falhas reais, não uma

### Falha 1 (camada G — Backend live): nenhum processo de polling contínuo rodava

`Get-ScheduledTask -TaskName "ATHOS-BRGPS-Sync"` não retornou nada — a task nunca tinha sido instalada em nenhuma máquina. O único código que já existia (`scripts/brgps-sync-daemon.ps1` + `scripts/install-brgps-sync-task.ps1`) ficou pronto desde 2026-09-06 mas nunca ativado, e mesmo se estivesse rodando, só cobria a conta 1 (`npm run brgps:sync`, sem `--account=2`) — a conta que serve as 10 tags Zaffari nunca teria sido consultada.

**Evidência**: nenhuma tag tinha posição atualizada nos ~45 minutos entre o `sync-once` manual da sessão anterior e o início desta sessão.

**Correção**: `scripts/brgps-sync-daemon.ps1` agora aceita `-Account 1|2`; `scripts/install-brgps-sync-task.ps1` registra as duas tasks. **Registro da Scheduled Task foi bloqueado pelo classificador de permissões desta sessão (mudança persistente de sistema operacional, exige aprovação explícita do usuário)** — ver seção "Pendência" abaixo. Nesta sessão, os dois loops (`npm run brgps:sync` e `npm run brgps:sync -- --account=2`) foram iniciados manualmente e ficaram rodando durante todo o teste.

### Falha 2 (camada G/H — ponte Backend→Frontend): LISTEN/NOTIFY nunca entregava nada

Mesmo com posição nova gravada no banco, o frontend só atualizava com F5 manual. Causa: `server/api/realtime.ts` fazia `LISTEN table_changes` usando `DATABASE_URL` — que no Supabase deste projeto é o **pooler PgBouncer em modo transação** (porta 6543). `LISTEN`/`NOTIFY` do Postgres não sobrevive a esse tipo de pool: a conexão física é reciclada entre clientes a cada transação, então um `NOTIFY` disparado depois do `LISTEN` nunca chega em quem escutou.

**Evidência real (teste isolado, 2026-09-10)**:
```
[DATABASE_URL(pooler:6543)] LISTEN issued, connection host/port from connString ok.
[DIRECT_URL(direct:5432)]   LISTEN issued, connection host/port from connString ok.
Disparando um UPDATE real em assets (toca updated_at de uma tag Zaffari, sem mudar posição)...
[DIRECT_URL(direct:5432)] NOTIFICATION RECEIVED: channel=table_changes payload_len=2164
--- RESULTADO ---
DATABASE_URL (pooler) recebeu notificação? false
DIRECT_URL (direto) recebeu notificação? true
```

**Correção**: `server/api/realtime.ts` passou a usar `DIRECT_URL` (porta 5432, sem pooler) — commit desta sessão. Confirmado end-to-end com um cliente Socket.io real (mesmo caminho do frontend):
```
[socket-e2e] conectado, socket id: q_Uciz7MOh8mU68IAAAB
[socket-e2e] disparando UPDATE real em assets (ZAF-CART-01)...
[socket-e2e] EVENTO RECEBIDO no cliente Socket.io: {"table":"assets","eventType":"UPDATE","code":"ZAF-CART-01",...}
[socket-e2e] RESULTADO: evento recebido no cliente? true
```

**Teste automático permanente**: `server/api/realtime.test.ts` — sobe a API real, conecta um Socket.io real, dispara um `UPDATE` real, exige recebimento em até 5s. Roda em todo `npm test`, trava a regressão pra sempre (não só documenta — falha o build se alguém trocar de volta pra `DATABASE_URL`).

## Mecanismo de atualização (seção 22 do brief)

Confirmado no código (`src/context/AssetContext.tsx`): busca uma vez ao montar + assinatura de push via Socket.io (não é polling do frontend, não é Supabase Realtime nativo — é um LISTEN/NOTIFY→Socket.io próprio, documentado de forma desatualizada em `docs/integrations/BRGPS.md` como "Supabase Realtime", corrigido nesta sessão — ver `PROVIDER-DOCUMENTATION-VALIDATION.md`). Assets com `provider` preenchido (reais) **nunca** são tocados pela simulação client-side de 4s — só a assinatura de push os atualiza. Antes da correção da Falha 2, isso significava, na prática, "nunca atualiza sozinho". Depois da correção, atualiza no instante em que o `UPDATE` acontece no banco (latência de rede + Socket.io, não de polling do navegador).

## Pendência que precisa da sua decisão

`Register-ScheduledTask` foi bloqueado pelo modo automático desta sessão (ação de sistema operacional persistente). Os dois loops de sync estão rodando **nesta sessão apenas** — se o terminal/sessão for encerrado, eles param, e as tags voltam a não atualizar sozinhas. Pra isso sobreviver a reinício de máquina/sessão, rode você mesmo (ou autorize explicitamente):
```
powershell -File scripts/install-brgps-sync-task.ps1
```
