import {screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it} from 'vitest';
import type {Company} from '../data/research';
import {renderWithProviders} from '../test/render';
import {NewsSummary} from './news_summary';

const NIKE: Company = {ticker: 'NKE', name: 'Nike, Inc.', exchange: 'NYSE'};
const COKE: Company = {
  ticker: 'KO',
  name: 'The Coca-Cola Company',
  exchange: 'NYSE',
};

describe('NewsSummary', () => {
  it('lists plain-language bullets, each with a source tag (F6, F7)', async () => {
    renderWithProviders(<NewsSummary company={NIKE} />);

    const list = await screen.findByRole('list');
    const bullets = within(list).getAllByRole('listitem');
    expect(bullets).toHaveLength(3);
    for (const bullet of bullets) {
      expect(
        within(bullet).getByRole('button', {name: /^Source: /}),
      ).toBeInTheDocument();
    }
    expect(bullets[0]).toHaveTextContent('Nike lowered its full-year guidance');
  });

  it('shows the disclaimer under the AI summary (F8)', async () => {
    renderWithProviders(<NewsSummary company={NIKE} />);
    expect(
      await screen.findByText(/not investment advice/),
    ).toBeInTheDocument();
  });

  it('says when there is too little news, without the AI disclaimer', async () => {
    renderWithProviders(<NewsSummary company={COKE} />);

    expect(
      await screen.findByText(
        'There is not enough recent news about Coca-Cola to summarize yet.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Written by AI/)).not.toBeInTheDocument();
  });
});

describe('SourceTag', () => {
  it('opens the original article’s headline, publisher, date and link (F7)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewsSummary company={NIKE} />);
    const tag = await screen.findByRole('button', {
      name: 'Source: Sample Wire · Oct 15',
    });

    await user.click(tag);

    expect(tag).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByText(
        'Nike lowers its full-year outlook as demand slows in China and North America',
      ),
    ).toBeVisible();
    expect(screen.getAllByText('Oct 15, 2026')[0]).toBeVisible();
    const link = screen.getByRole('link', {name: /Open original article/});
    expect(link).toHaveAttribute(
      'href',
      'https://example.com/sample-news/nke-outlook-cut',
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');

    await user.keyboard('{Escape}');
    expect(tag).toHaveAttribute('aria-expanded', 'false');
  });
});
