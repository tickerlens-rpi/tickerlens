import {SampleOverview} from '../components/sample_overview';
import {TickerSearch} from '../components/ticker_search';
import {navigate, routeHref} from '../lib/router';

export function Hero() {
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="hero__inner container">
        <div className="hero__copy">
          <p className="eyebrow">AI-assisted stock research · Built at RPI</p>
          <h1 className="hero__title" id="hero-title">
            Stock research that <em>explains itself.</em>
          </h1>
          <p className="hero__lede">
            TickerLens turns market data, financial metrics and company news
            into plain-language research you can actually read, with the source
            behind every claim.
          </p>
          <div id="search">
            <TickerSearch
              onSearch={ticker => navigate({page: 'research', ticker})}
            />
          </div>
          <p className="hero__hint">
            Try the sample card: tap any dotted term, or widen the chart to 1Y.
            Search a real ticker to ask Claude or ChatGPT about it; live prices
            and news are coming soon.{' '}
            <a href={routeHref({page: 'settings'})}>Connect your AI</a>
          </p>
        </div>
        <div className="hero__visual">
          <SampleOverview />
        </div>
      </div>
    </section>
  );
}
