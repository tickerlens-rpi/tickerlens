import {Audience} from '../sections/audience';
import {Comparison} from '../sections/comparison';
import {Disclaimer} from '../sections/disclaimer';
import {Features} from '../sections/features';
import {Hero} from '../sections/hero';
import {HowItWorks} from '../sections/how_it_works';

/** The marketing landing page at `#/`. */
export function LandingPage() {
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
