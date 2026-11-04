import {useEffect} from 'react';
import {BrowserRouter, Route, Routes, useLocation} from 'react-router';
import {
  ResearchClientContext,
  createResearchClient,
} from './data/research_context';
import {CompanyPage} from './pages/company_page';
import {LandingPage} from './pages/landing_page';
import {NotFoundPage} from './pages/not_found_page';

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
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/company/:ticker" element={<CompanyPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}

/** Starts each new page at the top, as a full page load would. */
function ScrollToTop() {
  const {pathname} = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
