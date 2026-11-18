import type { Plugin } from "vite";

/** Emits a versioned service worker from the actual production bundle.
 * Only the static app shell is cached. No API responses or user data. */
export function fieldReadyPwa(base: string): Plugin {
  return {
    name: "fieldready-static-precache",
    apply: "build",
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).filter(name => /\.(js|css|html|svg|woff2?)$/.test(name));
      const urls = [...new Set([base, `${base}manifest.webmanifest`, `${base}icon.svg`,
        ...files.map(name => `${base}${name}`)])];
      const version = files.filter(name => /assets\/.*\.(js|css)$/.test(name)).join("|");
      this.emitFile({
        type: "asset", fileName: "sw.js",
        source: `
const PREFIX = 'fieldready-shell-';
const CACHE = PREFIX + ${JSON.stringify(version)};
const URLS = ${JSON.stringify(urls)};
const SCOPE = new URL(self.registration.scope);
const ALLOWED = new Set(URLS.map(path => new URL(path, SCOPE.origin).href));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(URLS)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== SCOPE.origin ||
      !url.pathname.startsWith(SCOPE.pathname) || /(^|\\/)api(\\/|$)/.test(url.pathname)) return;
  if (req.mode === 'navigate') {
    // An installed shell is tied to its version, avoiding mixed old/new bundles.
    event.respondWith(caches.match(SCOPE.href).then(hit => hit || fetch(req)));
  } else if (ALLOWED.has(url.href)) {
    event.respondWith(caches.match(req).then(hit => hit || fetch(req)));
  }
});
`,
      });
    },
  };
}
