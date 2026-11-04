import {useMemo, useSyncExternalStore} from 'react';
import {readJson, subscribeToLocalData} from './local_data';
import {WATCHLIST_KEY, parseWatchlist} from './watchlist';
import type {WatchlistItem} from './watchlist';

function getSnapshot(): string {
  try {
    return localStorage.getItem(WATCHLIST_KEY) ?? '';
  } catch {
    return '';
  }
}

/** Returns the watchlist and re-renders when it changes in any tab. */
export function useWatchlist(): WatchlistItem[] {
  const snapshot = useSyncExternalStore(
    subscribeToLocalData,
    getSnapshot,
    () => '',
  );
  return useMemo(
    () =>
      parseWatchlist(
        snapshot === ''
          ? undefined
          : readJson(WATCHLIST_KEY, {getItem: () => snapshot}),
      ),
    [snapshot],
  );
}
