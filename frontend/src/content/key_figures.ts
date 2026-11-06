/**
 * @fileoverview The seven key figures on the company overview (requirement
 * F2) and their plain-language explanations (F3). Each explanation says what
 * the number means for this company and why it might matter, in 60 words or
 * fewer.
 */

import type {Company, Overview} from '../data/research';
import {shortName} from '../lib/text';
import {
  formatChange,
  formatCompactUsd,
  formatPercent,
  formatPrice,
  formatRatio,
} from '../lib/format';

/** The longest an explanation may be (acceptance test for F3). */
export const MAX_EXPLANATION_WORDS = 60;

export type KeyFigureId =
  | 'price'
  | 'dayChange'
  | 'weekChange'
  | 'marketCap'
  | 'peRatio'
  | 'eps'
  | 'revenueGrowth';

/** How one key figure is labelled, shown and explained. */
export interface KeyFigure {
  id: KeyFigureId;
  label: string;
  /** The value as the tile shows it. */
  value(overview: Overview): string;
  /** What the value means for this company, in 60 words or fewer. */
  explain(overview: Overview, company: Company): string;
}

/** What a tile shows when the data providers do not have the figure. */
export const NOT_AVAILABLE = '—';

function missing(company: Company): string {
  return `The data providers do not have this figure for ${shortName(company)} right now.`;
}

export const KEY_FIGURES: readonly KeyFigure[] = [
  {
    id: 'price',
    label: 'Price',
    value: overview => formatPrice(overview.price),
    explain: () =>
      'What one share cost in the most recent trade, at the time shown under the company name. It is the price of a single share, not the value of the whole company: market cap shows that.',
  },
  {
    id: 'dayChange',
    label: '1-day change',
    value: ({dayChange}) =>
      dayChange === undefined ? NOT_AVAILABLE : formatChange(dayChange),
    explain: ({dayChange}, company) =>
      dayChange === undefined
        ? `How much the price moved since the previous trading day ended. ${missing(company)}`
        : `How much the price moved since the previous trading day ended. ${shortName(company)} moved ${formatChange(dayChange)}. Prices bounce around every day, so a small daily move on its own rarely means much.`,
  },
  {
    id: 'weekChange',
    label: '1-week change',
    value: ({weekChange}) =>
      weekChange === undefined ? NOT_AVAILABLE : formatChange(weekChange),
    explain: ({weekChange}, company) =>
      weekChange === undefined
        ? `How much the price moved over the last five trading days. ${missing(company)}`
        : `How much the price moved over the last five trading days. ${shortName(company)} moved ${formatChange(weekChange)}. A week smooths out some of the daily noise, so a large weekly move deserves a closer look.`,
  },
  {
    id: 'marketCap',
    label: 'Market cap',
    value: ({marketCap}) =>
      marketCap === undefined ? NOT_AVAILABLE : formatCompactUsd(marketCap),
    explain: ({marketCap}, company) =>
      marketCap === undefined
        ? `Market capitalisation: the share price times the number of shares, or what the market values the whole company at. ${missing(company)}`
        : `Market capitalisation: the share price times the number of shares, or what the market values the whole company at. For ${shortName(company)} that is ${formatCompactUsd(marketCap)}. Larger companies tend to move less on any single piece of news.`,
  },
  {
    id: 'peRatio',
    label: 'P/E ratio',
    value: ({peRatio, eps}) => {
      if (peRatio !== undefined) {
        return formatRatio(peRatio);
      }
      return eps !== undefined && eps <= 0 ? 'n/a' : NOT_AVAILABLE;
    },
    explain: ({peRatio, eps}, company) => {
      const definition =
        'Price-to-earnings ratio: the share price divided by yearly earnings per share.';
      if (peRatio !== undefined) {
        return `${definition} Investors are paying about ${formatPrice(peRatio)} for every $1 of profit ${shortName(company)} earned over the past year. A higher P/E usually means investors expect strong growth.`;
      }
      return eps !== undefined && eps <= 0
        ? `${definition} ${shortName(company)} lost money over the past year, so the ratio would be meaningless and is not shown.`
        : `${definition} ${missing(company)}`;
    },
  },
  {
    id: 'eps',
    label: 'EPS',
    value: ({eps}) => (eps === undefined ? NOT_AVAILABLE : formatPrice(eps)),
    explain: ({eps}, company) =>
      eps === undefined
        ? `Earnings per share: the company’s profit over the past year divided by its number of shares. ${missing(company)}`
        : `Earnings per share: the company’s profit over the past year divided by its number of shares. ${shortName(company)} ${eps < 0 ? 'lost' : 'earned'} ${formatPrice(Math.abs(eps))} per share. Rising EPS usually means the business is earning more for each owner.`,
  },
  {
    id: 'revenueGrowth',
    label: 'Revenue growth',
    value: ({revenueGrowth}) =>
      revenueGrowth === undefined ? NOT_AVAILABLE : formatChange(revenueGrowth),
    explain: ({revenueGrowth}, company) =>
      revenueGrowth === undefined
        ? `How much sales changed compared with a year earlier. ${missing(company)}`
        : `How much sales changed compared with a year earlier. Sales at ${shortName(company)} ${revenueGrowth < 0 ? 'fell' : 'grew'} ${formatPercent(revenueGrowth)}. Growing sales can support a higher share price; shrinking sales are worth a closer look.`,
  },
];
