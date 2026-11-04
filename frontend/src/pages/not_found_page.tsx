import {PageHeading} from '../components/page_heading';
import {routeHref} from '../lib/router';

/** Shown for `#/` paths that match no page. */
export function NotFoundPage() {
  return (
    <div className="app-page container">
      <PageHeading eyebrow="Not found" title="That page does not exist">
        <p>
          <a href={routeHref({page: 'home'})}>Go to the home page</a> or{' '}
          <a href={routeHref({page: 'research'})}>start researching</a>.
        </p>
      </PageHeading>
    </div>
  );
}
