/**
 * Malaysia prayer times (waktu solat) API client for LG webOS TV web apps and browsers.
 *
 * @packageDocumentation
 */
export { WaktuSolatClient, DEFAULT_BASE_URL } from './client.js';
export type { WaktuSolatClientOptions, MonthOptions } from './client.js';
export { WaktuSolatApiException } from './errors.js';
export type { FetchLike } from './http.js';
export { toDate } from './models.js';
export type { ApiError, PrayerTime, SolatV2, WaktuState, ZoneInfo } from './models.js';
export { formatMalaysiaTime, malaysiaDateOf, MALAYSIA_UTC_OFFSET_SECONDS } from './malaysia.js';
export type { CalendarDate } from './malaysia.js';
