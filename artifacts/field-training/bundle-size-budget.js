import { gzipSync } from "node:zlib";

export const FIELD_TRAINING_BUNDLE_BUDGETS = Object.freeze({
  initialGzipBytes: 1024 * 1024,
  deferredGzipBytes: 512 * 1024,
});

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

  return {
    entryCount: entryChunks.length,
    initialGzipBytes,
    deferredGzipBytes,
    deferredChunkCount: deferredChunks.length,
  };
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
