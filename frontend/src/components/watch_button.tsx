import {useWatchlist} from '../lib/use_watchlist';
import {addToWatchlist, removeFromWatchlist} from '../lib/watchlist';

/** Toggles a ticker on the locally stored watchlist. */
export function WatchButton({ticker}: {ticker: string}) {
  const watching = useWatchlist().some(item => item.ticker === ticker);
  return (
    <button
      type="button"
      className={`button watch-button${watching ? ' watch-button--on' : ''}`}
      aria-pressed={watching}
      onClick={() =>
        watching ? removeFromWatchlist(ticker) : addToWatchlist(ticker)
      }
    >
      <span aria-hidden="true">{watching ? '★' : '☆'}</span>
      {watching ? 'On your watchlist' : 'Add to watchlist'}
    </button>
  );
}
