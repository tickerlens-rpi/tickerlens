import {useCallback, useId, useState} from 'react';
import type {FormEvent, KeyboardEvent} from 'react';
import {useNavigate} from 'react-router';
import type {Company} from '../data/research';
import {useResearchClient} from '../data/research_context';
import {useDebouncedValue} from '../lib/hooks';
import {useAsync} from '../lib/use_async';

/** Pause in typing before suggestions are fetched. */
const SUGGESTION_DELAY_MS = 150;

interface CompanySearchProps {
  /** `hero` is the large box on the landing page; `compact` fits a header. */
  variant?: 'hero' | 'compact';
}

type Problem =
  {kind: 'empty'} | {kind: 'noMatch'; query: string} | {kind: 'unavailable'};

/**
 * Search by company name or ticker, with suggestions as you type
 * (requirement F1). Choosing a company opens its page; a search that matches
 * nothing says so instead of failing.
 */
export function CompanySearch({variant = 'hero'}: CompanySearchProps) {
  const client = useResearchClient();
  const navigate = useNavigate();
  const inputId = useId();
  const listId = useId();
  const messageId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  // The highlighted suggestion belongs to the query it was chosen for, so
  // typing something new clears it without an extra state update.
  const [highlight, setHighlight] = useState({query: '', index: -1});
  // A problem found on submit only applies while the query is unchanged.
  const [submitted, setSubmitted] = useState<{
    query: string;
    problem: Problem;
  }>();

  const trimmed = query.trim();
  const debounced = useDebouncedValue(trimmed, SUGGESTION_DELAY_MS);
  const loadSuggestions = useCallback(
    () =>
      debounced === ''
        ? Promise.resolve<Company[]>([])
        : client.searchCompanies(debounced),
    [client, debounced],
  );
  const suggestions = useAsync(loadSuggestions);

  let companies: Company[] = [];
  if (suggestions.status === 'ready') {
    companies = suggestions.value;
  } else if (suggestions.status === 'loading') {
    companies = suggestions.previous ?? [];
  }
  const upToDate = debounced === trimmed && suggestions.status === 'ready';
  const showList = open && trimmed !== '' && companies.length > 0;
  const activeIndex =
    highlight.query === trimmed
      ? Math.min(highlight.index, companies.length - 1)
      : -1;

  let problem: Problem | undefined;
  if (suggestions.status === 'error') {
    problem = {kind: 'unavailable'};
  } else if (upToDate && trimmed !== '' && companies.length === 0) {
    problem = {kind: 'noMatch', query: trimmed};
  } else if (submitted?.query === trimmed) {
    problem = submitted.problem;
  }

  function choose(company: Company) {
    setQuery('');
    setOpen(false);
    setSubmitted(undefined);
    void navigate(`/company/${encodeURIComponent(company.ticker)}`);
  }

  async function submit() {
    const highlighted = showList ? companies[activeIndex] : undefined;
    if (highlighted) {
      choose(highlighted);
      return;
    }
    if (trimmed === '') {
      setSubmitted({query: trimmed, problem: {kind: 'empty'}});
      return;
    }
    try {
      // Enter can arrive before the debounced suggestions do.
      const matches = upToDate
        ? companies
        : await client.searchCompanies(trimmed);
      const best = matches[0];
      if (best) {
        choose(best);
      } else {
        setSubmitted({
          query: trimmed,
          problem: {kind: 'noMatch', query: trimmed},
        });
      }
    } catch {
      setSubmitted({query: trimmed, problem: {kind: 'unavailable'}});
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setOpen(true);
        setHighlight({
          query: trimmed,
          index: Math.min(activeIndex + 1, companies.length - 1),
        });
        break;
      case 'ArrowUp':
        event.preventDefault();
        setHighlight({query: trimmed, index: Math.max(activeIndex - 1, 0)});
        break;
      case 'Escape':
        if (showList) {
          event.preventDefault();
          setOpen(false);
        } else {
          setQuery('');
        }
        break;
      default:
        break;
    }
  }

  const optionId = (index: number) => `${listId}-option-${index}`;

  return (
    <form
      className={`company-search company-search--${variant}`}
      role="search"
      onSubmit={handleSubmit}
      noValidate
    >
      <label
        className={
          variant === 'hero' ? 'company-search__label' : 'visually-hidden'
        }
        htmlFor={inputId}
      >
        Search a company or ticker
      </label>
      <div className="company-search__field">
        <div className="company-search__row">
          <input
            id={inputId}
            className="company-search__input"
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showList}
            aria-controls={listId}
            aria-activedescendant={
              showList && activeIndex >= 0 ? optionId(activeIndex) : undefined
            }
            aria-describedby={messageId}
            autoComplete="off"
            spellCheck={false}
            placeholder={
              variant === 'hero'
                ? 'Apple or AAPL'
                : 'Search a company or ticker'
            }
            value={query}
            onChange={event => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={handleKeyDown}
          />
          {variant === 'hero' && (
            <button type="submit" className="button button--primary">
              Search
            </button>
          )}
        </div>
        <ul
          id={listId}
          className="company-search__options"
          role="listbox"
          aria-label="Matching companies"
          hidden={!showList}
          // Keep focus in the input while a suggestion is clicked.
          onMouseDown={event => event.preventDefault()}
        >
          {companies.map((company, index) => (
            <li
              key={company.ticker}
              id={optionId(index)}
              className="company-search__option"
              role="option"
              aria-selected={index === activeIndex}
              onMouseMove={() => setHighlight({query: trimmed, index})}
              onClick={() => choose(company)}
            >
              <span className="company-search__ticker">{company.ticker}</span>
              <span className="company-search__name">{company.name}</span>
              <span className="company-search__exchange">
                {company.exchange}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p
        id={messageId}
        className="company-search__message"
        role="status"
        aria-live="polite"
      >
        {problem && messageFor(problem)}
      </p>
    </form>
  );
}

function messageFor(problem: Problem): string {
  switch (problem.kind) {
    case 'empty':
      return 'Type a company name or ticker, for example Apple or AAPL.';
    case 'noMatch':
      return `No companies match “${problem.query}”. Try a company name like Apple or a ticker like AAPL.`;
    case 'unavailable':
      return 'Search is unavailable right now. Try again in a moment.';
    default: {
      // Exhaustiveness check: a new kind without a message fails to compile.
      const unreachable: never = problem;
      return unreachable;
    }
  }
}
