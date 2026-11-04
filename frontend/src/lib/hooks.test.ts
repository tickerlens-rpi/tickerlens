import {act, renderHook} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {useDebouncedValue, useDocumentTitle, useElementWidth} from './hooks';

describe('useDebouncedValue', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits for a pause before passing a new value on', async () => {
    vi.useFakeTimers();
    const {result, rerender} = renderHook(
      ({value}) => useDebouncedValue(value, 150),
      {initialProps: {value: 'a'}},
    );

    rerender({value: 'ap'});
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    rerender({value: 'app'});
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe('a');

    await act(async () => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current).toBe('app');
  });
});

describe('useDocumentTitle', () => {
  it('sets the tab title', () => {
    renderHook(() => useDocumentTitle('Apple Inc. (AAPL) · TickerLens'));
    expect(document.title).toBe('Apple Inc. (AAPL) · TickerLens');
  });
});

describe('useElementWidth', () => {
  it('falls back to the given width without ResizeObserver', () => {
    const {result} = renderHook(() => useElementWidth<HTMLDivElement>(640));
    expect(result.current[1]).toBe(640);
  });
});
