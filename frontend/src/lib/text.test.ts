import {describe, expect, it} from 'vitest';
import {SAMPLE_COMPANIES} from '../data/sample/companies';
import {countWords, shortName} from './text';

function shortNameOf(ticker: string): string {
  const company = SAMPLE_COMPANIES.find(entry => entry.ticker === ticker);
  if (!company) {
    throw new Error(`No sample company ${ticker}`);
  }
  return shortName(company);
}

describe('shortName', () => {
  it('drops legal suffixes and a leading "The"', () => {
    expect(shortNameOf('AAPL')).toBe('Apple');
    expect(shortNameOf('AMZN')).toBe('Amazon.com');
    expect(shortNameOf('JPM')).toBe('JPMorgan Chase');
    expect(shortNameOf('KO')).toBe('Coca-Cola');
    expect(shortNameOf('DIS')).toBe('Walt Disney');
    expect(shortNameOf('NVDA')).toBe('NVIDIA');
  });

  it('leaves names without a suffix alone', () => {
    expect(shortNameOf('APLE')).toBe('Apple Hospitality REIT');
  });
});

describe('countWords', () => {
  it('counts runs of non-space characters', () => {
    expect(countWords('  Price-to-earnings ratio:  $34.80 per $1 ')).toBe(5);
    expect(countWords('')).toBe(0);
  });
});
