import { describe, expect, it } from 'vitest';
import { malaysiaDateOf, WaktuSolatApiException, WaktuSolatClient } from '../src/index.js';

// Hits the real api.waktusolat.app. Run with `npm run test:live`.
describe.runIf(process.env.LIVE)('live API', () => {
  const client = new WaktuSolatClient();

  it('fetches states and zones', async () => {
    expect((await client.getStates()).length).toBeGreaterThan(10);
    expect((await client.getZones()).some((zone) => zone.jakimCode === 'SGR01')).toBe(true);
  });

  it('fetches prayer times by zone and GPS', async () => {
    const byZone = await client.getPrayerTimesByZone('SGR01', { year: 2025, month: 3 });
    expect(byZone.zone).toBe('SGR01');
    expect(byZone.prayerTime).toHaveLength(31);
    expect(byZone.prayerTime[0].isyraq).not.toBeNull();

    expect((await client.getPrayerTimesByGps(3.0738, 101.5183)).prayerTime.length).toBeGreaterThan(0);
  });

  it('fetches today in Malaysia', async () => {
    const today = malaysiaDateOf(new Date());
    expect((await client.getPrayerTimeByDate('SGR01', new Date()))?.day).toBe(today.day);
  });

  it('reports an unknown zone', async () => {
    await expect(client.getPrayerTimesByZone('XXX99')).rejects.toBeInstanceOf(WaktuSolatApiException);
  });
});
