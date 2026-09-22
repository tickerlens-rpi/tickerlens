import {afterEach, describe, expect, it} from 'vitest';
import {
  TEXT_SIZE_STORAGE_KEY,
  applyTextSize,
  isTextSize,
  readStoredTextSize,
  storeTextSize,
} from './text_size';

describe('isTextSize', () => {
  it('accepts the known sizes', () => {
    expect(isTextSize('default')).toBe(true);
    expect(isTextSize('large')).toBe(true);
    expect(isTextSize('larger')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isTextSize('huge')).toBe(false);
    expect(isTextSize(null)).toBe(false);
    expect(isTextSize(2)).toBe(false);
  });
});

describe('applyTextSize', () => {
  it('sets the attribute for non-default sizes', () => {
    const root = document.createElement('div');
    applyTextSize('large', root);
    expect(root.getAttribute('data-text-size')).toBe('large');
  });

  it('removes the attribute for the default size', () => {
    const root = document.createElement('div');
    root.setAttribute('data-text-size', 'larger');
    applyTextSize('default', root);
    expect(root.hasAttribute('data-text-size')).toBe(false);
  });
});

describe('storage helpers', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('round-trips a preference through localStorage', () => {
    storeTextSize('larger');
    expect(localStorage.getItem(TEXT_SIZE_STORAGE_KEY)).toBe('larger');
    expect(readStoredTextSize()).toBe('larger');
  });

  it('falls back to the default for unknown stored values', () => {
    localStorage.setItem(TEXT_SIZE_STORAGE_KEY, 'enormous');
    expect(readStoredTextSize()).toBe('default');
  });

  it('falls back to the default when storage throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readStoredTextSize(broken)).toBe('default');
  });

  it('ignores failures when storing', () => {
    const broken = {
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(() => storeTextSize('large', broken)).not.toThrow();
  });
});
