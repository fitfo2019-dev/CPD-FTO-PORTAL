import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { writeProtectedContextFile } from "./write-context.js";

test("protected configuration writes snapshot the old file before atomic replacement", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "context-write-test-"));
  try {
    const original = Buffer.from("before");
    const prepared = Buffer.from("after");
    await writeFile(resolve(root, ".replit-context.md"), original);
    await writeFile(resolve(root, "prepared.txt"), prepared);
    const events: string[] = [];

    const snapshot = await writeProtectedContextFile(".replit-context.md", "prepared.txt", {
      root,
      snapshot: async () => {
        events.push("snapshot");
        assert.deepEqual(await readFile(resolve(root, ".replit-context.md")), original);
        return "test-snapshot";
      },
    });

    events.push("write-complete");
    assert.equal(snapshot, "test-snapshot");
    assert.deepEqual(events, ["snapshot", "write-complete"]);
    assert.deepEqual(await readFile(resolve(root, ".replit-context.md")), prepared);
    assert.deepEqual((await readdir(root)).sort(), [".replit-context.md", "prepared.txt"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a failed snapshot leaves the protected file unchanged", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "context-write-failure-test-"));
  try {
    const original = Buffer.from("before");
    await writeFile(resolve(root, ".replit-context.md"), original);
    await writeFile(resolve(root, "prepared.txt"), "after");

    await assert.rejects(
      writeProtectedContextFile(".replit-context.md", "prepared.txt", {
        root,
        snapshot: async () => { throw new Error("snapshot unavailable"); },
      }),
      /snapshot unavailable/,
    );

    assert.deepEqual(await readFile(resolve(root, ".replit-context.md")), original);
    assert.deepEqual((await readdir(root)).sort(), [".replit-context.md", "prepared.txt"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
