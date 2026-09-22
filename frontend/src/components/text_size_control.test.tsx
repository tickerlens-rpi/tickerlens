import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it} from 'vitest';
import {TEXT_SIZE_STORAGE_KEY} from '../lib/text_size';
import {TextSizeControl} from './text_size_control';

describe('TextSizeControl', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-text-size');
  });

  it('offers three sizes with the default selected', () => {
    render(<TextSizeControl />);
    const group = screen.getByRole('group', {name: 'Text size'});
    expect(within(group).getAllByRole('button')).toHaveLength(3);
    expect(
      screen.getByRole('button', {name: 'Default text size'}),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('applies and stores the chosen size', async () => {
    const user = userEvent.setup();
    render(<TextSizeControl />);

    await user.click(screen.getByRole('button', {name: 'Larger text size'}));

    expect(document.documentElement).toHaveAttribute(
      'data-text-size',
      'larger',
    );
    expect(localStorage.getItem(TEXT_SIZE_STORAGE_KEY)).toBe('larger');
    expect(
      screen.getByRole('button', {name: 'Larger text size'}),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('clears the attribute when returning to the default size', async () => {
    const user = userEvent.setup();
    render(<TextSizeControl />);

    await user.click(screen.getByRole('button', {name: 'Large text size'}));
    await user.click(screen.getByRole('button', {name: 'Default text size'}));

    expect(document.documentElement).not.toHaveAttribute('data-text-size');
    expect(localStorage.getItem(TEXT_SIZE_STORAGE_KEY)).toBe('default');
  });

  it('restores a stored preference on mount', () => {
    localStorage.setItem(TEXT_SIZE_STORAGE_KEY, 'large');
    render(<TextSizeControl />);
    expect(
      screen.getByRole('button', {name: 'Large text size'}),
    ).toHaveAttribute('aria-pressed', 'true');
  });
});
