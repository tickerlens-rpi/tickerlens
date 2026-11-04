import {useEffect, useRef} from 'react';
import {useRoute} from './lib/use_route';
import type {PageName, Route} from './lib/router';
import {LandingPage} from './pages/landing_page';
import {NotFoundPage} from './pages/not_found_page';
import {ResearchPage} from './pages/research_page';
import {SettingsPage} from './pages/settings_page';
import {WatchlistPage} from './pages/watchlist_page';
import {SiteFooter} from './sections/site_footer';
import {SiteHeader} from './sections/site_header';

const PAGE_TITLES: Record<PageName, string> = {
  home: 'TickerLens · Stock research that explains itself',
  research: 'Research · TickerLens',
  watchlist: 'Watchlist · TickerLens',
  settings: 'Settings · TickerLens',
  'not-found': 'Not found · TickerLens',
};

function renderPage(route: Route) {
  switch (route.page) {
    case 'home':
      return <LandingPage />;
    case 'research':
      return <ResearchPage ticker={route.ticker} />;
    case 'watchlist':
      return <WatchlistPage />;
    case 'settings':
      return <SettingsPage />;
    case 'not-found':
      return <NotFoundPage />;
    default: {
      const unreachable: never = route;
      return unreachable;
    }
  }
}

function pageKey(route: Route): string {
  return route.page === 'research'
    ? `research:${route.ticker ?? ''}`
    : route.page;
}

export function App() {
  const route = useRoute();
  const key = pageKey(route);
  const mainRef = useRef<HTMLElement>(null);
  const previousKey = useRef(key);

  useEffect(() => {
    document.title =
      route.page === 'research' && route.ticker
        ? `${route.ticker} · Research · TickerLens`
        : PAGE_TITLES[route.page];
    // On real page changes (not the first render, and not in-page anchors on
    // the landing page) start at the top and move focus to the new content,
    // so screen-reader and keyboard users land on it.
    if (previousKey.current !== key) {
      previousKey.current = key;
      window.scrollTo({top: 0});
      mainRef.current?.focus({preventScroll: true});
    }
  }, [key, route]);

  return (
    <div className="page">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader current={route.page} />
      <main id="main" ref={mainRef} tabIndex={-1}>
        {renderPage(route)}
      </main>
      <SiteFooter />
    </div>
  );
}
