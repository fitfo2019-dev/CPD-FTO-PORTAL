import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { buildTokens } from "./scripts/build-tokens.mjs";

/**
 * Regenerates src/index.css and src/generated/tokens.tsx from tokens.json on startup and
 * whenever tokens.json changes, so editing the single source of truth
 * hot-reloads the running app.
 */
function designTokensPlugin(): Plugin {
  const tokensFile = path.resolve(import.meta.dirname, "tokens.json");
  return {
    name: "design-tokens",
    buildStart() {
      buildTokens();
      this.addWatchFile(tokensFile);
    },
    configureServer(server) {
      server.watcher.add(tokensFile);
      server.watcher.on("change", (file) => {
        if (path.resolve(file) === tokensFile) {
          buildTokens();
          server.ws.send({ type: "full-reload" });
        }
      });
    },
  };
}

const rawPort = process.env.PORT ?? "19391";

const port = Number(rawPort);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/fto-law-library-schema/";

if (!basePath.startsWith("/") || basePath.startsWith("//")) {
  throw new Error("BASE_PATH must be an absolute path.");
}

export default defineConfig({
  base: basePath,
  plugins: [
    designTokensPlugin(),
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
        ]
      : []),
  ],
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
