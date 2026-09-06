# Plataforma "Car Here System" (api.gwgps12580.com) — catalogado, NÃO conectado

> Fornecedor diferente do BRGPS/Jason/Heile (`server/integrations/brgps/`) — domínio,
> autenticação e modelo de dados completamente distintos. Nenhum código deste
> conector foi implementado ainda; este documento só registra o que a
> documentação oficial do fornecedor descreve, para viabilizar a implementação
> quando houver credenciais reais e uma tag confirmada deste fornecedor.
>
> Fonte: `API Interface Documentation.pdf` (fornecido pelo usuário em
> 2026-09-04), "Car Here System API Interface Documentation", v2.2 (2025-03-28).

## Por que isso é um fornecedor diferente

| | BRGPS (Jason/Heile) | Car Here System |
|---|---|---|
| Base URL | `http://www.brgps.com/open` | `https://api.gwgps12580.com/v1/Ch_manage_controller/api` |
| Autenticação | `api_token` + `timestamp` (header, gerado por request) | `apikey` (header estático) + login usuário/senha (Bearer token) pra operações de usuário |
| Modelo de conta | token único, sem hierarquia de usuários | hierárquico: admin / agente / usuário regular / super usuário, com sub-agentes |
| Identificador do device | `id` numérico (sem IMEI/serial exposto) | `terminalID` = **Device IMEI** explicitamente |
| Catálogo completo | `GET /tag/all` | `GET /user/findApiKeyByAllTerminalID` |
| Consulta de posição | `GET /tag?ids=...` | `POST /location/find` (body: array de IMEIs, `["imei1","imei2"]`, máx. 100) |
| Histórico | `GET /tag/history` | `GET` interface de trajetória (item 7 do doc) |
| Comandos remotos | não documentado | módulo de instruções completo (itens 11-16, 20-21, 30, 34) — inclusive corte de combustível/elétrica, comandos NB-IoT |
| Alarmes | não documentado | módulo de alarmes com paginação (itens 8-10) |
| Cerca virtual | não documentado | "Equipment Fence Creation" (item 37) |

## Autenticação

Todo request exige o header `apikey` (valor estático, solicitado ao administrador
do fornecedor — não é gerado por nós). Operações que envolvem dados de usuário
(login, listagem de sub-usuários) também exigem um Bearer token obtido via
`POST /login` (usuário/senha).

```
Header: apikey <valor fornecido pelo administrador>
```

**Não temos esse apikey configurado no projeto.** Nenhuma variável de ambiente,
nenhuma credencial. O exemplo no doc oficial (`d5MXV0LLL1t2H63p69kocGQA08jn9uhD`)
é só ilustrativo do formato do header — nunca testado, não deve ser usado como
se fosse uma chave real/nossa.

## Endpoint-chave pra diagnóstico (equivalente ao `/tag/all` da BRGPS)

```
GET https://api.gwgps12580.com/v1/Ch_manage_controller/api/user/findApiKeyByAllTerminalID
Header: apikey <...>
```

Retorna todos os dispositivos (por `terminalID`/IMEI) vinculados ao apikey usado.
Este é o primeiro teste a fazer assim que tivermos um apikey real — mesmo padrão
do teste que já fizemos contra `/tag/all` da BRGPS nesta sessão.

## Consulta de posição em lote

```
POST https://api.gwgps12580.com/v1/Ch_manage_controller/api/location/find
Header: apikey <...>
Body: ["imei1", "imei2", ...]   // máx. 100 por chamada
```

Retorna, por dispositivo: `lat`/`lon` (WGS84), `gcjLat`/`gcjLon` (Google/AMap),
`bdLat`/`bdLon` (Baidu), `speed`, `course`, `acc` (ignição), `electric`
(bateria/tensão), `gsm` (sinal), `iccid`, `deviceProtocol`, `networkProtocol`,
`stateTime`/`utcTime` (UTC — precisa somar 8h pro horário de exibição, conforme
o doc; não confundir com fuso do Brasil).

## Tipos de dispositivo observados nos exemplos do doc

`K100B`, `G11`, `G17` aparecem como `deviceType` nos JSONs de exemplo — modelos
de hardware do próprio catálogo do fornecedor "Car Here". Não confirmado se
algum desses corresponde às tags físicas que estamos tentando homologar
(`3092660181` / `9260072843`).

## Inventário completo dos 37 endpoints (v2.2, 2025-03-28)

Todos sob `https://api.gwgps12580.com/v1/Ch_manage_controller/api/` + o caminho
abaixo. Método e header `apikey` conforme seção "Autenticação" acima, salvo
indicação contrária.

| # | Função | Método | Caminho |
|---|---|---|---|
| 1 | Login (usuário/senha → Bearer token) | POST | `/login` |
| 2 | Listar todos os usuários subordinados | POST | `/user/findAllUser` |
| 3 | Listar todos os sub-agentes | POST | `/user/findAllAgent` |
| 4 | Modificar informações de usuário | POST | `/user/updateUser` |
| 5 | Logout | POST | `/logout` |
| 6 | Posição em tempo real em lote (por IMEI) | POST | `/location/find` |
| 7 | Consulta de trajetória/histórico | GET | `/track/findByTerminalID` |
| 8 | Alarmes paginados por dispositivo/período | GET | `/deviceAlarms/findAll` |
| 9 | Marcar alarme como lido | POST | `/deviceAlarms/save` |
| 10 | Deletar informação de alarme | POST | `/deviceAlarms/delete` |
| 11 | Consultar comandos de um dispositivo | GET | `/command/find` |
| 12 | Salvar informação de comando | POST | `/command/save` |
| 13 | Emissão de comando (envio real ao dispositivo) | POST | `/tracker_cmd` |
| 14 | Consultar configuração de comando | GET | `/order/find` |
| 15 | Atualizar configuração de comando | POST | `/order/save` |
| 16 | Consultar identificador único do dispositivo | — | (ver #22, NB) |
| 17 | Estatística de quilometragem | GET | `/stat/find` |
| 18 | Pontos de parada do equipamento | GET | `/stay/find` |
| 19 | Upload de imagem do dispositivo | POST | `/user/importPic` |
| 20 | Envio de comando dispositivo CCS | POST | `/ccs/sendCommand` |
| 21 | Envio de comando dispositivo NB-IoT | POST | `/nb/sendCommand` |
| 22 | Consultar/gerar deviceId de dispositivo NB | GET | `/nb/findDeviceId` |
| 23 | Configurar endereço de assinatura NB | POST | `/nb/subscriptions` |
| 24 | Consultar informação de apólice/seguro do equipamento | GET | `/insurance/find` |
| 25 | Busca paginada fuzzy de apólices | GET | `/insurance/select` |
| 26 | Adicionar informação de apólice | POST | `/insurance/insert` |
| 27 | Modificar informação de apólice | POST | `/insurance/insert` (mesmo endpoint do #26) |
| 28 | Consultar informação de bateria do dispositivo | GET | `/battery/findByTerminalID` |
| 29 | **Listar todos os dispositivos vinculados à apikey** | GET | `/user/findApiKeyByAllTerminalID` |
| 30 | Comando de corte de combustível/elétrica | POST | `/tracker_cmd_Relay` |
| 31 | Transferência em lote de equipamentos | POST | `/user/transfer` |
| 32 | Total de agentes online/offline | POST | `/user/findNumByUserId` |
| 33 | Lista de todos os agentes online/offline | POST | `/user/findTypeListByUserId` |
| 34 | Emissão de comando offline em lote | POST | `/batchOffline/import` |
| 35 | Consulta de registro de comandos | POST | `/command/findAndOffline` |
| 36 | Modificar número da placa | POST | `/user/updateCarNumber` |
| 37 | Criação de cerca virtual (geofence) | POST | `/fence/add` |

Item **#29 é o mais relevante pra diagnóstico** (mesmo papel do `/tag/all` da
BRGPS) — já documentado em detalhe na seção anterior.

**Teste real feito nesta sessão**: o `BRGPS_API_TOKEN` já configurado no
projeto **não é válido** nesta plataforma — testado ao vivo contra o endpoint
#29, resposta `HTTP 400 {"meta":{"message":"9904","success":false}}` (9904 =
"Invalid apikey" pela tabela de códigos do próprio doc). Confirma que são
credenciais de contas diferentes, mesmo initially parecendo o mesmo valor.

## Pendências antes de qualquer implementação

1. Confirmar com quem forneceu as tags físicas se este é de fato o backend
   correto (nome "Car Here System", domínio `gwgps12580.com`).
2. Obter um `apikey` real junto ao administrador do fornecedor.
3. Rodar `GET /user/findApiKeyByAllTerminalID` com esse apikey e conferir se
   `3092660181`/`9260072843` (ou seus IMEIs reais, se diferentes da etiqueta)
   aparecem na lista.
4. Só então desenhar o adapter (`server/integrations/carhere/`, seguindo o
   mesmo padrão de `server/integrations/brgps/`).
