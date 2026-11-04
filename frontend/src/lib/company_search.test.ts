import {describe, expect, it} from 'vitest';
import {SAMPLE_COMPANIES} from '../data/sample/companies';
import {rankCompanies} from './company_search';

function tickers(query: string, limit?: number): string[] {
  return rankCompanies(SAMPLE_COMPANIES, query, limit).map(
    company => company.ticker,
  );
}

describe('rankCompanies', () => {
  it('finds Apple by name, ahead of Apple Hospitality (F1)', () => {
    expect(tickers('apple')).toEqual(['AAPL', 'APLE']);
    expect(tickers('Apple')).toEqual(['AAPL', 'APLE']);
  });

  it('puts an exact ticker first, then other tickers that start with it', () => {
    expect(tickers('AAPL')).toEqual(['AAPL']);
    expect(tickers('ap')).toEqual(['APLE', 'AAPL']);
  });

  it('ignores case, surrounding spaces and a leading dollar sign', () => {
    expect(tickers('  $nke ')).toEqual(['NKE']);
  });

  it('matches words inside a name', () => {
    expect(tickers('coca')).toEqual(['KO']);
    expect(tickers('hathaway')).toEqual(['BRK.B']);
  });

  it('returns nothing for blank input or no match', () => {
    expect(tickers('   ')).toEqual([]);
    expect(tickers('ZZZZ')).toEqual([]);
  });

  it('stops at the limit', () => {
    expect(tickers('a', 3)).toHaveLength(3);
  });
});
