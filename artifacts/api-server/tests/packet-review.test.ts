import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import pg from "pg";
import express, { type RequestHandler } from "express";
import { createAgencyPacketStore, PacketError } from "../src/lib/agency-packet-store.js";
import { createTrainingPacketsRouter } from "../src/routes/training-packets.js";
import { hashUserIdentifier as hash } from "../src/utils/cryptoUtils.js";
import type { AgencyIdentity } from "../src/security/agencyIdentity.js";
import { CompletePacketsEnvelope } from "../src/lib/packet-contract.js";
import {createPacketReviewStore} from "../src/lib/packet-review-store.js";
import {
  AcknowledgeTrainingPacketBody,
  AcknowledgeTrainingPacketResponse,
  ListTrainingPacketsResponse,
  ReleaseTrainingPacketBody,
  ReleaseTrainingPacketResponse,
  WithdrawTrainingPacketBody,
  WithdrawTrainingPacketResponse,
} from "@workspace/api-zod";

const coordinator: AgencyIdentity = { id: "coordinator", badge: "10", role: "FTO_COORDINATOR" };
const po: AgencyIdentity = { id: "po", badge: "20", role: "PO" };
const fto: AgencyIdentity = { id: "fto", badge: "30", role: "FTO" };
const otherFto: AgencyIdentity = { id: "other-fto", badge: "31", role: "FTO" };
const classStaff: AgencyIdentity = { id: "class-staff", badge: "40", role: "FTO_COC" };
const audit = () => ({ requestId: randomUUID(), clientIp: "192.0.2.1" });
const contentHash = (report: unknown) => createHash("sha256").update(JSON.stringify(report)).digest("hex");
const change = (report: unknown) => ({ operation_id: randomUUID(), content_hash: contentHash(report), review_confirmed: true });
const denied = (code: string) => (error: unknown) => error instanceof PacketError && error.code === code;

const packetReviewValidators = [
  {
    action: "release",
    schemaName: "TrainingPacketReviewInput",
    validator: ReleaseTrainingPacketBody,
  },
  {
    action: "acknowledge",
    schemaName: "TrainingPacketAcknowledgmentInput",
    validator: AcknowledgeTrainingPacketBody,
  },
  {
    action: "withdraw",
    schemaName: "TrainingPacketWithdrawalInput",
    validator: WithdrawTrainingPacketBody,
  },
] as const;

const packetReviewResponseValidators = [
  { action: "release", schemaName: "TrainingPacketsEnvelope", validator: ReleaseTrainingPacketResponse },
  { action: "acknowledge", schemaName: "TrainingPacketsEnvelope", validator: AcknowledgeTrainingPacketResponse },
  { action: "withdraw", schemaName: "TrainingPacketsEnvelope", validator: WithdrawTrainingPacketResponse },
] as const;

type OpenApiProperty = {
  type?: string;
  format?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  enum?: (string | number | boolean)[];
};

function readOpenApiPacketReviewResponseSchema(action: string, schemaName: string) {
  const openApi = readFileSync(new URL("../../../lib/api-spec/openapi.yaml", import.meta.url), "utf8");
  const lines = openApi.split(/\r?\n/);
  const path = `/v1/training-packets/{id}/${action}`;
  const pathIndex = lines.findIndex(line => line === `  ${path}:`);
  assert.ok(pathIndex >= 0, `Packet ${action} action (${schemaName}): OpenAPI path ${path} is missing.`);
  const nextPathIndex = lines.findIndex((line, index) => index > pathIndex && /^  \//.test(line));
  const pathLines = lines.slice(pathIndex + 1, nextPathIndex < 0 ? lines.length : nextPathIndex);
  const responseStart = pathLines.findIndex(line => /^\s*"200":/.test(line));
  assert.ok(responseStart >= 0, `Packet ${action} action (${schemaName}): OpenAPI 200 response is missing.`);
  const responseEnd = pathLines.findIndex((line, index) => index > responseStart && /^\s*default:/.test(line));
  const responseLines = pathLines.slice(responseStart, responseEnd < 0 ? undefined : responseEnd);
  const responseSchema = responseLines
    .map(line => line.match(/^\s*schema:\s*\{\s*\$ref:\s*["']#\/components\/schemas\/([^"']+)["']\s*\}/)?.[1])
    .find(Boolean);
  assert.equal(responseSchema, schemaName,
    `Packet ${action} action (${schemaName}): OpenAPI 200 response references ${responseSchema ?? "no schema"}.`);
  return { lines };
}

function parseOpenApiObjectLines(
  lines: string[],
  schemaName: string,
  indent: number,
  label = schemaName,
) {
  const pad = " ".repeat(indent);
  const requiredLine = lines.find(line => line.startsWith(`${pad}required:`));
  assert.ok(requiredLine, `${label}: OpenAPI object has no required list.`);
  const required = requiredLine.match(/\[([^\]]*)\]/)?.[1]
    .split(",").map(field => field.trim()).filter(Boolean) ?? [];
  const propertiesIndex = lines.findIndex(line => line === `${pad}properties:`);
  assert.ok(propertiesIndex >= 0, `${label}: OpenAPI object has no properties.`);
  const propertyIndent = indent + 2;
  const propertyPad = " ".repeat(propertyIndent);
  const propertyLines = lines.slice(propertiesIndex + 1);
  const properties = propertyLines
    .map(line => line.match(new RegExp(`^${propertyPad}([A-Za-z0-9_]+):`))?.[1])
    .filter((field): field is string => Boolean(field));
  const additionalProperties = lines.find(line => line.startsWith(`${pad}additionalProperties:`))?.trim();
  const nullable = properties.filter(field => {
    const propertyIndex = propertyLines.findIndex(line =>
      line.match(new RegExp(`^${propertyPad}([A-Za-z0-9_]+):`))?.[1] === field);
    const nextPropertyIndex = propertyLines.findIndex((line, index) =>
      index > propertyIndex && new RegExp(`^${propertyPad}[A-Za-z0-9_]+:`).test(line));
    const definitionLines = propertyLines.slice(propertyIndex,
      nextPropertyIndex < 0 ? undefined : nextPropertyIndex);
    const declaration = definitionLines[0] ?? "";
    const nullableType = /\btype:\s*\[\s*["']?[^,\]]+["']?,\s*["']null["']?\s*\]/.test(declaration);
    const oneOfIsNullable = definitionLines.some(line =>
      line === `${propertyPad}  oneOf:`) &&
      definitionLines.some(line => /\{\s*type:\s*["']null["']\s*\}/.test(line));
    return nullableType || oneOfIsNullable;
  });
  return { required, properties, additionalProperties, nullable };
}

function readOpenApiComponent(lines: string[], schemaName: string, label: string) {
  const schemaIndex = lines.findIndex(line => line === `    ${schemaName}:`);
  assert.ok(schemaIndex >= 0, `${label}: OpenAPI component ${schemaName} is missing.`);
  const nextSchemaIndex = lines.findIndex((line, index) =>
    index > schemaIndex && /^    [A-Z][A-Za-z0-9]+:\s*$/.test(line));
  const schemaLines = lines.slice(schemaIndex + 1, nextSchemaIndex < 0 ? lines.length : nextSchemaIndex);
  return parseOpenApiObjectLines(schemaLines, schemaName, 6, `${label}; ${schemaName}`);
}

function readOpenApiInlineObject(
  lines: string[],
  parentSchema: string,
  propertyName: string,
  label: string,
) {
  const schemaIndex = lines.findIndex(line => line === `    ${parentSchema}:`);
  assert.ok(schemaIndex >= 0, `${label}: OpenAPI component ${parentSchema} is missing.`);
  const nextSchemaIndex = lines.findIndex((line, index) =>
    index > schemaIndex && /^    [A-Z][A-Za-z0-9]+:\s*$/.test(line));
  const schemaLines = lines.slice(schemaIndex + 1, nextSchemaIndex < 0 ? lines.length : nextSchemaIndex);
  const propertyIndex = schemaLines.findIndex(line => line === `        ${propertyName}:`);
  assert.ok(propertyIndex >= 0, `${label}: OpenAPI ${parentSchema}.${propertyName} object is missing.`);
  const nextPropertyIndex = schemaLines.findIndex((line, index) =>
    index > propertyIndex && /^        [A-Za-z0-9_]+:/.test(line));
  return parseOpenApiObjectLines(
    schemaLines.slice(propertyIndex, nextPropertyIndex < 0 ? undefined : nextPropertyIndex),
    `${parentSchema}.${propertyName}`,
    10,
    label,
  );
}

function readOpenApiPacketReviewBodySchema(action: string, schemaName: string) {
  const openApi = readFileSync(new URL("../../../lib/api-spec/openapi.yaml", import.meta.url), "utf8");
  const lines = openApi.split(/\r?\n/);
  const path = `/v1/training-packets/{id}/${action}`;
  const pathIndex = lines.findIndex(line => line === `  ${path}:`);
  assert.ok(pathIndex >= 0, `Packet ${action} action (${schemaName}): OpenAPI path ${path} is missing.`);
  const nextPathIndex = lines.findIndex((line, index) => index > pathIndex && /^  \//.test(line));
  const pathLines = lines.slice(pathIndex + 1, nextPathIndex < 0 ? lines.length : nextPathIndex);
  const requestBodyType = pathLines
    .map(line => line.match(/^\s*schema:\s*\{\s*\$ref:\s*["']#\/components\/schemas\/([^"']+)["']\s*\}/)?.[1])
    .find(Boolean);
  assert.equal(requestBodyType, schemaName,
    `Packet ${action} action (${schemaName}): OpenAPI request body references ${requestBodyType ?? "no schema"}.`);

  const schemaIndex = lines.findIndex(line => line === `    ${schemaName}:`);
  assert.ok(schemaIndex >= 0, `Packet ${action} action (${schemaName}): OpenAPI component is missing.`);
  const nextSchemaIndex = lines.findIndex((line, index) =>
    index > schemaIndex && /^    [A-Z][A-Za-z0-9]+:\s*$/.test(line));
  const schemaLines = lines.slice(schemaIndex + 1, nextSchemaIndex < 0 ? lines.length : nextSchemaIndex);
  const requiredLine = schemaLines.find(line => /^      required:\s*\[/.test(line));
  assert.ok(requiredLine, `Packet ${action} action (${schemaName}): OpenAPI required list is missing.`);
  const required = requiredLine.match(/\[([^\]]*)\]/)?.[1]
    .split(",").map(field => field.trim()).filter(Boolean) ?? [];
  const propertiesIndex = schemaLines.findIndex(line => line === "      properties:");
  assert.ok(propertiesIndex >= 0, `Packet ${action} action (${schemaName}): OpenAPI properties are missing.`);
  const properties: Record<string, OpenApiProperty> = {};
  for (const line of schemaLines.slice(propertiesIndex + 1)) {
    const propertyMatch = line.match(/^        ([A-Za-z0-9_]+): \{ (.*) \}$/);
    if (!propertyMatch) continue;
    const [, name, definition] = propertyMatch;
    const property: OpenApiProperty = {};
    const type = definition.match(/\btype:\s*(string|boolean|integer|number)\b/)?.[1];
    const format = definition.match(/\bformat:\s*([A-Za-z0-9_-]+)\b/)?.[1];
    const pattern = definition.match(/\bpattern:\s*"([^"]*)"/)?.[1];
    const minLength = definition.match(/\bminLength:\s*(\d+)/)?.[1];
    const maxLength = definition.match(/\bmaxLength:\s*(\d+)/)?.[1];
    const enumText = definition.match(/\benum:\s*\[([^\]]*)\]/)?.[1];
    if (type) property.type = type;
    if (format) property.format = format;
    if (pattern) property.pattern = pattern;
    if (minLength) property.minLength = Number(minLength);
    if (maxLength) property.maxLength = Number(maxLength);
    if (enumText !== undefined) {
      property.enum = enumText.split(",").map(value => {
        const trimmed = value.trim();
        if (trimmed === "true") return true;
        if (trimmed === "false") return false;
        if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
        return trimmed.replace(/^['"]|['"]$/g, "");
      });
    }
    properties[name] = property;
  }
  const additionalProperties = schemaLines.find(line => /^      additionalProperties:/.test(line));
  return { required, properties, additionalProperties };
}

function validReviewPropertyValue(property: OpenApiProperty): string | number | boolean {
  if (property.type === "boolean") return property.enum?.[0] === true ? true : false;
  if (property.type === "string") {
    if (property.format === "uuid") return randomUUID();
    if (property.pattern === "^[a-f0-9]{64}$") return "a".repeat(64);
    assert.equal(property.pattern, undefined, `No valid sample is defined for OpenAPI pattern ${property.pattern}.`);
    assert.equal(property.format, undefined, `No valid sample is defined for OpenAPI format ${property.format}.`);
    return "x".repeat(Math.max(1, property.minLength ?? 1));
  }
  assert.fail(`No valid sample is defined for OpenAPI type ${property.type ?? "missing"}.`);
}

function assertObjectMatchesOpenApi(
  label: string,
  openApi: ReturnType<typeof readOpenApiComponent>,
  schema: { shape: Record<string, { safeParse(value: unknown): { success: boolean; data?: unknown } }> },
) {
  const validatorFields = Object.keys(schema.shape).sort();
  const openApiFields = [...openApi.properties].sort();
  assert.deepEqual(validatorFields, openApiFields, `${label}: server validator properties differ from OpenAPI.`);
  const required = validatorFields.filter(field => !schema.shape[field].safeParse(undefined).success).sort();
  assert.deepEqual(required, [...openApi.required].sort(), `${label}: required fields differ from OpenAPI.`);
  const nullable = validatorFields.filter(field => {
    const result = schema.shape[field].safeParse(null);
    return result.success && result.data === null;
  }).sort();
  assert.deepEqual(nullable, [...openApi.nullable].sort(), `${label}: nullable fields differ from OpenAPI.`);
}

function packetReviewResponseFixture() {
  return {
    status: "success",
    metadata: { total_records: 1, role: "FTO_COORDINATOR" },
    data: [{
      id: "packet-1",
      assignment_id: randomUUID(),
      record_date: "2026-11-25",
      phase: 1,
      server_version: 1,
      sync_status: "submitted_complete",
      handoff_status: "awaiting_coordinator_receipt",
      po_totals: null,
      report: {
        operationalIdentity: {
          assignmentToken: "1234D", districtToken: "1234", cadUnit: "1234D", company: "D",
        },
        id: "report-1",
        date: "2026-11-25",
        phase: 1,
        className: "",
        recruitName: "Recruit",
        recruitBadge: "20",
        ftoName: "FTO",
        ftoBadge: "30",
        runs: [],
        activity: {},
        reportingForDuty: {},
        ratings: {},
        status: "draft",
        narrative: "",
        remedial: "",
        recruitComments: "",
      },
      content_hash: "a".repeat(64),
      released_to_po: false,
      released_at: null,
      withdrawn_at: null,
      withdrawal_reason: null,
      acknowledgment: null,
      amendment_of: null,
      amendment_reason: null,
    }],
  };
}

test("packet-review server validators match OpenAPI request schemas", async t => {
  for (const { action, schemaName, validator } of packetReviewValidators) {
    await t.test(`${action} (${schemaName})`, () => {
      const openApi = readOpenApiPacketReviewBodySchema(action, schemaName);
      const label = `Packet ${action} action (${schemaName})`;
      const validatorFields = Object.keys(validator.shape).sort();
      const openApiFields = Object.keys(openApi.properties).sort();
      assert.deepEqual(validatorFields, openApiFields, `${label}: generated validator properties differ from OpenAPI.`);
      assert.deepEqual(openApi.required.filter(field => !openApiFields.includes(field)), [],
        `${label}: OpenAPI requires a property that is not declared.`);
      assert.equal(openApi.additionalProperties?.trim(), "additionalProperties: false",
        `${label}: OpenAPI must reject undeclared body properties.`);

      const validBody = Object.fromEntries(openApiFields.map(field =>
        [field, validReviewPropertyValue(openApi.properties[field])]));
      assert.equal(validator.safeParse(validBody).success, true,
        `${label}: generated validator rejected a body allowed by OpenAPI.`);

      for (const field of openApiFields) {
        const property = openApi.properties[field];
        const missingFieldBody = { ...validBody };
        delete missingFieldBody[field];
        assert.equal(validator.safeParse(missingFieldBody).success, !openApi.required.includes(field),
          `${label}: required-field behavior differs for "${field}".`);

        const invalidValue = property.type === "string" ? 42 : "not-a-boolean";
        assert.equal(validator.safeParse({ ...validBody, [field]: invalidValue }).success, false,
          `${label}: generated validator accepts the wrong type for "${field}".`);
        if (property.format === "uuid") {
          assert.equal(validator.safeParse({ ...validBody, [field]: "not-a-uuid" }).success, false,
            `${label}: generated validator does not enforce UUID format for "${field}".`);
        }
        if (property.pattern) {
          assert.equal(validator.safeParse({ ...validBody, [field]: `${validBody[field]}!` }).success, false,
            `${label}: generated validator does not enforce the OpenAPI pattern for "${field}".`);
        }
        if (property.enum) {
          assert.equal(validator.safeParse({ ...validBody, [field]: property.enum[0] === true ? false : "not-allowed" }).success,
            false, `${label}: generated validator does not enforce the OpenAPI enum for "${field}".`);
        }
        if (property.minLength) {
          assert.equal(validator.safeParse({ ...validBody, [field]: "" }).success, false,
            `${label}: generated validator does not enforce minLength for "${field}".`);
        }
        if (property.maxLength) {
          assert.equal(validator.safeParse({ ...validBody, [field]: "x".repeat(property.maxLength + 1) }).success, false,
            `${label}: generated validator does not enforce maxLength for "${field}".`);
        }
      }

      assert.equal(validator.strict().safeParse({ ...validBody, forged_review_state: true }).success, false,
        `${label}: generated validator must reject unknown properties.`);
    });
  }
});

test("packet-review response validators match OpenAPI schemas", async t => {
  const responseSchema = CompletePacketsEnvelope;
  const responseData = responseSchema.shape.data.element;
  const reportSchema = responseData.shape.report.unwrap();
  const identitySchema = reportSchema.shape.operationalIdentity.unwrap();
  const acknowledgmentSchema = responseData.shape.acknowledgment.unwrap();
  const componentSchemas = [
    ["TrainingPacketsEnvelope", responseSchema],
    ["TrainingPacketRecord", responseData],
    ["TrainingPacketReport", reportSchema],
    ["OperationalIdentity", identitySchema],
    ["TrainingPacketAcknowledgment", acknowledgmentSchema],
  ] as const;

  for (const { action, schemaName, validator } of packetReviewResponseValidators) {
    await t.test(`${action} (${schemaName})`, async () => {
      const { lines } = readOpenApiPacketReviewResponseSchema(action, schemaName);
      assert.deepEqual(
        Object.keys(validator.shape).sort(),
        Object.keys(ListTrainingPacketsResponse.shape).sort(),
        `Packet ${action} action (${schemaName}): generated response schema differs from the server response shape.`,
      );

      for (const [componentName, serverSchema] of componentSchemas) {
        const openApi = readOpenApiComponent(
          lines,
          componentName,
          `Packet ${action} action (${schemaName})`,
        );
        assertObjectMatchesOpenApi(
          `Packet ${action} action (${schemaName}; ${componentName})`,
          openApi,
          serverSchema,
        );
        const expectedAdditionalProperties = componentName === "TrainingPacketReport"
          ? "additionalProperties: true"
          : "additionalProperties: false";
        assert.equal(openApi.additionalProperties, expectedAdditionalProperties,
          `Packet ${action} action (${schemaName}; ${componentName}): OpenAPI unknown-field policy changed.`);
      }
      const metadataOpenApi = readOpenApiInlineObject(
        lines,
        "TrainingPacketsEnvelope",
        "metadata",
        `Packet ${action} action (${schemaName})`,
      );
      assertObjectMatchesOpenApi(
        `Packet ${action} action (${schemaName}; TrainingPacketsEnvelope.metadata)`,
        metadataOpenApi,
        responseSchema.shape.metadata,
      );
      assert.equal(metadataOpenApi.additionalProperties, "additionalProperties: false",
        `Packet ${action} action (${schemaName}; TrainingPacketsEnvelope.metadata): OpenAPI must reject unknown fields.`);

      const envelope = packetReviewResponseFixture();
      const validResult = responseSchema.safeParse(envelope);
      assert.equal(validResult.success, true,
        `Packet ${action} action (${schemaName}): server validator rejected the OpenAPI-valid response: ${
          validResult.success ? "" : JSON.stringify(validResult.error.issues)}`);
      assert.equal(responseSchema.safeParse({ ...envelope, unexpected: true }).success, false,
        `Packet ${action} action (${schemaName}; TrainingPacketsEnvelope): server must reject unknown fields.`);
      assert.equal(responseSchema.safeParse({
        ...envelope,
        metadata: { ...envelope.metadata, unexpected: true },
      }).success, false,
      `Packet ${action} action (${schemaName}; TrainingPacketsEnvelope.metadata): server must reject unknown fields.`);

      const record = envelope.data[0];
      assert.equal(responseSchema.safeParse({
        ...envelope,
        data: [{ ...record, unexpected: true }],
      }).success, false,
      `Packet ${action} action (${schemaName}; TrainingPacketRecord): server must reject unknown fields.`);
      const reportExtension = responseSchema.safeParse({
        ...envelope,
        data: [{ ...record, report: { ...record.report, openReportExtension: true } }],
      });
      assert.equal(reportExtension.success, true,
        `Packet ${action} action (${schemaName}; TrainingPacketReport): server must preserve OpenAPI extensions.`);
      if (reportExtension.success) {
        assert.equal(reportExtension.data.data[0]?.report.openReportExtension, true,
          `Packet ${action} action (${schemaName}; TrainingPacketReport): server must retain extension fields.`);
      }
      assert.equal(responseSchema.safeParse({
        ...envelope,
        data: [{
          ...record,
          report: {
            ...record.report,
            operationalIdentity: { ...record.report.operationalIdentity, unexpected: true },
          },
        }],
      }).success, false,
      `Packet ${action} action (${schemaName}; OperationalIdentity): server must reject unknown fields.`);
      const acknowledged = {
        ...record,
        acknowledgment: {
          acknowledged_at: new Date().toISOString(),
          content_hash: "b".repeat(64),
          comments: "",
        },
      };
      assert.equal(responseSchema.safeParse({
        ...envelope,
        data: [{ ...acknowledged, acknowledgment: { ...acknowledged.acknowledgment, unexpected: true } }],
      }).success, false,
      `Packet ${action} action (${schemaName}; TrainingPacketAcknowledgment): server must reject unknown fields.`);
    });
  }
});

// Isolated, disposable PostgreSQL exercises actual constraints, SQL scopes,
// transactions and concurrent requests, without touching either project DB.
test("packet review authorization, immutable amendments, audit and concurrent transitions", async t => {
  const dir = mkdtempSync(join(tmpdir(), "packet-review-"));
  const dataDir = join(dir, "data");
  const port = 55438;
  let started = false;
  let pool: pg.Pool | undefined;
  try {
    execFileSync("initdb", ["-D", dataDir, "-U", "packet_test", "-A", "trust", "--no-locale"], { stdio: "pipe" });
    execFileSync("pg_ctl", ["-D", dataDir, "-l", join(dir, "postgres.log"), "-o",
      `-k ${dir} -h '' -p ${port} -F`, "-w", "start"], { stdio: "pipe" });
    started = true;
    pool = new pg.Pool({ host: dir, port, user: "packet_test", database: "postgres", max: 6 });
    await pool.query(readFileSync(new URL("../migrations/agency-training.sql", import.meta.url), "utf8"));
    await pool.query(readFileSync(new URL("../migrations/agency-training-packet-review.sql", import.meta.url), "utf8"));
    await pool.query(readFileSync(new URL("../migrations/agency-training-po-totals-review-upgrade.sql", import.meta.url), "utf8"));
    await pool.query(readFileSync(new URL("../migrations/agency-training-staff-class-access.sql", import.meta.url), "utf8"));
    await pool.query(readFileSync(new URL("../migrations/agency-training-packet-guards.sql", import.meta.url), "utf8"));
    const db = pool;
    const store = createAgencyPacketStore(db);
    const finalizeDraft = async (identity: typeof fto, packetId: string, packetStore = store) => {
      const draft = (await packetStore.read(identity, audit(), packetId))[0];
      assert.ok(draft);
      return packetStore.finalize(identity, audit(), packetId, {
        operation_id: randomUUID(), base_version: draft.server_version, content_hash: draft.content_hash,
      });
    };
    const assignment = randomUUID();
    const otherAssignment = randomUUID();
    const seedAssignment = async (id: string, className: string, coordinatorId: string,assignedPo=po,assignedFto=fto) => db.query(
      `INSERT INTO agency_training.assignments
       (id,class_name,phase,fto_id_hash,fto_badge_hash,fto_name,po_id_hash,po_badge_hash,po_name,
         coordinator_id_hash,starts_on,ends_on,fto_id,fto_badge,po_id,po_badge,coordinator_id)
         VALUES ($1,$2,1,$3,$4,'Synthetic FTO',$5,$6,'Synthetic PO',$7,'2026-01-01','2026-12-31',$8,$9,$10,$11,$12)`,
      [id, className, hash(assignedFto.id), hash(assignedFto.badge), hash(assignedPo.id), hash(assignedPo.badge), hash(coordinatorId),
         assignedFto.id,assignedFto.badge,assignedPo.id,assignedPo.badge,coordinatorId],
    );
    const sameClassPo={...po,id:"same-class-po",badge:"21"};
    const classBPo={...po,id:"class-b-po",badge:"22"};
    await seedAssignment(assignment, "Class A", coordinator.id);
    await seedAssignment(randomUUID(), "Class A", "same-class-outsider",sameClassPo,otherFto);
    await seedAssignment(otherAssignment, "Class B", "another-coordinator",classBPo);
    await db.query(`INSERT INTO agency_training.staff_class_read_grants
      (identity_id_hash,identity_role,class_name) VALUES($1,$2,'Class A')`,
      [hash(classStaff.id),classStaff.role]);
    await db.query("INSERT INTO agency_training.coordinator_directory(id,name) VALUES ($1,'Test Coordinator')",[coordinator.id]);
    const assigned=createPacketReviewStore(db);
    await assigned.assign(po,{po_id:po.id,coordinator_id:coordinator.id,expected_revision:0});
    const report = { id: "original", date: "2026-11-23", phase: 1, className: "Class A",
      recruitBadge: po.badge, ftoBadge: fto.badge, recruitName: "Synthetic PO", ftoName: "Synthetic FTO",
      status: "recruit_signed", signatures: { recruit: { signed: true } }, runs: [], ratings: {},
      activity: {}, reportingForDuty: {reviewedAt:"2026-11-23T12:00:00Z"},ratingsReviewedAt:"2026-11-23T12:00:00Z",
      ratings:{buildingSearch:{rating:"UA",justification:"Synthetic own UA explanation."}},
      narrative: "", remedial: "", recruitComments: "" };
    const approve=async(content:typeof report,packetStore=store)=>{
      await finalizeDraft(fto,content.id,packetStore);
      await assert.rejects(packetStore.review(coordinator,audit(),content.id,"release",change(content)),denied("PACKET_NOT_FOUND"));
      await assert.rejects(packetStore.read(coordinator,audit(),content.id),denied("PACKET_NOT_FOUND"));
      const poSubmission=(await assigned.list(po,0)).items.find(item=>item.packet_id===content.id)!;
      assert.equal(poSubmission.handoff_status,"awaiting_po_totals_review");
      assert.deepEqual((await assigned.list(coordinator,0)).items.filter(item=>item.packet_id===content.id),[]);
      const classRecord=(await store.read(classStaff,audit(),content.id))[0];
      assert.equal(classRecord.report.narrative,content.narrative);
      const classSubmission=(await assigned.list(classStaff,0)).items.find(item=>item.packet_id===content.id)!;
      assert.equal(classSubmission.can_correct,false);
      assert.equal((await assigned.detail(classStaff,classSubmission.id)).report.narrative,content.narrative);
      await assert.rejects(store.read({...classStaff,id:"unassigned-staff"},audit(),content.id),denied("PACKET_NOT_FOUND"));
      await assert.rejects(store.review(classStaff,audit(),content.id,"release",change(content)),denied("PACKET_REVIEW_FORBIDDEN"));
      await assert.rejects(assigned.act(classStaff,classSubmission.id,
        {operation_id:randomUUID(),action:"approve",note:""}),denied("REVIEW_FORBIDDEN"));
      const poDetail=await assigned.detail(po,poSubmission.id);
      assert.equal(poDetail.report,null);
      assert.ok(poDetail.po_totals);
      assert.deepEqual(poDetail.po_totals?.unacceptable_details,[{
        record_date:"2026-11-23",category_key:"buildingSearch",rating:"UA",
        justification:"Synthetic own UA explanation.",
      }]);
      assert.equal(JSON.stringify(poDetail).includes("private report"),false);
      await assert.rejects(assigned.detail({...po,id:"other-po"},poSubmission.id),denied("SUBMISSION_NOT_FOUND"));
      await assert.rejects(assigned.act(coordinator,poSubmission.id,
        {operation_id:randomUUID(),action:"review_totals",note:""}),denied("REVIEW_FORBIDDEN"));
      const poReview={operation_id:randomUUID(),action:"review_totals" as const,note:""};
      await assigned.act(po,poSubmission.id,poReview);
      await assigned.act(po,poSubmission.id,poReview);
      assert.equal((await db.query(`SELECT count(*)::int n FROM agency_training.packet_review_events
        WHERE submission_id=$1 AND action='PO_TOTALS_REVIEWED'`,[poSubmission.id])).rows[0].n,1);
      const submission=(await assigned.list(coordinator,0)).items.find(item=>item.packet_id===content.id)!;
      assert.ok(submission.po_reviewed_at);
      await assert.rejects(packetStore.review(coordinator,audit(),content.id,"release",change(content)),denied("PACKET_APPROVAL_REQUIRED"));
      await assigned.act(coordinator,submission.id,{operation_id:randomUUID(),action:"acknowledge",note:""});
      await assigned.detail(coordinator,submission.id);
      await assigned.act(coordinator,submission.id,{operation_id:randomUUID(),action:"approve",note:"Reviewed"});
    };
    const upload = { operation_id: randomUUID(), base_version: 0, report };
    await store.sync(fto, audit(), [upload]);
    const review = change(report);
    await t.test("forged client signature and status do not release or acknowledge an upload", async () => {
      assert.deepEqual(await store.read(po, audit()), []);
      assert.deepEqual(await store.read(coordinator,audit()),[]);
      const record = (await store.read(fto, audit(), report.id))[0];
      assert.equal(record.released_to_po, false);
      assert.equal(record.acknowledgment, null);
      assert.equal(record.content_hash, review.content_hash);
      CompletePacketsEnvelope.parse({ status: "success", metadata: { total_records: 1, role: coordinator.role }, data: [record] });
      await assert.rejects(store.review(fto, audit(), report.id, "release", review), denied("PACKET_REVIEW_FORBIDDEN"));
      await assert.rejects(store.review(po, audit(), report.id, "acknowledge", review), denied("PACKET_NOT_FOUND"));
    });
    await approve(report);
    await t.test("class access fails closed for another coordinator, badge, inactive assignment and class", async () => {
      await assigned.assign(sameClassPo,{po_id:sameClassPo.id,coordinator_id:coordinator.id,expected_revision:0});
      const otherReport={...report,id:"same-class-other-fto",recruitBadge:sameClassPo.badge,ftoBadge:otherFto.badge};
      await store.sync(otherFto,audit(),[{operation_id:randomUUID(),base_version:0,report:otherReport}]);
      await finalizeDraft(otherFto,otherReport.id);
      assert.equal((await store.read(fto,audit(),otherReport.id))[0].report.id,otherReport.id);
      const ftoClassView=(await assigned.list(fto,0)).items.find(item=>item.packet_id===otherReport.id)!;
      assert.equal(ftoClassView.can_correct,false);
      await assigned.assign(classBPo,{po_id:classBPo.id,coordinator_id:coordinator.id,expected_revision:0});
      const classBReport={...report,id:"other-class-record",className:"Class B",recruitBadge:classBPo.badge};
      await store.sync(fto,audit(),[{operation_id:randomUUID(),base_version:0,report:classBReport}]);
      await finalizeDraft(fto,classBReport.id);
      await assert.rejects(store.read(classStaff,audit(),classBReport.id),denied("PACKET_NOT_FOUND"));
      const submission=(await assigned.list(coordinator,0)).items.find(item=>item.packet_id===report.id)!;
      await assert.rejects(assigned.act(fto,submission.id,{operation_id:randomUUID(),action:"acknowledge",note:""}),denied("REVIEW_FORBIDDEN"));
      await assert.rejects(assigned.act({...coordinator,id:"another-coordinator"},submission.id,
        {operation_id:randomUUID(),action:"acknowledge",note:""}),denied("SUBMISSION_NOT_FOUND"));
      await assert.rejects(store.review({ ...coordinator, id: "outsider" }, audit(), report.id, "release", review), denied("PACKET_NOT_FOUND"));
      await assert.rejects(store.read({...coordinator,id:"same-class-outsider"},audit(),report.id),denied("PACKET_NOT_FOUND"));
      await db.query("UPDATE agency_training.packet_assignments SET active=false WHERE packet_id=$1", [report.id]);
      await assert.rejects(store.review(coordinator, audit(), report.id, "release", review), denied("PACKET_NOT_FOUND"));
      await db.query("UPDATE agency_training.packet_assignments SET active=true WHERE packet_id=$1", [report.id]);
      const other = { ...report, id: "other-class", className: "Class B",recruitBadge:"22" };
      await store.sync(fto, audit(), [{ ...upload, operation_id: randomUUID(), report: other }]);
      await assert.rejects(store.review(coordinator, audit(), other.id, "release", change(other)), denied("PACKET_NOT_FOUND"));
    });
    await t.test("approval remains distinct from PO release and acknowledgment in both APIs", async () => {
      const submission=()=>assigned.list(coordinator,0).then(page=>page.items.find(item=>item.packet_id===report.id)!);
      const approved=await submission();
      assert.equal(approved.state,"approved");
      assert.equal(approved.handoff_status,"awaiting_po_release");
      assert.equal(approved.released_at,null);
      assert.equal(approved.po_acknowledged_at,null);
      await assert.rejects(store.read(po,audit(),report.id),denied("PACKET_NOT_FOUND"));
      assert.equal((await store.read(coordinator,audit(),report.id))[0].handoff_status,"awaiting_po_release");
    });
    await t.test("release requires explicit exact-snapshot review and retries create just one audit event", async () => {
      await assert.rejects(store.review(coordinator, audit(), report.id, "release", { ...review, review_confirmed: false }), denied("PACKET_REVIEW_REQUIRED"));
      await assert.rejects(store.review(coordinator, audit(), report.id, "release", { ...review, content_hash: "f".repeat(64) }), denied("PACKET_SNAPSHOT_CONFLICT"));
      const release=change(report);
      await store.review(coordinator, audit(), report.id, "release", release);
      await store.review(coordinator, audit(), report.id, "release", release);
      assert.equal((await db.query("SELECT count(*)::int n FROM agency_training.packet_events WHERE event_type='RELEASE'")).rows[0].n, 1);
      const released=(await store.read(po,audit(),report.id))[0];
      assert.equal(released.released_to_po,true);
      assert.equal(released.handoff_status,"awaiting_po_acknowledgment");
      assert.equal(released.report,null);
      assert.ok(released.po_totals);
      assert.deepEqual(released.po_totals.unacceptable_details,[{
        record_date:"2026-11-23",category_key:"buildingSearch",rating:"UA",
        justification:"Synthetic own UA explanation.",
      }]);
      assert.equal(JSON.stringify(released).includes("narrative"),false);
      const submission=(await assigned.list(coordinator,0)).items.find(item=>item.packet_id===report.id)!;
      assert.equal(submission.handoff_status,"awaiting_po_acknowledgment");
      assert.ok(submission.released_at);
      assert.equal(submission.po_acknowledged_at,null);
      await assert.rejects(store.read({ ...po, badge: "wrong" }, audit(), report.id), denied("PACKET_NOT_FOUND"));
      await assert.rejects(store.read({ ...po, id: "another-po" }, audit(), report.id), denied("PACKET_NOT_FOUND"));
    });
    await t.test("PO acknowledgment is server-authored, exact-once and bound to the released content", async () => {
      const ack = { ...change(report), comments: "Reviewed, not agreement." };
      const result = await store.review(po, audit(), report.id, "acknowledge", ack);
      assert.equal(result[0].report,null);
      assert.ok(result[0].po_totals);
      assert.equal(result[0].po_totals?.unacceptable_details[0]?.justification,"Synthetic own UA explanation.");
      assert.equal(result[0].acknowledgment.comments, ack.comments);
      assert.equal(result[0].acknowledgment.content_hash, review.content_hash);
      await store.review(po, audit(), report.id, "acknowledge", ack);
      const submission=(await assigned.list(coordinator,0)).items.find(item=>item.packet_id===report.id)!;
      assert.equal(submission.handoff_status,"po_acknowledged");
      assert.ok(submission.po_acknowledged_at);
      assert.equal((await store.read(po,audit(),report.id))[0].handoff_status,"po_acknowledged");
      await assert.rejects(store.review(po, audit(), report.id, "acknowledge", { ...ack, comments: "Changed" }), denied("PACKET_OPERATION_CONFLICT"));
      await assert.rejects(store.review(po, audit(), report.id, "acknowledge", change(report)), denied("PACKET_ALREADY_ACKNOWLEDGED"));
      const events = await db.query("SELECT * FROM agency_training.packet_events WHERE event_type='ACKNOWLEDGE'");
      assert.equal(events.rows.length, 1);
      assert.equal(events.rows[0].actor_hash, hash(po.id));
      assert.equal(events.rows[0].content_hash, review.content_hash);
    });
    await t.test("correction requests are visible, reasoned, retry-safe and require fresh receipt", async () => {
      const correction={...report,id:"correction-return"};
      await store.sync(fto,audit(),[{...upload,operation_id:randomUUID(),report:correction}]);
      await finalizeDraft(fto,correction.id);
      const initialPo=(await assigned.list(po,0)).items.find(item=>item.packet_id===correction.id)!;
      await assigned.detail(po,initialPo.id);
      await assigned.act(po,initialPo.id,{operation_id:randomUUID(),action:"review_totals",note:""});
      const first=(await assigned.list(coordinator,0)).items.find(item=>item.packet_id===correction.id)!;
      await assigned.act(coordinator,first.id,{operation_id:randomUUID(),action:"acknowledge",note:""});
      await assigned.detail(coordinator,first.id);
      const operation_id=randomUUID();
      const returned=await assigned.act(coordinator,first.id,{operation_id,action:"return",note:"Correct the narrative."});
      assert.equal(returned.state,"correction_requested");
      assert.equal(returned.handoff_status,"correction_requested");
      const retry=await assigned.act(coordinator,first.id,{operation_id,action:"return",note:"Correct the narrative."});
      assert.equal(retry.state,"correction_requested");
      assert.equal((await assigned.detail(coordinator,first.id)).history.filter(event=>event.action==="CORRECTION_REQUESTED").length,1);

      const revised={...correction,narrative:"Corrected narrative."};
      await store.sync(fto,audit(),[{...upload,base_version:1,operation_id:randomUUID(),report:revised}]);
      await finalizeDraft(fto,revised.id);
      const nextPo=(await assigned.list(po,0)).items.find(item=>item.packet_id===revised.id)!;
      assert.equal(nextPo.handoff_status,"awaiting_po_totals_review");
      await assigned.detail(po,nextPo.id);
      await assigned.act(po,nextPo.id,{operation_id:randomUUID(),action:"review_totals",note:""});
      const next=(await assigned.list(coordinator,0)).items.find(item=>item.packet_id===revised.id)!;
      assert.equal(next.packet_version,2);
      assert.equal(next.handoff_status,"awaiting_coordinator_receipt");
      assert.equal(next.acknowledged_at,null);
      await assigned.act(coordinator,next.id,{operation_id:randomUUID(),action:"acknowledge",note:""});
      await assigned.detail(coordinator,next.id);
      const approved=await assigned.act(coordinator,next.id,{operation_id:randomUUID(),action:"approve",note:"Reviewed corrected snapshot."});
      assert.equal(approved.handoff_status,"awaiting_po_release");
      await assert.rejects(store.read(po,audit(),revised.id),denied("PACKET_NOT_FOUND"));
    });
    await t.test("withdrawal preserves history and replacements require fresh release and acknowledgment", async () => {
      await assert.rejects(store.review(coordinator, audit(), report.id, "withdraw", { ...review, reason: " " }), denied("PACKET_WITHDRAWAL_REASON_REQUIRED"));
      const withdrawal = { ...change(report), reason: "Correct the narrative." };
      await store.review(coordinator, audit(), report.id, "withdraw", withdrawal);
      await store.review(coordinator, audit(), report.id, "withdraw", withdrawal);
      await assert.rejects(store.read(po, audit(), report.id), denied("PACKET_NOT_FOUND"));
      await assert.rejects(store.review(coordinator, audit(), report.id, "release", change(report)), denied("PACKET_WITHDRAWN"));
      assert.equal((await store.read(coordinator, audit(), report.id))[0].acknowledgment.comments, "Reviewed, not agreement.");
      await assert.rejects(store.sync(fto, audit(), [{ ...upload, operation_id: randomUUID(), report: { ...report, narrative: "Overwrite" } }]), denied("PACKET_ALREADY_SUBMITTED"));
      const replacement = { ...report, id: "replacement", narrative: "Corrected" };
      const replacementUpload = { operation_id: randomUUID(), base_version: 0, report: replacement,
        amendment_of: report.id, amendment_reason: "Corrected narrative after withdrawal." };
      await store.sync(fto, audit(), [replacementUpload]);
      await store.sync(fto, audit(), [replacementUpload]);
      await approve(replacement);
      const replacementRecord = (await store.read(coordinator, audit(), replacement.id))[0];
      assert.equal(replacementRecord.released_to_po, false);
      assert.equal(replacementRecord.acknowledgment, null);
      assert.equal(replacementRecord.amendment_of, report.id);
      await assert.rejects(store.read(po, audit(), replacement.id), denied("PACKET_NOT_FOUND"));
      await store.review(coordinator, audit(), replacement.id, "release", change(replacement));
      await store.review(po, audit(), replacement.id, "acknowledge", change(replacement));
      await assert.rejects(store.sync(fto, audit(), [{ ...replacementUpload, operation_id: randomUUID(),
        report: { ...replacement, id: "second-replacement" } }]), denied("PACKET_AMENDMENT_EXISTS"));
    });
    await t.test("withdrawal racing acknowledgment never acknowledges a closed packet", async () => {
      const concurrent = { ...report, id: "concurrent" };
      await store.sync(fto, audit(), [{ ...upload, operation_id: randomUUID(), report: concurrent }]);
      await approve(concurrent);
      await store.review(coordinator, audit(), concurrent.id, "release", change(concurrent));
      const results = await Promise.allSettled([
        store.review(coordinator, audit(), concurrent.id, "withdraw", { ...change(concurrent), reason: "Correction" }),
        store.review(po, audit(), concurrent.id, "acknowledge", change(concurrent)),
      ]);
      assert.equal(results[0].status, "fulfilled");
      const state = (await store.read(coordinator, audit(), concurrent.id))[0];
      assert.equal(state.released_to_po, false);
      if (results[1].status === "fulfilled") {
        const times = await db.query(`SELECT a.acknowledged_at <= p.withdrawn_at AS valid
          FROM agency_training.packets p JOIN agency_training.packet_acknowledgments a ON a.packet_id=p.id WHERE p.id=$1`, [concurrent.id]);
        assert.equal(times.rows[0].valid, true);
      } else assert.ok(denied("PACKET_NOT_FOUND")(results[1].reason));
    });
    await t.test("audit failure rolls back release", async () => {
      const failing = { ...report, id: "audit-failure" };
      await store.sync(fto, audit(), [{ ...upload, operation_id: randomUUID(), report: failing }]);
      await approve(failing);
      await assert.rejects(store.review(coordinator, { ...audit(), requestId: "invalid-uuid" }, failing.id, "release", change(failing)));
      assert.equal((await store.read(coordinator, audit(), failing.id))[0].released_to_po, false);
    });
    await t.test("the workflow works with column-only grants and cannot rewrite snapshot content", async () => {
      await db.query(`CREATE ROLE packet_runtime LOGIN;
        GRANT USAGE ON SCHEMA agency_training TO packet_runtime;
        GRANT SELECT ON agency_training.assignments TO packet_runtime;
        GRANT SELECT ON agency_training.coordinator_directory TO packet_runtime;
        GRANT SELECT ON agency_training.staff_class_read_grants TO packet_runtime;
        GRANT SELECT,INSERT ON agency_training.po_coordinators,agency_training.packet_submissions,
          agency_training.packet_review_events,agency_training.packet_review_operations TO packet_runtime;
        GRANT UPDATE(state,reviewed_at,review_note) ON agency_training.packet_submissions TO packet_runtime;
        GRANT SELECT, INSERT ON agency_training.packets, agency_training.packet_assignments,
          agency_training.packet_acknowledgments, agency_training.packet_events TO packet_runtime;
        GRANT USAGE ON ALL SEQUENCES IN SCHEMA agency_training TO packet_runtime;
        GRANT UPDATE (report,operation_id,content_hash,server_version,submission_status,finalization_operation_id,submitted_at,
          released_to_po, released_at, released_by_hash, withdrawn_at, withdrawn_by_hash,
          withdrawal_reason) ON agency_training.packets TO packet_runtime;`);
      await db.query(`GRANT EXECUTE ON FUNCTION agency_training.lock_packet_assignment(text,text,text),
        agency_training.lock_active_packet_coordinator(text) TO packet_runtime;`);
      const limitedPool = new pg.Pool({ host: dir, port, user: "packet_runtime", database: "postgres" });
      try {
        const limited = createAgencyPacketStore(limitedPool);
        const leastPrivilege = { ...report, id: "least-privilege" };
        await limited.sync(fto, audit(), [{ ...upload, operation_id: randomUUID(), report: leastPrivilege }]);
        await approve(leastPrivilege,limited);
        await limited.review(coordinator, audit(), leastPrivilege.id, "release", change(leastPrivilege));
        await limited.review(po, audit(), leastPrivilege.id, "acknowledge", change(leastPrivilege));
        await limited.review(coordinator, audit(), leastPrivilege.id, "withdraw", { ...change(leastPrivilege), reason: "Correction" });
        await assert.rejects(limitedPool.query("UPDATE agency_training.packets SET report='{}'::jsonb WHERE id=$1", [leastPrivilege.id]));
        await assert.rejects(limitedPool.query("UPDATE agency_training.packet_submissions SET report='{}'::jsonb WHERE packet_id=$1",[leastPrivilege.id]));
        await assert.rejects(limitedPool.query("DELETE FROM agency_training.packet_events"));
        await assert.rejects(limitedPool.query("DELETE FROM agency_training.packet_acknowledgments"));
      } finally { await limitedPool.end(); }
    });
    await t.test("the upgrade preserves old content and audit entries but requires fresh release", async () => {
      await db.query("CREATE DATABASE packet_legacy");
      const legacy = new pg.Pool({ host: dir, port, user: "packet_test", database: "packet_legacy" });
      try {
        // Only the pre-existing columns touched by the additive upgrade.
        await legacy.query(`CREATE SCHEMA agency_training;
          CREATE TABLE agency_training.packets (id text PRIMARY KEY, released_to_po boolean NOT NULL DEFAULT false,
            report jsonb NOT NULL);
          CREATE TABLE agency_training.packet_events (event_type text NOT NULL
            CHECK (event_type IN ('READ','COMMIT')), occurred_at timestamptz NOT NULL DEFAULT now());
          INSERT INTO agency_training.packets VALUES ('legacy',true,'{"narrative":"Keep original"}');
          INSERT INTO agency_training.packet_events(event_type) VALUES ('COMMIT');`);
        await legacy.query(readFileSync(new URL("../migrations/agency-training-release-upgrade.sql", import.meta.url), "utf8"));
        const packet = (await legacy.query("SELECT * FROM agency_training.packets")).rows[0];
        assert.equal(packet.released_to_po, false);
        assert.deepEqual(packet.report, { narrative: "Keep original" });
        assert.equal((await legacy.query("SELECT count(*)::int n FROM agency_training.packet_events")).rows[0].n, 1);
        await legacy.query("INSERT INTO agency_training.packet_events(event_type) VALUES ('ACKNOWLEDGE')");
      } finally { await legacy.end(); }
    });
  } finally {
    await pool?.end();
    if (started) execFileSync("pg_ctl", ["-D", dataDir, "-m", "immediate", "-w", "stop"], { stdio: "pipe" });
    rmSync(dir, { recursive: true, force: true });
  }
});

test("review routes reject forged workflow fields, missing review, wrong roles, invalid IDs and unavailable storage", async () => {
  let current = coordinator;
  const authenticate: RequestHandler = (_req, res, next) => { res.locals.agencyIdentity = current; next(); };
  const app = express();
  app.use("/api", createTrainingPacketsRouter(authenticate, () => null));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const post = (action: string, body: unknown, id = "packet") => fetch(
    `http://127.0.0.1:${address.port}/api/v1/training-packets/${id}/${action}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
  try {
    const valid = { operation_id: randomUUID(), content_hash: "a".repeat(64), review_confirmed: true };
    assert.equal((await post("release", { ...valid, released_to_po: true })).status, 400);
    assert.equal((await post("release", { ...valid, signatures: { coordinator: true } })).status, 400);
    assert.equal((await post("release", { ...valid, review_confirmed: false })).status, 400);
    assert.equal((await post("release", valid, "bad%20id")).status, 400);
    assert.equal((await post("release", valid)).status, 503);
    assert.equal((await post("withdraw", { operation_id: randomUUID(), content_hash: valid.content_hash, reason: " " })).status, 400);
    assert.equal((await post("withdraw", { operation_id: randomUUID(), content_hash: valid.content_hash,
      reason: "Correction", released_to_po: true })).status, 400);
    current = po;
    assert.equal((await post("release", valid)).status, 403);
    assert.equal((await post("withdraw", valid)).status, 403);
    assert.equal((await post("acknowledge", { ...valid, actor_hash: "forged" })).status, 400);
    assert.equal((await post("acknowledge", valid)).status, 503);
    current = fto;
    assert.equal((await post("acknowledge", valid)).status, 403);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
