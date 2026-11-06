/**
 * @fileoverview The user's watchlist, stored in this browser only.
 */

import {STORAGE_PREFIX, readJson, writeJson} from './local_data';
import {isValidTicker} from './ticker';

export interface WatchlistItem {
  ticker: string;
  note: string;
  /** ISO 8601 timestamp of when the ticker was added. */
  addedAt: string;
}

export const WATCHLIST_KEY = `${STORAGE_PREFIX}watchlist`;

/** Longest note we keep, so one runaway paste cannot fill storage. */
export const MAX_NOTE_LENGTH = 2000;

function isWatchlistItem(value: unknown): value is WatchlistItem {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  // Safe: `value` is a non-null object, and every field is checked below.
  const record = value as Record<string, unknown>;
  return (
    typeof record.ticker === 'string' &&
    isValidTicker(record.ticker) &&
    typeof record.note === 'string' &&
    typeof record.addedAt === 'string'
  );
}

/** Parses stored data, dropping malformed and duplicate entries. */
export function parseWatchlist(value: unknown): WatchlistItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const items: WatchlistItem[] = [];
  for (const entry of value) {
    if (isWatchlistItem(entry) && !seen.has(entry.ticker)) {
      seen.add(entry.ticker);
      items.push(entry);
    }
  }
  return items;
}

export function readWatchlist(
  storage: Pick<Storage, 'getItem'> = localStorage,
): WatchlistItem[] {
  return parseWatchlist(readJson(WATCHLIST_KEY, storage));
}

function save(
  items: WatchlistItem[],
  storage: Pick<Storage, 'setItem' | 'removeItem'>,
): WatchlistItem[] {
  writeJson(WATCHLIST_KEY, items, storage);
  return items;
}

/** Adds `ticker` to the top of the list if it is not already there. */
export function addToWatchlist(
  ticker: string,
  storage: Storage = localStorage,
  now: Date = new Date(),
): WatchlistItem[] {
  const items = readWatchlist(storage);
  if (!isValidTicker(ticker) || items.some(item => item.ticker === ticker)) {
    return items;
  }
  return save(
    [{ticker, note: '', addedAt: now.toISOString()}, ...items],
    storage,
  );
}

export function removeFromWatchlist(
  ticker: string,
  storage: Storage = localStorage,
): WatchlistItem[] {
  return save(
    readWatchlist(storage).filter(item => item.ticker !== ticker),
    storage,
  );
}

export function updateWatchlistNote(
  ticker: string,
  note: string,
  storage: Storage = localStorage,
): WatchlistItem[] {
  const trimmed = note.slice(0, MAX_NOTE_LENGTH);
  return save(
    readWatchlist(storage).map(item =>
      item.ticker === ticker ? {...item, note: trimmed} : item,
    ),
    storage,
  );
}
