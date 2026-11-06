import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router';
import {describe, expect, it} from 'vitest';
import {App, AppRoutes} from './app';
import {FEATURES} from './content/features';
import {STEPS} from './content/steps';
import {ResearchClientContext} from './data/research_context';
import {SampleResearchClient} from './data/sample_research_client';
import {CurrentPath} from './test/current_path';

function renderAt(route: string) {
  return render(
    <ResearchClientContext value={new SampleResearchClient()}>
      <MemoryRouter initialEntries={[route]}>
        <AppRoutes />
        <CurrentPath />
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
    expect(screen.getByRole('link', {name: 'Research'})).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('opens a company page from the landing page search', async () => {
    const user = userEvent.setup();
    renderAt('/');

    await user.type(
      screen.getByRole('combobox', {name: 'Search a company or ticker'}),
      'nike{Enter}',
    );

    expect(
      await screen.findByRole('heading', {level: 1, name: 'Nike, Inc.'}),
    ).toBeInTheDocument();
    expect(screen.getByTestId('current-path')).toHaveTextContent(
      '/company/NKE',
    );
  });

  it('shows the settings page and marks it in the navigation', async () => {
    renderAt('/settings');
    expect(
      await screen.findByRole('heading', {level: 1, name: 'Settings'}),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Settings'})).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('shows the watchlist page', async () => {
    renderAt('/watchlist');
    expect(
      await screen.findByRole('heading', {name: /stocks you’re watching/i}),
    ).toBeInTheDocument();
  });

  it('asks for an AI connection before chatting about a ticker', async () => {
    renderAt('/research/nvda');
    expect(
      await screen.findByRole('heading', {level: 1, name: '$NVDA'}),
    ).toBeInTheDocument();
    expect(screen.getByTestId('current-path')).toHaveTextContent(
      '/research/NVDA',
    );
    expect(
      screen.getByRole('heading', {name: 'Connect an AI to ask about NVDA'}),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', {name: 'NVDA company page'}),
    ).toHaveAttribute('href', '/company/NVDA');
  });

  it('adds a ticker to the watchlist from the chat page', async () => {
    const user = userEvent.setup();
    renderAt('/research/MSFT');

    await user.click(screen.getByRole('button', {name: 'Add to watchlist'}));
    expect(
      screen.getByRole('button', {name: 'On your watchlist'}),
    ).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('link', {name: 'Watchlist'}));
    const list = await screen.findByRole('list', {name: 'Watchlist'});
    expect(within(list).getByRole('link', {name: 'MSFT'})).toHaveAttribute(
      'href',
      '/company/MSFT',
    );
  });

  it('skips to the content without leaving the current page', async () => {
    const user = userEvent.setup();
    renderAt('/settings');

    await user.click(screen.getByRole('link', {name: 'Skip to content'}));

    expect(screen.getByTestId('current-path')).toHaveTextContent('/settings');
    expect(screen.getByRole('main')).toHaveFocus();
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
