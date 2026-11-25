import type { Plugin } from "vite";
import { readdirSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createPortalWorker, retirePortalWorker } from "./pwa-worker.js";

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
    configureServer(server) {
      const basePath = base.endsWith("/") ? base : `${base}/`;
      server.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] !== `${basePath}sw.js`) { next(); return; }
        res.setHeader("Content-Type", "application/javascript");
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Service-Worker-Allowed", basePath);
        res.end(retirePortalWorker);
      });
    },
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
        source: createPortalWorker(basePath, urls, version),
      });
    },
  };
}
