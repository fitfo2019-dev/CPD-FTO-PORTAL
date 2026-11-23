import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import { readFile, rm } from "node:fs/promises";

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  const apiManifest = JSON.parse(
    await readFile(path.resolve(artifactDir, "package.json"), "utf8"),
  );
  const runtimePackages = Object.keys(apiManifest.dependencies ?? {}).filter(
    (name) => !name.startsWith("@workspace/"),
  );
  await rm(distDir, { recursive: true, force: true });

  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    define: {
      __INCLUDE_SYNTHETIC_STAGING__: JSON.stringify(
        !process.argv.includes("--agency-release") && process.env.NODE_ENV === "development",
      ),
    },
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    // Keep third-party runtime packages external. The standalone package
    // installs these from its generated production manifest.
    // pg is a development-only dependency of the synthetic staging adapter.
    // Agency-release dead-code elimination removes that adapter entirely.
    external: ["*.node", "pg", ...runtimePackages],
    sourcemap: "linked",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
