import {useId} from 'react';
import {PageHeading} from '../components/page_heading';
import {TickerSearch} from '../components/ticker_search';
import {routeHref} from '../lib/router';
import {useWatchlist} from '../lib/use_watchlist';
import {
  MAX_NOTE_LENGTH,
  addToWatchlist,
  removeFromWatchlist,
  updateWatchlistNote,
} from '../lib/watchlist';
import type {WatchlistItem} from '../lib/watchlist';

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {dateStyle: 'medium'});

function formatAdded(addedAt: string): string {
  const date = new Date(addedAt);
  return Number.isNaN(date.getTime()) ? '' : DATE_FORMAT.format(date);
}

function WatchlistRow({item}: {item: WatchlistItem}) {
  const noteId = useId();
  const added = formatAdded(item.addedAt);
  return (
    <li className="watch-row">
      <div className="watch-row__head">
        <a
          className="watch-row__ticker"
          href={routeHref({page: 'research', ticker: item.ticker})}
        >
          {item.ticker}
        </a>
        {added && <span className="watch-row__added">Added {added}</span>}
        <div className="watch-row__actions">
          <a
            className="button"
            href={routeHref({page: 'research', ticker: item.ticker})}
          >
            Research
          </a>
          <button
            type="button"
            className="button button--quiet"
            onClick={() => removeFromWatchlist(item.ticker)}
            aria-label={`Remove ${item.ticker} from watchlist`}
          >
            Remove
          </button>
        </div>
      </div>
      <label className="watch-row__note-label" htmlFor={noteId}>
        Your notes on {item.ticker}
      </label>
      <textarea
        id={noteId}
        className="watch-row__note"
        rows={2}
        maxLength={MAX_NOTE_LENGTH}
        placeholder="Why are you watching it? What would change your mind?"
        defaultValue={item.note}
        onBlur={event => {
          if (event.target.value !== item.note) {
            updateWatchlistNote(item.ticker, event.target.value);
          }
        }}
      />
    </li>
  );
}

/** Saved tickers with notes at `#/watchlist`. */
export function WatchlistPage() {
  const watchlist = useWatchlist();

  return (
    <div className="app-page container">
      <PageHeading eyebrow="Watchlist" title="Stocks you’re watching">
        <p>
          Your watchlist and notes are saved in this browser on your computer.
          They are not uploaded anywhere.
        </p>
      </PageHeading>

      <TickerSearch
        label="Add a ticker"
        buttonLabel="Add"
        clearOnAccept
        acceptedMessage={ticker => `${ticker} is on your watchlist.`}
        onSearch={ticker => addToWatchlist(ticker)}
      />

      {watchlist.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state__title">Nothing here yet</p>
          <p>
            Add a ticker above, or use “Add to watchlist” on any research page.
          </p>
        </div>
      ) : (
        <ul className="watchlist" aria-label="Watchlist">
          {watchlist.map(item => (
            <WatchlistRow key={item.ticker} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}
