# Catálogo de hardware GPS/BLE — referência de fabricantes/modelos

> Documento de referência, não de arquitetura de integração — cataloga os
> datasheets/manuais recebidos de fornecedores ao longo da homologação de tags
> físicas (sessão de 2026-09-04/05), pra evitar reabrir a mesma investigação
> pra cada tag nova. Ver `docs/integrations/` pros conectores que já têm
> código real (BRGPS/Jason/Heile) ou estão desenhados mas não implementados
> (F30/GPSONE, Car Here System).

## Como usar este catálogo

Antes de tentar homologar uma tag física nova:
1. Fotografe a etiqueta/QR code e o formato físico do dispositivo.
2. Compare o formato físico com a tabela abaixo.
3. Se bater com um modelo já catalogado, use os comandos/endpoints já
   documentados em vez de reabrir a investigação do zero.
4. Se não bater com nada, colete o datasheet/manual real do fornecedor antes
   de tentar comandos "genéricos GT06" — comandos SMS variam por modelo/firmware
   e um comando errado pode não ter efeito nenhum sem aviso claro.

## Modelos catalogados

### 1. "Air Tag" formato disco (BRGPS/Jason/Heile)

- **Formato físico**: disco preto redondo, ~35mm diâmetro, etiqueta circular
  com QR code + número de 10 dígitos (ex: `1603000067`, `3092660181`).
- **Sem porta visível, sem fios** — bateria interna.
- **Uso pretendido (confirmado 2026-09-06)**: rastreamento de **carrinhos e
  ativos** — ambas as tags físicas em homologação (`1603000067` e
  `3092660181`) são pra esse caso de uso, não veículos/rebanho.
- **Backend confirmado**: BRGPS Open API (`http://www.brgps.com/open`) — ver
  `docs/integrations/BRGPS.md`. Identificador usado pela API é só `id`
  (numérico) — API nunca expõe IMEI/ICCID/serial em nenhuma resposta.
- **Status de homologação**: `1603000067` tem histórico real de posição no
  nosso banco (mas coordenadas Tailândia/China — dado de demonstração do
  fornecedor, não confirmado como unidade física em uso real). `3092660181`
  nunca apareceu na API, em nenhum formato de ID testado, mesmo com o
  dispositivo fisicamente ligado.

- **Hipótese forte (2026-09-06): IDs de demonstração podem se repetir entre
  contas BRGPS distintas.** Recebemos dois `api_token` novos nesta sessão
  (um pra "3092524777", outro rotulado como sendo de `1603000067`) — ambos
  autenticam com sucesso, mas:
  - o token novo rotulado `1603000067` retornou posição em **Leipzig,
    Alemanha** (51.40, 12.24) — terceira localização diferente pro MESMO ID
    (depois de China e Tailândia/China já vistas antes);
  - no mesmo instante, o token JÁ configurado no projeto (`BRGPS_API_TOKEN`)
    consultado direto (`/tag?ids=1603000067`) devolveu `data: []` (nenhuma
    posição), mesmo reconhecendo o ID no catálogo.
  - Ou seja: contas BRGPS diferentes, tokens diferentes, o MESMO ID de tag,
    posições incompatíveis entre si e com o histórico já salvo. Consistente
    com a teoria de que o fornecedor pré-popula toda conta trial/demo com um
    ID de tag "de vitrine" com trajetória fictícia — não com o ID sendo
    exclusivo de uma unidade física real.
  - **Pendência**: confirmar com o fornecedor/vendedor se `1603000067` e
    `3092524777` correspondem de fato às tags físicas em mãos, antes de
    tratar qualquer uma dessas credenciais como produção. Código de suporte
    a múltiplas contas BRGPS já existe (`BRgpsRepository`/`BrgpsProvider`
    aceitam uma `providerKey`/`id` custom, `server/api/index.ts` já registra
    uma segunda instância opcional via `BRGPS2_*`, `server/brgps-sync`
    aceita `--account=2`) mas está **desativado** (`BRGPS2_ENABLED` não
    definido no `.env`) até essa confirmação.
  - **`3092524777` vinculado a um asset em 2026-09-06** (`Carrinho BRGPS
    3092524777`, código `CAR-03`, migration
    `supabase/migrations/20260906200000_link_brgps_3092524777_asset.sql`) —
    usando a conta BRGPS já configurada e confiável (não a `BRGPS2_*` ainda
    não confirmada, já que esse ID já existia no catálogo dessa conta desde
    08/2025). Sync validado ao vivo (posição aplicada em `assets`), pipeline
    BRGPS → Asset → banco funcionando ponta a ponta pra esse tag. A ressalva
    de dado de demonstração acima continua valendo — isso valida o cano
    técnico, não confirma que é a unidade física real.

  **Como ativar, assim que o fornecedor confirmar a tag real** (checklist,
  não precisa reabrir investigação nenhuma):
  1. No `.env`, preencher `BRGPS2_API_TOKEN` com o token confirmado e trocar
     `BRGPS2_ENABLED` pra `"true"` (`.env.example` já documenta as 3 chaves).
  2. Reiniciar a API (`npm run api:dev`/`api:start`) — `server/api/index.ts`
     registra a segunda conta automaticamente como provider `brgps2`.
  3. `npx tsx server/brgps-sync/index.ts discover --account=2` — traz o tag
     confirmado pro catálogo local como `UNASSIGNED` (tabela
     `provider_devices`, `provider='BRGPS_2'`).
  4. Vincular o dispositivo a um Asset pela tela TagsModule do frontend
     (mesmo fluxo manual que já existe pra conta 1 — nunca criar Asset
     automaticamente, seção 12 do brief original).
  5. `npx tsx server/brgps-sync/index.ts activate --account=2 <id>` — ativa
     no fornecedor (`PATCH /tag`).
  6. `npx tsx server/brgps-sync/index.ts sync-once --account=2` pra validar
     uma posição real antes de ligar o loop contínuo — o polling é sempre
     manual/standalone (`server/brgps-sync/index.ts sync --account=2`,
     rodando como processo próprio); `server/api/index.ts` não faz polling
     nenhum sozinho, só serve os endpoints REST/health.

### 2. TJ02 — rastreador de gado/rebanho ("牛羊定位器")

- **Fabricante/doc**: datasheet chinês/inglês, v1.0, agosto 2025 (arquivo
  `牛羊定位器英文版.pdf`).
- **Formato físico**: caixa 134.9×80.9×44mm, antena GPS cerâmica embutida,
  antena LTE tipo clipe, bateria de lítio 2Wmah.
- **Comunicação**: GPRS/4G-LTE-CAT1, banda GSM/GPRS 900/1900 ou 850/900/1800/1900
  conforme variante (N58 CA/LA), protocolo de transporte **TCP**.
- **Posicionamento**: GPS/BDS/GLONASS + LBS, precisão declarada ≤10m.
- **Configuração via SMS** — ver tabela completa abaixo (item "Comandos SMS").
- **IP67**, -20°C a +70°C.

### 3. GX03 — localizador de pet ("宠物定位器")

- **Fabricante/doc**: datasheet chinês/inglês, v1.0, 2022-12.
- **Formato físico**: 55.2×35×20mm, antena FPC (GPS e GSM), bateria 500mAh.
- **Liga/desliga**: inserir SIM + conectar carregador = liga; remover SIM = desliga.
- **Comunicação**: 4G-LTE-CAT1, protocolo **TCP**, suporta SMS (sem função de
  chamada telefônica).
- **Posicionamento**: GPS/BDS/GLONASS + WiFi + LBS.
- **Modos de operação**: inteligente (para com movimento → dorme após 3min),
  economia de energia, baixo consumo (só heartbeat, app manda comando pra
  localizar), temporizado.

### Comandos SMS (aplicam-se à família TJ02/GX03 — GT06-compatível com SIM)

> Fonte: `SMS指令.pdf` ("Command Table"). **Não confirmado que esses comandos
> funcionem nos discos "Air Tag" (item 1 acima)** — aquele formato não tem
> evidência de SIM/GSM próprio; estes comandos pressupõem um modem GPRS/LTE
> real com cartão SIM, o que só bate com TJ02/GX03 (e possivelmente outros
> modelos da mesma família de firmware).

| Função | Comando | Observação |
|---|---|---|
| Configurar servidor por IP | `SERVER,0,<IP>,<porta>,0#` | o `0` final significa TCP |
| Configurar servidor por domínio | `SERVER,1,<domínio>,<porta>,0#` | |
| Consultar servidor configurado | `SERVER#` | |
| Configurar APN | `APN,<nome da rede>[,usuário][,senha]#` | desabilita adaptação automática de APN |
| Consultar APN | `APN#` | |
| Habilitar/desabilitar adaptação automática de APN | `ASETAPN,<ON/OFF>#` | |
| Status do dispositivo | `STATUS#` | |
| Versão de firmware | `Version#` | |
| Consultar parâmetros | `Parameter#` | |
| Consultar posição atual | `WHERE#` | |
| Reiniciar | `RESET#` | |
| Intervalo de heartbeat | `HBT,T1,T2#` (1-5min cada) | T1=ACC ligado, T2=ACC desligado |
| Intervalo de envio GPS | `TIMER,T1,T2#` (5-60s cada) | |
| LBS liga/desliga | `LBSON#` / `LBSOFF#` / `LBS#` (consulta) | doc cita explicitamente "GT06 protocol" aqui |

**Nunca aplicar esses comandos a uma tag sem confirmar antes que o modelo
físico bate com TJ02/GX03 (ou outro da mesma família SIM-based)** — comandos
GT06 "genéricos" sem essa confirmação são exatamente o que as instruções desta
homologação pediram pra evitar.

### 4. Tags "No-SIM BLE" (formato cabeado, alimentação 5–30V)

- **Status**: foto real confirmada em 2026-09-05 — módulo retangular preto
  pequeno (poucos cm), etiqueta com **código de barras** (não QR code, ao
  contrário do disco BRGPS) impressa `SN:9260072843`, dois fios (vermelho/preto)
  saindo do corpo — bate com a descrição "wiring". Sem marca/modelo impresso,
  sem slot de SIM visível, sem antena celular aparente na foto. Ainda **sem**
  datasheet/manual real — a foto confirma o formato físico mas não adiciona
  dado técnico novo além do que já vinha do anúncio comercial (texto).
- **Hipótese não confirmada**: sem modem celular próprio — depende de
  smartphone próximo (BLE) retransmitindo posição pra nuvem do fabricante.
  "API + GT06 protocol support" citado no anúncio provavelmente descreve uma
  capacidade do **backend** do fornecedor (expor dados via API REST e/ou
  emular saída GT06), não o hardware da tag falando GT06 diretamente — isso
  seria logicamente incompatível com "No-SIM".
- **Pendência**: precisa de foto real do produto/embalagem/anúncio antes de
  qualquer teste físico ser proposto com confiança.

## Ver também

- `docs/integrations/BRGPS.md` — integração real e funcional (BRGPS/Jason/Heile)
- `docs/integrations/CAR-HERE-PLATFORM.md` — plataforma alternativa catalogada, não conectada (`api.gwgps12580.com`)
- `docs/integrations/F30_GPSONE.md` — outro rastreador de animal catalogado, não implementado
- `server/gt06-listener/` — parser/listener GT06 já implementado e testado, reutilizável por qualquer modelo SIM-based confirmado
