/**
 * @fileoverview Plain-language definitions used by the inline term
 * explanations. Wording follows the vision statement: say what a number means
 * and why it might matter, not just what it is.
 */

export interface GlossaryEntry {
  term: string;
  definition: string;
}

export const GLOSSARY = {
  guidance: {
    term: 'Guidance',
    definition:
      'A company’s own forecast for its upcoming sales or profit. When guidance changes, the stock price often moves because expectations change with it.',
  },
  peRatio: {
    term: 'P/E ratio',
    definition:
      'Price-to-earnings ratio: the share price divided by yearly earnings per share. It hints at how much investors are paying for each dollar of profit.',
  },
  eps: {
    term: 'EPS',
    definition:
      'Earnings per share: the company’s profit divided by its number of shares. Rising EPS usually means the business is earning more for each owner.',
  },
  marketCap: {
    term: 'Market cap',
    definition:
      'Market capitalisation: the share price multiplied by all the shares that exist. It is what the market currently values the whole company at.',
  },
  revenueGrowth: {
    term: 'Revenue growth',
    definition:
      'How much the company’s sales changed compared with the same period a year earlier.',
  },
  typicalWeek: {
    term: 'Typical week',
    definition:
      'How much this stock usually moves in a week, based on its recent history. A bigger-than-typical move is worth a closer look, not a panic.',
  },
} as const satisfies Record<string, GlossaryEntry>;
