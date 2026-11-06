import {useEffect, useRef, useState} from 'react';
import {clearAllLocalData} from '../lib/local_data';
import {applyTextSize} from '../lib/text_size';

interface LocalDataPanelProps {
  /** Called after everything has been deleted. */
  onCleared?: () => void;
}

type Step = 'idle' | 'confirming' | 'cancelled' | {cleared: number};

/** Explains what is stored on this computer and lets the user wipe it. */
export function LocalDataPanel({onCleared}: LocalDataPanelProps) {
  const [step, setStep] = useState<Step>('idle');
  const startRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  // Each step swaps the buttons, so move focus to where the user can carry on
  // instead of letting it fall back to the top of the page.
  useEffect(() => {
    if (step === 'confirming') {
      cancelRef.current?.focus();
    } else if (step === 'cancelled') {
      startRef.current?.focus();
    } else if (typeof step === 'object') {
      statusRef.current?.focus();
    }
  }, [step]);

  function clear() {
    const cleared = clearAllLocalData();
    applyTextSize('default');
    setStep({cleared});
    onCleared?.();
  }

  return (
    <div className="local-data">
      <ul className="local-data__list">
        <li>
          <strong>AI connection</strong>: which AI you use and your API key.
          Saved in this browser, or only in this tab if you chose that.
        </li>
        <li>
          <strong>Watchlist and notes</strong>: saved in this browser.
        </li>
        <li>
          <strong>Text size</strong>: saved in this browser.
        </li>
        <li>
          <strong>Conversations</strong>: not saved. They disappear when you
          leave the research page.
        </li>
      </ul>
      <p>
        When you ask a question, your browser sends it, with your key, straight
        to the AI company you picked. TickerLens has no server in between, and
        the site is built so it can only talk to Anthropic or OpenAI.
      </p>

      <div className="local-data__actions">
        {step === 'confirming' ? (
          <>
            <button
              type="button"
              className="button button--danger"
              onClick={clear}
            >
              Yes, delete everything
            </button>
            <button
              ref={cancelRef}
              type="button"
              className="button"
              onClick={() => setStep('cancelled')}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            ref={startRef}
            type="button"
            className="button"
            onClick={() => setStep('confirming')}
          >
            Delete all TickerLens data on this computer
          </button>
        )}
      </div>
      <p
        ref={statusRef}
        tabIndex={-1}
        className="local-data__status"
        role="status"
        aria-live="polite"
      >
        {step === 'confirming' &&
          'This removes your API key, watchlist, notes and preferences from this browser. It cannot be undone.'}
        {typeof step === 'object' &&
          `Done. Removed ${step.cleared} saved ${step.cleared === 1 ? 'item' : 'items'} from this computer.`}
      </p>
    </div>
  );
}
