import {useState} from 'react';
import {Link, Navigate, useNavigate, useParams} from 'react-router';
import {AiConnectionForm} from '../components/ai_connection_form';
import {CompanySearch} from '../components/company_search';
import {PageHeading} from '../components/page_heading';
import {ResearchChat} from '../components/research_chat';
import {WatchButton} from '../components/watch_button';
import {useAiConnection} from '../lib/ai/use_connection';
import {useDocumentTitle} from '../lib/hooks';
import {parseTickerInput} from '../lib/ticker';
import {useWatchlist} from '../lib/use_watchlist';

/**
 * Research at `/research` (pick a company) and `/research/:ticker`, where the
 * user can ask their connected AI about one stock.
 */
export function ResearchPage() {
  const {ticker: raw} = useParams();
  if (raw === undefined) {
    return <ResearchStart />;
  }
  const {ticker, error} = parseTickerInput(raw);
  if (error) {
    return <Navigate replace to="/research" />;
  }
  if (ticker !== raw) {
    // /research/aapl and /research/$AAPL both lead to /research/AAPL.
    return <Navigate replace to={`/research/${encodeURIComponent(ticker)}`} />;
  }
  return <TickerResearch ticker={ticker} />;
}

/** No company yet: pick one. */
function ResearchStart() {
  useDocumentTitle('Research · TickerLens');
  const watchlist = useWatchlist();
  return (
    <div className="app-page container">
      <PageHeading eyebrow="Research" title="Research a stock">
        <p>
          Search by company name or ticker to see its price, key figures
          explained, a simple chart, recent news and an AI summary of it.
        </p>
      </PageHeading>
      <div className="research__search">
        <CompanySearch />
        {watchlist.length > 0 && (
          <nav aria-label="Your watchlist" className="research__shortcuts">
            <p className="research__shortcuts-label">
              Or pick from your watchlist:
            </p>
            <ul className="chip-list">
              {watchlist.map(item => (
                <li key={item.ticker}>
                  <Link
                    className="chip chip--mono"
                    to={`/company/${encodeURIComponent(item.ticker)}`}
                  >
                    {item.ticker}
                  </Link>
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
  useDocumentTitle(`${ticker} · Ask AI · TickerLens`);
  const connection = useAiConnection();
  const navigate = useNavigate();
  // If the user connects on this page, put them straight into the chat box.
  const [connectedOnArrival] = useState(connection !== undefined);
  const companyHref = `/company/${encodeURIComponent(ticker)}`;

  return (
    <div className="app-page container">
      <div className="research__head">
        <PageHeading
          eyebrow="Ask AI"
          title={<span className="ticker-title">${ticker}</span>}
        >
          <WatchButton ticker={ticker} />
        </PageHeading>
        <CompanySearch
          key={ticker}
          variant="compact"
          label="Ask about another company"
          onChoose={company => {
            if (company.ticker !== ticker) {
              void navigate(`/research/${encodeURIComponent(company.ticker)}`);
            }
          }}
        />
      </div>

      <div className="research__body">
        <aside className="notice" aria-labelledby="notice-title">
          <p className="notice__tag" id="notice-title">
            Answers come from the AI’s training
          </p>
          <p>
            This chat answers from what the AI learned during training, which
            can be a year or more out of date. For today’s price, key figures
            and news, open the{' '}
            <Link to={companyHref}>{ticker} company page</Link>.
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
              TickerLens uses your own Claude or ChatGPT account. Your sign-in
              stays on this computer. You only need to do this once.
            </p>
            <AiConnectionForm />
          </section>
        )}
      </div>
    </div>
  );
}
