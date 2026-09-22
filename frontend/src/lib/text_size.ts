/**
 * @fileoverview Text-size preference.
 *
 * Implements user story 8 from the vision document: "As a user, I want to be
 * able to change the font size, so I can read it easier." The preference is
 * applied as a `data-text-size` attribute on `<html>`; the stylesheet scales
 * the root font size from there, and every layout size is expressed in `rem`
 * so the whole page grows with it.
 */

export const TEXT_SIZES = ['default', 'large', 'larger'] as const;

export type TextSize = (typeof TEXT_SIZES)[number];

export const TEXT_SIZE_STORAGE_KEY = 'tickerlens.textSize';

const TEXT_SIZE_ATTRIBUTE = 'data-text-size';

/** Type guard for values read from storage or query strings. */
export function isTextSize(value: unknown): value is TextSize {
  return TEXT_SIZES.some(size => size === value);
}

/** Applies `size` to the document root; the default size clears the attribute. */
export function applyTextSize(
  size: TextSize,
  root: HTMLElement = document.documentElement,
): void {
  if (size === 'default') {
    root.removeAttribute(TEXT_SIZE_ATTRIBUTE);
  } else {
    root.setAttribute(TEXT_SIZE_ATTRIBUTE, size);
  }
}

/**
 * Reads the stored preference, falling back to the default when storage is
 * unavailable or holds something we do not recognise.
 */
export function readStoredTextSize(
  storage: Pick<Storage, 'getItem'> = localStorage,
): TextSize {
  try {
    const stored = storage.getItem(TEXT_SIZE_STORAGE_KEY);
    return isTextSize(stored) ? stored : 'default';
  } catch {
    // Storage can throw in private browsing or when blocked by the browser.
    return 'default';
  }
}

/** Persists the preference. Failures are ignored: the page works without it. */
export function storeTextSize(
  size: TextSize,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  try {
    storage.setItem(TEXT_SIZE_STORAGE_KEY, size);
  } catch {
    // Storage is a convenience; ignore quota or privacy-mode failures.
  }
}
