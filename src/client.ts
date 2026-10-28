import { FormatError, WaktuSolatApiException } from './errors.js';
import { FetchLike, httpGet, HttpResponse } from './http.js';
import {
  ApiError,
  isObject,
  parseApiError,
  parseSolatV2,
  parseZoneInfo,
  PrayerTime,
  SolatV2,
  WaktuState,
  ZoneInfo,
} from './models.js';
import { CalendarDate, formatCalendarDate, malaysiaDateOf } from './malaysia.js';

/** The base URL for the Waktu Solat API. */
export const DEFAULT_BASE_URL = 'https://api.waktusolat.app';

export interface WaktuSolatClientOptions {
  /** The API base URL. Override only for testing. */
  baseUrl?: string;
  /** A `fetch` implementation. Defaults to the global `fetch`, or `XMLHttpRequest` where it is missing. */
  fetch?: FetchLike;
  /** Request timeout in milliseconds. Defaults to 15000; 0 disables it. */
  timeoutMs?: number;
}

export interface MonthOptions {
  /** The year (e.g., 2025). If omitted, the API defaults to the current year. */
  year?: number;
  /** The month (1-12). If omitted, the API defaults to the current month. */
  month?: number;
}

/**
 * A client for the Waktu Solat API v2 (https://api.waktusolat.app/docs).
 *
 * Provides methods to fetch prayer times, state lists, and zone lists.
 * Every method returns a Promise that rejects with {@link WaktuSolatApiException} on failure.
 */
export class WaktuSolatClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike | undefined;
  private readonly timeoutMs: number;

  constructor(options: WaktuSolatClientOptions = {}) {
    this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.fetchImpl = options.fetch;
    this.timeoutMs = options.timeoutMs !== undefined ? options.timeoutMs : 15000;
  }

  /**
   * Fetches the list of all Malaysian states and their corresponding zones.
   *
   * The API no longer has a states endpoint (`/v2/negeri` returns 404), so
   * this groups the `/zones` response by `negeri`, in the order the API returns them.
   */
  async getStates(): Promise<WaktuState[]> {
    const zones = await this.getZones();
    const states: WaktuState[] = [];
    const byName: { [negeri: string]: WaktuState } = {};

    for (const zone of zones) {
      let state = byName[zone.negeri];
      if (!state) {
        state = byName[zone.negeri] = { negeri: zone.negeri, zones: [] };
        states.push(state);
      }
      state.zones.push(zone.jakimCode);
    }

    return states;
  }

  /**
   * Fetches the list of all prayer zones with state and district details.
   *
   * Corresponds to the `/zones` endpoint. See zones visually at https://peta.waktusolat.app
   */
  async getZones(): Promise<ZoneInfo[]> {
    const response = await this.getRequest(['zones']);

    if (!Array.isArray(response)) {
      throw new WaktuSolatApiException(
        'Unexpected response format received for /zones. Expected a List of zone objects.'
      );
    }

    try {
      return response.map(parseZoneInfo);
    } catch (e) {
      throw new WaktuSolatApiException('Failed to parse zone info list response: ' + (e as Error).message);
    }
  }

  /**
   * Fetches prayer times for a specific zone, optionally for a given year and month.
   *
   * Corresponds to the `/v2/solat/{zone}` endpoint.
   *
   * @param zone The zone code (e.g., "SGR01"). Valid zones come from {@link getZones} or {@link getStates}.
   */
  getPrayerTimesByZone(zone: string, options: MonthOptions = {}): Promise<SolatV2> {
    return this.getSolatV2(['v2', 'solat', zone], options);
  }

  /**
   * Fetches prayer times based on GPS coordinates, optionally for a given year and month.
   *
   * Corresponds to the `/v2/solat/gps/{lat}/{long}` endpoint.
   */
  getPrayerTimesByGps(latitude: number, longitude: number, options: MonthOptions = {}): Promise<SolatV2> {
    return this.getSolatV2(['v2', 'solat', 'gps', String(latitude), String(longitude)], options);
  }

  /**
   * Fetches prayer times for a specific date.
   *
   * Pass a `Date` to use the Malaysia calendar date at that instant, so
   * `new Date()` means "today in Malaysia" even when the TV is set to another
   * time zone. Pass `{ year, month, day }` for an exact calendar date.
   *
   * Fetches that date's month and returns the day's entry, or `null` if the
   * API returned none for that day.
   */
  async getPrayerTimeByDate(zone: string, date: Date | CalendarDate): Promise<PrayerTime | null> {
    const day = toCalendarDate(date);
    const solatV2 = await this.getPrayerTimesByZone(zone, { year: day.year, month: day.month });
    return findDay(solatV2, day);
  }

  /**
   * Fetches prayer times for a specific date using GPS coordinates.
   *
   * `date` works as in {@link getPrayerTimeByDate}. Returns `null` if the API
   * returned no entry for that day.
   */
  async getPrayerTimeByDateGps(
    latitude: number,
    longitude: number,
    date: Date | CalendarDate
  ): Promise<PrayerTime | null> {
    const day = toCalendarDate(date);
    const solatV2 = await this.getPrayerTimesByGps(latitude, longitude, { year: day.year, month: day.month });
    return findDay(solatV2, day);
  }

  private async getSolatV2(pathSegments: string[], options: MonthOptions): Promise<SolatV2> {
    const query: string[] = [];
    if (options.year !== undefined) query.push('year=' + options.year);
    if (options.month !== undefined) query.push('month=' + options.month);

    const response = await this.getRequest(pathSegments, query);

    try {
      return parseSolatV2(response);
    } catch (e) {
      throw new WaktuSolatApiException('Failed to parse SolatV2 response: ' + (e as Error).message);
    }
  }

  /**
   * Performs a GET request and handles common errors.
   *
   * Rejects with {@link WaktuSolatApiException} for:
   *   - Status codes >= 400 (parsing {@link ApiError} if possible).
   *   - `status: "error"` in the JSON response body (even with 200 OK).
   *   - Network errors and timeouts.
   *   - JSON decoding errors.
   */
  private async getRequest(pathSegments: string[], query: string[] = []): Promise<unknown> {
    const url = this.baseUrl + '/' + pathSegments.map(encodeURIComponent).join('/') +
      (query.length ? '?' + query.join('&') : '');

    let response: HttpResponse;
    try {
      response = await httpGet(url, this.timeoutMs, this.fetchImpl);
    } catch (e) {
      throw new WaktuSolatApiException('Network error: ' + (e as Error).message);
    }

    if (response.status >= 400) {
      const apiError = tryParseApiError(response.body);
      if (apiError) {
        throw new WaktuSolatApiException('API Error: ' + apiError.message, response.status, apiError);
      }
      throw new WaktuSolatApiException(
        'API Request failed with status ' + response.status + '. Response: ' + response.body,
        response.status
      );
    }

    let json: unknown;
    try {
      json = JSON.parse(response.body);
    } catch (e) {
      throw new WaktuSolatApiException('Failed to parse API response: ' + (e as Error).message);
    }

    // Handle API errors returned with 200 OK ({"status": "error", ...})
    if (isObject(json) && json.status === 'error') {
      let apiError: ApiError;
      try {
        apiError = parseApiError(json);
      } catch (e) {
        throw new WaktuSolatApiException('An unexpected error occurred: ' + (e as Error).message);
      }
      throw new WaktuSolatApiException(apiError.message, response.status, apiError);
    }

    return json;
  }
}

/** Parses `body` as an {@link ApiError}, or returns `null` if it isn't one. */
function tryParseApiError(body: string): ApiError | null {
  try {
    const json: unknown = JSON.parse(body);
    return isObject(json) ? parseApiError(json) : null;
  } catch (e) {
    if (e instanceof SyntaxError || e instanceof FormatError) return null;
    throw e;
  }
}

function toCalendarDate(date: Date | CalendarDate): CalendarDate {
  return date instanceof Date ? malaysiaDateOf(date) : date;
}

/** Matches by Gregorian date string first, then falls back to day of month. */
function findDay(solatV2: SolatV2, date: CalendarDate): PrayerTime | null {
  const dateString = formatCalendarDate(date);
  const prayerTimes = solatV2.prayerTime;

  for (const prayerTime of prayerTimes) {
    if (prayerTime.date === dateString) return prayerTime;
  }
  for (const prayerTime of prayerTimes) {
    if (prayerTime.day === date.day) return prayerTime;
  }
  return null;
}
