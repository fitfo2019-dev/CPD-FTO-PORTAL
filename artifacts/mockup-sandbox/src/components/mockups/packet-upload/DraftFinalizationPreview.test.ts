import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("draft finalization preview remains isolated from live packet storage and APIs", async () => {
  const source = await readFile(new URL("./DraftFinalizationPreview.tsx", import.meta.url), "utf8");
  assert.match(source, /Isolated fictional preview/);
  assert.match(source, /Finalize and Submit to Coordinator/);
  assert.match(source, /No Agency API Requests, Local Vault Writes/);
  assert.doesNotMatch(source, /fetch\s*\(|customFetch|OfflineStorage|training-packet-sync|useWorkspace/);
});
