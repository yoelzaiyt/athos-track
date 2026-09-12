# Arquivo histórico

Relatórios de sessão e evidências de gate gerados entre 2026-08-28 e 2026-09-11.
São **snapshots de um momento específico** — a maioria já está desatualizada.
Estão aqui porque contêm a evidência bruta (payloads, contagens de request,
snapshots de banco, medições) que sustenta os documentos vivos.

**Não atualize nada aqui.** O estado atual do sistema está em:

| Assunto | Documento vivo |
|---|---|
| Mapa (engines, basemaps, realtime, clustering, geofence) | `docs/MAP-ARCHITECTURE.md` |
| Tags, ingestão BRGPS, latência | `docs/TAG-INTEGRATION.md` |
| Multi-tenant e RBAC | `docs/MULTI-TENANT-ARCHITECTURE.md` |
| Arquitetura de providers | `docs/PROVIDER-ARCHITECTURE.md` |
| Catálogo de hardware | `docs/HARDWARE-CATALOG.md` |
| Integrações por fornecedor | `docs/integrations/` |

Alguns comentários no código citam relatórios daqui pelo nome (ex.
`RBAC-SECURITY-GATE.md`, `SECURITY-GATE-REPORT.md`) — é neste diretório que eles estão.

## Conteúdo

**Mapa** — `MAP-401-ROOT-CAUSE.md`, `MAP-V1-AUDIT-BASELINE.md`,
`MAP-ENGINE-EVALUATION.md`, `MAP-V2-POC-REPORT.md`, `MAP-V2-REALTIME-EVIDENCE.md`,
`MAP-MARKER-VISIBILITY.md`, `MAP-NAVIGATION-REPORT.md`, `MAP-GEOFENCE-EVIDENCE.md`,
`MAP-LIVE-UPDATE-EVIDENCE.md`, `MAP-REALTIME-LIVE-OBSERVATION.md`,
`MAP-PERFORMANCE-REPORT.md`, `MAP-SECURITY-GATE.md`, `MAP-OPEN-SOURCE-LICENSES.md`,
`OPERATIONAL-MAP-ARCHITECTURE.md`, `MAP-OPERATIONAL-REFINEMENT-REPORT.md`,
`REALTIME-MAP-EVIDENCE.md`

**Tags e providers** — `10-TAGS-LIVE-AUDIT.md`, `TAG-REGISTRY-EVIDENCE.md`,
`TAG-CONNECTIVITY-MATRIX.md`, `TAG-FREQUENCY-REPORT.md`, `TAG-SECURITY-REPORT.md`,
`ATHOS-TRACK-TAG-INTEGRATION-REPORT.md`, `ATHOS-TRACK-LIVE-TAG-VALIDATION.md`,
`ATHOS-TRACK-LIVE-12-TAGS-REPORT.md`, `LIVE-TAG-TEST-PLAN.md`,
`LIVE-POSITION-EVIDENCE.md`, `MOVEMENT-TEST-REPORT.md`, `LOCATION-ACCURACY-REPORT.md`,
`PROVIDER-API-INTEGRATION.md`, `PROVIDER-INGESTION-MODE.md`,
`PROVIDER-DOCUMENTATION-VALIDATION.md`, `MULTI-PROVIDER-VALIDATION.md`,
`DIRECT-TRACKING-INVESTIGATION-REPORT.md`, `DATA-FLOW-REAL-ARCHITECTURE.md`

**Latência** — `END-TO-END-LATENCY.md`, `LIVE-LATENCY-REPORT.md`

**Segurança e tenant** — `SECURITY-GATE-REPORT.md`, `RBAC-SECURITY-GATE.md`,
`ATTACK-SURFACE.md`, `TENANT-ISOLATION-EVIDENCE.md`, `TENANT-MANAGER-REPORT.md`,
`SOCKET-TENANT-ISOLATION.md`

**Gates de release** — `FINAL-PRE-PRODUCTION-GATE.md`,
`FINAL-END-TO-END-VALIDATION-REPORT.md`, `HOMOLOGATION-READINESS-REPORT.md`,
`PRODUCTION-DEPLOY-REPORT.md`, `UI-E2E-VALIDATION.md`,
`OPERATIONAL-REFINEMENT-REPORT.md`
