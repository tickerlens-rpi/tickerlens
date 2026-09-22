import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it} from 'vitest';
import {SampleOverview} from './sample_overview';

describe('SampleOverview', () => {
  it('is clearly labelled as sample data', () => {
    render(<SampleOverview />);
    expect(screen.getByText(/sample data/i)).toBeInTheDocument();
    expect(screen.getByText(/fictional company/i)).toBeInTheDocument();
  });

  it('widens the chart from one month to one year', async () => {
    const user = userEvent.setup();
    render(<SampleOverview />);
    expect(screen.getByRole('img', {name: /past month/i})).toBeInTheDocument();

    await user.click(screen.getByRole('button', {name: '1Y'}));

    expect(screen.getByRole('img', {name: /past year/i})).toBeInTheDocument();
    expect(screen.getByText(/small next to it/i)).toBeInTheDocument();
  });

  it('explains jargon inline', async () => {
    const user = userEvent.setup();
    render(<SampleOverview />);

    await user.click(screen.getByRole('button', {name: 'guidance'}));

    expect(screen.getByText(/own forecast/i)).toBeVisible();
  });
});
