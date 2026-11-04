import {useState} from 'react';
import {clearAllLocalData} from '../lib/local_data';
import {applyTextSize} from '../lib/text_size';

interface LocalDataPanelProps {
  /** Called after everything has been deleted. */
  onCleared?: () => void;
}

/** Explains what is stored on this computer and lets the user wipe it. */
export function LocalDataPanel({onCleared}: LocalDataPanelProps) {
  const [confirming, setConfirming] = useState(false);
  const [cleared, setCleared] = useState<number | undefined>(undefined);

  function clear() {
    setCleared(clearAllLocalData());
    applyTextSize('default');
    setConfirming(false);
    onCleared?.();
  }

  return (
    <div className="local-data">
      <ul className="local-data__list">
        <li>
          <strong>AI connection</strong>: provider, model and API key. Kept in
          this browser’s storage, or in tab-only storage if you chose that.
        </li>
        <li>
          <strong>Watchlist and notes</strong>: kept in this browser’s storage.
        </li>
        <li>
          <strong>Text size</strong>: kept in this browser’s storage.
        </li>
        <li>
          <strong>Conversations</strong>: not saved. They disappear when you
          leave the research page.
        </li>
      </ul>
      <p>
        When you ask a question, your browser sends it, with your key, directly
        to the AI provider you picked. TickerLens has no server in that path,
        and the site’s security policy blocks the page from sending data to any
        other address.
      </p>

      <div className="local-data__actions">
        {confirming ? (
          <>
            <button
              type="button"
              className="button button--danger"
              onClick={clear}
            >
              Yes, delete everything
            </button>
            <button
              type="button"
              className="button"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            className="button"
            onClick={() => {
              setCleared(undefined);
              setConfirming(true);
            }}
          >
            Delete all TickerLens data on this computer
          </button>
        )}
      </div>
      <p className="local-data__status" role="status" aria-live="polite">
        {confirming &&
          'This removes your API key, watchlist, notes and preferences from this browser. It cannot be undone.'}
        {cleared !== undefined &&
          `Done. Removed ${cleared} saved ${cleared === 1 ? 'item' : 'items'}.`}
      </p>
    </div>
  );
}
