import type { Plugin } from "vite";
import { readdirSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PUBLIC_ROOT = join(dirname(fileURLToPath(import.meta.url)), "public");

function publicFiles(directory = PUBLIC_ROOT): string[] {
  return readdirSync(directory).flatMap(name => {
    const absolute = join(directory, name);
    if (statSync(absolute).isDirectory()) return publicFiles(absolute);
    return [relative(PUBLIC_ROOT, absolute).split(sep).join("/")];
  });
}

/** Emits a versioned service worker from the actual production bundle.
 * Cache the complete static app shell, including public images and install
 * assets. Never cache API responses or user data. */
export function fieldReadyPwa(base: string): Plugin {
  return {
    name: "fieldready-static-precache",
    apply: "build",
    generateBundle(_options, bundle) {
      const basePath = base.endsWith("/") ? base : `${base}/`;
      const files = Object.keys(bundle).filter(name => /\.(js|css|html|svg|woff2?|png|jpe?g|webp|ico|webmanifest|txt)$/i.test(name));
      const urls = [...new Set([
        basePath,
        ...publicFiles().map(name => `${basePath}${name}`),
        ...files.map(name => `${basePath}${name}`),
      ])];
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
