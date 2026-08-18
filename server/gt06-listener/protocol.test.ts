import { describe, expect, it } from 'vitest';
import { parseFrames, decodeBcdImei, decodeLocation, decodeAlarm, PROTOCOL, ALARM_CODE } from './protocol.ts';

// Exemplos oficiais de "GPS Tracker Communication Protocol" (doc do fornecedor).

describe('parseFrames + crcItu', () => {
  it('decodes the login packet example with a valid CRC (seção 5.1.3)', () => {
    const hex = '78 78 0D 01 01 23 45 67 89 01 23 45 00 01 8C DD 0D 0A';
    const buf = Buffer.from(hex.replace(/\s+/g, ''), 'hex');
    const { frames, rest } = parseFrames(buf);

    expect(frames).toHaveLength(1);
    expect(rest.length).toBe(0);
    expect(frames[0].protocol).toBe(PROTOCOL.LOGIN);
    expect(frames[0].crcValid).toBe(true);
    expect(decodeBcdImei(frames[0].content)).toBe('123456789012345');
  });

  it('decodes the GPS location packet example (seção 5.2.2)', () => {
    const hex = '78 78 1F 12 0B 08 1D 11 2E 10 CF 02 7A C7 EB 0C 46 58 49 00 14 8F 01 CC 00 28 7D 00 1F B8 00 03 80 81 0D 0A';
    const buf = Buffer.from(hex.replace(/\s+/g, ''), 'hex');
    const { frames } = parseFrames(buf);

    expect(frames).toHaveLength(1);
    expect(frames[0].protocol).toBe(PROTOCOL.LOCATION);
    expect(frames[0].crcValid).toBe(true);

    const loc = decodeLocation(frames[0].content);
    expect(loc).not.toBeNull();
    expect(loc!.satellites).toBe(15);
    expect(loc!.speedKmh).toBe(0);
  });
});

describe('protocol numbers (seção 4.3)', () => {
  it('0x16 is the alarm packet, not a location variant', () => {
    expect(PROTOCOL.ALARM).toBe(0x16);
  });

  it('recognizes the V3/4G/V4 location protocol variants', () => {
    expect(PROTOCOL.LOCATION_V3).toBe(0x22);
    expect(PROTOCOL.LOCATION_4G).toBe(0xa0);
    expect(PROTOCOL.LOCATION_V4).toBe(0x32);
  });
});

describe('decodeAlarm', () => {
  it('decodes the "Quick acceleration alarm" example (0xF0, doc p.30)', () => {
    const hex = '78 78 25 16 16 06 0A 0B 04 10 C6 02 6D 35 6C 0C 36 6A 30 00 04 00 08 01 CC 00 25 EF 00 0E B2 05 06 04 F0 01 00 53 7C A2 0D 0A';
    const buf = Buffer.from(hex.replace(/\s+/g, ''), 'hex');
    const { frames } = parseFrames(buf);

    expect(frames[0].protocol).toBe(PROTOCOL.ALARM);

    const alarm = decodeAlarm(frames[0].content);
    expect(alarm).not.toBeNull();
    expect(alarm!.alarmCode).toBe(0xf0);
    expect(alarm!.alarmName).toBe(ALARM_CODE[0xf0]);
    expect(alarm!.alarmName).toBe('harsh_acceleration');
  });

  it('returns null for content too short to hold GPS + LBS + status', () => {
    expect(decodeAlarm(Buffer.alloc(10))).toBeNull();
  });
});
