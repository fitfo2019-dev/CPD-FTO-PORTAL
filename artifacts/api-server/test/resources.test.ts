import assert from "node:assert/strict";
import { access, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  createResourceCatalogEnvelope,
  getResourceById,
  getResourceFileNames,
} from "../src/lib/resource-catalog.ts";

const resourceDirectory = fileURLToPath(new URL("../resources/", import.meta.url));

test("resource catalog is valid, unique, and does not expose server paths", () => {
  const catalog = createResourceCatalogEnvelope();
  const ids = catalog.data.map((resource) => resource.id);
  const newTrainingResourceIds = [
    "dv-3-3-domestic-violence",
    "dv-cpo-vs-tpo",
    "dv-family-household-member-relationships",
    "dv-feti-model",
    "i-40-115-domestic-violence-lethality-screen",
    "dv-power-and-control-wheel",
    "dv-safety-plan-victims-page-1",
    "dv-safety-plan-victims-page-2",
    "dv-strangulation-assessment-card-v4",
    "dv-strangulation-checklist",
    "dv-strangulation-physiological-consequences",
    "dv-types-of-abuse-worksheet-1",
  ];

  assert.equal(catalog.status, "success");
  assert.equal(catalog.metadata.total_records, 23);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(newTrainingResourceIds.every((id) => ids.includes(id)));
  assert.ok(
    catalog.data.every(
      (resource) =>
        resource.title.length > 0 &&
        !("file_name" in resource) &&
        !("download_name" in resource),
    ),
  );
});

test("resource identifiers use a closed allowlist", () => {
  assert.ok(getResourceById("amys-law-factors"));
  assert.equal(getResourceById("../resources/Amys_law_factors.doc"), undefined);
  assert.equal(getResourceById("unknown-resource"), undefined);
});

test("all allowlisted resource files exist in the API resource directory", async () => {
  const fileNames = getResourceFileNames();
  assert.equal(fileNames.length, 23);

  for (const fileName of fileNames) {
    assert.equal(fileName, fileName.split(/[\\/]/).at(-1));
    const filePath = join(resourceDirectory, fileName);
    await access(filePath);
    assert.ok((await stat(filePath)).isFile());
  }
});
