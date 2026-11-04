/**
 * @fileoverview Calendar-day helpers. Trading days are plain YYYY-MM-DD
 * strings handled in UTC, so no time zone can shift a date by one.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Parses YYYY-MM-DD into a Date at midnight UTC. */
export function parseDay(day: string): Date {
  // Check the shape first: the Date parser accepts text like "20 October".
  const date = new Date(`${day}T00:00:00Z`);
  if (!DAY_PATTERN.test(day) || Number.isNaN(date.getTime())) {
    throw new Error(`Expected a YYYY-MM-DD date, got "${day}"`);
  }
  return date;
}

/** Formats a Date as YYYY-MM-DD in UTC. */
export function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Returns the date `days` days after `date` (negative goes back). */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * Returns the date `months` months after `date`, keeping the day of the month
 * where it exists and clamping to the month's last day where it does not
 * (March 31 minus one month is February 28 or 29).
 */
export function addMonths(date: Date, months: number): Date {
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );
  const lastDayOfTarget = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDayOfTarget));
  return target;
}

/** Returns the Monday that starts the week containing `day`, as YYYY-MM-DD. */
export function weekStart(day: string): string {
  const date = parseDay(day);
  // getUTCDay() is 0 for Sunday; count Sunday as the end of the week.
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  return formatDay(addDays(date, -daysSinceMonday));
}

/** Lists the weekdays from `start` to `end` inclusive. Holidays are ignored. */
export function weekdaysBetween(start: string, end: string): string[] {
  const days: string[] = [];
  const last = parseDay(end);
  for (let date = parseDay(start); date <= last; date = addDays(date, 1)) {
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      days.push(formatDay(date));
    }
  }
  return days;
}
