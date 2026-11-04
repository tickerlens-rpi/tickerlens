import {useMemo, useSyncExternalStore} from 'react';
import {subscribeToLocalData} from '../local_data';
import {AI_CONNECTION_KEY, isAiConnection} from './connection';
import type {AiConnection} from './connection';

const SEPARATOR = '\u0000';

function safeGet(storage: () => Storage): string {
  try {
    return storage().getItem(AI_CONNECTION_KEY) ?? '';
  } catch {
    return '';
  }
}

// The snapshot is the raw stored text (tab copy first, then device copy), so
// React sees a stable string between changes and parsing happens only when it
// actually changes.
function getSnapshot(): string {
  return `${safeGet(() => sessionStorage)}${SEPARATOR}${safeGet(() => localStorage)}`;
}

function parseSnapshot(snapshot: string): AiConnection | undefined {
  for (const raw of snapshot.split(SEPARATOR)) {
    if (raw === '') {
      continue;
    }
    try {
      const value: unknown = JSON.parse(raw);
      if (isAiConnection(value)) {
        return value;
      }
    } catch {
      // Ignore a corrupted copy and fall through to the next one.
    }
  }
  return undefined;
}

/** Returns the saved AI connection and re-renders when it changes. */
export function useAiConnection(): AiConnection | undefined {
  const snapshot = useSyncExternalStore(
    subscribeToLocalData,
    getSnapshot,
    () => '',
  );
  return useMemo(() => parseSnapshot(snapshot), [snapshot]);
}
