/**
 * @fileoverview Turns a daily price history into what each chart range shows,
 * and derives the day and week changes from it.
 */

import type {ChartRange, PricePoint} from '../data/research';
import {addDays, addMonths, formatDay, parseDay, weekStart} from './dates';

/** Trading sessions in the "1-week change": today's close vs five closes ago. */
const SESSIONS_PER_WEEK = 5;

/**
 * Returns the first calendar day a range covers, counting back from the
 * latest close: one week, one month, one year or five years.
 */
export function rangeStart(lastDay: string, range: ChartRange): string {
  const last = parseDay(lastDay);
  switch (range) {
    case '1W':
      return formatDay(addDays(last, -7));
    case '1M':
      return formatDay(addMonths(last, -1));
    case '1Y':
      return formatDay(addMonths(last, -12));
    case '5Y':
      return formatDay(addMonths(last, -60));
    default: {
      const unreachable: never = range;
      return unreachable;
    }
  }
}

/**
 * Returns the points a chart range shows: every close up to one year, and the
 * last close of each week for five years, so every range draws a similar
 * number of points.
 */
export function pointsForRange(
  history: readonly PricePoint[],
  range: ChartRange,
): PricePoint[] {
  const last = history[history.length - 1];
  if (!last) {
    return [];
  }
  const start = rangeStart(last.date, range);
  const inRange = history.filter(point => point.date >= start);
  return range === '5Y' ? weeklyCloses(inRange) : inRange;
}

/** Keeps the last close of each week; weeks start on Monday. */
export function weeklyCloses(points: readonly PricePoint[]): PricePoint[] {
  const result: PricePoint[] = [];
  for (const point of points) {
    const previous = result[result.length - 1];
    if (previous && weekStart(previous.date) === weekStart(point.date)) {
      result[result.length - 1] = point;
    } else {
      result.push(point);
    }
  }
  return result;
}

/** Fractional change from the first close to the last; 0 if there is none. */
export function changeAcross(points: readonly PricePoint[]): number {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last || first.close === 0) {
    return 0;
  }
  return last.close / first.close - 1;
}

/** Change since the previous close, as a fraction. */
export function dayChange(history: readonly PricePoint[]): number {
  return changeAcross(history.slice(-2));
}

/** Change over the last five trading sessions, as a fraction. */
export function weekChange(history: readonly PricePoint[]): number {
  return changeAcross(history.slice(-(SESSIONS_PER_WEEK + 1)));
}
