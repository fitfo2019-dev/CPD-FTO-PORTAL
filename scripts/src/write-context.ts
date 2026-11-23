import { chmod, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { protectedPaths, snapshotContext } from "./snapshot-context.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const [target, replacement] = process.argv.slice(2);
if (!target || !replacement || !protectedPaths.includes(target)) {
  throw new Error("Usage: pnpm context:write <allowlisted-target> <prepared-text-file>");
}
const destination = resolve(root, target);
if (await realpath(destination) !== destination) throw new Error("Protected targets must not be symbolic links.");
const source = await realpath(resolve(root, replacement));
const sourceRelative = relative(root, source);
if (sourceRelative.startsWith("..") || sourceRelative.split("/").some(part => part.startsWith("."))) {
  throw new Error("Prepared text must be a non-hidden file inside the repository, never a secret file.");
}
const content = await readFile(source);
if (content.byteLength > 512_000) throw new Error("Prepared configuration exceeds the text size limit.");
// Snapshot completes BEFORE any destination mutation. A failed snapshot aborts.
const snapshot = await snapshotContext();
const temporary = `${destination}.${randomUUID()}.tmp`;
try {
  await writeFile(temporary, content, { flag: "wx", mode: 0o600 });
  await rename(temporary, destination);
  await chmod(destination, 0o600);
} finally {
  await rm(temporary, { force: true });
}
process.stdout.write(`Saved configuration after snapshot: ${snapshot}\n`);
