import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {TickerSearch} from './ticker_search';

describe('TickerSearch', () => {
  it('rejects an empty submission', async () => {
    const user = userEvent.setup();
    render(<TickerSearch />);

    await user.click(screen.getByRole('button', {name: 'Research'}));

    expect(screen.getByRole('status')).toHaveTextContent(
      /type a ticker symbol/i,
    );
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('rejects input that is not shaped like a ticker', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<TickerSearch onSearch={onSearch} />);

    await user.type(screen.getByRole('textbox'), '12345{Enter}');

    expect(screen.getByRole('status')).toHaveTextContent(
      /does not look like a ticker/i,
    );
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('accepts a valid ticker, normalises it and notifies the caller', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<TickerSearch onSearch={onSearch} />);

    await user.type(
      screen.getByRole('textbox', {name: /company ticker/i}),
      ' brk.b {Enter}',
    );

    expect(onSearch).toHaveBeenCalledWith('BRK.B');
    expect(screen.getByRole('textbox')).toHaveValue('BRK.B');
    expect(screen.getByRole('textbox')).toHaveAttribute(
      'aria-invalid',
      'false',
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      /BRK\.B looks like a valid symbol/,
    );
  });
});
