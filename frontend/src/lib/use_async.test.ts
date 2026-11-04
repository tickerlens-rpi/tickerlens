import {act, renderHook, waitFor} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {useAsync} from './use_async';

/** A promise the test resolves or rejects by hand. */
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {promise, resolve, reject};
}

describe('useAsync', () => {
  it('starts loading, then holds the value', async () => {
    const load = () => Promise.resolve(42);
    const {result} = renderHook(() => useAsync(load));
    expect(result.current.status).toBe('loading');
    await waitFor(() =>
      expect(result.current).toEqual({status: 'ready', value: 42}),
    );
  });

  it('turns a rejection into an error state', async () => {
    const load = () => Promise.reject(new Error('offline'));
    const {result} = renderHook(() => useAsync(load));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(
      result.current.status === 'error' && result.current.error.message,
    ).toBe('offline');
  });

  it('keeps the previous value while a new load runs', async () => {
    const first = () => Promise.resolve('AAPL');
    const second = deferred<string>();
    const next = () => second.promise;
    const {result, rerender} = renderHook(({load}) => useAsync(load), {
      initialProps: {load: first},
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    rerender({load: next});
    expect(result.current).toEqual({status: 'loading', previous: 'AAPL'});

    await act(async () => second.resolve('NKE'));
    expect(result.current).toEqual({status: 'ready', value: 'NKE'});
  });

  it('ignores a slow answer for an earlier load', async () => {
    const slow = deferred<string>();
    const fast = deferred<string>();
    const loadSlow = () => slow.promise;
    const loadFast = () => fast.promise;
    const {result, rerender} = renderHook(({load}) => useAsync(load), {
      initialProps: {load: loadSlow},
    });

    rerender({load: loadFast});
    await act(async () => fast.resolve('new'));
    await act(async () => slow.resolve('old'));

    expect(result.current).toEqual({status: 'ready', value: 'new'});
  });
});
