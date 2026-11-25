import assert from "node:assert/strict";
import test from "node:test";
import {
  assertReleaseArchiveContents,
  assertSameFileSet,
  getResourceCatalogFileNames,
} from "./bundle-package-contents.js";

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
