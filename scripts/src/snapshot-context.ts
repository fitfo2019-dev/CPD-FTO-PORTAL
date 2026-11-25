import { chmod, copyFile, mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const protectedPaths = [
  ".replit-context.md", "HANDOVER_MANUAL.md",
  "src/config/phaseConfiguration.ts", "tsconfig.base.json", "pnpm-workspace.yaml",
  "package.json", "artifacts/api-server/package.json",
];

/** Code/document recovery only. Never copies .env, records, uploads or secrets. */
export async function snapshotContext(): Promise<string> {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "_").slice(0, 15);
  const destination = resolve(root, "local-history-snapshots", `snapshot_${stamp}_${randomUUID().slice(0, 8)}`);
  await mkdir(resolve(root, "local-history-snapshots"), { recursive: true, mode: 0o700 });
  await chmod(resolve(root, "local-history-snapshots"), 0o700);
  await mkdir(destination, { recursive: true, mode: 0o700 });
  const entries: { path: string; sha256: string }[] = [];
  for (const path of protectedPaths) {
    const source = resolve(root, path);
    // Do not follow symlinks to files outside the repository.
    const canonical = await realpath(source);
    if (canonical !== source || relative(root, canonical).startsWith(`..${sep}`) || canonical === root) {
      throw new Error("Snapshot source must be an ordinary allowlisted file, not a symbolic link.");
    }
    if (!(await stat(canonical)).isFile()) throw new Error("Snapshot source must be a file.");
    const target = resolve(destination, path);
    await mkdir(dirname(target), { recursive: true });
    const bytes = await readFile(canonical);
    await copyFile(canonical, target);
    await chmod(target, 0o600);
    entries.push({ path, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  await writeFile(resolve(destination, "snapshot-manifest.json"), JSON.stringify({
    created_at: new Date().toISOString(), scope: "source-configuration-only", files: entries,
  }, null, 2), { flag: "wx", mode: 0o600 });
  return relative(root, destination);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${await snapshotContext()}\n`);
}
