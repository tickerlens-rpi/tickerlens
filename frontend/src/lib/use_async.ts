/**
 * @fileoverview A small hook for loading data from a ResearchClient.
 */

import {useEffect, useState} from 'react';

/** The state of an asynchronous load. */
export type AsyncState<T> =
  | {status: 'loading'; previous?: T}
  | {status: 'ready'; value: T}
  | {status: 'error'; error: Error};

interface Settled<T> {
  load: () => Promise<T>;
  state: AsyncState<T>;
}

/**
 * Runs `load` and tracks its result. Pass a function memoised with
 * useCallback: a new function starts a new load, and results from earlier
 * functions are ignored, so a slow response for an old query can never
 * overwrite a newer one. While a new load runs, the last value stays
 * available as `previous` so the UI can keep showing it.
 */
export function useAsync<T>(load: () => Promise<T>): AsyncState<T> {
  const [settled, setSettled] = useState<Settled<T>>();

  useEffect(() => {
    let current = true;
    load().then(
      value => {
        if (current) {
          setSettled({load, state: {status: 'ready', value}});
        }
      },
      (error: unknown) => {
        if (current) {
          setSettled({load, state: {status: 'error', error: toError(error)}});
        }
      },
    );
    return () => {
      current = false;
    };
  }, [load]);

  if (settled?.load === load) {
    return settled.state;
  }
  return {
    status: 'loading',
    previous:
      settled?.state.status === 'ready' ? settled.state.value : undefined,
  };
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
