import {act, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it} from 'vitest';
import {App} from './app';
import {FEATURES} from './content/features';
import {STEPS} from './content/steps';

// jsdom updates `location.hash` but does not fire `hashchange` synchronously,
// so fire it ourselves to keep tests deterministic.
function navigateTo(hash: string) {
  window.location.hash = hash;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
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

  it('routes to each app page from the hash', async () => {
    render(<App />);

    act(() => navigateTo('#/settings'));
    expect(
      await screen.findByRole('heading', {level: 1, name: 'Settings'}),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Settings'})).toHaveAttribute(
      'aria-current',
      'page',
    );

    act(() => navigateTo('#/watchlist'));
    expect(
      await screen.findByRole('heading', {name: /stocks you’re watching/i}),
    ).toBeInTheDocument();

    act(() => navigateTo('#/research/nvda'));
    expect(
      await screen.findByRole('heading', {level: 1, name: '$NVDA'}),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', {name: 'Connect in Settings'}),
    ).toHaveAttribute('href', '#/settings');

    act(() => navigateTo('#/missing'));
    expect(
      await screen.findByRole('heading', {name: /does not exist/}),
    ).toBeInTheDocument();
  });

  it('opens research for a ticker searched from the hero', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(
      screen.getByRole('textbox', {name: /company ticker/i}),
      'aapl{Enter}',
    );

    expect(window.location.hash).toBe('#/research/AAPL');
    expect(
      await screen.findByRole('heading', {level: 1, name: '$AAPL'}),
    ).toBeInTheDocument();
  });

  it('adds a researched ticker to the watchlist', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/research/MSFT';
    render(<App />);

    await user.click(screen.getByRole('button', {name: 'Add to watchlist'}));
    expect(
      screen.getByRole('button', {name: 'On your watchlist'}),
    ).toHaveAttribute('aria-pressed', 'true');

    act(() => navigateTo('#/watchlist'));
    const list = await screen.findByRole('list', {name: 'Watchlist'});
    expect(within(list).getByRole('link', {name: 'MSFT'})).toBeVisible();
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
});
