/** Only portal-owned pages may use the offline app shell. A root-scoped worker
 * must not replace another artifact's navigation with its own sign-in page. */
const portalRoots = [
  "sign-in", "sign-up", "phase-setup", "substation-orientation", "fto-forum",
  "reports", "nrt-ua", "class-overview", "substitute-fto", "fto-classes",
  "training", "settings", "resources", "help", "command-review",
  "role-access", "technical-access", "agency-packets",
];

export function createPortalWorker(basePath: string, urls: string[], version: string): string {
  return `
const PREFIX = 'fieldready-shell-';
const CACHE = PREFIX + ${JSON.stringify(version)};
const URLS = ${JSON.stringify(urls)};
const PORTAL_ROOTS = new Set(${JSON.stringify(portalRoots)});
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
  const base = ${JSON.stringify(basePath)};
  if (req.method !== 'GET' || url.origin !== SCOPE.origin ||
      !url.pathname.startsWith(base) || /(^|\\/)api(\\/|$)/.test(url.pathname)) return;
  if (req.mode === 'navigate') {
    const local = url.pathname.slice(base.length);
    const root = local.split('/')[0];
    // Unknown paths, development previews and sibling artifacts always use
    // the network. They must NEVER receive the portal's cached login shell.
    if (local !== '' && !PORTAL_ROOTS.has(root)) return;
    event.respondWith(caches.match(SCOPE.href).then(hit => hit || fetch(req)));
  } else if (ALLOWED.has(url.href)) {
    event.respondWith(caches.match(req).then(hit => hit || fetch(req)));
  }
});
`;
}

/** A dev server must replace older installed workers as well as avoid creating
 * new ones. No training records, IndexedDB stores or vault keys are touched. */
export const retirePortalWorker = `
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith('fieldready-shell-')).map(key => caches.delete(key))
    )).then(() => self.clients.claim()).then(() => self.registration.unregister())
  );
});
`;
