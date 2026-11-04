import {screen, within} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {Company} from '../data/research';
import {SampleResearchClient} from '../data/sample_research_client';
import {renderWithProviders} from '../test/render';
import {NewsList} from './news_list';

const MICROSOFT: Company = {
  ticker: 'MSFT',
  name: 'Microsoft Corporation',
  exchange: 'NASDAQ',
};

function listItemOf(element: HTMLElement): HTMLElement {
  const item = element.closest('li');
  if (!item) {
    throw new Error('Expected the element to sit in a list item');
  }
  return item;
}

describe('NewsList', () => {
  it('lists five articles from at least two publishers (F5)', async () => {
    renderWithProviders(<NewsList company={MICROSOFT} />);

    const items = within(await screen.findByRole('list')).getAllByRole(
      'listitem',
    );
    expect(items).toHaveLength(5);
    const publishers = new Set(
      items.map(
        item => item.querySelector('.news__meta')?.textContent?.split(' ·')[0],
      ),
    );
    expect(publishers.size).toBeGreaterThan(1);
  });

  it('links each headline to the original article in a new tab', async () => {
    renderWithProviders(<NewsList company={MICROSOFT} />);

    const link = await screen.findByRole('link', {
      name: /Microsoft’s cloud revenue keeps climbing/,
    });
    expect(link).toHaveAttribute(
      'href',
      'https://example.com/sample-news/msft-cloud-ai',
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAccessibleName(/opens in a new tab/);
    expect(
      within(listItemOf(link)).getByText(/Demo Daily ·/),
    ).toHaveTextContent('Demo Daily · Oct 15, 2026');
  });

  it('says when there is no news', async () => {
    const client = new SampleResearchClient();
    vi.spyOn(client, 'getNews').mockResolvedValue([]);
    renderWithProviders(<NewsList company={MICROSOFT} />, {client});

    expect(
      await screen.findByText('No recent news about Microsoft yet.'),
    ).toBeInTheDocument();
  });
});
