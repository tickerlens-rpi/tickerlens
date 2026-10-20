import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {SampleResearchClient} from '../data/sample_research_client';
import {renderWithProviders} from '../test/render';
import {CompanySearch} from './company_search';

function currentPath() {
  return screen.getByTestId('current-path');
}

describe('CompanySearch', () => {
  it('suggests companies by name, best match first (F1)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CompanySearch />);

    await user.type(screen.getByRole('combobox'), 'apple');

    const options = await screen.findAllByRole('option');
    expect(options[0]).toHaveTextContent('AAPLApple Inc.NASDAQ');
    expect(options[1]).toHaveTextContent('APLEApple Hospitality REITNYSE');
    expect(screen.getByRole('combobox')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('opens the company page for a clicked suggestion', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CompanySearch />);

    await user.type(screen.getByRole('combobox'), 'nike');
    await user.click(await screen.findByRole('option', {name: /Nike, Inc\./}));

    expect(currentPath()).toHaveTextContent('/company/NKE');
    expect(screen.getByRole('combobox')).toHaveValue('');
  });

  it('moves through suggestions with the arrow keys and opens one with Enter', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CompanySearch />);
    const input = screen.getByRole('combobox');

    await user.type(input, 'apple');
    await screen.findAllByRole('option');
    await user.keyboard('{ArrowDown}{ArrowDown}');

    expect(
      screen.getByRole('option', {name: /Apple Hospitality/}),
    ).toHaveAttribute('aria-selected', 'true');
    expect(input.getAttribute('aria-activedescendant')).toBeTruthy();

    await user.keyboard('{Enter}');
    expect(currentPath()).toHaveTextContent('/company/APLE');
  });

  it('opens the best match when Enter is pressed without choosing', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CompanySearch />);

    await user.type(screen.getByRole('combobox'), 'AAPL{Enter}');

    // Enter before the suggestions arrive searches first, then navigates.
    await waitFor(() =>
      expect(currentPath()).toHaveTextContent('/company/AAPL'),
    );
  });

  it('says so when nothing matches, instead of failing (F1)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CompanySearch />);

    await user.type(screen.getByRole('combobox'), 'ZZZZ');

    expect(
      await screen.findByText(/^No companies match “ZZZZ”/),
    ).toHaveAttribute('role', 'status');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();

    await user.keyboard('{Enter}');
    expect(currentPath()).toHaveTextContent('/');
  });

  it('asks for a name or ticker when submitted empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CompanySearch />);

    await user.click(screen.getByRole('button', {name: 'Search'}));

    expect(screen.getByRole('status')).toHaveTextContent(
      'Type a company name or ticker',
    );
  });

  it('reports that search is unavailable when the client fails', async () => {
    const user = userEvent.setup();
    const client = new SampleResearchClient();
    vi.spyOn(client, 'searchCompanies').mockRejectedValue(
      new Error('API down'),
    );
    renderWithProviders(<CompanySearch />, {client});

    await user.type(screen.getByRole('combobox'), 'apple');

    expect(
      await screen.findByText(/^Search is unavailable right now/),
    ).toHaveAttribute('role', 'status');
  });

  it('clears a submit error once the query changes', async () => {
    const user = userEvent.setup();
    const client = new SampleResearchClient();
    const search = vi
      .spyOn(client, 'searchCompanies')
      .mockRejectedValueOnce(new Error('API down'));
    renderWithProviders(<CompanySearch />, {client});

    // Submitting before suggestions arrive searches straight away and fails.
    await user.type(screen.getByRole('combobox'), 'n{Enter}');
    expect(
      await screen.findByText(/^Search is unavailable right now/),
    ).toBeInTheDocument();

    search.mockRestore();
    await user.type(screen.getByRole('combobox'), 'ike');
    expect(
      await screen.findByRole('option', {name: /Nike, Inc\./}),
    ).toBeInTheDocument();
    expect(screen.queryByText(/unavailable/)).not.toBeInTheDocument();
  });

  it('closes the suggestions on Escape', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CompanySearch />);

    await user.type(screen.getByRole('combobox'), 'apple');
    await screen.findAllByRole('option');
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('keeps the label for screen readers in the compact header variant', () => {
    renderWithProviders(<CompanySearch variant="compact" />);
    expect(
      screen.getByRole('combobox', {name: 'Search a company or ticker'}),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Search'})).toBeNull();
  });
});
