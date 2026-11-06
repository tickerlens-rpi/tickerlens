import {useDocumentTitle} from '../lib/hooks';
import {Audience} from '../sections/audience';
import {Comparison} from '../sections/comparison';
import {Disclaimer} from '../sections/disclaimer';
import {Features} from '../sections/features';
import {Hero} from '../sections/hero';
import {HowItWorks} from '../sections/how_it_works';

/** The home page: what TickerLens is, with the company search up front. */
export function LandingPage() {
  useDocumentTitle('TickerLens · Stock research that explains itself');
  return (
    <>
      <Hero />
      <Features />
      <HowItWorks />
      <Comparison />
      <Audience />
      <Disclaimer />
    </>
  );
}
