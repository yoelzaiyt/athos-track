# SOCKET-TENANT-ISOLATION.md

Seções 20/21 do brief: Socket.io tem que respeitar tenant, nunca só o filtro do frontend.

## Arquitetura já existente (não recriada — verificada)

`server/api/realtime.ts` já usava rooms por tenant antes desta sessão:
- Autenticação do socket exige JWT válido (`authenticateSocket`), mesmo formato da API REST.
- `ATHOS_ADMIN` entra na room `admins` (recebe tudo, por design — administra múltiplos tenants).
- Qualquer outro papel entra em `client:<client_id>` — só a própria empresa.
- Cada evento é emitido só pra `io.to(tenantRoom(clientId)).to('admins')` — nunca broadcast geral. Linha que resolve o `clientId` do evento (`resolveClientId`) já existia e cobre `system_alerts` (sem client_id direto, resolvido via `assets`).

**Autorização acontece no servidor**, não no frontend — o filtro por tenant do React (`selectedClientId` no AuthContext) é só UX; mesmo que alguém abra o DevTools e ignore esse filtro, o servidor não manda a linha de outro tenant pro socket dele.

## Teste real desta sessão (novo)

`server/api/realtime.test.ts`, 2 testes novos, nenhum mock:

1. Dois usuários reais (`VIEWER` Zaffari e `VIEWER` São João), login real, socket real conectado com JWT real.
2. `UPDATE` real num asset Zaffari (`3092524960`) — usuário Zaffari recebe o evento, usuário São João **não recebe nada** em 4s + 1,5s de janela extra pra pegar vazamento tardio.
3. Repetido no sentido inverso: `UPDATE` num asset São João (`3092524777`) — só o usuário São João recebe.

```
✓ usuário SÃO JOÃO nunca recebe evento de asset do ZAFFARI
✓ usuário ZAFFARI nunca recebe evento de asset do SÃO JOÃO
```

Ambos passando (`npm test`, 63/63). Isso é adicional ao isolamento já validado via REST (`TENANT-ISOLATION-EVIDENCE.md`, sessão anterior) — aqui é especificamente a camada Socket.io/rooms, que é um caminho de dado diferente (LISTEN/NOTIFY, não o proxy REST).

## O que não foi alterado

Nenhuma mudança em `server/api/realtime.ts` além da correção de `DATABASE_URL` → `DIRECT_URL` (documentada em `MAP-LIVE-UPDATE-EVIDENCE.md`, sessão anterior) — o isolamento por room já estava correto e só precisou de teste real comprovando, não de novo código.
