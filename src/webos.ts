/**
 * Optional helpers for LG webOS TV apps: detect webOS and read the TV's time zone.
 *
 * Nothing here is needed to fetch prayer times. They let an app check whether
 * the TV is set to a Malaysian time zone, for example to suggest a zone or warn
 * the user. The library never uses them for time arithmetic.
 */

/**
 * Calls a Luna service and resolves with its response. Lets Enact apps pass
 * `@enact/webos/LS2Request` instead of webOSTV.js. `service` is a full URI
 * such as `luna://com.palm.systemservice`.
 */
export type LunaRequest = (service: string, method: string, parameters: object) => Promise<unknown>;

export interface DeviceTimeZoneOptions {
  /** A Luna request function. Defaults to `window.webOS.service.request` from webOSTV.js, if loaded. */
  request?: LunaRequest;
  /** How long to wait for the Luna call, in milliseconds. Defaults to 3000. */
  timeoutMs?: number;
}

interface WebOSGlobal {
  systemInfo?: { timezone?: string };
  service?: {
    request(
      uri: string,
      options: {
        method: string;
        parameters?: object;
        onSuccess?: (response: unknown) => void;
        onFailure?: (error: unknown) => void;
      }
    ): unknown;
  };
}

/** Chromium major version → webOS TV version, from LG's "Web API and Web Engine" table. */
const CHROMIUM_TO_WEBOS: { [chromium: string]: string } = {
  '38': '3',
  '53': '4',
  '68': '5',
  '79': '6',
  '87': '22',
  '94': '23',
  '108': '24',
  '120': '25',
  '132': '26',
};

const MALAYSIA_TIME_ZONES = ['Asia/Kuala_Lumpur', 'Asia/Kuching', 'Asia/Singapore'];

function webOSGlobal(): WebOSGlobal | undefined {
  return typeof window !== 'undefined' ? (window as unknown as { webOS?: WebOSGlobal }).webOS : undefined;
}

function defaultUserAgent(): string {
  return typeof navigator !== 'undefined' ? navigator.userAgent : '';
}

/** Returns `true` when running on an LG webOS TV (user agent contains "Web0S" or "webOS"). */
export function isWebOS(userAgent: string = defaultUserAgent()): boolean {
  return /Web0S|webOS/.test(userAgent);
}

/**
 * Guesses the webOS TV version ("3", "4", "5", "6", "22" … "26") from the user agent's
 * Chromium version, or returns `null` when unknown (including webOS 1.x/2.x, which use WebKit).
 * For an exact answer use `sdkVersion` from webOSTV.js `webOS.deviceInfo()`.
 */
export function webOSVersion(userAgent: string = defaultUserAgent()): string | null {
  if (!isWebOS(userAgent)) return null;
  const match = /Chrome\/(\d+)/.exec(userAgent);
  return match ? CHROMIUM_TO_WEBOS[match[1]] || null : null;
}

/** Returns `true` for time zones that use Malaysia time (UTC+8). */
export function isMalaysiaTimeZone(timeZone: string | null): boolean {
  if (!timeZone) return false;
  for (const zone of MALAYSIA_TIME_ZONES) {
    if (zone === timeZone) return true;
  }
  return false;
}

function webOSRequest(): LunaRequest | undefined {
  const webOS = webOSGlobal();
  const service = webOS && webOS.service;
  if (!service) return undefined;
  return (uri, method, parameters) =>
    new Promise((resolve, reject) => {
      service.request(uri, { method: method, parameters: parameters, onSuccess: resolve, onFailure: reject });
    });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Luna request timed out')), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function intlTimeZone(): string | null {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone || null;
  } catch (e) {
    return null;
  }
}

/**
 * Reads the TV's IANA time zone, e.g. "Asia/Kuala_Lumpur". Tries, in order:
 * `webOS.systemInfo.timezone` (webOSTV.js), the Luna call
 * `luna://com.palm.systemservice/time/getSystemTime`, then `Intl`.
 * Resolves with `null` if none of them knows; it never rejects.
 */
export function getDeviceTimeZone(options: DeviceTimeZoneOptions = {}): Promise<string | null> {
  const webOS = webOSGlobal();
  const fromSystemInfo = webOS && webOS.systemInfo && webOS.systemInfo.timezone;
  if (fromSystemInfo) return Promise.resolve(fromSystemInfo);

  const request = options.request || webOSRequest();
  if (!request) return Promise.resolve(intlTimeZone());

  return withTimeout(
    request('luna://com.palm.systemservice', 'time/getSystemTime', {}),
    options.timeoutMs !== undefined ? options.timeoutMs : 3000
  ).then(
    (response) => {
      const timeZone = response && (response as { timezone?: unknown }).timezone;
      return typeof timeZone === 'string' && timeZone ? timeZone : intlTimeZone();
    },
    () => intlTimeZone()
  );
}
