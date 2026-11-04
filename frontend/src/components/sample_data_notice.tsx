import {SAMPLE_NEWS_TICKERS} from '../data/sample_research_client';

const TICKER_LIST = new Intl.ListFormat('en-US', {
  type: 'conjunction',
}).format(SAMPLE_NEWS_TICKERS);

/**
 * Says plainly that the figures on the page are made up. Shown until the
 * page is backed by real market data.
 */
export function SampleDataNotice() {
  return (
    <p className="sample-notice">
      <strong>Sample data.</strong> The prices, figures, news and summaries on
      this page are made up for the prototype. They are not real market data.
      Sample news is written for {TICKER_LIST}.
    </p>
  );
}
