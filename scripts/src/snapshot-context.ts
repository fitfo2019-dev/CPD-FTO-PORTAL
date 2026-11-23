import { copyFile, mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const protectedPaths = [
  ".replit-context.md", "HANDOVER_MANUAL.md",
  "src/config/phaseConfiguration.ts", "tsconfig.base.json", "pnpm-workspace.yaml",
  "package.json", "artifacts/api-server/package.json",
];

/** Code/document recovery only. Never copies .env, records, uploads or secrets. */
export async function snapshotContext(): Promise<string> {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "_").slice(0, 15);
  const destination = resolve(root, "local-history-snapshots", `snapshot_${stamp}_${randomUUID().slice(0, 8)}`);
  await mkdir(destination, { recursive: true });
  const entries: { path: string; sha256: string }[] = [];
  for (const path of protectedPaths) {
    const source = resolve(root, path);
    // Do not follow symlinks to files outside the repository.
    const canonical = await realpath(source);
    if (relative(root, canonical).startsWith(`..${sep}`) || canonical === root) {
      throw new Error("Snapshot source must remain inside the repository.");
    }
    if (!(await stat(canonical)).isFile()) throw new Error("Snapshot source must be a file.");
    const target = resolve(destination, path);
    await mkdir(dirname(target), { recursive: true });
    const bytes = await readFile(canonical);
    await copyFile(canonical, target);
    entries.push({ path, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  await writeFile(resolve(destination, "snapshot-manifest.json"), JSON.stringify({
    created_at: new Date().toISOString(), scope: "source-configuration-only", files: entries,
  }, null, 2), { flag: "wx" });
  return relative(root, destination);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${await snapshotContext()}\n`);
}
