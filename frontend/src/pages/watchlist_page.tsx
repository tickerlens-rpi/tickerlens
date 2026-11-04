import {useEffect, useId, useRef, useState} from 'react';
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

/** How long typing must pause before a note is saved. */
const NOTE_SAVE_DELAY_MS = 600;

function formatAdded(addedAt: string): string {
  const date = new Date(addedAt);
  return Number.isNaN(date.getTime()) ? '' : DATE_FORMAT.format(date);
}

type NoteState = 'idle' | 'typing' | 'saved';

interface WatchlistRowProps {
  item: WatchlistItem;
  onRemove: () => void;
}

function WatchlistRow({item, onRemove}: WatchlistRowProps) {
  const noteId = useId();
  const noteStatusId = useId();
  const added = formatAdded(item.addedAt);
  const [noteState, setNoteState] = useState<NoteState>('idle');
  const timerRef = useRef<number | undefined>(undefined);
  const pendingRef = useRef<string | undefined>(undefined);

  function flush() {
    window.clearTimeout(timerRef.current);
    const pending = pendingRef.current;
    pendingRef.current = undefined;
    if (pending !== undefined) {
      updateWatchlistNote(item.ticker, pending);
      setNoteState('saved');
    }
  }

  // Save anything still waiting if the row goes away (navigation, removal).
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  });
  useEffect(() => () => flushRef.current(), []);

  function handleChange(value: string) {
    pendingRef.current = value;
    setNoteState('typing');
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(flush, NOTE_SAVE_DELAY_MS);
  }

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
            onClick={onRemove}
            aria-label={`Remove ${item.ticker} from watchlist`}
          >
            Remove
          </button>
        </div>
      </div>
      <label className="visually-hidden" htmlFor={noteId}>
        Your notes on {item.ticker}
      </label>
      <textarea
        id={noteId}
        className="watch-row__note"
        rows={1}
        maxLength={MAX_NOTE_LENGTH}
        placeholder="Add a note: why are you watching it? What would change your mind?"
        defaultValue={item.note}
        onChange={event => handleChange(event.target.value)}
        onBlur={flush}
        aria-describedby={noteStatusId}
      />
      <p
        id={noteStatusId}
        className="watch-row__saved"
        role="status"
        aria-live="polite"
      >
        {noteState === 'saved' ? 'Note saved on this computer.' : ''}
      </p>
    </li>
  );
}

/** Saved tickers with notes at `#/watchlist`. */
export function WatchlistPage() {
  const watchlist = useWatchlist();
  const listRef = useRef<HTMLUListElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  // Index of a just-removed row, read once the list has re-rendered.
  const removedIndexRef = useRef<number | undefined>(undefined);

  // After a removal, focus the next row's ticker (or the add box when the
  // list is empty) so keyboard users are not sent back to the top.
  useEffect(() => {
    const focusIndex = removedIndexRef.current;
    if (focusIndex === undefined) {
      return;
    }
    removedIndexRef.current = undefined;
    const links =
      listRef.current?.querySelectorAll<HTMLAnchorElement>(
        '.watch-row__ticker',
      );
    const target =
      links && links.length > 0
        ? links[Math.min(focusIndex, links.length - 1)]
        : formRef.current?.querySelector<HTMLInputElement>('input');
    target?.focus();
  }, [watchlist]);

  return (
    <div className="app-page container">
      <PageHeading eyebrow="Watchlist" title="Stocks you’re watching">
        <p>
          Keep track of companies you are curious about, with your own notes.
          Everything is saved in this browser on your computer, not uploaded
          anywhere. Prices will show here once live data arrives.
        </p>
      </PageHeading>

      <div ref={formRef}>
        <TickerSearch
          label="Add a ticker"
          buttonLabel="Add"
          placeholder="e.g. MSFT"
          clearOnAccept
          acceptedMessage={ticker => `${ticker} is on your watchlist.`}
          onSearch={ticker => addToWatchlist(ticker)}
        />
      </div>

      {watchlist.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state__title">Nothing here yet</p>
          <p>
            Add a ticker above, or use “Add to watchlist” on any research page.
          </p>
        </div>
      ) : (
        <ul ref={listRef} className="watchlist" aria-label="Watchlist">
          {watchlist.map((item, index) => (
            <WatchlistRow
              key={item.ticker}
              item={item}
              onRemove={() => {
                removedIndexRef.current = index;
                removeFromWatchlist(item.ticker);
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
