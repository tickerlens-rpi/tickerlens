import '@testing-library/jest-dom/vitest';
import {cleanup} from '@testing-library/react';
import {afterEach} from 'vitest';

// Testing Library only unmounts rendered trees automatically when Vitest
// globals are enabled. We keep explicit imports (Google style), so do it here.
afterEach(() => {
  cleanup();
});
