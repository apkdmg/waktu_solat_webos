/** A calendar date. `month` is 1-12. */
export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

/** Malaysia is UTC+8 all year (no daylight saving time). */
export const MALAYSIA_UTC_OFFSET_SECONDS = 8 * 3600;

function pad2(value: number): string {
  return value < 10 ? '0' + value : String(value);
}

/**
 * Returns the calendar date in Malaysia at the given instant, whatever time
 * zone the TV is set to. `malaysiaDateOf(new Date())` is "today" in Malaysia.
 */
export function malaysiaDateOf(date: Date): CalendarDate {
  const shifted = new Date(date.getTime() + MALAYSIA_UTC_OFFSET_SECONDS * 1000);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

/**
 * Formats a prayer time (Unix seconds) as 24-hour Malaysia time, e.g. "05:48".
 * Uses fixed UTC+8 arithmetic, so it needs no `Intl` time zone data (which
 * older TVs may not have). Returns "--:--" for a missing time.
 */
export function formatMalaysiaTime(unixSeconds: number | null): string {
  if (unixSeconds === null) return '--:--';
  const shifted = new Date((unixSeconds + MALAYSIA_UTC_OFFSET_SECONDS) * 1000);
  return pad2(shifted.getUTCHours()) + ':' + pad2(shifted.getUTCMinutes());
}

/** Formats a calendar date as YYYY-MM-DD. */
export function formatCalendarDate(date: CalendarDate): string {
  return date.year + '-' + pad2(date.month) + '-' + pad2(date.day);
}
