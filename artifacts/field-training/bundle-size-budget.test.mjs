import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeBundleSize,
  bundleSizeBudgetPlugin,
} from "./bundle-size-budget.js";

function chunk(fileName, code, options = {}) {
  return {
    type: "chunk",
    fileName,
    code,
    imports: options.imports ?? [],
    dynamicImports: options.dynamicImports ?? [],
    isEntry: options.isEntry ?? false,
    isDynamicEntry: options.isDynamicEntry ?? false,
  };
}

function bundleWith(entryCode, deferredCode) {
  const entry = chunk("entry.js", entryCode, {
    isEntry: true,
    imports: ["shared.js"],
    dynamicImports: ["deferred.js"],
  });
  const shared = chunk("shared.js", "shared runtime code");
  const deferred = chunk("deferred.js", deferredCode, {
    isDynamicEntry: true,
    imports: ["shared.js"],
  });

  return { "entry.js": entry, "shared.js": shared, "deferred.js": deferred };
}

function runBudget(bundle, budgets) {
  const plugin = bundleSizeBudgetPlugin(budgets);
  const context = {
    error(message) {
      throw new Error(message);
    },
  };
  plugin.generateBundle.call(context, {}, bundle);
}

test("initial budget excludes code reachable only through dynamic imports", () => {
  const smallLazyResult = analyzeBundleSize(
    bundleWith("entry runtime", "lazy feature"),
  );
  const largeLazyBundle = bundleWith(
    "entry runtime",
    "lazy feature ".repeat(1_000),
  );
  const largeLazyResult = analyzeBundleSize(largeLazyBundle);

  assert.equal(largeLazyResult.entryCount, 1);
  assert.equal(largeLazyResult.deferredChunkCount, 1);
  assert.equal(
    largeLazyResult.initialGzipBytes,
    smallLazyResult.initialGzipBytes,
  );
  assert.ok(
    largeLazyResult.deferredGzipBytes > smallLazyResult.deferredGzipBytes,
  );
  assert.doesNotThrow(() =>
    runBudget(largeLazyBundle, {
      initialGzipBytes: smallLazyResult.initialGzipBytes,
      deferredGzipBytes: largeLazyResult.deferredGzipBytes,
    }),
  );
});

test("fails when the initial static-import graph exceeds its budget", () => {
  const bundle = bundleWith("entry runtime", "lazy feature");

  assert.throws(
    () =>
      runBudget(bundle, {
        initialGzipBytes: 1,
        deferredGzipBytes: 1024 * 1024,
      }),
    /Initial download budget exceeded/,
  );
});

test("fails when deferred JavaScript exceeds its separate budget", () => {
  const bundle = bundleWith("entry runtime", "lazy feature ".repeat(1_000));

  assert.throws(
    () =>
      runBudget(bundle, {
        initialGzipBytes: 1024 * 1024,
        deferredGzipBytes: 1,
      }),
    /Deferred JavaScript budget exceeded/,
  );
});

test("fails if Vite produces no JavaScript entry chunk", () => {
  assert.throws(
    () =>
      runBudget(
        {},
        { initialGzipBytes: 1024 * 1024, deferredGzipBytes: 512 * 1024 },
      ),
    /found no JavaScript entry chunk/,
  );
});
