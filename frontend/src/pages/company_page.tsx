import {useCallback} from 'react';
import type {ReactNode} from 'react';
import {Navigate, useParams} from 'react-router';
import {CompanySearch} from '../components/company_search';
import {NewsList} from '../components/news_list';
import {NewsSummary} from '../components/news_summary';
import {OverviewFigures} from '../components/overview_figures';
import {PriceChart} from '../components/price_chart';
import {QuoteHeader} from '../components/quote_header';
import {ResearchDisclaimer} from '../components/research_disclaimer';
import {SampleDataNotice} from '../components/sample_data_notice';
import type {Company} from '../data/research';
import {useResearchClient} from '../data/research_context';
import {useDocumentTitle} from '../lib/hooks';
import {normalizeTicker} from '../lib/ticker';
import {useAsync} from '../lib/use_async';
import {ResearchLayout} from '../sections/research_layout';

/**
 * One company's research page, at /company/:ticker. Everything a reader
 * needs sits on this single page: the price and key figures with
 * explanations, the chart, the AI news summary with sources, and the news.
 */
export function CompanyPage() {
  const {ticker = ''} = useParams();
  const symbol = normalizeTicker(ticker);
  const client = useResearchClient();
  const loadCompany = useCallback(
    () => client.getCompany(symbol),
    [client, symbol],
  );
  const company = useAsync(loadCompany);

  if (ticker !== symbol) {
    // /company/aapl and /company/$AAPL both lead to /company/AAPL.
    return <Navigate replace to={`/company/${encodeURIComponent(symbol)}`} />;
  }

  let body: ReactNode;
  if (company.status === 'loading') {
    body = (
      <p className="research__status" role="status">
        Loading {symbol}…
      </p>
    );
  } else if (company.status === 'error') {
    body = <LoadFailed symbol={symbol} />;
  } else if (!company.value) {
    body = <CompanyNotFound symbol={symbol} />;
  } else {
    body = <CompanyResearch company={company.value} />;
  }

  return <ResearchLayout>{body}</ResearchLayout>;
}

function CompanyResearch({company}: {company: Company}) {
  const client = useResearchClient();
  useDocumentTitle(`${company.name} (${company.ticker}) · TickerLens`);
  const loadOverview = useCallback(
    () => client.getOverview(company.ticker),
    [client, company.ticker],
  );
  const overview = useAsync(loadOverview);
  const figures = overview.status === 'ready' ? overview.value : undefined;

  let overviewBody: ReactNode;
  if (figures) {
    overviewBody = <OverviewFigures company={company} overview={figures} />;
  } else if (overview.status === 'loading') {
    overviewBody = <p className="research__empty">Loading key figures…</p>;
  } else if (overview.status === 'error') {
    overviewBody = (
      <p className="research__empty">
        The key figures could not be loaded. Reload the page to try again.
      </p>
    );
  } else {
    overviewBody = (
      <p className="research__empty">
        Key figures for {company.name} are not available yet.
      </p>
    );
  }

  return (
    <>
      {client.usesSampleData && <SampleDataNotice />}
      <QuoteHeader company={company} overview={figures} />
      <ResearchDisclaimer />
      {overviewBody}
      <div className="research__grid">
        <PriceChart ticker={company.ticker} companyName={company.name} />
        <NewsSummary company={company} />
        <NewsList company={company} />
      </div>
    </>
  );
}

function CompanyNotFound({symbol}: {symbol: string}) {
  useDocumentTitle('Company not found · TickerLens');
  return (
    <div className="research__missing">
      <h1 className="research__missing-title">
        No company found for “{symbol}”
      </h1>
      <p>
        TickerLens covers companies listed on the NYSE and NASDAQ. Search by
        company name or ticker instead.
      </p>
      <CompanySearch />
    </div>
  );
}

function LoadFailed({symbol}: {symbol: string}) {
  useDocumentTitle('TickerLens');
  return (
    <div className="research__missing">
      <h1 className="research__missing-title">{symbol} could not be loaded</h1>
      <p>
        TickerLens could not reach its data service. Reload the page to try
        again.
      </p>
    </div>
  );
}
