import {useId, useState} from 'react';
import type {KeyboardEvent, ReactNode} from 'react';

interface TermProps {
  /** The word or metric being explained, shown as the card's title. */
  term: string;
  /** Plain-language explanation revealed when the term is opened. */
  definition: string;
  /** Inline text to underline; defaults to `term`. */
  children?: ReactNode;
}

/**
 * Inline jargon with a dotted underline. Activating it reveals a short
 * plain-language explanation: the "tap what you don't know" interaction that
 * the whole product is built around.
 */
export function Term({term, definition, children}: TermProps) {
  const [open, setOpen] = useState(false);
  const cardId = useId();

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <span className="term">
      <button
        type="button"
        className="term__trigger"
        aria-expanded={open}
        aria-controls={cardId}
        onClick={() => setOpen(current => !current)}
        onKeyDown={handleKeyDown}
      >
        {children ?? term}
      </button>
      <span id={cardId} role="note" className="term__card" hidden={!open}>
        <strong className="term__title">{term}</strong> {definition}
      </span>
    </span>
  );
}
