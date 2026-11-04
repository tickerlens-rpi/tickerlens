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
    value: overview => formatChange(overview.dayChange),
    explain: (overview, company) =>
      `How much the price moved since the previous trading day ended. ${shortName(company)} moved ${formatChange(overview.dayChange)}. Prices bounce around every day, so a small daily move on its own rarely means much.`,
  },
  {
    id: 'weekChange',
    label: '1-week change',
    value: overview => formatChange(overview.weekChange),
    explain: (overview, company) =>
      `How much the price moved over the last five trading days. ${shortName(company)} moved ${formatChange(overview.weekChange)}. A week smooths out some of the daily noise, so a large weekly move deserves a closer look.`,
  },
  {
    id: 'marketCap',
    label: 'Market cap',
    value: overview => formatCompactUsd(overview.marketCap),
    explain: (overview, company) =>
      `Market capitalisation: the share price times the number of shares, or what the market values the whole company at. For ${shortName(company)} that is ${formatCompactUsd(overview.marketCap)}. Larger companies tend to move less on any single piece of news.`,
  },
  {
    id: 'peRatio',
    label: 'P/E ratio',
    value: overview =>
      overview.peRatio === undefined ? 'n/a' : formatRatio(overview.peRatio),
    explain: (overview, company) =>
      overview.peRatio === undefined
        ? `Price-to-earnings ratio: the share price divided by yearly earnings per share. ${shortName(company)} lost money over the past year, so the ratio would be meaningless and is not shown.`
        : `Price-to-earnings ratio: the share price divided by yearly earnings per share. Investors are paying about ${formatPrice(overview.peRatio)} for every $1 of profit ${shortName(company)} earned over the past year. A higher P/E usually means investors expect strong growth.`,
  },
  {
    id: 'eps',
    label: 'EPS',
    value: overview => formatPrice(overview.eps),
    explain: (overview, company) =>
      `Earnings per share: the company’s profit over the past year divided by its number of shares. ${shortName(company)} ${overview.eps < 0 ? 'lost' : 'earned'} ${formatPrice(Math.abs(overview.eps))} per share. Rising EPS usually means the business is earning more for each owner.`,
  },
  {
    id: 'revenueGrowth',
    label: 'Revenue growth',
    value: overview => formatChange(overview.revenueGrowth),
    explain: (overview, company) =>
      `How much sales changed compared with a year earlier. Sales at ${shortName(company)} ${overview.revenueGrowth < 0 ? 'fell' : 'grew'} ${formatPercent(overview.revenueGrowth)}. Growing sales can support a higher share price; shrinking sales are worth a closer look.`,
  },
];
