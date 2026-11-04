import {LensMark} from '../components/lens_mark';
import {TextSizeControl} from '../components/text_size_control';
import {PROVIDERS} from '../lib/ai/connection';
import {useAiConnection} from '../lib/ai/use_connection';
import {routeHref} from '../lib/router';
import type {PageName} from '../lib/router';

const NAV_ITEMS: ReadonlyArray<{page: PageName; label: string}> = [
  {page: 'research', label: 'Research'},
  {page: 'watchlist', label: 'Watchlist'},
  {page: 'settings', label: 'Settings'},
];

function hrefFor(page: PageName): string {
  switch (page) {
    case 'research':
      return routeHref({page: 'research'});
    case 'watchlist':
      return routeHref({page: 'watchlist'});
    case 'settings':
      return routeHref({page: 'settings'});
    default:
      return routeHref({page: 'home'});
  }
}

interface SiteHeaderProps {
  /** The page being shown, highlighted in the navigation. */
  current?: PageName;
}

export function SiteHeader({current = 'home'}: SiteHeaderProps) {
  const connection = useAiConnection();

  return (
    <header className="site-header">
      <div className="site-header__inner container">
        <a className="wordmark" href={routeHref({page: 'home'})}>
          <LensMark className="wordmark__mark" />
          <span>
            Ticker<em>Lens</em>
          </span>
        </a>
        <nav className="site-nav" aria-label="Primary">
          <ul>
            {NAV_ITEMS.map(item => (
              <li key={item.page}>
                <a
                  href={hrefFor(item.page)}
                  aria-current={current === item.page ? 'page' : undefined}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="site-header__actions">
          <a
            className={`ai-status${connection ? ' ai-status--on' : ''}`}
            href={routeHref({page: 'settings'})}
          >
            <span className="ai-status__dot" aria-hidden="true" />
            {connection ? (
              <span>
                {PROVIDERS[connection.provider].product}
                <span className="ai-status__long"> connected</span>
              </span>
            ) : (
              'Connect AI'
            )}
          </a>
          <TextSizeControl />
        </div>
      </div>
    </header>
  );
}
