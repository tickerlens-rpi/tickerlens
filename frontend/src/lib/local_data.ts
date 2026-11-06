/**
 * @fileoverview Helpers for data TickerLens keeps in the browser.
 *
 * Everything the user configures (AI connection, watchlist, text size) lives
 * in this browser's storage on their own computer. Nothing here is sent to a
 * TickerLens server. Every key starts with `tickerlens.` so the whole set can
 * be listed and wiped in one go.
 */

/** Prefix shared by every storage key the app writes. */
export const STORAGE_PREFIX = 'tickerlens.';

/** Name of the window event fired when app data changes in this tab. */
export const LOCAL_DATA_EVENT = 'tickerlens:local-data';

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem' | 'removeItem'>;

/** Reads and parses a JSON value, returning `undefined` when absent or broken. */
export function readJson(
  key: string,
  storage: ReadableStorage = localStorage,
): unknown {
  try {
    const raw = storage.getItem(key);
    return raw === null ? undefined : (JSON.parse(raw) as unknown);
  } catch {
    // Storage can be blocked, and stored JSON can be hand-edited into garbage.
    return undefined;
  }
}

/** Serialises and stores a value. Returns false when storage refused it. */
export function writeJson(
  key: string,
  value: unknown,
  storage: WritableStorage = localStorage,
): boolean {
  try {
    storage.setItem(key, JSON.stringify(value));
    notifyLocalDataChanged();
    return true;
  } catch {
    return false;
  }
}

/** Removes a key, ignoring storage failures. */
export function removeKey(
  key: string,
  storage: WritableStorage = localStorage,
): void {
  try {
    storage.removeItem(key);
  } catch {
    // Nothing to do: if storage is unavailable there is nothing stored either.
  }
  notifyLocalDataChanged();
}

/** Lists every TickerLens key in `storage`. */
export function listAppKeys(storage: Storage): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        keys.push(key);
      }
    }
  } catch {
    return [];
  }
  return keys;
}

/**
 * Deletes every TickerLens key from local and session storage, including the
 * saved API key. Returns how many entries were removed.
 */
export function clearAllLocalData(
  storages: Storage[] = [localStorage, sessionStorage],
): number {
  let removed = 0;
  for (const storage of storages) {
    for (const key of listAppKeys(storage)) {
      try {
        storage.removeItem(key);
        removed++;
      } catch {
        // Keep going so one failure does not leave the rest behind.
      }
    }
  }
  notifyLocalDataChanged();
  return removed;
}

/** Tells hooks in this tab to re-read storage. */
export function notifyLocalDataChanged(): void {
  window.dispatchEvent(new Event(LOCAL_DATA_EVENT));
}

/**
 * Subscribes to app data changes from this tab and from other tabs (the
 * browser fires `storage` only in the tabs that did not make the change).
 */
export function subscribeToLocalData(onChange: () => void): () => void {
  window.addEventListener(LOCAL_DATA_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(LOCAL_DATA_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}
