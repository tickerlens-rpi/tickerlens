import {render, screen, within} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {App} from './app';
import {FEATURES} from './content/features';
import {STEPS} from './content/steps';

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
});
