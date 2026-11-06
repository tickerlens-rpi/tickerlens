import {Link} from 'react-router';
import {CompanySearch} from '../components/company_search';
import {SampleOverview} from '../components/sample_overview';
import {useResearchClient} from '../data/research_context';

export function Hero() {
  const client = useResearchClient();
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
          <div id="search" className="hero__search">
            <CompanySearch />
          </div>
          <p className="hero__hint">
            Try Apple or NKE.
            {client.usesSampleData &&
              ' Until real market data is connected, every company page uses sample data.'}{' '}
            For AI news summaries and answers,{' '}
            <Link to="/settings">connect your AI</Link>.
          </p>
        </div>
        <div className="hero__visual">
          <SampleOverview />
        </div>
      </div>
    </section>
  );
}
