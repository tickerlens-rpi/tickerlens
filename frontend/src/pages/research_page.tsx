import {PageHeading} from '../components/page_heading';
import {ResearchChat} from '../components/research_chat';
import {TickerSearch} from '../components/ticker_search';
import {WatchButton} from '../components/watch_button';
import {useAiConnection} from '../lib/ai/use_connection';
import {navigate, routeHref} from '../lib/router';
import {useWatchlist} from '../lib/use_watchlist';

/** Research dashboard at `#/research` and `#/research/<TICKER>`. */
export function ResearchPage({ticker}: {ticker?: string}) {
  const connection = useAiConnection();
  const watchlist = useWatchlist();

  return (
    <div className="app-page container">
      <PageHeading
        eyebrow="Research"
        title={
          ticker ? (
            <span className="ticker-title">${ticker}</span>
          ) : (
            'Research a stock'
          )
        }
      >
        {ticker ? (
          <WatchButton ticker={ticker} />
        ) : (
          <p>
            Pick a ticker, then ask your connected AI to explain the company,
            its numbers and its risks in plain language.
          </p>
        )}
      </PageHeading>

      <div className="research__search">
        <TickerSearch
          key={ticker ?? ''}
          label={ticker ? 'Research another ticker' : 'Search a company ticker'}
          acceptedMessage={next => `Opening ${next}…`}
          clearOnAccept
          onSearch={next => navigate({page: 'research', ticker: next})}
        />
        {!ticker && watchlist.length > 0 && (
          <nav aria-label="Your watchlist" className="research__shortcuts">
            <p className="research__shortcuts-label">From your watchlist:</p>
            <ul className="chip-list">
              {watchlist.map(item => (
                <li key={item.ticker}>
                  <a
                    className="chip chip--mono"
                    href={routeHref({page: 'research', ticker: item.ticker})}
                  >
                    {item.ticker}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>

      {ticker && (
        <div className="research__body">
          <aside className="notice" aria-label="About this data">
            <p className="notice__title">No live market data yet</p>
            <p>
              Prices, charts and news arrive once the TickerLens API is
              connected. Until then, answers come from your AI model’s training
              knowledge, which has a cutoff date. Check anything important
              against a current source.
            </p>
          </aside>
          {connection ? (
            <ResearchChat
              key={`${ticker}:${connection.provider}:${connection.model}`}
              ticker={ticker}
              connection={connection}
            />
          ) : (
            <section className="connect-card" aria-labelledby="connect-title">
              <h2 className="connect-card__title" id="connect-title">
                Connect an AI to ask about {ticker}
              </h2>
              <p>
                TickerLens uses your own Claude or ChatGPT API key. It is kept
                in this browser on your computer and sent only to the AI
                provider, never to TickerLens.
              </p>
              <a
                className="button button--primary"
                href={routeHref({page: 'settings'})}
              >
                Connect in Settings
              </a>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
