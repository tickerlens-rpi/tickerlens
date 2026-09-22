import {Audience} from './sections/audience';
import {Comparison} from './sections/comparison';
import {Disclaimer} from './sections/disclaimer';
import {Features} from './sections/features';
import {Hero} from './sections/hero';
import {HowItWorks} from './sections/how_it_works';
import {SiteFooter} from './sections/site_footer';
import {SiteHeader} from './sections/site_header';

export function App() {
  return (
    <div className="page">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main">
        <Hero />
        <Features />
        <HowItWorks />
        <Comparison />
        <Audience />
        <Disclaimer />
      </main>
      <SiteFooter />
    </div>
  );
}
