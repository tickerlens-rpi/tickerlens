import {render, screen, within} from '@testing-library/react';
import {MemoryRouter} from 'react-router';
import {describe, expect, it} from 'vitest';
import {App, AppRoutes} from './app';
import {FEATURES} from './content/features';
import {STEPS} from './content/steps';
import {ResearchClientContext} from './data/research_context';
import {SampleResearchClient} from './data/sample_research_client';

function renderAt(route: string) {
  return render(
    <ResearchClientContext value={new SampleResearchClient()}>
      <MemoryRouter initialEntries={[route]}>
        <AppRoutes />
      </MemoryRouter>
    </ResearchClientContext>,
  );
}

describe('App', () => {
  it('renders the landing page headline', () => {
    render(<App />);
    expect(screen.getByRole('heading', {level: 1})).toHaveTextContent(
      /stock research that explains itself/i,
    );
  });

  it('lists every planned feature and every step', () => {
    render(<App />);
    const features = screen.getByRole('list', {name: 'Planned features'});
    expect(within(features).getAllByRole('listitem')).toHaveLength(
      FEATURES.length,
    );
    const steps = screen.getByRole('list', {name: 'Steps'});
    expect(within(steps).getAllByRole('listitem')).toHaveLength(STEPS.length);
  });

  it('shows the research-only disclaimer', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', {name: /not advice/i}),
    ).toBeInTheDocument();
  });

  it('exposes header, navigation, main and footer landmarks', () => {
    render(<App />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', {name: 'Primary'}),
    ).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('puts the company search on the landing page', () => {
    render(<App />);
    expect(
      screen.getByRole('combobox', {name: 'Search a company or ticker'}),
    ).toBeInTheDocument();
  });
});

describe('AppRoutes', () => {
  it('opens a company page at /company/:ticker', async () => {
    renderAt('/company/NKE');
    expect(
      await screen.findByRole('heading', {level: 1, name: 'Nike, Inc.'}),
    ).toBeInTheDocument();
    expect(screen.getByRole('search')).toBeInTheDocument();
  });

  it('shows a not-found page for any other address', () => {
    renderAt('/no-such-page');
    expect(
      screen.getByRole('heading', {level: 1, name: 'This page does not exist'}),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', {name: 'TickerLens home page'}),
    ).toHaveAttribute('href', '/');
  });
});
