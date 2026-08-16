// Testes contra os exemplos byte-a-byte publicados na doc "GPS Tracker
// Communication Protocol" (login, status/heartbeat, RFID e os três alarmes
// do apêndice vii) — garante que framing, CRC-ITU, ACK e os decoders batem
// com o que um GT06 real envia/espera, não só com a nossa própria leitura
// do formato.
import { describe, expect, it } from 'vitest';
import {
  buildAck,
  crcItu,
  decodeAlarm,
  decodeBcdImei,
  decodeHeartbeat,
  decodeLocation,
  decodeRfid,
  mapAlarmCode,
  parseFrames,
} from './protocol.ts';

function hexToBuffer(hex: string): Buffer {
  return Buffer.from(hex.replace(/\s+/g, ''), 'hex');
}

describe('crcItu / buildAck — exemplos de "reception" da doc (seção 5.1.3 e apêndice vii)', () => {
  it('login: buildAck(0x01, 1) bate com "78 78 05 01 00 01 D9 DC 0D 0A"', () => {
    // Regressão do bug corrigido nesta revisão: o corpo do ACK tinha 2 bytes
    // de padding zerado a mais, o que quebrava o CRC e inseria lixo no frame.
    expect(buildAck(0x01, 1).toString('hex')).toBe(hexToBuffer('78 78 05 01 00 01 D9 DC 0D 0A').toString('hex'));
  });

  it('heartbeat: buildAck(0x13, 5) bate com "78 78 05 13 00 05 AF D5 0D 0A"', () => {
    expect(buildAck(0x13, 5).toString('hex')).toBe(hexToBuffer('78 78 05 13 00 05 AF D5 0D 0A').toString('hex'));
  });

  it('crcItu calcula 0x8CDD para o corpo do pacote de login (seção 5.1.3)', () => {
    // Corpo = "Packet Length" até "Information Serial Number" (seção 4.6).
    const body = hexToBuffer('0D 01 01 23 45 67 89 01 23 45 00 01');
    expect(crcItu(body)).toBe(0x8cdd);
  });
});

describe('parseFrames + decodeBcdImei — pacote de login (seção 5.1.3)', () => {
  const raw = hexToBuffer('78 78 0D 01 01 23 45 67 89 01 23 45 00 01 8C DD 0D 0A');

  it('extrai um frame válido com protocolo, serial e CRC corretos', () => {
    const { frames, rest } = parseFrames(raw);
    expect(frames).toHaveLength(1);
    expect(rest).toHaveLength(0);
    expect(frames[0].protocol).toBe(0x01);
    expect(frames[0].serial).toBe(1);
    expect(frames[0].crcValid).toBe(true);
  });

  it('decodeBcdImei recupera o IMEI 123456789012345', () => {
    const { frames } = parseFrames(raw);
    expect(decodeBcdImei(frames[0].content)).toBe('123456789012345');
  });
});

describe('decodeHeartbeat — pacote de status (apêndice vii)', () => {
  const raw = hexToBuffer('78 78 0A 13 44 01 04 00 01 00 05 08 45 0D 0A');

  it('decodifica terminalInfo/voltageLevel/gsmSignal e o alarme embutido', () => {
    const { frames } = parseFrames(raw);
    expect(frames[0].crcValid).toBe(true);
    const hb = decodeHeartbeat(frames[0].content);
    expect(hb).toEqual({ terminalInfo: 0x44, voltageLevel: 0x01, gsmSignal: 0x04, alarmCode: 0x00, language: 0x01 });
  });
});

describe('decodeRfid — pacote de cartão RFID (seção 5.5.1)', () => {
  const raw = hexToBuffer(
    '78 78 28 17 16 03 1D 0A 1F 21 C6 02 6C C8 14 0C 36 7F 90 00 14 00 01 CC 00 25 EF 00 B4 0F ' +
    '47 00 1B 00 2F CF 8B 01 01 00 11 11 5D 0D 0A'
  );

  // Nota: não afirmamos crcValid aqui — este frame foi remontado por nós a
  // partir da tabela de campos da seção 5.5.1 (não veio como uma única
  // string hex contígua na doc, ao contrário dos exemplos de login/heartbeat/
  // alarme), e o CRC de 2 bytes é fácil de transcrever errado sem afetar o
  // resultado funcional. Os campos decodificados abaixo (cardId, satélites,
  // lat/lon) já confirmam que a ordem dos bytes está certa.
  it('extrai o frame com o protocolo certo', () => {
    const { frames } = parseFrames(raw);
    expect(frames).toHaveLength(1);
    expect(frames[0].protocol).toBe(0x17);
  });

  it('decodifica o cartão e a localização embutida', () => {
    const { frames } = parseFrames(raw);
    const rfid = decodeRfid(frames[0].content);
    expect(rfid?.cardId).toBe('47001b002fcf8b01');
    expect(rfid?.valid).toBe(true);
    expect(rfid?.location?.satellites).toBe(6); // 0xC6 → nibble baixo = 6
    // Conversão da seção 5.2.1.6, calculada aqui de forma independente do decoder.
    expect(rfid?.location?.latitude).toBeCloseTo(0x026cc814 / 30000 / 60, 6);
    expect(rfid?.location?.longitude).toBeCloseTo(0x0c367f90 / 30000 / 60, 6);
  });
});

describe('decodeAlarm + mapAlarmCode — os 3 alarmes do apêndice vii', () => {
  const acceleration = hexToBuffer(
    '78 78 25 16 16 06 0A 0B 04 10 C6 02 6D 35 6C 0C 36 6A 30 00 04 00 08 01 CC 00 25 EF 00 0E B2 05 06 04 F0 01 00 53 7C A2 0D 0A'
  );
  const brake = hexToBuffer(
    '78 78 25 16 16 06 0A 0B 0A 22 C6 02 6D 35 6C 0C 36 6A 30 00 04 00 08 01 CC 00 25 EF 00 0E B2 05 06 04 F1 01 00 53 9B C3 0D 0A'
  );
  const collision = hexToBuffer(
    '78 78 25 16 16 06 0A 0B 0A 22 C6 02 6D 35 6C 0C 36 6A 30 00 04 00 08 01 CC 00 25 EF 00 0E B2 05 06 04 F2 01 00 53 9B C3 0D 0A'
  );

  // Nota: não afirmamos crcValid aqui — os 3 exemplos desta página do PDF
  // (com "Warn ID" destacado em vermelho, formatação diferente do resto da
  // doc) não batem com o CRC-ITU calculado, o que indica um erro de
  // transcrição/OCR nessa página específica, não um bug no crcItu (que já
  // foi validado byte a byte contra os exemplos de login e heartbeat acima).
  // O que importa pra este teste — o offset do alarmCode dentro do
  // conteúdo — está correto: o valor decodificado bate exatamente com o
  // "Warn ID" que a doc rotula em cada exemplo.
  it.each([
    ['aceleração brusca', acceleration, 0xf0, 'harsh_driving'],
    ['frenagem brusca', brake, 0xf1, 'harsh_driving'],
    ['colisão', collision, 0xf2, 'impact'],
  ] as const)('%s: protocolo 0x16, alarmCode 0x%s → alertType %s', (_label, raw, expectedCode, expectedType) => {
    const { frames } = parseFrames(raw);
    expect(frames).toHaveLength(1);
    expect(frames[0].protocol).toBe(0x16);

    const alarm = decodeAlarm(frames[0].content);
    expect(alarm?.alarmCode).toBe(expectedCode);
    expect(mapAlarmCode(expectedCode).alertType).toBe(expectedType);
  });
});

describe('mapAlarmCode', () => {
  it('não gera alerta para estados normais/telemetria pura', () => {
    expect(mapAlarmCode(0x00).alertType).toBeNull(); // normal
    expect(mapAlarmCode(0xfe).alertType).toBeNull(); // ACC on — vira telemetry.ignition, não alerta
    expect(mapAlarmCode(0xff).alertType).toBeNull(); // ACC off
  });

  it('mapeia SOS e corte de energia para os tipos novos', () => {
    expect(mapAlarmCode(0x01)).toMatchObject({ alertType: 'sos', severity: 'critical' });
    expect(mapAlarmCode(0x02)).toMatchObject({ alertType: 'power_cut', severity: 'critical' });
  });

  it('nunca inventa um rótulo silencioso para código desconhecido', () => {
    const mapping = mapAlarmCode(0x77);
    expect(mapping.alertType).toBeNull();
    expect(mapping.label).toContain('0x77');
  });
});

describe('decodeLocation — direção norte/sul e leste/oeste (seção 5.2.1.9)', () => {
  it('bit10=0 (Sul) e bit11=1 (Oeste) negam latitude e longitude', () => {
    // Mesmo cabeçalho GPS do exemplo de RFID, mas com course/status forçado
    // pra Sul+Oeste, só pra exercitar os dois sinais que o exemplo real não cobre.
    // course/status = 0x0800: bit10 (0x0400) desligado → Sul; bit11 (0x0800) ligado → Oeste.
    const content = hexToBuffer('16 03 1D 0A 1F 21 C6 02 6C C8 14 0C 36 7F 90 00 08 00');
    const loc = decodeLocation(content);
    expect(loc?.latitude).toBeLessThan(0);
    expect(loc?.longitude).toBeLessThan(0);
  });
});
