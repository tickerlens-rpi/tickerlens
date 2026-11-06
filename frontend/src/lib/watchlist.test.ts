import {describe, expect, it} from 'vitest';
import {
  MAX_NOTE_LENGTH,
  WATCHLIST_KEY,
  addToWatchlist,
  parseWatchlist,
  readWatchlist,
  removeFromWatchlist,
  updateWatchlistNote,
} from './watchlist';

describe('watchlist', () => {
  it('adds new tickers to the top and ignores duplicates', () => {
    addToWatchlist('AAPL', localStorage, new Date('2026-01-01T00:00:00Z'));
    addToWatchlist('MSFT');
    addToWatchlist('AAPL');
    expect(readWatchlist().map(item => item.ticker)).toEqual(['MSFT', 'AAPL']);
    expect(readWatchlist()[1].addedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('rejects symbols that are not tickers', () => {
    expect(addToWatchlist('not a ticker')).toEqual([]);
  });

  it('removes tickers and caps note length', () => {
    addToWatchlist('AAPL');
    addToWatchlist('MSFT');
    updateWatchlistNote('AAPL', 'x'.repeat(MAX_NOTE_LENGTH + 10));
    removeFromWatchlist('MSFT');
    const items = readWatchlist();
    expect(items).toHaveLength(1);
    expect(items[0].note).toHaveLength(MAX_NOTE_LENGTH);
  });

  it('drops malformed and duplicate stored entries', () => {
    const good = {ticker: 'AAPL', note: '', addedAt: '2026-01-01'};
    expect(
      parseWatchlist([good, good, {ticker: 5}, null, {...good, ticker: 'b@d'}]),
    ).toEqual([good]);
    localStorage.setItem(WATCHLIST_KEY, '"nope"');
    expect(readWatchlist()).toEqual([]);
  });
});
