# ATHOS Track

Plataforma multi-tenant de rastreamento de ativos (carrinhos, caixas, frota,
empilhadeiras, agro) com ingestão de provedores de GPS/BLE, mapa ao vivo e realtime
via Socket.IO.

## Rodando localmente

**Pré-requisitos:** Node.js

```bash
npm install       # dependências
npm run dev       # frontend (Vite)
npm run api:dev   # API + Socket.IO
```

Configure o `.env` a partir de `.env.example`. Variáveis principais:
`DATABASE_URL` e `DIRECT_URL` (mesmo valor — ver abaixo), `APP_DATABASE_URL`
(role com RLS real), `BRGPS_ENABLED` / `BRGPS2_ENABLED` e seus tokens.

**Banco único:** o projeto usa um só Postgres, o do Railway (projeto
`athos-track`, serviço `Postgres`). O Supabase foi descontinuado — o app
nunca usou SDK/Auth/REST dele, só o Postgres. Dentro do Railway o próprio
platform injeta `DATABASE_URL` (host privado `postgres.railway.internal`);
de fora, é preciso o TCP Proxy do serviço Postgres para ter um host público.
Como não há pooler separado, `DATABASE_URL` e `DIRECT_URL` recebem a mesma
string.

## Documentação

| Assunto | Documento |
|---|---|
| Mapa — engines V1/V2, basemaps, realtime, clustering, geofence | [docs/MAP-ARCHITECTURE.md](docs/MAP-ARCHITECTURE.md) |
| Tags — inventário, ingestão BRGPS, latência, bugs conhecidos | [docs/TAG-INTEGRATION.md](docs/TAG-INTEGRATION.md) |
| Multi-tenant, RBAC, isolamento | [docs/MULTI-TENANT-ARCHITECTURE.md](docs/MULTI-TENANT-ARCHITECTURE.md) |
| Banco único no Railway, o que ficou fora e como alcançar produção | [docs/DATABASE-CONSOLIDATION.md](docs/DATABASE-CONSOLIDATION.md) |
| Arquitetura de providers | [docs/PROVIDER-ARCHITECTURE.md](docs/PROVIDER-ARCHITECTURE.md) |
| Catálogo de hardware | [docs/HARDWARE-CATALOG.md](docs/HARDWARE-CATALOG.md) |
| Integrações por fornecedor | [docs/integrations/](docs/integrations/) |
| Relatórios de sessão e evidências históricas | [docs/archive/](docs/archive/README.md) |

Ao trabalhar numa dessas áreas, **atualize o documento vivo correspondente** em vez de
criar um relatório novo — foi assim que a raiz do repo acumulou 48 arquivos `.md`.
