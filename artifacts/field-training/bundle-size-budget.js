import { gzipSync } from "node:zlib";

export const FIELD_TRAINING_BUNDLE_BUDGETS = Object.freeze({
  initialGzipBytes: 1024 * 1024,
  deferredGzipBytes: 1024 * 1024,
});

// Pieces that must never be part of the start-up download. Division equipment
// fetches them in the background right after sign-in.
export const FIELD_TRAINING_DEFERRED_ONLY = Object.freeze(["vendor-spreadsheet"]);

export function analyzeBundleSize(bundle) {
  const chunks = Object.values(bundle).filter(
    (output) => output.type === "chunk",
  );
  const chunksByFileName = new Map(
    chunks.map((chunk) => [chunk.fileName, chunk]),
  );
  const initialChunks = new Set();

  function includeStaticImports(chunk, included) {
    if (included.has(chunk.fileName)) return;
    included.add(chunk.fileName);
    for (const importedFile of chunk.imports) {
      const importedChunk = chunksByFileName.get(importedFile);
      if (importedChunk) includeStaticImports(importedChunk, included);
    }
  }

  const entryChunks = chunks.filter((chunk) => chunk.isEntry);
  for (const entry of entryChunks) {
    includeStaticImports(entry, initialChunks);
  }

  const initialGzipBytes = [...initialChunks].reduce((total, fileName) => {
    const chunk = chunksByFileName.get(fileName);
    return total + gzipSync(chunk.code).byteLength;
  }, 0);
  const deferredChunks = chunks.filter(
    (chunk) => !initialChunks.has(chunk.fileName),
  );
  const deferredGzipBytes = deferredChunks.reduce(
    (total, chunk) => total + gzipSync(chunk.code).byteLength,
    0,
  );

  const importLoop = findImportLoop(chunks, chunksByFileName);
  const initialNames = [...initialChunks];

  return {
    entryCount: entryChunks.length,
    importLoop,
    initialChunkNames: initialNames,
    initialGzipBytes,
    deferredGzipBytes,
    deferredChunkCount: deferredChunks.length,
  };
}

/** Returns the first static import loop between chunks, or null. A loop can
 * leave a shared module undefined at start-up and blank the portal. */
export function findImportLoop(chunks, chunksByFileName) {
  const state = new Map();
  const path = [];
  function visit(fileName) {
    if (state.get(fileName) === "done") return null;
    if (state.get(fileName) === "open") return [...path.slice(path.indexOf(fileName)), fileName];
    state.set(fileName, "open");
    path.push(fileName);
    for (const importedFile of chunksByFileName.get(fileName)?.imports ?? []) {
      if (!chunksByFileName.has(importedFile)) continue;
      const loop = visit(importedFile);
      if (loop) return loop;
    }
    path.pop();
    state.set(fileName, "done");
    return null;
  }
  for (const chunk of chunks) {
    const loop = visit(chunk.fileName);
    if (loop) return loop;
  }
  return null;
}

export function bundleSizeBudgetPlugin(
  budgets = FIELD_TRAINING_BUNDLE_BUDGETS,
) {
  return {
    name: "field-training-bundle-size-budget",
    apply: "build",
    generateBundle(_options, bundle) {
      const result = analyzeBundleSize(bundle);
      const kibibytes = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;
      const summary =
        `Field Training gzip budget: initial ${kibibytes(result.initialGzipBytes)}` +
        ` / ${kibibytes(budgets.initialGzipBytes)}; deferred ` +
        `${kibibytes(result.deferredGzipBytes)} / ` +
        `${kibibytes(budgets.deferredGzipBytes)} across ` +
        `${result.deferredChunkCount} chunks.`;

      if (result.entryCount === 0) {
        this.error(
          "Field Training bundle size check found no JavaScript entry chunk.",
        );
      }
      if (result.importLoop) {
        this.error(`Field Training chunk import loop: ${result.importLoop.join(" -> ")}.`);
      }
      const startUpOnly = result.initialChunkNames.filter((name) =>
        FIELD_TRAINING_DEFERRED_ONLY.some((prefix) => name.includes(prefix)),
      );
      if (startUpOnly.length) {
        this.error(`Field Training start-up download includes ${startUpOnly.join(", ")}.`);
      }
      if (result.initialGzipBytes > budgets.initialGzipBytes) {
        this.error(`${summary} Initial download budget exceeded.`);
      }
      if (result.deferredGzipBytes > budgets.deferredGzipBytes) {
        this.error(`${summary} Deferred JavaScript budget exceeded.`);
      }

      console.info(summary);
    },
  };
}
