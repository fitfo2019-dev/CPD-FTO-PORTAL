import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const openApi = readFileSync(resolve(here, "../openapi.yaml"), "utf8");
const generatedClient = readFileSync(
  resolve(here, "../../api-client-react/src/generated/api.ts"),
  "utf8",
);
const publicClientIndex = readFileSync(
  resolve(here, "../../api-client-react/src/index.ts"),
  "utf8",
);

const packetActions = [
  {
    path: "/v1/training-packets/{id}/release",
    operationId: "releaseTrainingPacket",
    urlHelper: "getReleaseTrainingPacketUrl",
  },
  {
    path: "/v1/training-packets/{id}/acknowledge",
    operationId: "acknowledgeTrainingPacket",
    urlHelper: "getAcknowledgeTrainingPacketUrl",
  },
  {
    path: "/v1/training-packets/{id}/withdraw",
    operationId: "withdrawTrainingPacket",
    urlHelper: "getWithdrawTrainingPacketUrl",
  },
];

function getGeneratedExportBlock(exportName) {
  const declaration = new RegExp(`^export const ${exportName}\\s*=`, "m");
  const match = declaration.exec(generatedClient);
  if (!match) return "";

  const blockStart = match.index;
  const remaining = generatedClient.slice(blockStart + match[0].length);
  const nextExportOffset = remaining.search(/^\s*export const /m);
  const blockEnd =
    nextExportOffset === -1
      ? generatedClient.length
      : blockStart + match[0].length + nextExportOffset;

  return generatedClient.slice(blockStart, blockEnd);
}

function getOperationId(path) {
  const lines = openApi.split(/\r?\n/);
  const pathIndex = lines.findIndex((line) => line === `  ${path}:`);
  if (pathIndex === -1) return undefined;

  const nextPathIndex = lines.findIndex(
    (line, index) => index > pathIndex && /^  \//.test(line),
  );
  const pathLines = lines.slice(
    pathIndex,
    nextPathIndex === -1 ? lines.length : nextPathIndex,
  );
  return pathLines
    .map((line) => line.match(/^\s{6}operationId:\s*([^\s#]+)/)?.[1])
    .find(Boolean);
}

for (const { path, operationId, urlHelper } of packetActions) {
  test(`OpenAPI retains ${operationId} at ${path}`, () => {
    assert.equal(
      getOperationId(path),
      operationId,
      `Expected ${path} to define operationId "${operationId}". ` +
        "A missing path or renamed operationId breaks packet client generation.",
    );
  });

  test(`generated client exports ${operationId}`, () => {
    assert.match(
      generatedClient,
      new RegExp(`^export const ${operationId}\\s*=`, "m"),
      `Expected generated/api.ts to export "${operationId}". ` +
        "Regenerate the client and investigate if the export is still missing.",
    );
  });

  test(`generated ${operationId} sends POST to ${path}`, () => {
    const actionBlock = getGeneratedExportBlock(operationId);
    const urlBlock = getGeneratedExportBlock(urlHelper);
    const expectedGeneratedPath = path.replace("{id}", "${id}");

    assert.match(
      actionBlock,
      /method:\s*['"]POST['"]/,
      `${operationId} drifted from POST. Regenerate the client and check its OpenAPI operation.`,
    );
    assert.match(
      actionBlock,
      new RegExp(`customFetch(?:<[^>]+>)?\\(\\s*${urlHelper}\\(id\\)`),
      `${operationId} no longer sends its request through ${urlHelper}.`,
    );
    assert.match(
      urlBlock,
      new RegExp(
        `return\\s+\`/api${expectedGeneratedPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\``,
      ),
      `${operationId} route drifted: expected ${path} in ${urlHelper}.`,
    );
  });
}

test("public API client re-exports generated API operations", () => {
  assert.match(
    publicClientIndex,
    /export\s+\*\s+from\s+["']\.\/generated\/api["']\s*;/,
    "Expected src/index.ts to re-export generated/api.ts so packet actions " +
      "remain available from the public @workspace/api-client-react entry point.",
  );
});
