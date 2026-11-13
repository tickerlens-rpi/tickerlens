/**
 * @fileoverview Picks the price chart's colour from how the price moved over
 * the range on screen: green for a rise, red for a fall, and a blend toward a
 * neutral grey for small moves.
 */

import type {ChartRange} from '../data/research';

/**
 * The change at which each range reaches full green or red. Longer ranges
 * need bigger moves, so a typical week does not look as dramatic as a year.
 */
export const FULL_TREND_CHANGE: Record<ChartRange, number> = {
  '1W': 0.05,
  '1M': 0.1,
  '1Y': 0.3,
  '5Y': 1,
};

/**
 * Returns how strongly a change leans up or down, from -1 (a fall of the
 * range's full-trend size or more) through 0 (flat) to 1 (a rise of that size
 * or more).
 */
export function trendStrength(change: number, range: ChartRange): number {
  if (!Number.isFinite(change)) {
    return 0;
  }
  const strength = change / FULL_TREND_CHANGE[range];
  return Math.max(-1, Math.min(1, strength));
}

/**
 * Returns a CSS colour for the chart: the up or down colour blended with the
 * neutral one in proportion to the trend strength. Mixing in OKLab keeps the
 * in-between shades from turning muddy.
 */
export function trendColor(change: number, range: ChartRange): string {
  const strength = trendStrength(change, range);
  const percent = Math.round(Math.abs(strength) * 100);
  const toward = strength >= 0 ? 'var(--up)' : 'var(--down)';
  return `color-mix(in oklab, ${toward} ${percent}%, var(--trend-flat))`;
}
