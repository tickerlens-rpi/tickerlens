/**
 * @fileoverview Positioning against existing platforms, taken from the
 * "Business Case and Competition" section of the vision statement.
 */

export interface Platform {
  name: string;
  bestAt: string;
  keepInMind: string;
}

export const COMPETITORS: readonly Platform[] = [
  {
    name: 'TradingView',
    bestAt: 'Advanced charts, technical indicators, screeners and raw data.',
    keepInMind:
      'Much of the interface assumes you already understand technical and financial analysis.',
  },
  {
    name: 'Simply Wall St',
    bestAt: 'Visual reports and financial summaries.',
    keepInMind:
      'Shows what the data is. TickerLens puts more weight on explaining what it means.',
  },
  {
    name: 'Seeking Alpha',
    bestAt: 'Stock research, ratings, news and analyst opinions.',
    keepInMind:
      'Deep, but traditional research can feel overwhelming when you are starting out.',
  },
];

export const TICKERLENS: Platform = {
  name: 'TickerLens',
  bestAt: 'Plain-language explanations with the source behind every claim.',
  keepInMind:
    'Intentionally fewer charts and controls. Simplicity is the feature, not a limitation.',
};
