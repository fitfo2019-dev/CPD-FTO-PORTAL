const generatedOrWorkspaceOnlyPatterns = [
  /(^|\/)node_modules(\/|$)/,
  /(^|\/)\.git(\/|$)/,
  /(^|\/)(?:src|scripts|dist)(\/|$)/,
  /(^|\/)\.cache(\/|$)/,
  /(^|\/)[^/]+\.map$/,
  /(^|\/)[^/]+\.tsbuildinfo$/,
  /(^|\/)tsconfig[^/]*\.json$/,
  /(^|\/)(?:vite|webpack|rollup|esbuild)\.config\.[^/]+$/,
];

export function getResourceCatalogFileNames(source: string): string[] {
  const names = [...source.matchAll(/\bfile_name\s*:\s*"([^"]+)"/g)].map(
    (match) => match[1],
  );
  if (names.length === 0) {
    throw new Error("No resource file names were found in the API resource catalog.");
  }
  if (new Set(names).size !== names.length) {
    throw new Error("The API resource catalog contains duplicate file names.");
  }
  return names;
}

export function assertSameFileSet(
  label: string,
  expectedFiles: Iterable<string>,
  actualFiles: Iterable<string>,
): void {
  const expected = new Set(expectedFiles);
  const actual = new Set(actualFiles);
  const missing = [...expected].filter((file) => !actual.has(file)).sort();
  const extra = [...actual].filter((file) => !expected.has(file)).sort();
  if (missing.length === 0 && extra.length === 0) return;

  const details = [
    missing.length > 0
      ? `Missing:\n${missing.map((file) => `  - ${file}`).join("\n")}`
      : "",
    extra.length > 0
      ? `Extra:\n${extra.map((file) => `  - ${file}`).join("\n")}`
      : "",
  ].filter(Boolean);
  throw new Error(`${label} do not match:\n${details.join("\n")}`);
}

export function assertArchiveFileMatchesSource(
  archivePath: string,
  sourceContents: Uint8Array,
  packagedContents: Uint8Array,
): void {
  const contentsMatch =
    sourceContents.length === packagedContents.length &&
    sourceContents.every((byte, index) => byte === packagedContents[index]);
  if (!contentsMatch) {
    throw new Error(
      `Packaged contents do not match the source file: ${archivePath}`,
    );
  }
}

export function assertNoGeneratedOrWorkspaceFiles(
  archiveEntries: Iterable<string>,
): void {
  const unexpected = [...archiveEntries]
    .filter((entry) =>
      generatedOrWorkspaceOnlyPatterns.some((pattern) => pattern.test(entry)),
    )
    .sort();
  if (unexpected.length > 0) {
    throw new Error(
      `Generated or workspace-only files must not be in the release archive:\n${unexpected
        .map((entry) => `  - ${entry}`)
        .join("\n")}`,
    );
  }
}

export function assertReleaseArchiveContents({
  resourceFileNames,
  migrationFileNames,
  expectedArchiveEntries,
  actualArchiveEntries,
}: {
  resourceFileNames: Iterable<string>;
  migrationFileNames: Iterable<string>;
  expectedArchiveEntries: Iterable<string>;
  actualArchiveEntries: Iterable<string>;
}): void {
  const actual = [...actualArchiveEntries];
  const actualResources = actual
    .filter((entry) => entry.startsWith("resources/"))
    .map((entry) => entry.slice("resources/".length));
  const actualMigrations = actual
    .filter((entry) => entry.startsWith("migrations/"))
    .map((entry) => entry.slice("migrations/".length));

  assertSameFileSet("Packaged API resources and the resource catalog", resourceFileNames, actualResources);
  assertSameFileSet("Packaged migrations and migration sources", migrationFileNames, actualMigrations);
  assertNoGeneratedOrWorkspaceFiles(actual);
  assertSameFileSet("Release archive entries and the package manifest", expectedArchiveEntries, actual);
}
