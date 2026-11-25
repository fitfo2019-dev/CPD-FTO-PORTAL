import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, readFile, readdir, readlink, rm, symlink, writeFile } from "node:fs/promises";
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

test("a symbolic-link protected target is rejected before snapshot or file changes", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "context-write-symlink-test-"));
  try {
    const protectedData = Buffer.from("protected data");
    await writeFile(resolve(root, "protected-data.txt"), protectedData);
    await symlink("protected-data.txt", resolve(root, ".replit-context.md"));
    await writeFile(resolve(root, "prepared.txt"), "replacement");
    let snapshotCalled = false;

    await assert.rejects(
      writeProtectedContextFile(".replit-context.md", "prepared.txt", {
        root,
        snapshot: async () => {
          snapshotCalled = true;
          return "unexpected-snapshot";
        },
      }),
      /Protected targets must not be symbolic links/,
    );

    assert.equal(snapshotCalled, false);
    assert.equal(await readlink(resolve(root, ".replit-context.md")), "protected-data.txt");
    assert.deepEqual(await readFile(resolve(root, "protected-data.txt")), protectedData);
    assert.deepEqual((await readdir(root)).sort(), [".replit-context.md", "prepared.txt", "protected-data.txt"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a hidden prepared file is rejected without changing the protected file", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "context-write-hidden-test-"));
  try {
    const original = Buffer.from("before");
    await writeFile(resolve(root, ".replit-context.md"), original);
    await writeFile(resolve(root, ".prepared.txt"), "replacement");
    let snapshotCalled = false;

    await assert.rejects(
      writeProtectedContextFile(".replit-context.md", ".prepared.txt", {
        root,
        snapshot: async () => {
          snapshotCalled = true;
          return "unexpected-snapshot";
        },
      }),
      /Prepared text must be a non-hidden file inside the repository/,
    );

    assert.equal(snapshotCalled, false);
    assert.deepEqual(await readFile(resolve(root, ".replit-context.md")), original);
    assert.deepEqual((await readdir(root)).sort(), [".prepared.txt", ".replit-context.md"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a prepared file outside the repository is rejected without changing the protected file", async () => {
  const parent = await mkdtemp(resolve(tmpdir(), "context-write-outside-test-"));
  const root = resolve(parent, "repository");
  const outside = resolve(parent, "prepared.txt");
  try {
    await mkdir(root);
    const original = Buffer.from("before");
    await writeFile(resolve(root, ".replit-context.md"), original);
    await writeFile(outside, "replacement");
    let snapshotCalled = false;

    await assert.rejects(
      writeProtectedContextFile(".replit-context.md", outside, {
        root,
        snapshot: async () => {
          snapshotCalled = true;
          return "unexpected-snapshot";
        },
      }),
      /Prepared text must be a non-hidden file inside the repository/,
    );

    assert.equal(snapshotCalled, false);
    assert.deepEqual(await readFile(resolve(root, ".replit-context.md")), original);
    assert.deepEqual((await readdir(root)).sort(), [".replit-context.md"]);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("a non-allowlisted target is rejected before snapshot or file changes", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "context-write-allowlist-test-"));
  try {
    const original = Buffer.from("before");
    await writeFile(resolve(root, "unprotected.txt"), original);
    await writeFile(resolve(root, "prepared.txt"), "replacement");
    let snapshotCalled = false;

    await assert.rejects(
      writeProtectedContextFile("unprotected.txt", "prepared.txt", {
        root,
        snapshot: async () => {
          snapshotCalled = true;
          return "unexpected-snapshot";
        },
      }),
      /Usage: pnpm context:write/,
    );

    assert.equal(snapshotCalled, false);
    assert.deepEqual(await readFile(resolve(root, "unprotected.txt")), original);
    assert.deepEqual((await readdir(root)).sort(), ["prepared.txt", "unprotected.txt"]);
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
