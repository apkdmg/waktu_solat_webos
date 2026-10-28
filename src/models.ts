import { FormatError } from './errors.js';

/** Represents an error response from the Waktu Solat API: `{"status": "error", "message": "..."}`. */
export interface ApiError {
  /** The status indication, usually "error". */
  status: string;
  /** The descriptive error message from the API. */
  message: string;
}

/** Represents a Malaysian state and its associated prayer zone codes. */
export interface WaktuState {
  /** The name of the state (e.g., "Johor"). */
  negeri: string;
  /** The prayer zone codes belonging to this state (e.g., ["JHR01", "JHR02"]). */
  zones: string[];
}

/** Zone information: the JAKIM code, the state (negeri), and the district/area (daerah). */
export interface ZoneInfo {
  /** The JAKIM zone code (e.g., "JHR01", "SGR02"). */
  jakimCode: string;
  /** The name of the state (negeri) the zone belongs to. */
  negeri: string;
  /** The name of the district or area (daerah) covered by the zone. */
  daerah: string;
}

/**
 * Prayer times for a single day.
 *
 * All times are Unix timestamps in seconds; use {@link toDate} to convert one.
 */
export interface PrayerTime {
  /** Hijri date string (format: YYYY-MM-DD). */
  hijri: string;
  /** Gregorian date string (format: YYYY-MM-DD). The API usually omits it. */
  date: string | null;
  /** Day of the month. */
  day: number;
  /** Imsak time. Calculated as 10 minutes before Fajr when the API omits it. */
  imsak: number | null;
  /** Fajr (Subuh) time. */
  fajr: number | null;
  /** Syuruk time. */
  syuruk: number | null;
  /** Dhuhr (Zohor) time. */
  dhuhr: number | null;
  /** Asr time. */
  asr: number | null;
  /** Maghrib time. */
  maghrib: number | null;
  /** Isha time. */
  isha: number | null;
  /** Isyraq time, calculated as 15 minutes after Syuruk. */
  isyraq: number | null;
}

/** Prayer times for a zone, typically one entry per day of the requested month. */
export interface SolatV2 {
  /** The prayer zone code (e.g., "SGR01"). */
  zone: string;
  /** The source or origin of the prayer time data (e.g., "JAKIM"). May be null. */
  origin: string | null;
  /** Prayer times, one entry per day. */
  prayerTime: PrayerTime[];
}

/** Converts a prayer time (Unix seconds) to a `Date`, or returns `null` if it is missing. */
export function toDate(unixSeconds: number | null): Date | null {
  return unixSeconds === null ? null : new Date(unixSeconds * 1000);
}

type JsonObject = { [key: string]: unknown };

export function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && isFinite(value) && Math.floor(value) === value;
}

function typeName(value: unknown): string {
  if (value === null || value === undefined) return 'Null';
  if (Array.isArray(value)) return 'List';
  if (isInteger(value)) return 'int';
  return typeof value;
}

export function parseApiError(json: JsonObject): ApiError {
  if (typeof json.status !== 'string' || typeof json.message !== 'string') {
    throw new FormatError('Invalid JSON structure for ApiError');
  }
  return { status: json.status, message: json.message };
}

export function parseZoneInfo(json: unknown): ZoneInfo {
  if (!isObject(json) || typeof json.jakimCode !== 'string' ||
    typeof json.negeri !== 'string' || typeof json.daerah !== 'string') {
    throw new FormatError('Invalid JSON format for ZoneInfo: ' + JSON.stringify(json));
  }
  return { jakimCode: json.jakimCode, negeri: json.negeri, daerah: json.daerah };
}

/** Parses a nullable time field, accepting an integer or a numeric string (legacy). */
function parseTime(json: JsonObject, field: string): number | null {
  const value = json[field];
  if (value === null || value === undefined) return null;
  if (isInteger(value)) return value;
  if (typeof value === 'string') {
    if (!/^-?\d+$/.test(value)) {
      throw new FormatError('Invalid non-integer String field: ' + field + ' in PrayerTime JSON');
    }
    return parseInt(value, 10);
  }
  throw new FormatError(
    'Invalid or missing Int field: ' + field + ' in PrayerTime JSON (got ' + typeName(value) + ')'
  );
}

export function parsePrayerTime(json: unknown): PrayerTime {
  if (!isObject(json)) {
    throw new FormatError('Expected object inside prayers list');
  }
  if (typeof json.hijri !== 'string') {
    throw new FormatError('Invalid or missing String field: hijri in PrayerTime JSON');
  }
  if (json.date !== undefined && json.date !== null && typeof json.date !== 'string') {
    throw new FormatError('Invalid field type: date (must be String or null) in PrayerTime JSON');
  }
  if (!isInteger(json.day)) {
    throw new FormatError(
      'Invalid or missing Int field: day in PrayerTime JSON (got ' + typeName(json.day) + ')'
    );
  }

  const imsak = parseTime(json, 'imsak');
  const fajr = parseTime(json, 'fajr');
  const syuruk = parseTime(json, 'syuruk');

  return {
    hijri: json.hijri,
    date: typeof json.date === 'string' ? json.date : null,
    day: json.day,
    imsak: imsak !== null ? imsak : fajr !== null ? fajr - 10 * 60 : null,
    fajr: fajr,
    syuruk: syuruk,
    dhuhr: parseTime(json, 'dhuhr'),
    asr: parseTime(json, 'asr'),
    maghrib: parseTime(json, 'maghrib'),
    isha: parseTime(json, 'isha'),
    isyraq: syuruk !== null ? syuruk + 15 * 60 : null,
  };
}

export function parseSolatV2(json: unknown): SolatV2 {
  if (!isObject(json) || typeof json.zone !== 'string') {
    throw new FormatError('Invalid or missing field (zone) in SolatV2 JSON');
  }
  // API uses 'prayers', model uses 'prayerTime'
  if (!Array.isArray(json.prayers)) {
    throw new FormatError('Missing or invalid field: prayers in SolatV2 JSON');
  }

  let prayerTime: PrayerTime[];
  try {
    prayerTime = json.prayers.map(parsePrayerTime);
  } catch (e) {
    throw new FormatError('Failed to parse prayerTime list in SolatV2 JSON: ' + (e as Error).message);
  }

  return {
    zone: json.zone,
    origin: typeof json.origin === 'string' ? json.origin : null,
    prayerTime: prayerTime,
  };
}
