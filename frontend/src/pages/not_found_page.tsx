import {Link} from 'react-router';
import {CompanySearch} from '../components/company_search';
import {useDocumentTitle} from '../lib/hooks';
import {ResearchLayout} from '../sections/research_layout';

/** Shown for any address that is not a TickerLens page. */
export function NotFoundPage() {
  useDocumentTitle('Page not found · TickerLens');
  return (
    <ResearchLayout>
      <div className="research__missing">
        <h1 className="research__missing-title">This page does not exist</h1>
        <p>
          Search for a company below, or go back to the{' '}
          <Link to="/">TickerLens home page</Link>.
        </p>
        <CompanySearch />
      </div>
    </ResearchLayout>
  );
}
