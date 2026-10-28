import { afterEach, describe, expect, it, vi } from 'vitest';
import { WaktuSolatApiException, WaktuSolatClient } from '../src/index.js';
import { BASE, mockFetch } from './helpers.js';

const zonesBody = JSON.stringify([
  { jakimCode: 'JHR01', negeri: 'Johor', daerah: 'Pulau Aur dan Pulau Pemanggil' },
  { jakimCode: 'JHR02', negeri: 'Johor', daerah: 'Johor Bahru, Kota Tinggi, Mersing, Kulai' },
  { jakimCode: 'KDH01', negeri: 'Kedah', daerah: 'Kota Setar, Kubang Pasu, Pokok Sena' },
  { jakimCode: 'SGR01', negeri: 'Selangor', daerah: 'Gombak, Petaling, Sepang, Hulu Langat, Hulu Selangor, Shah Alam' },
]);

const solatBody = (zone: string) => JSON.stringify({
  zone,
  origin: 'JAKIM',
  prayers: [{
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
  }],
});

function client(fetch: ReturnType<typeof mockFetch>) {
  return new WaktuSolatClient({ baseUrl: BASE, fetch });
}

async function rejection(promise: Promise<unknown>): Promise<WaktuSolatApiException> {
  try {
    await promise;
  } catch (e) {
    expect(e).toBeInstanceOf(WaktuSolatApiException);
    return e as WaktuSolatApiException;
  }
  throw new Error('Expected the promise to reject');
}

describe('getStates', () => {
  it('groups zones by state', async () => {
    const fetch = mockFetch({ body: zonesBody });

    expect(await client(fetch).getStates()).toEqual([
      { negeri: 'Johor', zones: ['JHR01', 'JHR02'] },
      { negeri: 'Kedah', zones: ['KDH01'] },
      { negeri: 'Selangor', zones: ['SGR01'] },
    ]);
    expect(fetch.urls).toEqual([BASE + '/zones']);
  });

  it('rejects on error status code', async () => {
    const e = await rejection(client(mockFetch({ status: 500, body: '{"message":"Server Error"}' })).getStates());
    expect(e.statusCode).toBe(500);
  });

  it('rejects on network error', async () => {
    const e = await rejection(client(mockFetch(new Error('Connection failed'))).getStates());
    expect(e.message).toBe('Network error: Connection failed');
  });

  it('rejects when the response is not a list', async () => {
    const e = await rejection(client(mockFetch({ body: '{"jakimCode":"JHR01"}' })).getStates());
    expect(e.message).toContain('Expected a List');
  });
});

describe('getZones', () => {
  it('returns zones on success', async () => {
    const zones = await client(mockFetch({ body: zonesBody })).getZones();

    expect(zones).toHaveLength(4);
    expect(zones[0]).toEqual({ jakimCode: 'JHR01', negeri: 'Johor', daerah: 'Pulau Aur dan Pulau Pemanggil' });
    expect(zones[3].jakimCode).toBe('SGR01');
  });

  it('uses the generic message when a 404 body is not an ApiError', async () => {
    const e = await rejection(client(mockFetch({ status: 404, body: '{"message":"Not Found"}' })).getZones());
    expect(e.statusCode).toBe(404);
    expect(e.apiError).toBeNull();
    expect(e.message).toContain('API Request failed with status 404');
  });

  it('rejects on malformed items', async () => {
    const e = await rejection(client(mockFetch({ body: '[{"jakimCode":1}]' })).getZones());
    expect(e.message).toContain('Failed to parse zone info list response');
  });
});

describe('getPrayerTimesByZone', () => {
  it('returns SolatV2 on success', async () => {
    const fetch = mockFetch({ body: solatBody('sgr01') });

    const result = await client(fetch).getPrayerTimesByZone('sgr01');

    expect(result.zone).toBe('sgr01');
    expect(result.origin).toBe('JAKIM');
    expect(result.prayerTime).toHaveLength(1);
    expect(result.prayerTime[0].isyraq).toBe(1425486360);
    expect(fetch.urls).toEqual([BASE + '/v2/solat/sgr01']);
  });

  it('sends year and month', async () => {
    const fetch = mockFetch({ body: solatBody('sgr01') });

    await client(fetch).getPrayerTimesByZone('sgr01', { year: 2025, month: 3 });

    expect(fetch.urls).toEqual([BASE + '/v2/solat/sgr01?year=2025&month=3']);
  });

  it('encodes the zone in the path', async () => {
    const fetch = mockFetch({ body: solatBody('a/b') });

    await client(fetch).getPrayerTimesByZone('a/b');

    expect(fetch.urls).toEqual([BASE + '/v2/solat/a%2Fb']);
  });

  it('rejects on API error with 200 OK', async () => {
    const e = await rejection(client(mockFetch({
      body: '{"status": "error", "message": "Error, Zone not found, Please use /zones"}',
    })).getPrayerTimesByZone('sgr01'));

    expect(e.message).toContain('Zone not found');
    expect(e.statusCode).toBe(200);
    expect(e.apiError?.status).toBe('error');
  });

  it('includes the parsed ApiError on an error status code', async () => {
    const e = await rejection(client(mockFetch({
      status: 404,
      body: '{"status": "error", "message": "Zone not found"}',
    })).getPrayerTimesByZone('sgr01'));

    expect(e.statusCode).toBe(404);
    expect(e.message).toBe('API Error: Zone not found');
    expect(e.apiError).toEqual({ status: 'error', message: 'Zone not found' });
  });

  it('rejects on server error', async () => {
    const e = await rejection(client(mockFetch({ status: 500, body: 'Server Error' })).getPrayerTimesByZone('sgr01'));
    expect(e.statusCode).toBe(500);
    expect(e.message).toContain('API Request failed with status 500');
  });

  it('rejects on invalid JSON', async () => {
    const e = await rejection(client(mockFetch({ body: 'invalid json' })).getPrayerTimesByZone('sgr01'));
    expect(e.message).toContain('Failed to parse API response');
  });

  it('rejects on malformed success JSON', async () => {
    const e = await rejection(client(mockFetch({ body: '{"zone": "sgr01", "origin": "JAKIM"}' })).getPrayerTimesByZone('sgr01'));
    expect(e.message).toContain('Failed to parse SolatV2 response');
  });
});

describe('getPrayerTimesByGps', () => {
  it('returns SolatV2 on success', async () => {
    const fetch = mockFetch({ body: solatBody('WLP01') });

    const result = await client(fetch).getPrayerTimesByGps(3.0738, 101.5183);

    expect(result.zone).toBe('WLP01');
    expect(fetch.urls).toEqual([BASE + '/v2/solat/gps/3.0738/101.5183']);
  });

  it('sends year and month', async () => {
    const fetch = mockFetch({ body: solatBody('WLP01') });

    await client(fetch).getPrayerTimesByGps(3.0738, 101.5183, { year: 2025, month: 3 });

    expect(fetch.urls).toEqual([BASE + '/v2/solat/gps/3.0738/101.5183?year=2025&month=3']);
  });

  it('rejects when no zone matches the coordinates', async () => {
    const e = await rejection(client(mockFetch({
      status: 422,
      body: '{"message":"No zone found for the given coordinates."}',
    })).getPrayerTimesByGps(37.42, -122.08));

    expect(e.statusCode).toBe(422);
  });
});

describe('getPrayerTimeByDate', () => {
  // Mirrors the real API: no "date" field, "day" is the day of the month.
  const monthBody = JSON.stringify({
    zone: 'SGR01',
    prayers: [
      { day: 1, hijri: '1446-08-30', fajr: 1740781020, syuruk: 1740784920 },
      { day: 2, hijri: '1446-09-01', fajr: 1740867360, syuruk: 1740871320 },
    ],
  });

  it('falls back to day of month for a calendar date', async () => {
    const fetch = mockFetch({ body: monthBody });

    const result = await client(fetch).getPrayerTimeByDate('SGR01', { year: 2025, month: 3, day: 2 });

    expect(result?.hijri).toBe('1446-09-01');
    expect(fetch.urls).toEqual([BASE + '/v2/solat/SGR01?year=2025&month=3']);
  });

  it('reads a Date as the Malaysia calendar date, whatever the device time zone', async () => {
    const fetch = mockFetch({ body: monthBody });

    // 2025-03-01 16:30 UTC is 00:30 on 2 March in Malaysia, but still 1 March
    // in this test process's time zone (America/Los_Angeles).
    const result = await client(fetch).getPrayerTimeByDate('SGR01', new Date('2025-03-01T16:30:00Z'));

    expect(result?.day).toBe(2);
  });

  it('uses the Malaysia month at a month boundary', async () => {
    const fetch = mockFetch({ body: monthBody });

    // 2025-02-28 16:30 UTC is already 1 March in Malaysia.
    const result = await client(fetch).getPrayerTimeByDate('SGR01', new Date('2025-02-28T16:30:00Z'));

    expect(fetch.urls).toEqual([BASE + '/v2/solat/SGR01?year=2025&month=3']);
    expect(result?.day).toBe(1);
  });

  it('prefers a matching date string', async () => {
    const fetch = mockFetch({
      body: JSON.stringify({
        zone: 'SGR01',
        prayers: [{ day: 2, hijri: 'wrong' }, { day: 9, date: '2025-03-02', hijri: 'right' }],
      }),
    });

    expect((await client(fetch).getPrayerTimeByDate('SGR01', { year: 2025, month: 3, day: 2 }))?.hijri).toBe('right');
  });

  it('returns null when the day is missing', async () => {
    const result = await client(mockFetch({ body: monthBody })).getPrayerTimeByDate('SGR01', { year: 2025, month: 3, day: 15 });
    expect(result).toBeNull();
  });

  it('GPS variant requests the date\'s month', async () => {
    const fetch = mockFetch({ body: monthBody });

    const result = await client(fetch).getPrayerTimeByDateGps(3.0738, 101.5183, { year: 2025, month: 3, day: 1 });

    expect(result?.fajr).toBe(1740781020);
    expect(fetch.urls).toEqual([BASE + '/v2/solat/gps/3.0738/101.5183?year=2025&month=3']);
  });
});

describe('transport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('times out slow requests', async () => {
    vi.useFakeTimers();
    const never = () => new Promise<never>(() => undefined);
    const promise = new WaktuSolatClient({ baseUrl: BASE, fetch: never, timeoutMs: 1000 }).getZones();
    const caught = rejection(promise);

    await vi.advanceTimersByTimeAsync(1000);

    expect((await caught).message).toBe('Network error: Request timed out after 1000ms');
  });

  it('falls back to XMLHttpRequest when fetch is missing', async () => {
    const opened: string[] = [];
    class FakeXhr {
      status = 0;
      responseText = '';
      timeout = 0;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      ontimeout: (() => void) | null = null;
      open(_method: string, url: string) {
        opened.push(url);
      }
      send() {
        this.status = 200;
        this.responseText = zonesBody;
        setTimeout(() => this.onload && this.onload(), 0);
      }
    }
    vi.stubGlobal('fetch', undefined);
    vi.stubGlobal('XMLHttpRequest', FakeXhr);

    const zones = await new WaktuSolatClient({ baseUrl: BASE }).getZones();

    expect(zones).toHaveLength(4);
    expect(opened).toEqual([BASE + '/zones']);
  });
});
