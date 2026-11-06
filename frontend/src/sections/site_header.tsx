import {Link, useLocation} from 'react-router';
import {LensMark} from '../components/lens_mark';
import {TextSizeControl} from '../components/text_size_control';
import {PROVIDERS} from '../lib/ai/connection';
import {useAiConnection} from '../lib/ai/use_connection';

interface NavItem {
  to: string;
  label: string;
  /** Other address prefixes that count as this section. */
  alsoActiveUnder?: readonly string[];
}

const NAV_ITEMS: readonly NavItem[] = [
  {to: '/research', label: 'Research', alsoActiveUnder: ['/company/']},
  {to: '/watchlist', label: 'Watchlist'},
  {to: '/settings', label: 'Settings'},
];

/** Header on every page: home link, navigation, AI status and text size. */
export function SiteHeader() {
  const connection = useAiConnection();
  const {pathname} = useLocation();

  return (
    <header className="site-header">
      <div className="site-header__inner container">
        <Link className="wordmark" to="/">
          <LensMark className="wordmark__mark" />
          <span>
            Ticker<em>Lens</em>
          </span>
        </Link>
        <nav className="site-nav" aria-label="Primary">
          <ul>
            {NAV_ITEMS.map(item => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  aria-current={isActive(item, pathname) ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="site-header__actions">
          <Link
            className={`ai-status${connection ? ' ai-status--on' : ''}`}
            to="/settings"
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
          </Link>
          <TextSizeControl />
        </div>
      </div>
    </header>
  );
}

function isActive(item: NavItem, pathname: string): boolean {
  const prefixes = [item.to, ...(item.alsoActiveUnder ?? [])];
  return prefixes.some(
    prefix =>
      pathname === prefix ||
      pathname.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`),
  );
}
