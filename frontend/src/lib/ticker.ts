/**
 * @fileoverview Helpers that turn free-form search input into a ticker symbol.
 *
 * The landing page only validates the shape of a symbol. Whether the symbol
 * exists is decided by the central API once the backend is connected.
 */

/** Matches symbols like `AAPL`, `MSFT`, `BRK.B` or `BF-B`. */
const TICKER_PATTERN = /^[A-Z]{1,5}(?:[.-][A-Z]{1,2})?$/;

/** Why a piece of search input could not be turned into a ticker. */
export type TickerError = 'empty' | 'invalid';

/** Result of parsing search input. `error` is set when `ticker` is unusable. */
export interface TickerParse {
  ticker: string;
  error?: TickerError;
}

/** Trims, strips a leading `$` and upper-cases raw search input. */
export function normalizeTicker(input: string): string {
  return input.trim().replace(/^\$/, '').toUpperCase();
}

/** Returns true when `ticker` has the shape of a US-listed symbol. */
export function isValidTicker(ticker: string): boolean {
  return TICKER_PATTERN.test(ticker);
}

/** Parses raw search input into a ticker, reporting why it failed if it did. */
export function parseTickerInput(input: string): TickerParse {
  const ticker = normalizeTicker(input);
  if (ticker === '') {
    return {ticker, error: 'empty'};
  }
  if (!isValidTicker(ticker)) {
    return {ticker, error: 'invalid'};
  }
  return {ticker};
}
