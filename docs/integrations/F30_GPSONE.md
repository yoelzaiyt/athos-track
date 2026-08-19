# Integração F30 / GPSONE — Rastreador GPS de Animais (ATHOS AGRO TRACK)

Desenho técnico do conector com o rastreador **F30 Animals GPS Tracker** (fabricante chinês, plataforma
GPSONE/GPS90x). **Nenhum arquivo de código deste conector foi implementado ainda** — este documento é a
referência para quando as Fases 2 e 3 forem construídas (ver `C:\Users\wordi\.claude\plans\steady-napping-moth.md`,
seção "Fora de escopo nesta rodada").

## O que o F30 é (e não é), segundo o fabricante

Baseado nas 3 documentações oficiais do fabricante (User Manual, ficha técnica e doc de API):

- **Posicionamento**: GPS + BeiDou (BDS) + LBS, com suporte a AGPS. Precisão diverge entre os documentos:
  manual diz "≤10m", ficha técnica diz "1-5m"; LBS (torre de celular) fica em 100-1000m. Usar a faixa
  "1–10m conforme documentação/condição de sinal" nunca um valor fixo.
- **Comunicação**: GSM 2G (850/900/1800/1900MHz) + 4G LTE, chip MTK MT6261, GPS chip TD1030, Nano SIM.
- **Física**: IP67, 118×63×36mm, 236g, bateria 10000mAh, carregamento solar + magnético, temperatura de
  operação -20°C a +65°C (manual) / -20°C a +70°C (ficha técnica — pequena divergência entre os dois docs).
- **Autonomia real (não inventar números diferentes destes)**: até 30 dias em standby; até 50h de operação
  contínua com upload a cada 5 minutos.
- **"Shock Sensor"** (ficha técnica) = sensor de vibração/impacto (acelerômetro), não estímulo elétrico.
  Nunca representar como "choque" na UI — é detecção de movimento/impacto físico do animal ou da coleira.
- **Anti-violação da coleira**: a ficha técnica diz explicitamente **"Anti dismantling alarm: nothing"**
  (não suportado). O mecanismo real e documentado é o **alarme de sensor de luz** (comando SMS
  `remove123456`/`noremove123456`): dispara quando luz incide no ponto onde o sensor normalmente fica
  coberto pelo pelo do animal — ou seja, é o proxy real de "coleira removida", não um anti-tamper genérico.
  No app, isso mapeia para `AlertType: 'device_removed'` (já existe em `src/types/index.ts`).
- **BLE e estímulo elétrico não existem em nenhum dos 3 documentos do F30.** Essas funções, quando
  implementadas, pertencem aos Módulos B/C da coleira ATHOS (hardware próprio, futuro, não fabricado pelo
  fornecedor do F30) — nunca atribuir ao F30 em telas, textos ou modelos de dados.
- **Histórico de trajetória**: até 6 meses armazenados na plataforma do fornecedor (ficha técnica).

## Canal A — Leitura (API HTTP)

Diferente do conector BRGPS já existente (`server/integrations/brgps/`), o F30 **não tem endpoint de
catálogo/descoberta** (equivalente ao `/tag/all` da BRGPS). Cadastro de IMEI é manual no ATHOS — o mesmo
padrão do conector GT06 (`server/integrations/gt06/`), não o padrão de descoberta+vinculação da BRGPS.

### Domínio da API — ambigüidade real do fornecedor

O doc de API usa `gps902.net`; o manual do usuário final e a plataforma web usam `gps903.net`. **Não
hardcodar nenhum dos dois** — configurar via env var (`F30_API_BASE_URL`) e confirmar com o fornecedor/nota
fiscal qual domínio corresponde ao SIM efetivamente comprado, mesmo padrão de cautela já usado em
`BRGPS_BASE_URL` (teste internacional vs. China).

### Endpoints confirmados

| Endpoint | Uso | Parâmetros |
|---|---|---|
| `GetTracking.aspx` | Posição em tempo real de 1 dispositivo | `id` (IMEI), `mapType` (baidu/google/vazio), `key` |
| `GetHistory.aspx` | Trajetória histórica | `id`, `mapType`, `key`, `startTime`, `endTime` (horário de Pequim, `yyyy-MM-dd HH:mm`) |
| `GetMonitor.aspx` | Múltiplos dispositivos de uma vez | `ids` (IMEIs separados por vírgula), `mapType`, `key` |

`key` é um valor fixo por conta, fornecido pelo fabricante — tratar como segredo (nunca no bundle do
navegador), mesmo padrão de `BRGPS_API_TOKEN`.

### Formato de resposta

```json
{"state":"0","positionTime":"2016-12-22 15:30:53","lat":"22.67235","lng":"114.03085",
 "speed":"0.00","course":"0","isStop":"1","isGPS":"1","status":"2-power: 100%"}
```

- `status` traz **bateria real em %** embutida no texto (`"<driving_status>-power:<pct>%"`) — diferente da
  BRGPS, que só tem categoria -1..3 sem percentual. O mapper deve extrair isso via regex
  (`/^(\d+)-power:(\d+)%$/`), nunca inventar percentual quando o campo não bate no formato esperado.
- `isGPS`: `1` = GPS, `0` = LBS — mapeia pra `PositionSource` do app.
- `isStop`/`status` (dígito inicial, histórico usa `stop`): `0` movendo, `1` parado (tempo real) —
  no histórico, `g` tem o mesmo papel de `isGPS` (`0`:LBS, `1`:GPS).

### Códigos de retorno (`state`)

| Código | Significado | Tratamento |
|---|---|---|
| `0` | Sucesso | — |
| `1001` | Parâmetros errados | Erro permanente — não retry automático |
| `1002` | Erro de programa/exceção | Transiente — pode fazer retry |
| `1003` | IMEI não existe | Erro permanente — sinalizar cadastro incorreto |
| `2002` | Sem resultados | Não é erro — dispositivo sem posição no período |
| `3001` | Key inválida | Erro permanente/config — alertar operador, não fazer retry em loop |

### Plano de arquivos (quando implementado)

Espelhar exatamente `server/integrations/brgps/`:

- `server/integrations/f30/F30Client.ts` — HTTP cru, parse do envelope, mapeamento dos `state` codes acima.
- `server/integrations/f30/F30Adapter.ts` — fala o protocolo (não há paginação/descoberta; cadastro manual).
- `server/integrations/f30/F30Mapper.ts` — puro, normaliza pra `NormalizedPosition`, extrai bateria real do
  campo `status`, sem inventar dados quando o parse falhar.
- `server/integrations/f30/db.ts` — reaproveita `assets.telemetry_*`, `asset_route_points`,
  `provider_devices`/`provider_health` (já genéricas, provider `'F30_GPSONE'`, sem migration necessária) e
  `server/integrations/shared/geofenceEngine.ts` (mesmo motor inside/outside já usado por BRGPS e GT06).
- `server/integrations/f30/F30Service.ts` — orquestra; sem `syncDeviceCatalog()` (não existe descoberta),
  cadastro de IMEI acontece direto no `DeviceFormModal` do ATHOS.
- `server/f30-sync/index.ts` — worker standalone via `tsx`, mesmo padrão de `server/brgps-sync/index.ts`
  (polling em loop, intervalo via env var).

### Variáveis de ambiente (quando implementado)

```env
F30_ENABLED=false
F30_API_BASE_URL=            # confirmar com o fornecedor: gps902.net ou gps903.net
F30_API_KEY=                 # nunca commitar
F30_SYNC_INTERVAL_SECONDS=15
```

## Canal B — Controle (comandos SMS)

**Não existe nenhum precedente de canal de escrita/comando neste projeto hoje** — BRGPS e GT06 são 100%
leitura. O F30 é controlado por **SMS enviado direto ao número do SIM da coleira**, não pela API HTTP acima
(são dois mecanismos tecnicamente distintos do próprio fabricante).

### Pré-requisitos ainda não resolvidos

1. **Gateway SMS** — o projeto não tem conta de nenhum provedor (Twilio, Zenvia, AWS SNS, etc.). Decisão de
   fornecedor é do usuário; o design abaixo assume uma interface abstrata (`SmsGatewayClient`) plugável.
2. **Número do SIM da coleira (MSISDN)** — precisa de campo novo em `AssetDevice` (`simMsisdn`), hoje
   inexistente, pois os comandos são endereçados por número de telefone, não por IMEI.
3. **Correlação de resposta assíncrona** — respostas chegam por SMS inbound, não como resposta HTTP
   síncrona. Duas estratégias possíveis:
   - **Webhook de SMS inbound** (se o gateway suportar, ex. Twilio): correlacionar pela combinação
     número-origem + comando pendente + janela de timeout.
   - **Fire-and-poll**: para comandos cujo efeito é verificável via `GetTracking`/`check123456` (ex.
     `tracker123456`, mudança de intervalo de upload), enviar o SMS e depois confirmar via polling da API
     HTTP existente, em vez de depender de parsear a resposta SMS.
   Comandos sem estado verificável via API (ex. `password123456`, `begin123456` reset de fábrica) ficam
   marcados como "enviado" sem confirmação forte — deixar isso explícito na UI, nunca fingir certeza.

### Tabela de comandos documentados (fonte: F30 User Manual, seção "Command List")

| Função | Comando | Observação |
|---|---|---|
| Definir número autorizado | `admin123456 <telefone>` | |
| Remover número autorizado | `noadmin123456 <telefone>` | |
| Modo de chamada única (escuta) | `monitor123456` | Ouvir o ambiente ao ligar pro device |
| Trocar senha do device | `password123456 <nova>` | Senha original: `123456` |
| Modo de rastreamento | `tracker123456` | Torna a próxima ligação um pedido de posição |
| Cerca de deslocamento nativa | `move123456` / `nomove123456` | Círculo fixo de 500m centrado na posição atual — **não é a cerca virtual do ATHOS**, é um recurso nativo do device, mais limitado (sempre círculo, sempre 500m) |
| Posição única | `G123456#` | |
| Alarme de excesso de velocidade | `speed123456 <kmh>` / `nospeed123456` | |
| Alarme de vibração/impacto | `shock123456` / `noshock123456` | "Shock Sensor" = acelerômetro, não estímulo elétrico |
| Fuso horário | `timezone123456 <offset>` | |
| Intervalo de upload | `upload123456 <segundos>` | Isto é o comando real por trás dos "Perfis de Frequência" do frontend (`AssetDevice.trackingProfile`) |
| Alarme de bateria baixa | `LOWBATSMS123456 on/off` | Limiar fixo do fabricante: <20% |
| APN/IP/porta | `apn123456 <apn>`, `adminip123456 <ip> <porta>` | |
| GPRS on/off | `gprs123456` / `ongprs123456` | |
| Alarme de sensor de luz (remoção) | `remove123456` / `noremove123456` | Ver seção "O que o F30 é" acima — é o proxy real de `device_removed` |
| Atualização OTA | `update123456` | Exige bateria ≥50% (regra do fabricante) |
| Reset de fábrica | `begin123456` | Mantém IP/APN, reseta número admin |
| Consulta de parâmetros | `check123456` | Versão, ID, IP, porta, APN, sinal GPS/GSM, número admin |

### UI planejada (Fase 3)

Painel "Comandos do Dispositivo" no detalhe da coleira, agrupado por categoria (Alarmes, Rastreamento,
Rede, Manutenção), reaproveitando o campo `AssetDevice.lastRemoteCommand` (`{ command, label, sentAt }`) já
existente no tipo — reservado para esta fase, ainda não usado por nenhum outro fluxo do agro.
