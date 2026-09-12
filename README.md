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
`DATABASE_URL` (pooler) e `DIRECT_URL` (conexão direta — obrigatória para
LISTEN/NOTIFY), `BRGPS_ENABLED` / `BRGPS2_ENABLED` e seus tokens.

## Documentação

| Assunto | Documento |
|---|---|
| Mapa — engines V1/V2, basemaps, realtime, clustering, geofence | [docs/MAP-ARCHITECTURE.md](docs/MAP-ARCHITECTURE.md) |
| Tags — inventário, ingestão BRGPS, latência, bugs conhecidos | [docs/TAG-INTEGRATION.md](docs/TAG-INTEGRATION.md) |
| Multi-tenant, RBAC, isolamento | [docs/MULTI-TENANT-ARCHITECTURE.md](docs/MULTI-TENANT-ARCHITECTURE.md) |
| Arquitetura de providers | [docs/PROVIDER-ARCHITECTURE.md](docs/PROVIDER-ARCHITECTURE.md) |
| Catálogo de hardware | [docs/HARDWARE-CATALOG.md](docs/HARDWARE-CATALOG.md) |
| Integrações por fornecedor | [docs/integrations/](docs/integrations/) |
| Relatórios de sessão e evidências históricas | [docs/archive/](docs/archive/README.md) |

Ao trabalhar numa dessas áreas, **atualize o documento vivo correspondente** em vez de
criar um relatório novo — foi assim que a raiz do repo acumulou 48 arquivos `.md`.
