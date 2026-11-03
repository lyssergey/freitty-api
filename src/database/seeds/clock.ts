import { zonedDayAt } from '../../common/time/zoned-time.js';

const MINUTE_MS = 60_000;

/**
 * Seed dates are relative to the moment the seed runs, so the demo always looks
 * "live" (the mockup's 17 Apr 2026 maps to the seed day).
 */
export interface SeedClock {
  readonly now: Date;
  readonly timeZone: string;
  /** Local wall time `HH:MM` on (today + `offsetDays`), as a UTC instant (DST-correct). */
  day(offsetDays: number, time: string): Date;
  /** `minutes` before now. */
  ago(minutes: number): Date;
  /** `minutes` after now. */
  inMin(minutes: number): Date;
}

export function seedClock(now: Date, timeZone: string): SeedClock {
  return {
    now,
    timeZone,
    day: (offsetDays, time) => zonedDayAt(now, timeZone, offsetDays, time),
    ago: (minutes) => new Date(now.getTime() - minutes * MINUTE_MS),
    inMin: (minutes) => new Date(now.getTime() + minutes * MINUTE_MS),
  };
}

export function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * MINUTE_MS);
}
