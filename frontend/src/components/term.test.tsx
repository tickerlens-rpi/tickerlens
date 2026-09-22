import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it} from 'vitest';
import {Term} from './term';

const DEFINITION = 'A company’s own forecast for its upcoming sales or profit.';

describe('Term', () => {
  it('hides the definition until activated', () => {
    render(<Term term="Guidance" definition={DEFINITION} />);
    const trigger = screen.getByRole('button', {name: 'Guidance'});
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('note', {hidden: true})).not.toBeVisible();
  });

  it('reveals the definition on click and hides it again on Escape', async () => {
    const user = userEvent.setup();
    render(
      <Term term="Guidance" definition={DEFINITION}>
        guidance
      </Term>,
    );
    const trigger = screen.getByRole('button', {name: 'guidance'});

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('note')).toBeVisible();
    expect(screen.getByRole('note')).toHaveTextContent(DEFINITION);

    await user.keyboard('{Escape}');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('note', {hidden: true})).not.toBeVisible();
  });
});
