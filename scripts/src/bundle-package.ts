import { execFile } from "node:child_process";
import {
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

type PackageManifest = {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  engines?: { node?: string };
};

const execFileAsync = promisify(execFile);
const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const apiRoot = join(workspaceRoot, "artifacts/api-server");
const apiDist = join(apiRoot, "dist");
const outputDir = join(workspaceRoot, "dist-production");
const archivePath = join(workspaceRoot, "dist-production.zip");
const excludedBuildHelpers = new Set(["pino-file.mjs", "pino-pretty.mjs"]);

async function readManifest(path: string): Promise<PackageManifest> {
  return JSON.parse(await readFile(path, "utf8")) as PackageManifest;
}

async function listFilesRecursively(
  directory: string,
  prefix = "",
): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const relativePath = prefix ? join(prefix, entry.name) : entry.name;
      if (entry.isDirectory()) {
        return listFilesRecursively(join(directory, entry.name), relativePath);
      }
      return [relativePath];
    }),
  );
  return files.flat();
}

function hasWorkspaceImport(source: string): boolean {
  return /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\(\s*)["']@workspace\//.test(
    source,
  );
}

async function bundlePackage(): Promise<void> {
  const [rootManifest, apiManifest] = await Promise.all([
    readManifest(join(workspaceRoot, "package.json")),
    readManifest(join(apiRoot, "package.json")),
  ]);
  const nodeEngine = rootManifest.engines?.node;
  if (!nodeEngine) {
    throw new Error("The workspace Node.js engine range is not declared.");
  }
  if (apiManifest.engines?.node && apiManifest.engines.node !== nodeEngine) {
    throw new Error(
      "The API server Node.js engine range does not match the workspace baseline.",
    );
  }

  const unresolvedDependencies = Object.entries(
    apiManifest.dependencies ?? {},
  ).filter(
    ([name, version]) =>
      !name.startsWith("@workspace/") &&
      /^(workspace:|catalog:|link:|file:|portal:)/.test(version),
  );
  if (unresolvedDependencies.length > 0) {
    throw new Error(
      `Production dependencies contain non-portable references: ${unresolvedDependencies
        .map(([name]) => name)
        .join(", ")}`,
    );
  }

  const runtimeEntries = await readdir(apiDist, { withFileTypes: true });
  const runtimeFiles = runtimeEntries.filter(
    (entry) =>
      entry.isFile() &&
      extname(entry.name) === ".mjs" &&
      !excludedBuildHelpers.has(entry.name),
  );

  if (!runtimeFiles.some((entry) => entry.name === "index.mjs")) {
    throw new Error(
      "Compiled API entry was not found in artifacts/api-server/dist.",
    );
  }

  await rm(outputDir, { recursive: true, force: true });
  await rm(archivePath, { force: true });
  await mkdir(outputDir, { recursive: true });

  for (const entry of runtimeFiles) {
    const outputName = entry.name === "index.mjs" ? "index.js" : entry.name;
    const source = await readFile(join(apiDist, entry.name), "utf8");
    const withoutSourceMapLink = source.replace(
      /^\s*\/\/# sourceMappingURL=.*$/gm,
      "",
    );
    if (/synthetic_training|SYNTHETIC_STAGING_ENABLED|DEVELOPER_STAGING_PASSWORD|X-Developer-Staging-Password/.test(withoutSourceMapLink)) {
      throw new Error("Developer-only staging code was found in the agency release. Build with --agency-release first.");
    }
    if (hasWorkspaceImport(withoutSourceMapLink)) {
      throw new Error(
        `The compiled module ${entry.name} still references a pnpm workspace package.`,
      );
    }
    await writeFile(join(outputDir, outputName), withoutSourceMapLink, "utf8");
  }

  const dependencies = Object.fromEntries(
    Object.entries(apiManifest.dependencies ?? {}).filter(
      ([name]) => !name.startsWith("@workspace/"),
    ),
  );
  const productionManifest = {
    name: "api-server",
    version: apiManifest.version ?? "1.0.0",
    private: true,
    type: "module",
    main: "index.js",
    scripts: {
      start: "node index.js",
    },
    engines: {
      node: nodeEngine,
    },
    dependencies,
  };

  await writeFile(
    join(outputDir, "package.json"),
    `${JSON.stringify(productionManifest, null, 2)}\n`,
    "utf8",
  );

  const handoverManual = await readFile(
    join(workspaceRoot, "HANDOVER_MANUAL.md"),
    "utf8",
  );
  await writeFile(join(outputDir, "HANDOVER_MANUAL.md"), handoverManual, "utf8");
  await cp(join(apiRoot, "migrations"), join(outputDir, "migrations"), { recursive: true });
  const migrationFiles = await listFilesRecursively(join(outputDir, "migrations"));

  const resourceSourceDir = join(apiRoot, "resources");
  const resourceOutputDir = join(outputDir, "resources");
  await cp(resourceSourceDir, resourceOutputDir, { recursive: true });
  const resourceFiles = await listFilesRecursively(resourceOutputDir);
  const archiveEntries = [
    "package.json",
    "HANDOVER_MANUAL.md",
    ...migrationFiles.map(path => join("migrations", path)),
    ...resourceFiles.map((path) => join("resources", path)),
    ...runtimeFiles.map((entry) =>
      entry.name === "index.mjs" ? "index.js" : entry.name,
    ),
  ];
  await execFileAsync(
    "zip",
    ["-X", "-q", archivePath, ...archiveEntries],
    { cwd: outputDir },
  );
  await execFileAsync("zip", ["-T", archivePath]);

  const archiveStats = await stat(archivePath);
  console.log(
    `Created dist-production/ with ${runtimeFiles.length} runtime modules, ${resourceFiles.length} protected resources and ${Object.keys(dependencies).length} production dependencies; verified dist-production.zip (${archiveStats.size} bytes).`,
  );
}

bundlePackage().catch((error: unknown) => {
  console.error(
    "Could not create the standalone production package.",
    error instanceof Error ? error.message : "Unknown build error.",
  );
  process.exitCode = 1;
});
