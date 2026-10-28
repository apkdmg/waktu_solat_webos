import { describe, expect, it } from 'vitest';
import { formatCalendarDate, formatMalaysiaTime, malaysiaDateOf } from '../src/malaysia.js';

describe('Malaysia time helpers', () => {
  it('gives the Malaysia calendar date at an instant', () => {
    expect(malaysiaDateOf(new Date('2025-03-01T15:59:59Z'))).toEqual({ year: 2025, month: 3, day: 1 });
    expect(malaysiaDateOf(new Date('2025-03-01T16:00:00Z'))).toEqual({ year: 2025, month: 3, day: 2 });
    expect(malaysiaDateOf(new Date('2025-12-31T16:00:00Z'))).toEqual({ year: 2026, month: 1, day: 1 });
  });

  it('formats prayer times as 24-hour Malaysia time', () => {
    // 1740781020 is Subuh on 1 March 2025 in SGR01: 22:17 UTC, 06:17 in Malaysia.
    expect(formatMalaysiaTime(1740781020)).toBe('06:17');
    expect(formatMalaysiaTime(1740828540)).toBe('19:29');
    expect(formatMalaysiaTime(null)).toBe('--:--');
  });

  it('formats calendar dates', () => {
    expect(formatCalendarDate({ year: 2025, month: 3, day: 2 })).toBe('2025-03-02');
  });
});
