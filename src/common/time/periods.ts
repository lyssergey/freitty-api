import { startOfZonedDay, startOfZonedIsoWeek } from './zoned-time.js';

export const DAY_MS = 86_400_000;

/** Order-list date filter. Applies to the order date `COALESCE(scheduled_at, created_at)`. */
export const DatePreset = {
  TODAY: 'today',
  WEEK: 'week',
  LAST_30_DAYS: '30d',
  ALL: 'all',
} as const;
export type DatePreset = (typeof DatePreset)[keyof typeof DatePreset];

/** Half-open instant range `[from, to)`; `null` = unbounded on that side. */
export interface InstantRange {
  from: Date | null;
  to: Date | null;
}

/**
 * Resolves a date preset to instants, using local calendar days in `timeZone`:
 * - `today` — local midnight to the next local midnight;
 * - `week`  — local ISO week (Monday 00:00, 7 calendar days);
 * - `30d`   — the last 30 days with no upper bound (upcoming orders included);
 * - `all`   — no restriction.
 */
export function datePresetRange(preset: DatePreset, now: Date, timeZone: string): InstantRange {
  switch (preset) {
    case DatePreset.TODAY:
      return { from: startOfZonedDay(now, timeZone), to: startOfZonedDay(now, timeZone, 1) };
    case DatePreset.WEEK: {
      const from = startOfZonedIsoWeek(now, timeZone);
      return { from, to: startOfZonedDay(from, timeZone, 7) };
    }
    case DatePreset.LAST_30_DAYS:
      return { from: new Date(now.getTime() - 30 * DAY_MS), to: null };
    case DatePreset.ALL:
      return { from: null, to: null };
  }
}

/** Granularity of the dashboard activity chart. */
export const ActivityPeriod = {
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
  QUARTER: 'quarter',
} as const;
export type ActivityPeriod = (typeof ActivityPeriod)[keyof typeof ActivityPeriod];

export interface ActivityBuckets {
  /** Postgres `date_trunc` field (weeks start on Monday, as ISO weeks do). */
  unit: ActivityPeriod;
  /** `generate_series` step. Postgres has no `1 quarter` interval, hence `3 months`. */
  step: string;
  /** Number of buckets, the last one being the current (partial) bucket. */
  count: number;
}

export const ACTIVITY_BUCKETS: Record<ActivityPeriod, ActivityBuckets> = {
  day: { unit: 'day', step: '1 day', count: 14 },
  week: { unit: 'week', step: '1 week', count: 12 },
  month: { unit: 'month', step: '1 month', count: 12 },
  quarter: { unit: 'quarter', step: '3 months', count: 6 },
};

/** Rolling 30-day windows of the "Completed (30 d)" KPI: `(now − 30d, now]` and the 30 days before. */
export function completedWindows(now: Date): {
  last30d: { after: Date; until: Date };
  previous30d: { after: Date; until: Date };
} {
  const monthAgo = new Date(now.getTime() - 30 * DAY_MS);
  return {
    last30d: { after: monthAgo, until: now },
    previous30d: { after: new Date(now.getTime() - 60 * DAY_MS), until: monthAgo },
  };
}
