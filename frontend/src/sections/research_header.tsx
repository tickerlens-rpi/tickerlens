import {Link} from 'react-router';
import {CompanySearch} from '../components/company_search';
import {LensMark} from '../components/lens_mark';
import {TextSizeControl} from '../components/text_size_control';

/** Header for the research pages: home link, search and text size. */
export function ResearchHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner container">
        <Link className="wordmark" to="/">
          <LensMark className="wordmark__mark" />
          <span>
            Ticker<em>Lens</em>
          </span>
        </Link>
        <div className="site-header__search">
          <CompanySearch variant="compact" />
        </div>
        <div className="site-header__actions">
          <TextSizeControl />
        </div>
      </div>
    </header>
  );
}
