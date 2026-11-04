import {useId, useState} from 'react';
import type {KeyboardEvent} from 'react';
import {KEY_FIGURES} from '../content/key_figures';
import type {KeyFigureId} from '../content/key_figures';
import type {Company, Overview} from '../data/research';

interface OverviewFiguresProps {
  company: Company;
  overview: Overview;
}

/**
 * The seven key figures (requirement F2). Every label opens a plain-language
 * explanation of that number for this company (F3). One explanation shows at
 * a time: opening another closes the first, as use case UC2 describes.
 */
export function OverviewFigures({company, overview}: OverviewFiguresProps) {
  const [openId, setOpenId] = useState<KeyFigureId>();
  const titleId = useId();
  const explainerId = useId();
  const open = KEY_FIGURES.find(figure => figure.id === openId);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      setOpenId(undefined);
    }
  }

  return (
    <section
      className="figures"
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
    >
      <h2 className="research__heading" id={titleId}>
        Key figures
      </h2>
      <dl className="figures__list">
        {KEY_FIGURES.map(figure => (
          <div
            key={figure.id}
            className="figures__item"
            data-open={figure.id === openId || undefined}
          >
            <dt>
              <button
                type="button"
                className="figures__label"
                aria-expanded={figure.id === openId}
                aria-controls={explainerId}
                onClick={() =>
                  setOpenId(current =>
                    current === figure.id ? undefined : figure.id,
                  )
                }
              >
                {figure.label}
              </button>
            </dt>
            <dd className="figures__value">{figure.value(overview)}</dd>
          </div>
        ))}
      </dl>
      <div id={explainerId} className="figures__explainer" hidden={!open}>
        {open && (
          <>
            <p>
              <strong className="figures__explainer-title">{open.label}</strong>{' '}
              {open.explain(overview, company)}
            </p>
            <button
              type="button"
              className="figures__close"
              onClick={() => setOpenId(undefined)}
            >
              Close
            </button>
          </>
        )}
      </div>
    </section>
  );
}
