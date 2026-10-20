/**
 * @fileoverview Small React hooks shared by the research pages.
 */

import {useCallback, useEffect, useState} from 'react';

/**
 * Returns `value` once it has stopped changing for `delayMs`, so a search box
 * queries once per pause in typing instead of once per keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/** Sets the browser tab title while the calling component is shown. */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title;
  }, [title]);
}

/**
 * Measures an element's width and keeps it current as the layout changes.
 * Attach the returned callback as the element's `ref`. Until the first
 * measurement, or where ResizeObserver is missing (as in jsdom), the width is
 * `fallback`.
 */
export function useElementWidth<T extends HTMLElement>(
  fallback: number,
): [(node: T | null) => (() => void) | undefined, number] {
  const [width, setWidth] = useState(fallback);
  const ref = useCallback((node: T | null) => {
    if (!node || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(entries => {
      const measured = entries[0]?.contentRect.width;
      if (measured) {
        setWidth(Math.round(measured));
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}
