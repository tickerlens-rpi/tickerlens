import {useCallback, useId} from 'react';
import type {Company} from '../data/research';
import {useResearchClient} from '../data/research_context';
import {formatLongDate} from '../lib/format';
import {shortName} from '../lib/text';
import {useAsync} from '../lib/use_async';

/** Articles shown at once (acceptance test for requirement F5). */
export const NEWS_LIMIT = 5;

interface NewsListProps {
  company: Company;
}

/**
 * The latest articles about the company from more than one publisher, each
 * with its headline, publisher, date and a link to the original (F5).
 */
export function NewsList({company}: NewsListProps) {
  const client = useResearchClient();
  const titleId = useId();
  const loadNews = useCallback(
    () => client.getNews(company.ticker),
    [client, company.ticker],
  );
  const news = useAsync(loadNews);

  let body;
  if (news.status === 'loading') {
    body = <p className="research__empty">Loading the latest news…</p>;
  } else if (news.status === 'error') {
    body = (
      <p className="research__empty">
        The news could not be loaded. Reload the page to try again.
      </p>
    );
  } else if (news.value.length === 0) {
    body = (
      <p className="research__empty">
        No recent news about {shortName(company)} yet.
      </p>
    );
  } else {
    body = (
      <ul className="news__list">
        {news.value.slice(0, NEWS_LIMIT).map(article => (
          <li key={article.id} className="news__item">
            <a
              className="news__headline"
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {article.headline}
              <span className="visually-hidden"> (opens in a new tab)</span>
            </a>
            <p className="news__meta">
              {article.publisher} ·{' '}
              <time dateTime={article.publishedAt}>
                {formatLongDate(article.publishedAt)}
              </time>
            </p>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="news" aria-labelledby={titleId}>
      <h2 className="research__heading" id={titleId}>
        Latest news
      </h2>
      {body}
    </section>
  );
}
