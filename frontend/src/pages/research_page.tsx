import {useState} from 'react';
import {AiConnectionForm} from '../components/ai_connection_form';
import {PageHeading} from '../components/page_heading';
import {ResearchChat} from '../components/research_chat';
import {TickerSearch} from '../components/ticker_search';
import {WatchButton} from '../components/watch_button';
import {useAiConnection} from '../lib/ai/use_connection';
import {navigate, routeHref} from '../lib/router';
import {useWatchlist} from '../lib/use_watchlist';

const TICKER_HINT = (
  <>
    A ticker is a stock’s short code: AAPL is Apple, NVDA is Nvidia, KO is
    Coca-Cola. Not sure of one? Search the web for “<em>company</em> stock
    ticker”.
  </>
);

/** Research dashboard at `#/research` and `#/research/<TICKER>`. */
export function ResearchPage({ticker}: {ticker?: string}) {
  return ticker ? <TickerResearch ticker={ticker} /> : <ResearchStart />;
}

/** No ticker yet: pick one. */
function ResearchStart() {
  const watchlist = useWatchlist();
  return (
    <div className="app-page container">
      <PageHeading eyebrow="Research" title="Research a stock">
        <p>
          Pick a company, then ask an AI to explain what it does, its numbers
          and its risks in plain language.
        </p>
      </PageHeading>
      <div className="research__search">
        <TickerSearch
          acceptedMessage={next => `Opening ${next}…`}
          onSearch={next => navigate({page: 'research', ticker: next})}
          hint={TICKER_HINT}
        />
        {watchlist.length > 0 && (
          <nav aria-label="Your watchlist" className="research__shortcuts">
            <p className="research__shortcuts-label">
              Or pick from your watchlist:
            </p>
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
    </div>
  );
}

/** One ticker: the chat, or connecting an AI first. */
function TickerResearch({ticker}: {ticker: string}) {
  const connection = useAiConnection();
  // If the user connects on this page, put them straight into the chat box.
  const [connectedOnArrival] = useState(connection !== undefined);

  return (
    <div className="app-page container">
      <div className="research__head">
        <PageHeading
          eyebrow="Research"
          title={<span className="ticker-title">${ticker}</span>}
        >
          <WatchButton ticker={ticker} />
        </PageHeading>
        <TickerSearch
          key={ticker}
          compact
          label="Research another ticker"
          placeholder="e.g. MSFT"
          clearOnAccept
          acceptedMessage={next =>
            next === ticker
              ? `You are already looking at ${next}.`
              : `Opening ${next}…`
          }
          onSearch={next => {
            if (next !== ticker) {
              navigate({page: 'research', ticker: next});
            }
          }}
        />
      </div>

      <div className="research__body">
        <aside className="notice" aria-labelledby="notice-title">
          <p className="notice__tag" id="notice-title">
            Live data coming soon
          </p>
          <p>
            Live prices, charts and news are not here yet; we are still building
            that part of TickerLens. For now, answers come from what the AI
            learned during training, which can be a year or more out of date.
          </p>
          <p>
            Always check the current price and recent news on your brokerage or
            a finance site before deciding anything.
          </p>
        </aside>
        {connection ? (
          <ResearchChat
            key={`${ticker}:${connection.provider}:${connection.model}`}
            ticker={ticker}
            connection={connection}
            autoFocus={!connectedOnArrival}
          />
        ) : (
          <section className="connect-card" aria-labelledby="connect-title">
            <h2 className="connect-card__title" id="connect-title">
              Connect an AI to ask about {ticker}
            </h2>
            <p className="connect-card__lede">
              TickerLens uses your own Claude or ChatGPT developer account. Your
              key stays on this computer and goes only to the AI company, never
              to TickerLens. You only need to do this once.
            </p>
            <AiConnectionForm />
          </section>
        )}
      </div>
    </div>
  );
}
