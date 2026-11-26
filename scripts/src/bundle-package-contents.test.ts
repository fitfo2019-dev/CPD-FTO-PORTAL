import assert from "node:assert/strict";
import test from "node:test";
import {
  assertArchiveFileMatchesSource,
  assertProductionArchiveSize,
  assertReleaseArchiveContents,
  assertSameFileSet,
  getResourceCatalogFileNames,
  PRODUCTION_ARCHIVE_MAX_BYTES,
} from "./bundle-package-contents.js";

test("accepts packaged bytes that match the source file", () => {
  assert.doesNotThrow(() =>
    assertArchiveFileMatchesSource(
      "resources/reference.pdf",
      Uint8Array.from([0, 255, 37, 128]),
      Uint8Array.from([0, 255, 37, 128]),
    ),
  );
});

test("reports the archive path when packaged bytes differ from the source", () => {
  assert.throws(
    () =>
      assertArchiveFileMatchesSource(
        "migrations/first.sql",
        Uint8Array.from([1, 2, 3]),
        Uint8Array.from([1, 2]),
      ),
    /Packaged contents do not match the source file: migrations\/first\.sql/,
  );
});

test("reads every file name from the resource catalog", () => {
  const names = getResourceCatalogFileNames(`
    const files = [
      { file_name: "first.pdf", download_name: "First.pdf" },
      { file_name: "second.docx", download_name: "Second.docx" },
    ];
  `);
  assert.deepEqual(names, ["first.pdf", "second.docx"]);
});

test("reports missing and extra files when file sets drift", () => {
  assert.throws(
    () => assertSameFileSet("Resources", ["expected.pdf"], ["unexpected.pdf"]),
    /Resources do not match:[\s\S]*Missing:[\s\S]*expected\.pdf[\s\S]*Extra:[\s\S]*unexpected\.pdf/,
  );
});

test("checks resources, migrations, exact archive contents, and excludes build files", () => {
  const expectedEntries = [
    "index.js",
    "migrations/first.sql",
    "package.json",
    "resources/reference.pdf",
  ];
  assert.doesNotThrow(() =>
    assertReleaseArchiveContents({
      resourceFileNames: ["reference.pdf"],
      migrationFileNames: ["first.sql"],
      expectedArchiveEntries: expectedEntries,
      actualArchiveEntries: expectedEntries,
    }),
  );

  assert.throws(
    () =>
      assertReleaseArchiveContents({
        resourceFileNames: ["reference.pdf"],
        migrationFileNames: ["first.sql"],
        expectedArchiveEntries: expectedEntries,
        actualArchiveEntries: [...expectedEntries, "portal/assets/app.js.map"],
      }),
    /Generated or workspace-only files[\s\S]*portal\/assets\/app\.js\.map/,
  );
});

test("production archive size accepts below and exactly at the limit, and rejects one byte above", () => {
  assert.doesNotThrow(() => assertProductionArchiveSize(PRODUCTION_ARCHIVE_MAX_BYTES - 1));
  assert.doesNotThrow(() => assertProductionArchiveSize(PRODUCTION_ARCHIVE_MAX_BYTES));
  assert.throws(
    () => assertProductionArchiveSize(PRODUCTION_ARCHIVE_MAX_BYTES + 1),
    /exceeds the approved 26214400-byte size budget/,
  );
  for (const invalid of [-1, Number.NaN, Number.POSITIVE_INFINITY, 1.5])
    assert.throws(() => assertProductionArchiveSize(invalid));
});
