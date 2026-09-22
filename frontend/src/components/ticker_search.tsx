import {useId, useState} from 'react';
import type {FormEvent} from 'react';
import {parseTickerInput} from '../lib/ticker';
import type {TickerError} from '../lib/ticker';

interface TickerSearchProps {
  /** Receives the normalised symbol whenever a valid one is submitted. */
  onSearch?: (ticker: string) => void;
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

/**
 * Search form for the hero. Until the central API exists it only validates
 * the shape of the symbol and says so, rather than pretending to search.
 */
export function TickerSearch({onSearch}: TickerSearchProps) {
  const inputId = useId();
  const messageId = useId();
  const [value, setValue] = useState('');
  const [state, setState] = useState<SearchState>({kind: 'idle'});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const {ticker, error} = parseTickerInput(value);
    if (error) {
      setState({kind: 'error', message: ERROR_MESSAGES[error]});
      return;
    }
    setValue(ticker);
    setState({kind: 'accepted', ticker});
    onSearch?.(ticker);
  }

  return (
    <form className="ticker-search" onSubmit={handleSubmit} noValidate>
      <label className="ticker-search__label" htmlFor={inputId}>
        Search a company ticker
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
          placeholder="AAPL"
          value={value}
          onChange={event => setValue(event.target.value)}
          aria-describedby={messageId}
          aria-invalid={state.kind === 'error'}
        />
        <button type="submit" className="button button--primary">
          Research
        </button>
      </div>
      <p
        id={messageId}
        className={`ticker-search__message ticker-search__message--${state.kind}`}
        role="status"
        aria-live="polite"
      >
        {messageFor(state)}
      </p>
    </form>
  );
}

function messageFor(state: SearchState): string {
  switch (state.kind) {
    case 'idle':
      return '';
    case 'error':
      return state.message;
    case 'accepted':
      return `${state.ticker} looks like a valid symbol. Full research opens here once the TickerLens API is connected.`;
    default: {
      // Exhaustiveness check: adding a state without handling it fails to compile.
      const unreachable: never = state;
      return unreachable;
    }
  }
}
