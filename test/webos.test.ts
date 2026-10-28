import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDeviceTimeZone, isMalaysiaTimeZone, isWebOS, webOSVersion } from '../src/webos.js';

// User agents from LG's "Web API and Web Engine" page.
const UA_WEBOS_6 = 'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.36 WebAppManager';
const UA_WEBOS_3 = 'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/38.0.2125.122 Safari/537.36 WebAppManager';
const UA_WEBOS_2 = 'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/538.2 (KHTML, like Gecko) Large Screen WebAppManager Safari/538.2';
const UA_DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';

describe('webOS detection', () => {
  it('detects webOS and its version from the user agent', () => {
    expect(isWebOS(UA_WEBOS_6)).toBe(true);
    expect(webOSVersion(UA_WEBOS_6)).toBe('6');
    expect(webOSVersion(UA_WEBOS_3)).toBe('3');
    expect(isWebOS(UA_WEBOS_2)).toBe(true);
    expect(webOSVersion(UA_WEBOS_2)).toBeNull();
    expect(isWebOS(UA_DESKTOP)).toBe(false);
    expect(webOSVersion(UA_DESKTOP)).toBeNull();
  });

  it('recognises Malaysian time zones', () => {
    expect(isMalaysiaTimeZone('Asia/Kuala_Lumpur')).toBe(true);
    expect(isMalaysiaTimeZone('Asia/Kuching')).toBe(true);
    expect(isMalaysiaTimeZone('Europe/London')).toBe(false);
    expect(isMalaysiaTimeZone(null)).toBe(false);
  });
});

describe('getDeviceTimeZone', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('reads webOS.systemInfo.timezone first', async () => {
    vi.stubGlobal('window', { webOS: { systemInfo: { timezone: 'Asia/Kuching' } } });
    expect(await getDeviceTimeZone()).toBe('Asia/Kuching');
  });

  it('calls the Luna system service through webOSTV.js', async () => {
    const calls: unknown[] = [];
    vi.stubGlobal('window', {
      webOS: {
        service: {
          request(uri: string, options: { method: string; onSuccess: (r: unknown) => void }) {
            calls.push([uri, options.method]);
            options.onSuccess({ returnValue: true, timezone: 'Asia/Kuala_Lumpur' });
          },
        },
      },
    });

    expect(await getDeviceTimeZone()).toBe('Asia/Kuala_Lumpur');
    expect(calls).toEqual([['luna://com.palm.systemservice', 'time/getSystemTime']]);
  });

  it('uses an injected request function (e.g. Enact LS2Request)', async () => {
    const request = vi.fn().mockResolvedValue({ timezone: 'Asia/Kuala_Lumpur' });

    expect(await getDeviceTimeZone({ request })).toBe('Asia/Kuala_Lumpur');
    expect(request).toHaveBeenCalledWith('luna://com.palm.systemservice', 'time/getSystemTime', {});
  });

  it('falls back to Intl when Luna fails or times out', async () => {
    expect(await getDeviceTimeZone({ request: () => Promise.reject(new Error('denied')) })).toBe('America/Los_Angeles');

    vi.useFakeTimers();
    const pending = getDeviceTimeZone({ request: () => new Promise(() => undefined), timeoutMs: 500 });
    await vi.advanceTimersByTimeAsync(500);
    expect(await pending).toBe('America/Los_Angeles');
  });

  it('falls back to Intl outside webOS', async () => {
    expect(await getDeviceTimeZone()).toBe('America/Los_Angeles');
  });
});
