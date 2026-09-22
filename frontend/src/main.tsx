import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/fraunces/full-italic.css';
import '@fontsource-variable/instrument-sans';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles/global.css';
import './styles/landing.css';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './app';
import {applyTextSize, readStoredTextSize} from './lib/text_size';

// Apply the saved text-size preference before the first paint.
applyTextSize(readStoredTextSize());

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root was not found in index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
