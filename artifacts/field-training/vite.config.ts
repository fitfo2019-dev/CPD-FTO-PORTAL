import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import checker from "vite-plugin-checker";
import { defineConfig } from "vite";
import { fieldReadyPwa } from "./pwa-plugin.js";
import { bundleSizeBudgetPlugin } from "./bundle-size-budget.js";

import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

function normalizeZodRollupAnnotations() {
  return {
    name: "normalize-zod-rollup-annotation-docs",
    enforce: "pre" as const,
    apply: "build" as const,
    transform(code: string, id: string) {
      if (!id.includes("/node_modules/zod/v4/core/")) return null;

      let changed = false;
      const normalized = code.replace(
        /\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g,
        (comment) => {
          if (
            !comment.includes("@__PURE__") ||
            /^\/\*\s*@__PURE__\s*\*\/$/.test(comment)
          ) {
            return comment;
          }
          changed = true;
          return comment.replaceAll("@__PURE__", "PURE_____");
        },
      );

      return changed ? { code: normalized, map: null } : null;
    },
  };
}

const rawPort = process.env.PORT ?? "18795";
const port = Number(rawPort);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";

if (!basePath.startsWith("/") || basePath.startsWith("//")) {
  throw new Error("BASE_PATH must be an absolute path.");
}

export default defineConfig(async ({ command }) => {
  const isDevServer = command === "serve";

  return {
  base: basePath,
  plugins: [
    fieldReadyPwa(basePath),
    normalizeZodRollupAnnotations(),
    bundleSizeBudgetPlugin(),
    react(),
    checker({ typescript: true }),
    tailwindcss({ optimize: false }),
    ...(isDevServer ? [runtimeErrorOverlay()] : []),
    ...(isDevServer &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      onwarn(warning, defaultHandler) {
        const sourceId = warning.id ?? warning.loc?.file ?? "";
        const knownUnmappedSource =
          sourceId.endsWith("/src/components/ui/tooltip.tsx") ||
          sourceId.endsWith("/src/components/ui/label.tsx");

        // Production sourcemaps are disabled; these two blank-line mapping
        // notices have no source location to report. Preserve all other warnings.
        if (
          warning.code === "SOURCEMAP_ERROR" &&
          warning.message.includes("Can't resolve original location of error.") &&
          knownUnmappedSource
        ) {
          return;
        }

        defaultHandler(warning);
      },
      output: {
        manualChunks(id) {
          // Shared CommonJS helpers stay with the React chunk (no imports of its own)
          // so the spreadsheet tools are not pulled into the start-up download
          // and no chunk import loop forms.
          if (id.startsWith("\0commonjs") || id.includes("__vite-browser-external")) return "vendor-react";
          if (!id.includes("/node_modules/")) return;
          if (
            id.includes("/node_modules/@radix-ui/") ||
            id.includes("/node_modules/@floating-ui/")
          ) {
            return "vendor-ui";
          }
          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/scheduler/")
          ) {
            return "vendor-react";
          }
          if (
            id.includes("/node_modules/recharts/") ||
            id.includes("/node_modules/d3-")
          ) {
            return "vendor-charts";
          }
          if (
            id.includes("/node_modules/lucide-react/") ||
            id.includes("/node_modules/react-icons/")
          ) {
            return "vendor-icons";
          }
          if (
            id.includes("/node_modules/xlsx/") ||
            id.includes("/node_modules/xlsx-js-style/")
          ) {
            return "vendor-spreadsheet";
          }
          return "vendor";
        },
      },
    },
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
  };
});
