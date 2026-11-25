import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { protectedPaths, snapshotContext } from "./snapshot-context.js";

test("pre-write snapshot clones required source files and records their checksums",async()=>{
  const root=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
  const destination=await snapshotContext();
  assert.match(destination,/^local-history-snapshots\/snapshot_\d{8}_\d{6}_/);
  const manifest=JSON.parse(await readFile(resolve(root,destination,"snapshot-manifest.json"),"utf8")) as {
    scope:string;files:{path:string;sha256:string}[];
  };
  assert.equal(manifest.scope,"source-configuration-only");
  assert.deepEqual(manifest.files.map(item=>item.path),protectedPaths);
  const requiredPaths = [".replit-context.md","HANDOVER_MANUAL.md","src/config/phaseConfiguration.ts"];
  for(const path of requiredPaths) {
    assert.ok(protectedPaths.includes(path),`${path} must remain in the protected allowlist`);
    const source=await readFile(resolve(root,path));
    assert.deepEqual(await readFile(resolve(root,destination,path)),source);
    assert.equal(manifest.files.find(item=>item.path===path)?.sha256,
      createHash("sha256").update(source).digest("hex"));
  }
  assert.ok(!manifest.files.some(item=>/(?:^|\/)\.env|uploads|records|secrets/i.test(item.path)));
});
