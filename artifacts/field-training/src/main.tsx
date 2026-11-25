import { createRoot } from 'react-dom/client';

import App from './App.js';
import { ErrorBoundary } from '@/components/error-boundary.js';

import './index.css';

if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  // A previously installed root-scoped production worker can serve the cached
  // sign-in page over this development server, intercepting links to sibling
  // previews before Vite can render them. Register the dev retirement worker
  // immediately on the first portal page load, then force its update check.
  void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
    scope: import.meta.env.BASE_URL,
    updateViaCache: 'none',
  }).then(registration => registration.update()).catch(() => {
    // The development-only preview remains usable without service worker support.
  });
}

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js', { scope: import.meta.env.BASE_URL })
      .catch(error => console.error('Offline app shell could not be installed.', error));
  });
}
