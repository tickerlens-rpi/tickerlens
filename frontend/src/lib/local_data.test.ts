import {describe, expect, it, vi} from 'vitest';
import {
  LOCAL_DATA_EVENT,
  clearAllLocalData,
  readJson,
  writeJson,
} from './local_data';

describe('local data', () => {
  it('round-trips JSON and notifies listeners', () => {
    const listener = vi.fn();
    window.addEventListener(LOCAL_DATA_EVENT, listener);

    expect(writeJson('tickerlens.test', {a: 1})).toBe(true);
    expect(readJson('tickerlens.test')).toEqual({a: 1});
    expect(listener).toHaveBeenCalled();

    window.removeEventListener(LOCAL_DATA_EVENT, listener);
  });

  it('returns undefined for missing or corrupted values', () => {
    localStorage.setItem('tickerlens.broken', '{not json');
    expect(readJson('tickerlens.missing')).toBeUndefined();
    expect(readJson('tickerlens.broken')).toBeUndefined();
  });

  it('survives storage that throws', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {},
    };
    expect(readJson('tickerlens.x', blocked)).toBeUndefined();
    expect(writeJson('tickerlens.x', 1, blocked)).toBe(false);
  });

  it('clears only TickerLens keys, in both storages', () => {
    localStorage.setItem('tickerlens.a', '1');
    localStorage.setItem('other-site', 'keep');
    sessionStorage.setItem('tickerlens.b', '2');

    expect(clearAllLocalData()).toBe(2);
    expect(localStorage.getItem('tickerlens.a')).toBeNull();
    expect(sessionStorage.getItem('tickerlens.b')).toBeNull();
    expect(localStorage.getItem('other-site')).toBe('keep');
  });
});
