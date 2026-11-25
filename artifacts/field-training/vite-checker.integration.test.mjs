import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const portalRoot = path.dirname(fileURLToPath(import.meta.url));

function runPortalBuild() {
  return spawnSync("pnpm", ["run", "build"], {
    cwd: portalRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      FORCE_COLOR: "0",
      NO_COLOR: "1",
    },
    maxBuffer: 16 * 1024 * 1024,
    timeout: 180_000,
  });
}

test(
  "the portal Vite build rejects TypeScript errors and passes when clean",
  { timeout: 7 * 60_000 },
  async () => {
    const cleanBuild = runPortalBuild();
    assert.ifError(cleanBuild.error);
    assert.equal(
      cleanBuild.status,
      0,
      `The clean portal Vite build should pass.\n${cleanBuild.stdout}\n${cleanBuild.stderr}`,
    );

    const probeName = `vite-checker-probe-${process.pid}.ts`;
    const probePath = path.join(portalRoot, "src", probeName);

    try {
      await writeFile(
        probePath,
        "const checkerProbe: string = 42;\nexport default checkerProbe;\n",
        { flag: "wx" },
      );

      const failingBuild = runPortalBuild();
      assert.ifError(failingBuild.error);
      const output = `${failingBuild.stdout}\n${failingBuild.stderr}`;
      assert.notEqual(
        failingBuild.status,
        0,
        `The Vite build must fail when a TypeScript error is present.\n${output}`,
      );
      assert.match(
        output,
        new RegExp(`src[/\\\\]${probeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
        "The checker output should identify the injected TypeScript file.",
      );
      assert.match(output, /TS2322/, "The checker should report the type mismatch.");
    } finally {
      await rm(probePath, { force: true });
    }
  },
);
