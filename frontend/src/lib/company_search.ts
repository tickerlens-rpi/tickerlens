/**
 * @fileoverview Ranks companies against a search query. Mirrors
 * `InMemoryCompanyRepository.search` in `api/app/repositories.py`, so the
 * sample client suggests the same companies, in the same order, as the API.
 */

import type {Company} from '../data/research';

/** Most suggestions the search box shows, the API's default `limit`. */
export const DEFAULT_SEARCH_LIMIT = 8;

/**
 * Returns up to `limit` companies matching `query`, best first: an exact
 * ticker, then tickers starting with the query, then names starting with it,
 * then names containing it. Ties are broken by ticker.
 */
export function rankCompanies(
  companies: readonly Company[],
  query: string,
  limit = DEFAULT_SEARCH_LIMIT,
): Company[] {
  const needle = query.trim().replace(/^\$/, '').toLowerCase();
  if (needle === '') {
    return [];
  }
  const ranked: Array<{rank: number; company: Company}> = [];
  for (const company of companies) {
    const rank = matchRank(company, needle);
    if (rank !== undefined) {
      ranked.push({rank, company});
    }
  }
  ranked.sort(
    (a, b) =>
      a.rank - b.rank || compareCodePoints(a.company.ticker, b.company.ticker),
  );
  return ranked.slice(0, limit).map(entry => entry.company);
}

/** Orders strings the way Python does, so ties match the API exactly. */
function compareCodePoints(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

/** Lower is a better match; undefined means no match. */
function matchRank(company: Company, needle: string): number | undefined {
  const ticker = company.ticker.toLowerCase();
  const name = company.name.toLowerCase();
  if (ticker === needle) {
    return 0;
  }
  if (ticker.startsWith(needle)) {
    return 1;
  }
  if (name.startsWith(needle)) {
    return 2;
  }
  if (name.includes(needle)) {
    return 3;
  }
  return undefined;
}
