import {useId, useState} from 'react';
import type {FormEvent, ReactNode} from 'react';
import {parseTickerInput} from '../lib/ticker';
import type {TickerError} from '../lib/ticker';

interface TickerSearchProps {
  /** Receives the normalised symbol whenever a valid one is submitted. */
  onSearch?: (ticker: string) => void;
  /** Visible label above the field. */
  label?: string;
  /** Text on the submit button. */
  buttonLabel?: string;
  /** Message shown after a valid symbol is accepted. */
  acceptedMessage?: (ticker: string) => string;
  /** Empties the field after a valid submission, for add-another forms. */
  clearOnAccept?: boolean;
  /** Smaller, quieter variant for secondary placements. */
  compact?: boolean;
  /** Placeholder inside the field. */
  placeholder?: string;
  /** Help text under the field, read out with it by screen readers. */
  hint?: ReactNode;
}

type SearchState =
  | {kind: 'idle'}
  | {kind: 'error'; message: string}
  | {kind: 'accepted'; ticker: string};

const ERROR_MESSAGES: Record<TickerError, string> = {
  empty: 'Type a ticker symbol to get started, for example AAPL.',
  invalid:
    'That does not look like a ticker symbol. Try something like MSFT or BRK.B.',
};

function defaultAcceptedMessage(ticker: string): string {
  return `${ticker} looks like a valid symbol. Opening research…`;
}

/**
 * Ticker search form. It validates the shape of the symbol only; whether the
 * company exists is decided later by the AI or, once connected, the API.
 */
export function TickerSearch({
  onSearch,
  label = 'Search a company ticker',
  buttonLabel = 'Research',
  acceptedMessage = defaultAcceptedMessage,
  clearOnAccept = false,
  compact = false,
  placeholder = 'AAPL',
  hint,
}: TickerSearchProps) {
  const inputId = useId();
  const messageId = useId();
  const hintId = useId();
  const [value, setValue] = useState('');
  const [state, setState] = useState<SearchState>({kind: 'idle'});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const {ticker, error} = parseTickerInput(value);
    if (error) {
      setState({kind: 'error', message: ERROR_MESSAGES[error]});
      return;
    }
    setValue(clearOnAccept ? '' : ticker);
    setState({kind: 'accepted', ticker});
    onSearch?.(ticker);
  }

  return (
    <form
      className={`ticker-search${compact ? ' ticker-search--compact' : ''}`}
      onSubmit={handleSubmit}
      noValidate
    >
      <label className="ticker-search__label" htmlFor={inputId}>
        {label}
      </label>
      <div className="ticker-search__row">
        <span className="ticker-search__prefix" aria-hidden="true">
          $
        </span>
        <input
          id={inputId}
          className="ticker-search__input"
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={placeholder}
          value={value}
          onChange={event => setValue(event.target.value)}
          aria-describedby={hint ? `${hintId} ${messageId}` : messageId}
          aria-invalid={state.kind === 'error'}
        />
        <button type="submit" className="button button--primary">
          {buttonLabel}
        </button>
      </div>
      {hint && (
        <p id={hintId} className="ticker-search__hint">
          {hint}
        </p>
      )}
      <p
        id={messageId}
        className={`ticker-search__message ticker-search__message--${state.kind}`}
        role="status"
        aria-live="polite"
      >
        {messageFor(state, acceptedMessage)}
      </p>
    </form>
  );
}

function messageFor(
  state: SearchState,
  acceptedMessage: (ticker: string) => string,
): string {
  switch (state.kind) {
    case 'idle':
      return '';
    case 'error':
      return state.message;
    case 'accepted':
      return acceptedMessage(state.ticker);
    default: {
      // Exhaustiveness check: adding a state without handling it fails to compile.
      const unreachable: never = state;
      return unreachable;
    }
  }
}
