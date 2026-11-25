import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const openApi = readFileSync(resolve(here, "../openapi.yaml"), "utf8");
const apiSpecPackage = JSON.parse(
  readFileSync(resolve(here, "../package.json"), "utf8"),
);
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
    inputType: "TrainingPacketReviewInput",
  },
  {
    path: "/v1/training-packets/{id}/acknowledge",
    operationId: "acknowledgeTrainingPacket",
    urlHelper: "getAcknowledgeTrainingPacketUrl",
    inputType: "TrainingPacketAcknowledgmentInput",
  },
  {
    path: "/v1/training-packets/{id}/withdraw",
    operationId: "withdrawTrainingPacket",
    urlHelper: "getWithdrawTrainingPacketUrl",
    inputType: "TrainingPacketWithdrawalInput",
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

function getOpenApiOperations() {
  const lines = openApi.split(/\r?\n/);
  const operations = new Map();

  for (let pathIndex = 0; pathIndex < lines.length; pathIndex += 1) {
    const pathMatch = lines[pathIndex].match(/^  (\/.*):$/);
    if (!pathMatch) continue;

    let pathEnd = pathIndex + 1;
    while (pathEnd < lines.length && !/^  \//.test(lines[pathEnd])) pathEnd += 1;
    const pathLines = lines.slice(pathIndex + 1, pathEnd);

    for (let lineIndex = 0; lineIndex < pathLines.length; lineIndex += 1) {
      const methodMatch = pathLines[lineIndex].match(
        /^    (get|put|post|patch|delete):\s*$/,
      );
      if (!methodMatch) continue;

      let operationEnd = lineIndex + 1;
      while (
        operationEnd < pathLines.length &&
        !/^    (get|put|post|patch|delete):\s*$/.test(pathLines[operationEnd])
      ) {
        operationEnd += 1;
      }

      const operationId = pathLines
        .slice(lineIndex + 1, operationEnd)
        .map((line) => line.match(/^\s{6}operationId:\s*([^\s#]+)/)?.[1])
        .find(Boolean);
      if (operationId) {
        operations.set(operationId, {
          path: pathMatch[1],
          method: methodMatch[1].toUpperCase(),
          requestBodyType: pathLines
            .slice(lineIndex + 1, operationEnd)
            .map((line) =>
              line.match(
                /^\s*schema:\s*\{\s*\$ref:\s*["']#\/components\/schemas\/([^"']+)["']\s*\}/,
              )?.[1],
            )
            .find(Boolean),
        });
      }
    }
  }

  return operations;
}

const openApiOperations = getOpenApiOperations();

function getGeneratedRequestUrlHelper(actionBlock, operationId) {
  const helper = actionBlock.match(
    /customFetch(?:<[^>]+>)?\(\s*(get[A-Za-z0-9]+Url)\s*\(/,
  )?.[1];
  assert.ok(
    helper,
    `${operationId} no longer sends its request through a generated URL helper.`,
  );
  return helper;
}

function normalizePath(path) {
  return path
    .split("?")[0]
    .replace(/\$\{[^}]+\}/g, "{}")
    .replace(/\{[^}]+\}/g, "{}");
}

const highImpactOperations = [
  "getOperationalProfile",
  "updateOperationalProfile",
  "getPacketReviewContext",
  "updatePacketCoordinator",
  "listPacketSubmissions",
  "getPacketSubmission",
  "actOnPacketSubmission",
  "listTrainingPackets",
  "getTrainingPacketSyncReadiness",
  "syncTrainingPackets",
  "finalizeTrainingPacket",
  "getTrainingPacket",
  "downloadResourceFile",
  "listPhaseExtensionRequests",
  "submitPhaseExtensionRequest",
  "reviewPhaseExtensionRequest",
];

for (const { path, operationId, urlHelper } of packetActions) {
  test(`OpenAPI retains ${operationId} at ${path}`, () => {
    assert.equal(
      openApiOperations.get(operationId)?.path === path
        ? operationId
        : undefined,
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

for (const { operationId, inputType } of packetActions) {
  test(`generated ${operationId} serializes its matching input as JSON`, () => {
    const actionBlock = getGeneratedExportBlock(operationId);
    const definition = openApiOperations.get(operationId);
    assert.ok(
      actionBlock,
      `Generated client is missing "${operationId}"; regenerate the client before checking its request body.`,
    );
    assert.equal(
      definition?.requestBodyType,
      inputType,
      `${operationId} OpenAPI request body changed: expected ${inputType}, found ${definition?.requestBodyType ?? "no JSON schema"}.`,
    );

    const inputParameter = actionBlock.match(
      new RegExp(`([A-Za-z_$][\\w$]*):\\s*${inputType}\\s*,`),
    )?.[1];
    assert.ok(
      inputParameter,
      `${operationId} no longer accepts its OpenAPI input type ${inputType}.`,
    );
    assert.match(
      actionBlock,
      /['"]Content-Type['"]\s*:\s*['"]application\/json['"]/,
      `${operationId} no longer declares an application/json request body.`,
    );

    const serializedInput = actionBlock.match(
      /body:\s*JSON\.stringify\(\s*([A-Za-z_$][\w$]*)\s*\)/,
    )?.[1];
    assert.equal(
      serializedInput,
      inputParameter,
      `${operationId} must JSON.stringify its ${inputType} input (${inputParameter}) into the request body.`,
    );
  });
}

for (const operationId of highImpactOperations) {
  test(`generated ${operationId} matches its OpenAPI method and URL`, () => {
    const definition = openApiOperations.get(operationId);
    assert.ok(
      definition,
      `OpenAPI no longer defines selected operation "${operationId}".`,
    );

    const actionBlock = getGeneratedExportBlock(operationId);
    assert.ok(
      actionBlock,
      `Generated client is missing operation "${operationId}". Run client generation and investigate the missing export.`,
    );

    const method = actionBlock.match(/method:\s*['"]([A-Z]+)['"]/)?.[1];
    assert.equal(
      method,
      definition.method,
      `${operationId} method drifted: OpenAPI defines ${definition.method} ${definition.path}, but the generated request uses ${method ?? "no method"}.`,
    );

    const urlHelper = getGeneratedRequestUrlHelper(actionBlock, operationId);
    const urlBlock = getGeneratedExportBlock(urlHelper);
    assert.ok(
      urlBlock,
      `${operationId} references missing generated URL helper "${urlHelper}".`,
    );

    const generatedPaths = [...urlBlock.matchAll(/`(\/api[^`]+)`/g)].map(
      ([, generatedPath]) => normalizePath(generatedPath),
    );
    const expectedPath = normalizePath(`/api${definition.path}`);
    assert.ok(
      generatedPaths.includes(expectedPath),
      `${operationId} URL drifted: OpenAPI defines ${definition.method} ${definition.path}, but ${urlHelper} does not generate /api${definition.path}.`,
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

test("API client generation runs packet request checks after Orval", () => {
  const codegenSteps = apiSpecPackage.scripts.codegen
    ?.split("&&")
    .map((step) => step.trim());
  assert.ok(
    codegenSteps?.[0]?.startsWith("orval --config ./orval.config.ts"),
    "The codegen script must generate the client with Orval before request-body checks run.",
  );
  assert.equal(
    codegenSteps?.[1],
    "pnpm run test:generated-requests",
    "The codegen script must run packet request-body checks immediately after client generation.",
  );
});
