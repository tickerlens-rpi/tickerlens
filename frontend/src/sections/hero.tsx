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
            To ask an AI about a real ticker,{' '}
            <a href={routeHref({page: 'settings'})}>
              connect your Claude or ChatGPT API key
            </a>
            .
          </p>
        </div>
        <div className="hero__visual">
          <SampleOverview />
        </div>
      </div>
    </section>
  );
}
