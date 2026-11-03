import { describe, expect, it } from 'vitest';
import {
  addCalendarDays,
  formatZonedDate,
  formatZonedDateTime,
  startOfZonedDay,
  startOfZonedIsoWeek,
  toZonedParts,
  zonedDayAt,
  zonedTimeToUtc,
  zoneOffsetMs,
} from './zoned-time.js';

const TZ = 'America/Toronto';
const HOUR = 3_600_000;

describe('zoned time (America/Toronto)', () => {
  it('reads wall-clock parts and ISO weekday', () => {
    expect(toZonedParts(new Date('2026-04-17T14:05:09Z'), TZ)).toEqual({
      year: 2026,
      month: 4,
      day: 17,
      hour: 10,
      minute: 5,
      second: 9,
      weekday: 5, // Friday
    });
    expect(toZonedParts(new Date('2026-04-17T04:30:00Z'), TZ)).toMatchObject({ day: 17, hour: 0 });
  });

  it('knows the offset on both sides of DST', () => {
    expect(zoneOffsetMs(new Date('2026-01-15T12:00:00Z'), TZ)).toBe(-5 * HOUR);
    expect(zoneOffsetMs(new Date('2026-07-15T12:00:00Z'), TZ)).toBe(-4 * HOUR);
  });

  it('converts wall time to UTC in winter and summer', () => {
    const local = { hour: 12, minute: 0 };
    expect(zonedTimeToUtc({ year: 2026, month: 1, day: 15, ...local }, TZ).toISOString()).toBe(
      '2026-01-15T17:00:00.000Z',
    );
    expect(zonedTimeToUtc({ year: 2026, month: 7, day: 15, ...local }, TZ).toISOString()).toBe(
      '2026-07-15T16:00:00.000Z',
    );
  });

  it('handles the DST transition days (8 Mar and 1 Nov 2026)', () => {
    // Day of the spring-forward: noon is already EDT.
    expect(
      zonedTimeToUtc({ year: 2026, month: 3, day: 8, hour: 12, minute: 0 }, TZ).toISOString(),
    ).toBe('2026-03-08T16:00:00.000Z');
    // 02:30 does not exist that night — resolved forward to 03:30 EDT.
    expect(
      zonedTimeToUtc({ year: 2026, month: 3, day: 8, hour: 2, minute: 30 }, TZ).toISOString(),
    ).toBe('2026-03-08T07:30:00.000Z');
    // 01:30 happens twice on 1 Nov — the earlier (EDT) instant wins.
    expect(
      zonedTimeToUtc({ year: 2026, month: 11, day: 1, hour: 1, minute: 30 }, TZ).toISOString(),
    ).toBe('2026-11-01T05:30:00.000Z');
    expect(
      zonedTimeToUtc({ year: 2026, month: 11, day: 1, hour: 5, minute: 0 }, TZ).toISOString(),
    ).toBe('2026-11-01T10:00:00.000Z');
  });

  it('computes seed-style day offsets across a DST change', () => {
    const now = new Date('2026-03-09T14:00:00Z'); // Mon 10:00 EDT, the day after DST started
    expect(zonedDayAt(now, TZ, 0, '09:00').toISOString()).toBe('2026-03-09T13:00:00.000Z');
    expect(zonedDayAt(now, TZ, -1, '09:00').toISOString()).toBe('2026-03-08T13:00:00.000Z');
    expect(zonedDayAt(now, TZ, -2, '09:00').toISOString()).toBe('2026-03-07T14:00:00.000Z'); // still EST
    expect(zonedDayAt(now, TZ, 1, '23:59').toISOString()).toBe('2026-03-11T03:59:00.000Z');
    expect(() => zonedDayAt(now, TZ, 0, '9:00')).toThrow(/HH:MM/);
  });

  it('finds local midnights and ISO week starts', () => {
    // 23:30 EST on Sun 1 Nov is already 2 Nov in UTC.
    const lateSunday = new Date('2026-11-02T04:30:00Z');
    expect(startOfZonedDay(lateSunday, TZ).toISOString()).toBe('2026-11-01T04:00:00.000Z'); // EDT midnight
    expect(startOfZonedDay(lateSunday, TZ, 1).toISOString()).toBe('2026-11-02T05:00:00.000Z'); // EST midnight
    expect(startOfZonedIsoWeek(lateSunday, TZ).toISOString()).toBe('2026-10-26T04:00:00.000Z'); // Mon 26 Oct
    expect(startOfZonedIsoWeek(new Date('2026-11-02T05:00:00Z'), TZ).toISOString()).toBe(
      '2026-11-02T05:00:00.000Z',
    );
  });

  it('formats local dates', () => {
    const instant = new Date('2026-11-03T04:59:00Z'); // 23:59 EST on 2 Nov
    expect(formatZonedDate(instant, TZ)).toBe('2026-11-02');
    expect(formatZonedDateTime(instant, TZ)).toBe('2026-11-02 23:59');
    expect(addCalendarDays({ year: 2026, month: 2, day: 28 }, 1)).toEqual({
      year: 2026,
      month: 3,
      day: 1,
    });
    expect(addCalendarDays({ year: 2026, month: 1, day: 1 }, -1)).toEqual({
      year: 2025,
      month: 12,
      day: 31,
    });
  });
});
