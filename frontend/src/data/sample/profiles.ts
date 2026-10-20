/**
 * @fileoverview Made-up figures for the sample companies. These numbers are
 * invented for the prototype and are not real market data; the company page
 * says so on every page that shows them.
 *
 * AAPL and NKE follow the illustrative numbers in the Sprint 1 user scenarios
 * (Paul researching Apple, Priya checking on a Nike drop).
 */

import type {SampleHistoryOptions} from '../../lib/sample_prices';

/** The day the sample data is "as of". */
export const SAMPLE_AS_OF_DAY = '2026-10-20';

/** 4:00 PM in New York on the sample day, when the market closes. */
export const SAMPLE_AS_OF = '2026-10-20T20:00:00Z';

/** First day of the five-year sample histories. */
export const SAMPLE_HISTORY_START = '2021-10-20';

/** Figures and price-history settings for one sample company. */
export interface SampleProfile {
  /** Closing price on the sample day. */
  price: number;
  /** Earnings per share over the past twelve months. */
  eps: number;
  sharesOutstanding: number;
  revenueGrowth: number;
  /** How the price history is generated; see generateSampleHistory. */
  history: Omit<SampleHistoryOptions, 'startDate' | 'endDate' | 'endPrice'> & {
    /** Overrides SAMPLE_HISTORY_START for companies that listed later. */
    startDate?: string;
  };
}

export const SAMPLE_PROFILES: Readonly<Record<string, SampleProfile>> = {
  AAPL: {
    price: 231.45,
    eps: 6.65,
    sharesOutstanding: 14.9e9,
    revenueGrowth: 0.061,
    history: {
      annualDrift: 0.12,
      annualVolatility: 0.27,
      seed: 207,
      // +1.2% today and -0.8% this week, as in Paul's scenario.
      recentReturns: [-0.006, -0.009, 0.003, -0.008, 0.012],
    },
  },
  AMZN: {
    price: 219.4,
    eps: 6.1,
    sharesOutstanding: 10.7e9,
    revenueGrowth: 0.108,
    history: {annualDrift: 0.1, annualVolatility: 0.33, seed: 10},
  },
  APLE: {
    price: 13.2,
    eps: 0.85,
    sharesOutstanding: 0.24e9,
    revenueGrowth: 0.018,
    history: {annualDrift: 0, annualVolatility: 0.22, seed: 22},
  },
  'BRK.B': {
    price: 488.3,
    eps: 38.4,
    sharesOutstanding: 2.16e9,
    revenueGrowth: 0.042,
    history: {annualDrift: 0.12, annualVolatility: 0.17, seed: 61},
  },
  DIS: {
    price: 112.6,
    eps: 5.9,
    sharesOutstanding: 1.8e9,
    revenueGrowth: 0.031,
    history: {annualDrift: -0.02, annualVolatility: 0.27, seed: 197},
  },
  GOOGL: {
    price: 251.2,
    eps: 9.8,
    sharesOutstanding: 12.1e9,
    revenueGrowth: 0.132,
    history: {annualDrift: 0.15, annualVolatility: 0.3, seed: 31},
  },
  JPM: {
    price: 296.8,
    eps: 20.4,
    sharesOutstanding: 2.75e9,
    revenueGrowth: 0.071,
    history: {annualDrift: 0.18, annualVolatility: 0.22, seed: 32},
  },
  KO: {
    price: 68.9,
    eps: 2.95,
    sharesOutstanding: 4.3e9,
    revenueGrowth: 0.029,
    history: {annualDrift: 0.05, annualVolatility: 0.15, seed: 203},
  },
  MSFT: {
    price: 512.3,
    eps: 14.1,
    sharesOutstanding: 7.43e9,
    revenueGrowth: 0.153,
    history: {annualDrift: 0.16, annualVolatility: 0.24, seed: 274},
  },
  NKE: {
    price: 71.8,
    eps: 2.1,
    sharesOutstanding: 1.48e9,
    revenueGrowth: -0.098,
    history: {
      annualDrift: 0,
      annualVolatility: 0.3,
      seed: 95,
      // Keeps the past year between about $65 and $85, as in Priya's scenario.
      meanReversion: {level: 76, strength: 6},
      // About -9.2% this week: roughly three times a typical week for NKE.
      recentReturns: [-0.012, 0.004, -0.072, -0.018, 0.004],
    },
  },
  NVDA: {
    price: 182.7,
    eps: 3.55,
    sharesOutstanding: 24.3e9,
    revenueGrowth: 0.552,
    history: {annualDrift: 0.45, annualVolatility: 0.5, seed: 136},
  },
  SBUX: {
    price: 84.5,
    eps: 2.6,
    sharesOutstanding: 1.14e9,
    revenueGrowth: 0.026,
    history: {annualDrift: 0, annualVolatility: 0.28, seed: 157},
  },
  SPCX: {
    price: 158.4,
    // A loss per share, so the page shows how it handles a missing P/E.
    eps: -0.42,
    sharesOutstanding: 11.4e9,
    revenueGrowth: 0.348,
    history: {
      annualDrift: 0.3,
      annualVolatility: 0.55,
      seed: 8,
      // Listed in June 2026, so its history is shorter than five years.
      startDate: '2026-06-12',
    },
  },
  TSLA: {
    price: 438.2,
    eps: 1.75,
    sharesOutstanding: 3.22e9,
    revenueGrowth: -0.021,
    history: {annualDrift: 0.2, annualVolatility: 0.55, seed: 175},
  },
};
