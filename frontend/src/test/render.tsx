import {render} from '@testing-library/react';
import type {ReactElement} from 'react';
import {MemoryRouter, Route, Routes} from 'react-router';
import type {ResearchClient} from '../data/research';
import {ResearchClientContext} from '../data/research_context';
import {SampleResearchClient} from '../data/sample_research_client';
import {CurrentPath} from './current_path';

interface ProviderOptions {
  /** Defaults to a fresh sample client. */
  client?: ResearchClient;
  /** The address the router starts at. */
  route?: string;
  /** The route pattern `ui` renders under, for pages that read params. */
  path?: string;
}

/**
 * Renders `ui` inside a research client and an in-memory router. The current
 * path is shown in the element with test id "current-path", so tests can
 * check where a click navigated to.
 */
export function renderWithProviders(
  ui: ReactElement,
  {
    client = new SampleResearchClient(),
    route = '/',
    path = '*',
  }: ProviderOptions = {},
) {
  return render(
    <ResearchClientContext value={client}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={ui} />
          {path !== '*' && <Route path="*" element={null} />}
        </Routes>
        <CurrentPath />
      </MemoryRouter>
    </ResearchClientContext>,
  );
}
