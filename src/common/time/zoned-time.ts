/**
 * Minimal time-zone math on top of `Intl` (no date library): converting between
 * UTC instants and wall-clock time in an IANA zone, DST-correct.
 */

export interface CalendarDate {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
}

export interface LocalDateTime extends CalendarDate {
  hour: number;
  minute: number;
  second?: number;
}

export interface ZonedParts extends Required<LocalDateTime> {
  /** ISO weekday: 1 = Monday … 7 = Sunday. */
  weekday: number;
}

const DAY_MS = 86_400_000;
const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

// Building an Intl.DateTimeFormat is relatively expensive; keep one per zone.
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** Wall-clock reading of `instant` in `timeZone`. */
export function toZonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts: Record<string, string> = {};
  for (const { type, value } of formatterFor(timeZone).formatToParts(instant)) parts[type] = value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAYS[parts.weekday] ?? Number.NaN,
  };
}

/** Offset of `timeZone` from UTC at `instant`, in ms (local − UTC; −5 h for Toronto in winter). */
export function zoneOffsetMs(instant: Date, timeZone: string): number {
  const p = toZonedParts(instant, timeZone);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const wholeSeconds = Math.floor(instant.getTime() / 1000) * 1000;
  return wallAsUtc - wholeSeconds;
}

/**
 * The instant at which clocks in `timeZone` show `local`. Wall times skipped by a
 * DST jump resolve forward (02:30 → 03:30); repeated ones pick the earlier instant
 * (in every zone, east or west of UTC).
 */
export function zonedTimeToUtc(local: LocalDateTime, timeZone: string): Date {
  const wallAsUtc = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second ?? 0,
  );
  // One candidate per offset in force a day before and a day after the wall time.
  const candidate = (shiftMs: number) =>
    wallAsUtc - zoneOffsetMs(new Date(wallAsUtc + shiftMs), timeZone);
  const before = candidate(-DAY_MS);
  const after = candidate(DAY_MS);
  if (before === after) return new Date(before); // no transition nearby
  // A transition is near: keep the candidates whose wall time reads back as `local`.
  // Both do for a repeated wall time (take the earlier), neither for a skipped one:
  // `before` then lands after the jump, i.e. the wall time pushed forward.
  const readsBack = [before, after].filter(
    (instant) => instant + zoneOffsetMs(new Date(instant), timeZone) === wallAsUtc,
  );
  return new Date(readsBack.length > 0 ? Math.min(...readsBack) : before);
}

/** Calendar arithmetic on a plain date (no zone involved). */
export function addCalendarDays(date: CalendarDate, days: number): CalendarDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day) + days * DAY_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** Local midnight of the day containing `instant`, shifted by `dayOffset` calendar days. */
export function startOfZonedDay(instant: Date, timeZone: string, dayOffset = 0): Date {
  const date = addCalendarDays(toZonedParts(instant, timeZone), dayOffset);
  return zonedTimeToUtc({ ...date, hour: 0, minute: 0 }, timeZone);
}

/** Local Monday 00:00 of the ISO week containing `instant`. */
export function startOfZonedIsoWeek(instant: Date, timeZone: string): Date {
  return startOfZonedDay(instant, timeZone, 1 - toZonedParts(instant, timeZone).weekday);
}

/**
 * `HH:MM` wall time on the local day `dayOffset` days from the day of `now`
 * (`dayOffset` 0 = today, -1 = yesterday) — e.g. `zonedDayAt(now, tz, -1, '15:20')`.
 */
export function zonedDayAt(now: Date, timeZone: string, dayOffset: number, time: string): Date {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) throw new Error(`Expected HH:MM, got "${time}"`);
  const date = addCalendarDays(toZonedParts(now, timeZone), dayOffset);
  return zonedTimeToUtc({ ...date, hour: Number(match[1]), minute: Number(match[2]) }, timeZone);
}

const pad = (n: number, width = 2): string => String(n).padStart(width, '0');

/** `YYYY-MM-DD` of `instant` in `timeZone`. */
export function formatZonedDate(instant: Date, timeZone: string): string {
  const p = toZonedParts(instant, timeZone);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`;
}

/** `YYYY-MM-DD HH:mm` of `instant` in `timeZone`. */
export function formatZonedDateTime(instant: Date, timeZone: string): string {
  const p = toZonedParts(instant, timeZone);
  return `${formatZonedDate(instant, timeZone)} ${pad(p.hour)}:${pad(p.minute)}`;
}
