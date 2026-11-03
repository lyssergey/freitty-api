import { describe, expect, it } from 'vitest';
import { ACTIVITY_BUCKETS, completedWindows, datePresetRange, DAY_MS } from './periods.js';

const TZ = 'America/Toronto';
const iso = (d: Date | null) => d?.toISOString() ?? null;

describe('datePresetRange', () => {
  const now = new Date('2026-04-17T14:00:00Z'); // Fri 17 Apr, 10:00 EDT

  it('today = local midnight to the next local midnight', () => {
    const { from, to } = datePresetRange('today', now, TZ);
    expect([iso(from), iso(to)]).toEqual(['2026-04-17T04:00:00.000Z', '2026-04-18T04:00:00.000Z']);
  });

  it('week = local ISO week, Monday 00:00 + 7 days', () => {
    const { from, to } = datePresetRange('week', now, TZ);
    expect([iso(from), iso(to)]).toEqual(['2026-04-13T04:00:00.000Z', '2026-04-20T04:00:00.000Z']);
  });

  it('a week spanning the end of DST is 7 calendar days (169 hours)', () => {
    const { from, to } = datePresetRange('week', new Date('2026-11-03T13:00:00Z'), TZ);
    expect([iso(from), iso(to)]).toEqual(['2026-11-02T05:00:00.000Z', '2026-11-09T05:00:00.000Z']);
    const dstWeek = datePresetRange('week', new Date('2026-10-28T12:00:00Z'), TZ);
    expect((dstWeek.to!.getTime() - dstWeek.from!.getTime()) / 3_600_000).toBe(169);
  });

  it('today follows the local date, not the UTC one', () => {
    const lateEvening = new Date('2026-04-18T03:30:00Z'); // still 17 Apr, 23:30 EDT
    expect(iso(datePresetRange('today', lateEvening, TZ).from)).toBe('2026-04-17T04:00:00.000Z');
  });

  it('30d has no upper bound (upcoming orders included) and all has no bounds', () => {
    expect(datePresetRange('30d', now, TZ)).toEqual({
      from: new Date(now.getTime() - 30 * DAY_MS),
      to: null,
    });
    expect(datePresetRange('all', now, TZ)).toEqual({ from: null, to: null });
  });
});

describe('activity buckets', () => {
  it('uses 14 days, 12 ISO weeks, 12 months and 6 quarters', () => {
    expect(
      Object.fromEntries(Object.entries(ACTIVITY_BUCKETS).map(([k, v]) => [k, [v.step, v.count]])),
    ).toEqual({
      day: ['1 day', 14],
      week: ['1 week', 12],
      month: ['1 month', 12],
      quarter: ['3 months', 6],
    });
  });
});

describe('completedWindows', () => {
  it('splits the last 60 days into two rolling 30-day windows', () => {
    const now = new Date('2026-04-17T14:00:00Z');
    const { last30d, previous30d } = completedWindows(now);
    expect(last30d.until).toEqual(now);
    expect(last30d.after).toEqual(previous30d.until);
    expect(now.getTime() - previous30d.after.getTime()).toBe(60 * DAY_MS);
  });
});
