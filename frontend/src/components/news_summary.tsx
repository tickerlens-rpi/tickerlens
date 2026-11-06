import {useCallback, useEffect, useId, useRef, useState} from 'react';
import {Link} from 'react-router';
import type {Company, NewsSummary as Summary} from '../data/research';
import {useResearchClient} from '../data/research_context';
import {AiError, describeAiError} from '../lib/ai/chat';
import {PROVIDERS, modelDisplayName} from '../lib/ai/connection';
import {
  readCachedSummary,
  saveCachedSummary,
  summarizeNews,
} from '../lib/ai/news_summary';
import {useAiConnection} from '../lib/ai/use_connection';
import {formatUpdatedAt} from '../lib/format';
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
 * underneath (F8). The sample data comes with written summaries; with real
 * data the reader's own connected AI writes one when asked.
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
  if (summary.status === 'loading') {
    body = <p className="research__empty">Summarizing the latest news…</p>;
  } else if (summary.status === 'error') {
    body = (
      <p className="research__empty">
        The news summary could not be loaded. Reload the page to try again.
      </p>
    );
  } else if (summary.value && summary.value.bullets.length > 0) {
    body = <SummaryBullets summary={summary.value} />;
  } else if (client.usesSampleData) {
    body = <NotEnoughNews company={company} />;
  } else {
    body = <AiSummary key={company.ticker} company={company} />;
  }

  return (
    <section className="summary" aria-labelledby={titleId}>
      <h2 className="research__heading" id={titleId}>
        What’s happening
      </h2>
      {body}
    </section>
  );
}

function SummaryBullets({summary}: {summary: Summary}) {
  return (
    <>
      <p className="summary__intro">
        An AI summary of the latest news. Open any source to check it.
      </p>
      <ul className="summary__bullets">
        {summary.bullets.map((bullet, index) => (
          <li key={index} className="summary__bullet">
            <span className="summary__text">{bullet.text}</span>{' '}
            <SourceTag article={bullet.source} />
          </li>
        ))}
      </ul>
      <ResearchDisclaimer context="ai" />
    </>
  );
}

function NotEnoughNews({company}: {company: Company}) {
  return (
    <p className="research__empty">
      There is not enough recent news about {shortName(company)} to summarize
      yet.
    </p>
  );
}

type AiSummaryState =
  | {kind: 'idle'}
  | {kind: 'working'}
  | {kind: 'ready'; summary: Summary; model: string}
  | {kind: 'no-news'}
  | {kind: 'error'; message: string};

/**
 * The summary written by the reader's own AI. It runs only when asked,
 * because it uses the reader's account, and is kept for a few hours.
 */
function AiSummary({company}: {company: Company}) {
  const client = useResearchClient();
  const connection = useAiConnection();
  const [state, setState] = useState<AiSummaryState>(() => {
    const cached = readCachedSummary(company.ticker);
    return cached ? {kind: 'ready', ...cached} : {kind: 'idle'};
  });
  const abortRef = useRef<AbortController | undefined>(undefined);

  // Stop a summary still being written when the page goes away.
  useEffect(() => () => abortRef.current?.abort(), []);

  async function summarize() {
    if (!connection) {
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({kind: 'working'});
    try {
      const articles = await client.getNews(company.ticker);
      if (articles.length === 0) {
        setState({kind: 'no-news'});
        return;
      }
      const summary = await summarizeNews({
        connection,
        company,
        articles,
        signal: controller.signal,
      });
      if (summary.bullets.length === 0) {
        setState({kind: 'no-news'});
        return;
      }
      saveCachedSummary(company.ticker, summary, connection.model);
      setState({kind: 'ready', summary, model: connection.model});
    } catch (error) {
      if (error instanceof AiError && error.kind === 'aborted') {
        setState({kind: 'idle'});
        return;
      }
      if (!controller.signal.aborted) {
        setState({
          kind: 'error',
          message: describeAiError(error, connection.provider),
        });
      }
    }
  }

  function stop() {
    abortRef.current?.abort();
    setState({kind: 'idle'});
  }

  if (state.kind === 'ready') {
    return (
      <>
        <SummaryBullets summary={state.summary} />
        <p className="summary__meta">
          Written by {modelDisplayName(state.model)} ·{' '}
          <time dateTime={state.summary.generatedAt}>
            {formatUpdatedAt(state.summary.generatedAt)}
          </time>
          {connection && (
            <>
              {' · '}
              <button
                type="button"
                className="link-button"
                onClick={() => void summarize()}
              >
                Summarize again
              </button>
            </>
          )}
        </p>
      </>
    );
  }

  if (!connection) {
    return (
      <div className="summary__connect">
        <p className="research__empty">
          Connect your own AI to get a short summary of the latest news about{' '}
          {shortName(company)}, with the source behind every point.
        </p>
        <Link className="button" to="/settings">
          Connect your AI
        </Link>
      </div>
    );
  }

  const product = PROVIDERS[connection.provider].product;
  return (
    <div className="summary__connect">
      {state.kind === 'no-news' ? (
        <NotEnoughNews company={company} />
      ) : (
        <p className="research__empty">
          {product} can read the latest news about {shortName(company)} and sum
          it up in a few sentences, each with its source.
        </p>
      )}
      {state.kind === 'working' ? (
        <div className="summary__actions">
          <p className="research__status" role="status">
            Reading the latest news…
          </p>
          <button type="button" className="button" onClick={stop}>
            Stop
          </button>
        </div>
      ) : (
        state.kind !== 'no-news' && (
          <button
            type="button"
            className="button button--primary"
            onClick={() => void summarize()}
          >
            {state.kind === 'error' ? 'Try again' : 'Summarize the news'}
          </button>
        )
      )}
      {state.kind === 'error' && (
        <p className="summary__error" role="alert">
          {state.message}
        </p>
      )}
    </div>
  );
}
