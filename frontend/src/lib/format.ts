/**
 * @fileoverview Formats prices, changes and dates the way the company page
 * shows them. US English and US dollars throughout, since TickerLens covers
 * NYSE and NASDAQ companies.
 */

const MINUS = '−';

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const USD_COMPACT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumSignificantDigits: 3,
});

const USD_WHOLE = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const MONTH_DAY = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

const MONTH_DAY_YEAR = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

const WEEKDAY_DATE = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

const MONTH = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  timeZone: 'UTC',
});

const NEW_YORK_TIME = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/New_York',
});

const NEW_YORK_DAY = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'America/New_York',
});

/** "$231.45", or "−$0.42" for a loss per share. */
export function formatPrice(value: number): string {
  return value < 0 ? `${MINUS}${USD.format(-value)}` : USD.format(value);
}

/** "$3.45T", "$203B", "$3.17B": for market capitalisation. */
export function formatCompactUsd(value: number): string {
  return USD_COMPACT.format(value);
}

/** "$230": for chart axis ticks, which are always round numbers. */
export function formatAxisPrice(value: number): string {
  return Number.isInteger(value) ? USD_WHOLE.format(value) : USD.format(value);
}

/**
 * Formats a fractional change as a signed percentage with one decimal:
 * "+1.2%", "−0.8%" (with a true minus sign), or "0.0%".
 */
export function formatChange(fraction: number): string {
  const percent = Math.abs(fraction * 100).toFixed(1);
  if (percent === '0.0') {
    return '0.0%';
  }
  return `${fraction > 0 ? '+' : MINUS}${percent}%`;
}

/** "6.1%": an unsigned percentage with one decimal, for use in sentences. */
export function formatPercent(fraction: number): string {
  return `${Math.abs(fraction * 100).toFixed(1)}%`;
}

/** "34.8": for ratios such as P/E. */
export function formatRatio(value: number): string {
  return value.toFixed(1);
}

/** "Oct 16", from YYYY-MM-DD or an ISO timestamp. */
export function formatShortDate(value: string): string {
  return MONTH_DAY.format(toDate(value));
}

/** "Oct 16, 2026" */
export function formatLongDate(value: string): string {
  return MONTH_DAY_YEAR.format(toDate(value));
}

/** "Fri, Oct 16, 2026": for the chart readout. */
export function formatWeekdayDate(value: string): string {
  return WEEKDAY_DATE.format(toDate(value));
}

/** "4:00 PM ET, Oct 20": when figures were last updated, in market time. */
export function formatUpdatedAt(timestamp: string): string {
  const date = new Date(timestamp);
  return `${NEW_YORK_TIME.format(date)} ET, ${NEW_YORK_DAY.format(date)}`;
}

/**
 * Labels an x-axis tick on a chart spanning `spanDays` calendar days: "Oct 13"
 * up to about two months, "Jan ’26" up to about a year, then "2024". Going by
 * the span rather than the chosen range keeps the labels useful for a company
 * that has traded for less time than the range covers.
 */
export function formatAxisDate(day: string, spanDays: number): string {
  const date = toDate(day);
  if (spanDays <= 62) {
    return MONTH_DAY.format(date);
  }
  if (spanDays <= 400) {
    return `${MONTH.format(date)} ’${String(date.getUTCFullYear()).slice(2)}`;
  }
  return String(date.getUTCFullYear());
}

/** Calendar days from `start` to `end`, as YYYY-MM-DD or ISO timestamps. */
export function daysBetween(start: string, end: string): number {
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.round((toDate(end).getTime() - toDate(start).getTime()) / dayMs);
}

/** Date-only strings are calendar days; read them as UTC, not local time. */
function toDate(value: string): Date {
  return new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value,
  );
}
