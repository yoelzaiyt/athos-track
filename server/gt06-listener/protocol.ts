// Decodificação do protocolo binário GT06 (TCP). Módulo puro (sem I/O) —
// framing de bytes, CRC, e parsing dos tipos de pacote usados na homologação
// (login, localização, heartbeat). Separado do index.ts (que cuida do socket
// e da persistência) pra poder testar a decodificação isoladamente.

export const START_STANDARD = Buffer.from([0x78, 0x78]);
export const START_EXTENDED = Buffer.from([0x79, 0x79]);
export const STOP = Buffer.from([0x0d, 0x0a]);

// Números de protocolo conforme a doc "GPS Tracker Communication Protocol"
// (seção 4.3). 0x16 é Alarm, não localização — corrigido depois de comparar
// byte a byte com o PDF (a versão anterior tratava 0x16 como mais uma
// variante de localização e descartava o código de alarme embutido nele).
// 0x23/0x26 não aparecem nessa doc; mantidos por compatibilidade com
// hardware já testado antes desta revisão — se algum dia confirmarmos a
// origem exata, documentar aqui.
export const PROTOCOL = {
  LOGIN: 0x01,
  LOCATION: 0x12,
  LOCATION_V3: 0x22, // seção 5.2.3
  LOCATION_V4: 0x32, // seção 5.2.5
  LOCATION_4G: 0xa0, // seção 5.2.4
  LOCATION_LEGACY_EXT: 0x26, // não documentado nesta versão do PDF, mantido por compatibilidade
  HEARTBEAT: 0x13,
  HEARTBEAT_ALT: 0x23, // não documentado nesta versão do PDF, mantido por compatibilidade
  ALARM: 0x16, // seção 5.3 — GPS+LBS+status do terminal+código de alarme
  RFID: 0x17, // seção 5.5 — GPS+LBS+cartão RFID
} as const;

// Tabela CRC-16/X-25 (CRC-ITU), poly reverso 0x8408 — é o checksum que o GT06
// usa em todo pacote (do byte de tamanho até o serial, exclusive o próprio CRC).
const CRC_TABLE: number[] = Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? (c >>> 1) ^ 0x8408 : c >>> 1;
  }
  return c & 0xffff;
});

export function crcItu(buffer: Buffer): number {
  let fcs = 0xffff;
  for (const byte of buffer) {
    fcs = (fcs >>> 8) ^ CRC_TABLE[(fcs ^ byte) & 0xff];
  }
  return (~fcs) & 0xffff;
}

export interface Gt06Frame {
  protocol: number;
  content: Buffer;
  serial: number;
  crcValid: boolean;
  raw: Buffer;
}

export interface ParseResult {
  frames: Gt06Frame[];
  rest: Buffer;
}

// Consome um buffer acumulado do socket e extrai quantos frames completos
// existirem. Devolve os bytes restantes (pacote parcial) pra próxima leitura
// — TCP não garante que um "data" event traga um frame inteiro.
export function parseFrames(input: Buffer): ParseResult {
  let buf = input;
  const frames: Gt06Frame[] = [];

  for (;;) {
    if (buf.length < 5) break;

    const startIdx = buf.indexOf(START_STANDARD);
    if (startIdx === -1) {
      // Sem início de frame reconhecível: descarta lixo, mantém só o último
      // byte (pode ser o primeiro 0x78 de um start ainda incompleto).
      buf = buf.subarray(Math.max(buf.length - 1, 0));
      break;
    }
    if (startIdx > 0) {
      buf = buf.subarray(startIdx);
      continue;
    }

    const lengthByte = buf[2];
    const contentLen = lengthByte - 5; // protocolo(1) + conteúdo(C) + serial(2) + crc(2) = lengthByte
    if (contentLen < 0) {
      // Tamanho inválido — resincroniza pulando o start falso-positivo.
      buf = buf.subarray(2);
      continue;
    }

    const totalLen = 5 + lengthByte; // start(2) + lengthByte(1) + lengthByte + stop(2)
    if (buf.length < totalLen) break; // frame incompleto, espera mais dados

    const frameBuf = buf.subarray(0, totalLen);
    const stop = frameBuf.subarray(totalLen - 2);
    if (stop[0] !== STOP[0] || stop[1] !== STOP[1]) {
      // Stop bits não batem: frame corrompido/desalinhado, resincroniza.
      buf = buf.subarray(2);
      continue;
    }

    const protocol = frameBuf[3];
    const content = frameBuf.subarray(4, 4 + contentLen);
    const serial = frameBuf.readUInt16BE(4 + contentLen);
    const crc = frameBuf.readUInt16BE(4 + contentLen + 2);
    const crcData = frameBuf.subarray(2, 4 + contentLen + 2);
    const crcValid = crcItu(crcData) === crc;

    frames.push({ protocol, content, serial, crcValid, raw: Buffer.from(frameBuf) });
    buf = buf.subarray(totalLen);
  }

  return { frames, rest: Buffer.from(buf) };
}

// Monta o frame de ACK que o servidor devolve pro login (0x01) e pro
// heartbeat (0x13/0x23) — sem isso a maioria dos GT06 derruba a conexão por
// timeout depois de alguns segundos sem confirmação.
//
// Bug corrigido nesta revisão: o corpo usado pro CRC e pro frame tinha 2
// bytes a mais (Buffer.alloc(lengthByte + 1) = 6 bytes) do que os 4 bytes
// reais (packet length + protocolo + serial) que a seção 4.6 da doc manda
// somar no CRC-ITU — o alloc de 6 deixava 2 bytes 0x00 de lixo entre o
// serial e o CRC, e o CRC saía calculado sobre esse lixo. Conferido contra
// os exemplos de "reception" da doc (seções 5.1.2.3/5.1.3 e apêndice vii):
// buildAck(0x01, 1) tem que bater byte a byte com "78 78 05 01 00 01 D9 DC
// 0D 0A" — ver server/gt06-listener/protocol.test.ts.
export function buildAck(protocol: number, serial: number): Buffer {
  const lengthByte = 5; // protocolo(1) + serial(2) + crc(2), sem conteúdo
  const body = Buffer.alloc(4);
  body[0] = lengthByte;
  body[1] = protocol;
  body.writeUInt16BE(serial, 2);
  const crc = crcItu(body);

  return Buffer.concat([
    START_STANDARD,
    body,
    (() => {
      const c = Buffer.alloc(2);
      c.writeUInt16BE(crc, 0);
      return c;
    })(),
    STOP,
  ]);
}

// IMEI vem como 8 bytes BCD (2 dígitos por byte) = 16 dígitos; o primeiro é
// padding e some no IMEI real de 15 dígitos.
export function decodeBcdImei(content: Buffer): string {
  let digits = '';
  for (const byte of content.subarray(0, 8)) {
    digits += ((byte >> 4) & 0x0f).toString(16);
    digits += (byte & 0x0f).toString(16);
  }
  return digits.replace(/^0+(?=\d)/, '');
}

export interface DecodedLocation {
  timestamp: Date;
  latitude: number;
  longitude: number;
  speedKmh: number;
  course: number;
  satellites: number;
  courseStatusRaw: number;
}

// Estrutura clássica do pacote de localização GT06 (0x12 e variantes com
// LBS anexado, que reaproveitam o mesmo cabeçalho GPS nos primeiros bytes).
// Convenção de bits do campo curso/status (bit10=hemisfério N/S,
// bit11=hemisfério E/W) segue a documentação pública mais difundida do
// protocolo — se um teste real mostrar sinal de lat/lon trocado, é aqui que
// se ajusta.
export function decodeLocation(content: Buffer): DecodedLocation | null {
  if (content.length < 18) return null;

  const [yy, mm, dd, hh, min, ss] = content.subarray(0, 6);
  const timestamp = new Date(Date.UTC(2000 + yy, Math.max(mm - 1, 0), dd, hh, min, ss));

  const satellites = content[6] & 0x0f;
  const rawLat = content.readUInt32BE(7);
  const rawLon = content.readUInt32BE(11);
  const speedKmh = content[15];
  const courseStatusRaw = content.readUInt16BE(16);

  let latitude = rawLat / 30000 / 60;
  if (!(courseStatusRaw & 0x0400)) latitude = -latitude; // bit10 desligado = Sul
  let longitude = rawLon / 30000 / 60;
  if (courseStatusRaw & 0x0800) longitude = -longitude; // bit11 ligado = Oeste
  const course = courseStatusRaw & 0x03ff;

  return { timestamp, latitude, longitude, speedKmh, course, satellites, courseStatusRaw };
}

export interface DecodedHeartbeat {
  terminalInfo: number;
  voltageLevel: number;
  gsmSignal: number;
  // Alarm/Language (seção 5.4.1.7) — o heartbeat também pode carregar um
  // código de alarme (ex.: bateria baixa), não só o pacote de Alarm (0x16).
  alarmCode?: number;
  language?: number;
}

export function decodeHeartbeat(content: Buffer): DecodedHeartbeat | null {
  if (content.length < 3) return null;
  const base = { terminalInfo: content[0], voltageLevel: content[1], gsmSignal: content[2] };
  if (content.length >= 5) {
    return { ...base, alarmCode: content[3], language: content[4] };
  }
  return base;
}

// Pacote de Alarm (0x16, seção 5.3): mesmo cabeçalho GPS de decodeLocation
// + bloco LBS + status do terminal + código de alarme. O bloco GPS (18
// bytes) é decodificado reaproveitando decodeLocation.
export interface DecodedAlarm {
  location: DecodedLocation | null;
  mcc: number;
  mnc: number;
  lac: number;
  cellId: number;
  terminalInfo: number;
  voltageLevel: number;
  gsmSignal: number;
  alarmCode: number;
  language: number;
}

export function decodeAlarm(content: Buffer): DecodedAlarm | null {
  if (content.length < 32) return null;
  const location = decodeLocation(content);

  const mcc = content.readUInt16BE(19);
  const mnc = content[21];
  const lac = content.readUInt16BE(22);
  const cellId = (content[24] << 16) | (content[25] << 8) | content[26];
  const terminalInfo = content[27];
  const voltageLevel = content[28];
  const gsmSignal = content[29];
  const alarmCode = content[30];
  const language = content[31];

  return { location, mcc, mnc, lac, cellId, terminalInfo, voltageLevel, gsmSignal, alarmCode, language };
}

// Pacote de RFID (0x17, seção 5.5): cabeçalho GPS (18) + LBS sem byte de
// tamanho (8: MCC 2, MNC 1, LAC 2, Cell ID 3) + cartão RFID (8) + flag de
// validade (1) = 35 bytes.
export interface DecodedRfid {
  location: DecodedLocation | null;
  cardId: string; // 8 bytes em hex
  valid: boolean;
}

export function decodeRfid(content: Buffer): DecodedRfid | null {
  if (content.length < 35) return null;
  const location = decodeLocation(content);
  const cardId = content.subarray(26, 34).toString('hex');
  const valid = content[34] === 0x01;
  return { location, cardId, valid };
}

// Mapeamento do byte "former bit" do campo Alarm/Language (seção 5.3.1.17 /
// 5.4.1.7) para o vocabulário de alertas do ATHOS. alertType null significa
// "não vira um SystemAlert" (estado normal, ou informação só de telemetria
// como ACC on/off, que já é refletida em telemetry.ignition).
export interface AlarmMapping {
  label: string;
  alertType: string | null;
  severity: 'info' | 'warning' | 'critical';
}

const ALARM_CODE_MAP: Record<number, AlarmMapping> = {
  0x00: { label: 'Normal', alertType: null, severity: 'info' },
  0x01: { label: 'SOS', alertType: 'sos', severity: 'critical' },
  0x02: { label: 'Corte de energia', alertType: 'power_cut', severity: 'critical' },
  0x03: { label: 'Choque/impacto', alertType: 'impact', severity: 'warning' },
  0x06: { label: 'Excesso de velocidade', alertType: 'speeding', severity: 'warning' },
  0x09: { label: 'Saída de cerca virtual', alertType: 'geofence_exit', severity: 'critical' },
  0x0e: { label: 'Tensão externa baixa', alertType: 'low_battery', severity: 'warning' },
  0x13: { label: 'Rastreador removido', alertType: 'device_removed', severity: 'critical' },
  0x14: { label: 'Alarme de porta', alertType: null, severity: 'info' },
  0x19: { label: 'Bateria interna baixa', alertType: 'low_battery', severity: 'warning' },
  0xf0: { label: 'Aceleração brusca', alertType: 'harsh_driving', severity: 'warning' },
  0xf1: { label: 'Frenagem brusca', alertType: 'harsh_driving', severity: 'warning' },
  0xf2: { label: 'Colisão', alertType: 'impact', severity: 'critical' },
  0xfe: { label: 'Ignição ligada', alertType: null, severity: 'info' },
  0xff: { label: 'Ignição desligada', alertType: null, severity: 'info' },
};

export function mapAlarmCode(code: number): AlarmMapping {
  return ALARM_CODE_MAP[code] ?? { label: `Desconhecido (0x${code.toString(16).padStart(2, '0')})`, alertType: null, severity: 'info' };
}
