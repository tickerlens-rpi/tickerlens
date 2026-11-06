import {useEffect, useRef} from 'react';
import {BrowserRouter, Outlet, Route, Routes, useLocation} from 'react-router';
import {
  ResearchClientContext,
  createResearchClient,
} from './data/research_context';
import {CompanyPage} from './pages/company_page';
import {LandingPage} from './pages/landing_page';
import {NotFoundPage} from './pages/not_found_page';
import {ResearchPage} from './pages/research_page';
import {SettingsPage} from './pages/settings_page';
import {WatchlistPage} from './pages/watchlist_page';
import {SiteFooter} from './sections/site_footer';
import {SiteHeader} from './sections/site_header';

// Set VITE_API_BASE_URL (see frontend/README.md) to use the central API.
const RESEARCH_CLIENT = createResearchClient(import.meta.env.VITE_API_BASE_URL);

/** The whole app: the research data client, the router and the pages. */
export function App() {
  return (
    <ResearchClientContext value={RESEARCH_CLIENT}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ResearchClientContext>
  );
}

/** Maps addresses to pages. Tests render this inside a MemoryRouter. */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/company/:ticker" element={<CompanyPage />} />
        <Route path="/research" element={<ResearchPage />} />
        <Route path="/research/:ticker" element={<ResearchPage />} />
        <Route path="/watchlist" element={<WatchlistPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

/**
 * The frame every page shares: skip link, header, main landmark and footer.
 * Each page sets its own title with `useDocumentTitle`.
 */
function AppLayout() {
  const {pathname} = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);

  useEffect(() => {
    // On real page changes (not the first render) start at the top and move
    // focus to the new content, so screen-reader and keyboard users land on
    // it, as they would after a full page load.
    if (previousPath.current !== pathname) {
      previousPath.current = pathname;
      window.scrollTo({top: 0});
      mainRef.current?.focus({preventScroll: true});
    }
  }, [pathname]);

  return (
    <div className="page">
      <a
        className="skip-link"
        href="#main"
        onClick={event => {
          // Following `#main` would change the address; move focus instead.
          event.preventDefault();
          mainRef.current?.focus();
        }}
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" ref={mainRef} tabIndex={-1}>
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
