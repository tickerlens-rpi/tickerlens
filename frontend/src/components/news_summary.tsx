import {useCallback, useId} from 'react';
import type {Company} from '../data/research';
import {useResearchClient} from '../data/research_context';
import {shortName} from '../lib/text';
import {useAsync} from '../lib/use_async';
import {ResearchDisclaimer} from './research_disclaimer';
import {SourceTag} from './source_tag';

interface NewsSummaryProps {
  company: Company;
}

/**
 * "What's happening": recent news condensed by AI into a few plain-language
 * bullets (requirement F6), each with its source (F7) and the disclaimer
 * underneath (F8).
 */
export function NewsSummary({company}: NewsSummaryProps) {
  const client = useResearchClient();
  const titleId = useId();
  const loadSummary = useCallback(
    () => client.getNewsSummary(company.ticker),
    [client, company.ticker],
  );
  const summary = useAsync(loadSummary);

  let body;
  let hasBullets = false;
  if (summary.status === 'loading') {
    body = <p className="research__empty">Summarizing the latest news…</p>;
  } else if (summary.status === 'error') {
    body = (
      <p className="research__empty">
        The news summary could not be loaded. Reload the page to try again.
      </p>
    );
  } else if (!summary.value || summary.value.bullets.length === 0) {
    body = (
      <p className="research__empty">
        There is not enough recent news about {shortName(company)} to summarize
        yet.
      </p>
    );
  } else {
    hasBullets = true;
    body = (
      <ul className="summary__bullets">
        {summary.value.bullets.map(bullet => (
          <li key={bullet.source.id} className="summary__bullet">
            <span className="summary__text">{bullet.text}</span>{' '}
            <SourceTag article={bullet.source} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="summary" aria-labelledby={titleId}>
      <h2 className="research__heading" id={titleId}>
        What’s happening
      </h2>
      {hasBullets && (
        <p className="summary__intro">
          An AI summary of the latest news. Open any source to check it.
        </p>
      )}
      {body}
      {hasBullets && <ResearchDisclaimer context="ai" />}
    </section>
  );
}
