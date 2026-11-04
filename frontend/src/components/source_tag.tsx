import {useId, useState} from 'react';
import type {KeyboardEvent} from 'react';
import type {NewsArticle} from '../data/research';
import {formatLongDate, formatShortDate} from '../lib/format';

interface SourceTagProps {
  article: NewsArticle;
}

/**
 * The source behind one AI statement (requirement F7). The tag names the
 * publisher and date; opening it shows the article's headline and a link to
 * the original, so a reader can check the claim instead of trusting it.
 */
export function SourceTag({article}: SourceTagProps) {
  const [open, setOpen] = useState(false);
  const slipId = useId();

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="source__tag"
        aria-expanded={open}
        aria-controls={slipId}
        onClick={() => setOpen(current => !current)}
        onKeyDown={handleKeyDown}
      >
        {/* Space outside the span so "Source:" never runs into the name. */}
        <span className="visually-hidden">Source:</span> {article.publisher} ·{' '}
        {formatShortDate(article.publishedAt)}
      </button>
      <div id={slipId} className="source__slip" hidden={!open}>
        <p className="source__headline">{article.headline}</p>
        <p className="source__meta">
          {article.publisher} ·{' '}
          <time dateTime={article.publishedAt}>
            {formatLongDate(article.publishedAt)}
          </time>
        </p>
        <a
          className="source__link"
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open original article
          <span className="visually-hidden"> (opens in a new tab)</span>
        </a>
      </div>
    </>
  );
}
