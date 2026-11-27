import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const openApi = readFileSync(resolve(repoRoot, "lib/api-spec/openapi.yaml"), "utf8");

const selectedRoutes = [
  ["getOperationalProfileHistory", "operational-profile.ts"],
  ["getOperationalProfile", "operational-profile.ts"],
  ["updateOperationalProfile", "operational-profile.ts"],
  ["getPacketReviewContext", "packet-review.ts"],
  ["updatePacketCoordinator", "packet-review.ts"],
  ["listPacketSubmissions", "packet-review.ts"],
  ["getPacketSubmission", "packet-review.ts"],
  ["actOnPacketSubmission", "packet-review.ts"],
  ["getAssignmentTransitionContext", "agency-assignment-transitions.ts"],
  ["getAssignmentTransitionHistory", "agency-assignment-transitions.ts"],
  ["createSuccessorAssignment", "agency-assignment-transitions.ts"],
  ["listTrainingAlerts", "training-alerts.ts"],
  ["createNrtReviewRequest", "training-alerts.ts"],
  ["saveWeek15Recommendation", "training-alerts.ts"],
  ["closeTrainingAlert", "training-alerts.ts"],
  ["healthCheck", "health.ts"],
  ["mockLogin", "auth.ts"],
  ["listSecureRecords", "secureRecords.ts"],
  ["listTrainingPackets", "training-packets.ts"],
  ["getTrainingPacketSyncReadiness", "training-packets.ts"],
  ["syncTrainingPackets", "training-packets.ts"],
  ["finalizeTrainingPacket", "training-packets.ts"],
  ["releaseTrainingPacket", "training-packets.ts"],
  ["acknowledgeTrainingPacket", "training-packets.ts"],
  ["withdrawTrainingPacket", "training-packets.ts"],
  ["getTrainingPacket", "training-packets.ts"],
  ["listAuditLogs", "audit-logs.ts"],
  ["dispatchIncidentLookup", "dispatch.ts"],
  ["dispatchEventIngress", "dispatch.ts"],
  ["getPatrolViewStatus", "patrol-view-link.ts"],
  ["openPatrolView", "patrol-view-link.ts"],
  ["listResources", "resources.ts"],
  ["downloadResourceFile", "resources.ts"],
  ["listPhaseExtensionRequests", "phase-extension-requests.ts"],
  ["submitPhaseExtensionRequest", "phase-extension-requests.ts"],
  ["reviewPhaseExtensionRequest", "phase-extension-requests.ts"],
];

function readOpenApiOperations(source) {
  const lines = source.split(/\r?\n/);
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
          method: methodMatch[1].toUpperCase(),
          path: pathMatch[1],
        });
      }
    }
  }
  return operations;
}

function normalizePath(path) {
  return path
    .replace(/\$\{([A-Za-z_$][\w$]*)\}/g, "{$1}")
    .replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

function readRegisteredRoutes(source) {
  const routes = [];
  const addRoute = (method, path) => {
    routes.push({ method: method.toUpperCase(), path: normalizePath(path) });
  };

  // Ordinary literal and array-form Express registrations.
  for (const match of source.matchAll(
    /router\.(get|put|post|patch|delete)\s*\(\s*["']([^"']+)["']/g,
  )) {
    addRoute(match[1], match[2]);
  }
  for (const match of source.matchAll(
    /router\.(get|put|post|patch|delete)\s*\(\s*\[([^\]]+)\]/g,
  )) {
    for (const path of match[2].matchAll(/["']([^"']+)["']/g)) {
      addRoute(match[1], path[1]);
    }
  }
  for (const match of source.matchAll(
    /router\.(get|put|post|patch|delete)\s*\(\s*`([^`]+)`/g,
  )) {
    addRoute(match[1], match[2]);
  }

  // The operational-profile router intentionally registers GET and PUT from a
  // method loop; expand it so both operations remain covered by this check.
  for (const match of source.matchAll(
    /for\s*\(const\s+method\s+of\s*\[([^\]]+)\][\s\S]{0,300}?router\[method\]\(\s*["']([^"']+)["']/g,
  )) {
    const path = match[2];
    for (const method of match[1].matchAll(/["'](get|put|post|patch|delete)["']/g)) {
      addRoute(method[1], path);
    }
  }

  // Training-packet review actions share one template registration. Expand
  // its action values to compare each documented operation independently.
  const actionValues = [...source.matchAll(
    /for\s*\(const\s+action\s+of\s*\[([^\]]+)\]/g,
  )].flatMap((match) =>
    [...match[1].matchAll(/["']([^"']+)["']/g)].map((value) => value[1]),
  );
  for (const match of source.matchAll(
    /router\.(get|put|post|patch|delete)\s*\(\s*`([^`]+)`/g,
  )) {
    for (const action of actionValues) {
      addRoute(match[1], match[2].replaceAll("${action}", action));
    }
  }

  return routes;
}

const openApiOperations = readOpenApiOperations(openApi);

for (const [operationId, routeFile] of selectedRoutes) {
  test(`server route for ${operationId} matches OpenAPI`, () => {
    const operation = openApiOperations.get(operationId);
    assert.ok(
      operation,
      `OpenAPI no longer defines selected operation "${operationId}".`,
    );

    const routeSource = readFileSync(
      resolve(repoRoot, "artifacts/api-server/src/routes", routeFile),
      "utf8",
    );
    const registeredRoutes = readRegisteredRoutes(routeSource);
    const expectedPath = normalizePath(operation.path);
    const matchingPath = registeredRoutes.filter(
      (route) => route.path === expectedPath,
    );
    assert.ok(
      matchingPath.some((route) => route.method === operation.method),
      `${operationId} server route drift: OpenAPI defines ${operation.method} ${operation.path}, but ${routeFile} registers ${matchingPath.map((route) => `${route.method} ${route.path}`).join(", ") || "no route at that path"}.`,
    );
  });
}
