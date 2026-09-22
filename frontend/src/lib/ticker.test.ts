import {describe, expect, it} from 'vitest';
import {isValidTicker, normalizeTicker, parseTickerInput} from './ticker';

describe('normalizeTicker', () => {
  it('trims whitespace and upper-cases', () => {
    expect(normalizeTicker('  aapl ')).toBe('AAPL');
  });

  it('strips a leading dollar sign', () => {
    expect(normalizeTicker('$msft')).toBe('MSFT');
  });
});

describe('isValidTicker', () => {
  it.each(['A', 'AAPL', 'GOOGL', 'BRK.B', 'BF-B'])('accepts %s', ticker => {
    expect(isValidTicker(ticker)).toBe(true);
  });

  it.each(['', '123', 'TOOLONG', 'AA PL', 'aapl', 'BRK.', '.B'])(
    'rejects %j',
    ticker => {
      expect(isValidTicker(ticker)).toBe(false);
    },
  );
});

describe('parseTickerInput', () => {
  it('reports empty input', () => {
    expect(parseTickerInput('   ')).toEqual({ticker: '', error: 'empty'});
  });

  it('reports malformed input', () => {
    expect(parseTickerInput('12$')).toEqual({ticker: '12$', error: 'invalid'});
  });

  it('returns the normalized ticker on success', () => {
    expect(parseTickerInput(' $brk.b ')).toEqual({ticker: 'BRK.B'});
  });
});
