/**
 * @fileoverview Made-up price histories for the sample data client.
 *
 * Nothing here is real market data. A seeded random walk produces a
 * plausible-looking daily series that ends on a chosen price, so the prototype
 * can show every chart range before a data provider is connected. The same
 * seed always produces the same series, which keeps tests and demos stable.
 */

import type {PricePoint} from '../data/research';
import {weekdaysBetween} from './dates';

const TRADING_DAYS_PER_YEAR = 252;

/** Options for `generateSampleHistory`. */
export interface SampleHistoryOptions {
  /** First calendar day to include, as YYYY-MM-DD. */
  startDate: string;
  /** Last trading day, as YYYY-MM-DD. The series ends on this day. */
  endDate: string;
  /** Closing price on `endDate`. */
  endPrice: number;
  /** Expected yearly return, as a fraction (0.12 is 12%). */
  annualDrift: number;
  /** Yearly volatility, as a fraction. */
  annualVolatility: number;
  /** Seed for the random walk. */
  seed: number;
  /**
   * Daily returns for the most recent sessions, oldest first, so a sample can
   * pin its 1-day and 1-week changes.
   */
  recentReturns?: readonly number[];
  /**
   * Pulls the price back toward `level` dollars with the given yearly
   * strength, for a stock that has traded in a range.
   */
  meanReversion?: {level: number; strength: number};
}

/** Returns a seeded generator of pseudo-random numbers in [0, 1). */
export function seededRandom(seed: number): () => number {
  // mulberry32: tiny and fast, which is all sample data needs.
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generates a made-up daily price history described by `options`. */
export function generateSampleHistory(
  options: SampleHistoryOptions,
): PricePoint[] {
  const days = weekdaysBetween(options.startDate, options.endDate);
  if (days.length === 0) {
    return [];
  }
  const steps = days.length - 1;
  const recent = options.recentReturns ?? [];
  const pinned = recent.slice(Math.max(0, recent.length - steps));
  const random = seededRandom(options.seed);
  const dt = 1 / TRADING_DAYS_PER_YEAR;
  const sigma = options.annualVolatility;
  const drift = (options.annualDrift - (sigma * sigma) / 2) * dt;
  const shock = sigma * Math.sqrt(dt);
  const reversion = options.meanReversion;

  // Walk in log-price space, then shift the whole walk so it ends on
  // endPrice. Shifting keeps every daily return the same.
  let logPrice = Math.log(reversion?.level ?? options.endPrice);
  const logPrices = [logPrice];
  for (let step = 0; step < steps - pinned.length; step++) {
    let change = drift + shock * standardNormal(random);
    if (reversion) {
      change +=
        reversion.strength * (Math.log(reversion.level) - logPrice) * dt;
    }
    logPrice += change;
    logPrices.push(logPrice);
  }
  for (const dailyReturn of pinned) {
    logPrice += Math.log(1 + dailyReturn);
    logPrices.push(logPrice);
  }

  const shift = Math.log(options.endPrice) - logPrice;
  return days.map((date, index) => ({
    date,
    close: roundToCents(Math.exp(logPrices[index] + shift)),
  }));
}

/** Draws from a standard normal distribution (Box-Muller transform). */
function standardNormal(random: () => number): number {
  // 1 - random() is in (0, 1], so the logarithm is always defined.
  const u = 1 - random();
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}
