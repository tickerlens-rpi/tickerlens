/**
 * @fileoverview The major features from the TickerLens vision statement.
 */

export interface Feature {
  id: string;
  title: string;
  description: string;
}

export const FEATURES: readonly Feature[] = [
  {
    id: 'search',
    title: 'Stock search',
    description:
      'Look up any publicly traded company by its name or ticker symbol.',
  },
  {
    id: 'overview',
    title: 'Simplified overview',
    description:
      'Price, company basics and the numbers that matter, laid out so the important part is obvious.',
  },
  {
    id: 'summaries',
    title: 'AI research summaries',
    description:
      'Company performance and recent developments, summarised in plain language and grounded in the data on screen.',
  },
  {
    id: 'metrics',
    title: 'Metric explanations',
    description:
      'P/E ratio, EPS, market cap, revenue growth: every metric says what it means and why it might matter.',
  },
  {
    id: 'news',
    title: 'News summaries',
    description:
      'Recent company news condensed into a few bullets, so you can catch up without reading a dozen articles.',
  },
  {
    id: 'strengths-risks',
    title: 'Strengths and risks',
    description:
      'Notable positives, concerns and trends surfaced during research, not buried in a footnote.',
  },
  {
    id: 'charts',
    title: 'Simplified charts',
    description: 'Useful price history without a wall of technical indicators.',
  },
  {
    id: 'sources',
    title: 'Source transparency',
    description:
      'The sources behind important data and AI-generated research are shown wherever possible.',
  },
];
