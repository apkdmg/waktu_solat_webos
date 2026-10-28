import { describe, expect, it } from 'vitest';
import { FormatError } from '../src/errors.js';
import { parseApiError, parsePrayerTime, parseSolatV2, parseZoneInfo, toDate } from '../src/models.js';

describe('PrayerTime', () => {
  it('parses valid JSON correctly', () => {
    const prayerTime = parsePrayerTime({
      hijri: '1446-09-01',
      date: '2025-03-01',
      day: 6,
      imsak: 1425480000,
      fajr: 1425480480,
      syuruk: 1425485460,
      dhuhr: 1425507480,
      asr: 1425518340,
      maghrib: 1425529800,
      isha: 1425533940,
    });

    expect(prayerTime).toEqual({
      hijri: '1446-09-01',
      date: '2025-03-01',
      day: 6,
      imsak: 1425480000,
      fajr: 1425480480,
      syuruk: 1425485460,
      dhuhr: 1425507480,
      asr: 1425518340,
      maghrib: 1425529800,
      isha: 1425533940,
      // syuruk + 15 minutes (900 seconds)
      isyraq: 1425486360,
    });
  });

  it('calculates imsak from fajr when missing', () => {
    const prayerTime = parsePrayerTime({ hijri: '1446-09-01', day: 1, fajr: 1000000 });

    expect(prayerTime.imsak).toBe(1000000 - 600);
    expect(prayerTime.date).toBeNull();
    expect(prayerTime.syuruk).toBeNull();
    expect(prayerTime.isyraq).toBeNull();
  });

  it('accepts numeric strings for times', () => {
    const prayerTime = parsePrayerTime({ hijri: 'x', day: 1, fajr: '1000000', syuruk: '2000000', isha: null });

    expect(prayerTime.fajr).toBe(1000000);
    expect(prayerTime.isyraq).toBe(2000900);
    expect(prayerTime.isha).toBeNull();
  });

  it('rejects invalid fields', () => {
    expect(() => parsePrayerTime({ day: 1 })).toThrow(FormatError);
    expect(() => parsePrayerTime({ hijri: 'x' })).toThrow(FormatError);
    expect(() => parsePrayerTime({ hijri: 'x', day: 1.5 })).toThrow(FormatError);
    expect(() => parsePrayerTime({ hijri: 'x', day: 1, date: 5 })).toThrow(FormatError);
    expect(() => parsePrayerTime({ hijri: 'x', day: 1, fajr: 'abc' })).toThrow(FormatError);
    expect(() => parsePrayerTime({ hijri: 'x', day: 1, fajr: true })).toThrow(FormatError);
  });

  it('converts times to Date', () => {
    expect(toDate(1425480480)?.toISOString()).toBe('2015-03-04T14:48:00.000Z');
    expect(toDate(null)).toBeNull();
  });
});

describe('SolatV2', () => {
  it('parses valid JSON correctly', () => {
    const solatV2 = parseSolatV2({
      zone: 'sgr01',
      origin: 'JAKIM',
      prayers: [
        { hijri: '1446-09-01', date: '2025-03-01', day: 6, fajr: 1425480480, syuruk: 1425485460 },
        { hijri: '1446-09-02', date: '2025-03-02', day: 0, fajr: 1425566880, syuruk: 1425571860 },
      ],
    });

    expect(solatV2.zone).toBe('sgr01');
    expect(solatV2.origin).toBe('JAKIM');
    expect(solatV2.prayerTime).toHaveLength(2);
    expect(solatV2.prayerTime[0].day).toBe(6);
    expect(solatV2.prayerTime[1].day).toBe(0);
    expect(solatV2.prayerTime[0].isyraq).toBe(1425486360);
    expect(solatV2.prayerTime[1].isyraq).toBe(1425572760);
  });

  it('rejects missing prayers', () => {
    expect(() => parseSolatV2({ zone: 'sgr01', origin: 'JAKIM' })).toThrow(FormatError);
  });
});

describe('ZoneInfo and ApiError', () => {
  it('parses ZoneInfo', () => {
    expect(parseZoneInfo({ jakimCode: 'JHR01', negeri: 'Johor', daerah: 'Pulau Aur' }))
      .toEqual({ jakimCode: 'JHR01', negeri: 'Johor', daerah: 'Pulau Aur' });
    expect(() => parseZoneInfo({ jakimCode: 'JHR01' })).toThrow(FormatError);
  });

  it('parses ApiError', () => {
    expect(parseApiError({ status: 'error', message: 'Error, Zone not found, Please use /zones' }))
      .toEqual({ status: 'error', message: 'Error, Zone not found, Please use /zones' });
    expect(() => parseApiError({ message: 'x' })).toThrow(FormatError);
  });
});
