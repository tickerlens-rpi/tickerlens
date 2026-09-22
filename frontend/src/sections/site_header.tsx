import {LensMark} from '../components/lens_mark';
import {TextSizeControl} from '../components/text_size_control';

const NAV_ITEMS = [
  {href: '#features', label: 'Features'},
  {href: '#how-it-works', label: 'How it works'},
  {href: '#compare', label: 'Compare'},
] as const;

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner container">
        <a className="wordmark" href="#top">
          <LensMark className="wordmark__mark" />
          <span>
            Ticker<em>Lens</em>
          </span>
        </a>
        <nav className="site-nav" aria-label="Primary">
          <ul>
            {NAV_ITEMS.map(item => (
              <li key={item.href}>
                <a href={item.href}>{item.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="site-header__actions">
          <TextSizeControl />
          <a className="button button--primary site-header__cta" href="#search">
            Try the demo
          </a>
        </div>
      </div>
    </header>
  );
}
