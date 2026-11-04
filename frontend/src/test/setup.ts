import '@testing-library/jest-dom/vitest';
import {cleanup} from '@testing-library/react';
import {afterEach, beforeEach} from 'vitest';

beforeEach(() => {
  // jsdom does not implement scrolling; route changes call it.
  window.scrollTo = () => {};
});

// Testing Library only unmounts rendered trees automatically when Vitest
// globals are enabled. We keep explicit imports (Google style), so do it here.
// Storage and the hash are reset too, so tests cannot leak state.
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = '';
});
