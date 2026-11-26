import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import express from "express";
import pg from "pg";
import { after, before, test } from "node:test";
import type { TestAdminScenarioEnvelope, TestAdminAuditEnvelope, StagingTrainingEnvelope } from "@workspace/api-zod";
import { createStagingRouter } from "./router.js";
import { StagingRepository } from "./repository.js";
import { createTestAdminRouter } from "./test-admin-router.js";
import { TestAdminRepository } from "./test-admin-repository.js";
import { hashUserIdentifier } from "../utils/cryptoUtils.js";
import type { VerifiedStagingSession } from "./access.js";

// Fictional, uniquely namespaced fixtures only. No Clerk accounts are created
// or granted roles. Cleanup removes only rows this file created.
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
const prefix = `fixture-${randomUUID()}`;
const subjects = { admin: `${prefix}-admin`, fto: `${prefix}-fto` };
const ids = { admin: randomUUID(), fto: randomUUID() };
let selected: VerifiedStagingSession | null = null;
const session = (subject: string, overrides: Partial<VerifiedStagingSession> = {}): VerifiedStagingSession => ({
  subject, sessionId: "fixture-session", recentMfa: true, agencyVerified: false, ...overrides,
});
const app = express();
app.use(express.json({ limit: "16kb" }));
app.use("/api", createStagingRouter(new StagingRepository(pool), async () => selected));
app.use("/api", createTestAdminRouter(new TestAdminRepository(pool), async () => selected));
const server = app.listen(0, "127.0.0.1");
let base = "";
const admin = "/api/v1/staging/test-admin";
const records = "/api/v1/staging/training-records";
const created = { participants: new Set<string>(), classes: new Set<string>(), assignments: new Set<string>() };
const saved = { enabled: process.env.SYNTHETIC_STAGING_ENABLED, mode: process.env.NODE_ENV, testAdmin: process.env.PORTAL_TEST_ADMIN_ENABLED };

async function call(path: string, who: VerifiedStagingSession | null, method = "GET", body?: unknown) {
  selected = who;
  const response = await fetch(`${base}${path}`, {
    method,
    // Forged browser role hints must never matter.
    headers: { "Content-Type": "application/json", "X-Role": "TEST_ADMIN", "X-Test-Admin": "true" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const data: unknown = response.headers.get("content-type")?.includes("json") ? JSON.parse(text) : text;
  return { status: response.status, data };
}
const asAdmin = () => session(subjects.admin);
function track(envelope: TestAdminScenarioEnvelope) {
  envelope.data.participants.forEach(p => created.participants.add(p.id));
  envelope.data.classes.forEach(c => created.classes.add(c.id));
  envelope.data.assignments.forEach(a => created.assignments.add(a.id));
}
const tag = (label: string) => `${label} ${prefix.slice(-8)}`;

before(async () => {
  process.env.SYNTHETIC_STAGING_ENABLED = "true";
  process.env.NODE_ENV = "test";
  process.env.PORTAL_TEST_ADMIN_ENABLED = "true";
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test listener.");
  base = `http://127.0.0.1:${address.port}`;
  await pool.query(`INSERT INTO synthetic_training.members (id,subject_hash,role,active,agency_verified,terms_accepted)
    VALUES ($1,$2,'TEST_ADMIN',true,false,true),($3,$4,'FTO',true,true,true)`,
  [ids.admin, hashUserIdentifier(subjects.admin), ids.fto, hashUserIdentifier(subjects.fto)]);
});
after(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  const assignments = [...created.assignments];
  await pool.query("DELETE FROM synthetic_training.receipts WHERE actor_hash=ANY($1::text[])", [Object.values(subjects).map(hashUserIdentifier)]);
  await pool.query("DELETE FROM synthetic_training.audit_events WHERE actor_hash=ANY($1::text[])", [Object.values(subjects).map(hashUserIdentifier)]);
  await pool.query("DELETE FROM synthetic_training.record_versions WHERE record_id IN (SELECT id FROM synthetic_training.records WHERE assignment_id=ANY($1::uuid[]))", [assignments]);
  await pool.query("DELETE FROM synthetic_training.records WHERE assignment_id=ANY($1::uuid[])", [assignments]);
  await pool.query("DELETE FROM synthetic_training.assignments WHERE id=ANY($1::uuid[]) AND fictional", [assignments]);
  await pool.query("DELETE FROM synthetic_training.classes WHERE id=ANY($1::uuid[]) AND fictional", [[...created.classes]]);
  await pool.query("DELETE FROM synthetic_training.members WHERE (id=ANY($1::uuid[]) AND fictional) OR id=ANY($2::uuid[])", [[...created.participants], Object.values(ids)]);
  await pool.end();
  for (const [key, value] of [["SYNTHETIC_STAGING_ENABLED", saved.enabled], ["NODE_ENV", saved.mode], ["PORTAL_TEST_ADMIN_ENABLED", saved.testAdmin]] as const) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

test("scenario routes fail closed without a verified test administrator", async () => {
  assert.equal((await call(`${admin}/scenario`, null)).status, 401);
  assert.equal((await call(`${admin}/scenario`, session(subjects.admin, { recentMfa: false }))).status, 401);
  // A real directory FTO (or any other role) cannot manage scenarios.
  assert.equal((await call(`${admin}/scenario`, session(subjects.fto))).status, 403);
  assert.equal((await call(`${admin}/scenario`, session(`${prefix}-unprovisioned`))).status, 403);
  // Agency-verified sessions never hold test authority.
  assert.equal((await call(`${admin}/scenario`, session(subjects.admin, { agencyVerified: true }))).status, 403);
  delete process.env.PORTAL_TEST_ADMIN_ENABLED;
  assert.equal((await call(`${admin}/scenario`, asAdmin())).status, 403);
  process.env.PORTAL_TEST_ADMIN_ENABLED = "true";
  process.env.NODE_ENV = "production";
  assert.equal((await call(`${admin}/scenario`, asAdmin())).status, 404);
  process.env.NODE_ENV = "test";
  assert.equal((await call(`${admin}/scenario`, asAdmin())).status, 200);
});

test("test administrator builds, edits and deactivates a fictional scenario with audit history", async () => {
  const people: Record<string, string> = {};
  for (const [key, role, badge] of [["coord", "FTO_COORDINATOR", "T-3301"], ["fto", "FTO", "T-2201"], ["po", "PO", "T-4101"]] as const) {
    const res = await call(`${admin}/participants`, asAdmin(), "POST", { display_label: tag(`Fixture ${key}`), badge_label: badge, role });
    assert.equal(res.status, 201);
    const envelope = res.data as TestAdminScenarioEnvelope;
    track(envelope);
    people[key] = envelope.data.participants.find(p => p.display_label === tag(`Fixture ${key}`))!.id;
  }
  // Fictional people can never sign in: they have random subject hashes and are excluded from session lookup.
  const fictional = await pool.query("SELECT subject_hash, agency_verified FROM synthetic_training.members WHERE id=$1", [people.po]);
  assert.equal(fictional.rows[0].agency_verified, false);
  assert.notEqual(fictional.rows[0].subject_hash, hashUserIdentifier(people.po));

  // Role mismatches are rejected server-side.
  assert.equal((await call(`${admin}/classes`, asAdmin(), "POST", { label: tag("Class"), coordinator_id: people.fto })).status, 422);
  const cls = await call(`${admin}/classes`, asAdmin(), "POST", { label: tag("Class"), coordinator_id: people.coord });
  assert.equal(cls.status, 201);
  track(cls.data as TestAdminScenarioEnvelope);
  const classId = (cls.data as TestAdminScenarioEnvelope).data.classes.find(c => c.label === tag("Class"))!.id;

  const assignmentInput = { class_id: classId, po_id: people.po, fto_id: people.fto, phase: 1, starts_on: "2026-11-02", ends_on: "2026-11-29" };
  assert.equal((await call(`${admin}/assignments`, asAdmin(), "POST", { ...assignmentInput, po_id: people.fto })).status, 422);
  assert.equal((await call(`${admin}/assignments`, asAdmin(), "POST", { ...assignmentInput, ends_on: "2026-10-01" })).status, 422);
  const asg = await call(`${admin}/assignments`, asAdmin(), "POST", assignmentInput);
  assert.equal(asg.status, 201);
  track(asg.data as TestAdminScenarioEnvelope);
  const assignmentId = (asg.data as TestAdminScenarioEnvelope).data.assignments.find(a => a.class_id === classId)!.id;

  // Records can be created on the fictional assignment through the record API.
  const rec = await call(records, asAdmin(), "POST", {
    operation_id: randomUUID(), assignment_id: assignmentId, record_date: "2026-11-10",
    narrative: "FICTIONAL scenario note.", status: "draft", synthetic: true,
  });
  assert.equal(rec.status, 201);
  const recordId = (rec.data as StagingTrainingEnvelope).data[0].id;
  assert.equal((await call(records, asAdmin(), "POST", {
    operation_id: randomUUID(), assignment_id: assignmentId, record_date: "2026-11-10",
    narrative: "Duplicate fictional date.", status: "draft", synthetic: true,
  })).status, 409);
  const revised = await call(`${records}/${recordId}`, asAdmin(), "PUT", {
    operation_id: randomUUID(), base_version: 1, narrative: "FICTIONAL corrected scenario note.", status: "submitted", synthetic: true,
  });
  assert.equal(revised.status, 200);
  // Version conflicts are reported, not overwritten.
  assert.equal((await call(`${records}/${recordId}`, asAdmin(), "PUT", {
    operation_id: randomUUID(), base_version: 1, narrative: "Stale", status: "draft", synthetic: true,
  })).status, 409);
  const versions = await call(`${admin}/records/${recordId}/versions`, asAdmin());
  assert.equal(versions.status, 200);
  const versionData = (versions.data as {
    data: { version: number; narrative: string; status: string }[];
    metadata: { environment: string };
  });
  assert.equal(versionData.metadata.environment, "SYNTHETIC_STAGING");
  assert.deepEqual(versionData.data, [
    { version: 1, narrative: "FICTIONAL scenario note.", status: "draft" },
    { version: 2, narrative: "FICTIONAL corrected scenario note.", status: "submitted" },
  ]);
  assert.equal((await call(`${admin}/records/${recordId}/versions`, session(subjects.fto))).status, 403);
  // Test admin never acknowledges for a PO.
  assert.equal((await call(`${records}/${recordId}/acknowledgement`, asAdmin(), "POST", {
    operation_id: randomUUID(), base_version: 1, acknowledged: true,
  })).status, 403);

  // Historical records pin assignment identity and phase, but permit safe date
  // changes that continue to contain every existing record.
  assert.equal((await call(`${admin}/assignments/${assignmentId}`, asAdmin(), "PUT", { ...assignmentInput, phase: 2 })).status, 409);
  assert.equal((await call(`${admin}/assignments/${assignmentId}`, asAdmin(), "PUT", { ...assignmentInput, starts_on: "2026-11-15" })).status, 409);
  assert.equal((await call(`${admin}/assignments/${assignmentId}`, asAdmin(), "PUT", { ...assignmentInput, starts_on: "2026-11-03" })).status, 200);
  // Role changes and forged fields are rejected.
  assert.equal((await call(`${admin}/participants/${people.po}`, asAdmin(), "PUT", { display_label: tag("Renamed"), badge_label: "T-4101", role: "FTO" })).status, 409);
  assert.equal((await call(`${admin}/participants`, asAdmin(), "POST", { display_label: "X", badge_label: "1", role: "TEST_ADMIN" })).status, 422);
  assert.equal((await call(`${admin}/participants`, asAdmin(), "POST", { display_label: "X", badge_label: "1", role: "PO", agency_verified: true })).status, 422);
  const renamed = await call(`${admin}/participants/${people.po}`, asAdmin(), "PUT", { display_label: tag("Renamed"), badge_label: "T-4199", role: "PO" });
  assert.equal(renamed.status, 200);

  // Deactivation is audited, idempotency-safe, and never deletes.
  assert.equal((await call(`${admin}/classes/${classId}/deactivation`, asAdmin(), "POST", {})).status, 409);
  assert.equal((await call(`${admin}/participants/${people.po}/deactivation`, asAdmin(), "POST", {})).status, 409);
  const off = await call(`${admin}/assignments/${assignmentId}/deactivation`, asAdmin(), "POST", {});
  assert.equal(off.status, 200);
  assert.equal((off.data as TestAdminScenarioEnvelope).data.assignments.find(a => a.id === assignmentId)!.active, false);
  assert.equal((await call(`${records}/${recordId}`, asAdmin())).status, 200);
  assert.equal((await call(`${admin}/assignments/${assignmentId}/deactivation`, asAdmin(), "POST", {})).status, 409);
  const stillThere = await pool.query("SELECT count(*)::int AS n FROM synthetic_training.records WHERE id=$1", [recordId]);
  assert.equal(stillThere.rows[0].n, 1);
  assert.equal((await call(`${admin}/participants/${people.po}`, asAdmin(), "DELETE")).status, 404);

  const audit = await call(`${admin}/audit`, asAdmin());
  assert.equal(audit.status, 200);
  const events = (audit.data as TestAdminAuditEnvelope).data;
  for (const action of ["CREATE_PARTICIPANT", "CREATE_CLASS", "CREATE_ASSIGNMENT", "UPDATE_ASSIGNMENT", "UPDATE_PARTICIPANT", "DEACTIVATE_ASSIGNMENT"]) {
    assert.ok(events.some(e => e.action === action), `missing ${action}`);
  }
  assert.ok(events.some(e => e.action === "CREATE" && e.record_id === recordId));
  assert.ok(events.some(e => e.action === "READ_VERSIONS" && e.record_id === recordId && e.version === 2));
  // No actor or client hashes leave the server.
  assert.ok(events.every(e => !("actor_hash" in e) && !("client_ip_hash" in e)));
});

test("scenario management only touches fictional rows", async () => {
  // The real directory FTO is not listed and cannot be deactivated through the scenario API.
  const scenario = await call(`${admin}/scenario`, asAdmin());
  assert.ok(!(scenario.data as TestAdminScenarioEnvelope).data.participants.some(p => p.id === ids.fto || p.id === ids.admin));
  assert.equal((await call(`${admin}/participants/${ids.fto}/deactivation`, asAdmin(), "POST", {})).status, 404);
  assert.equal((await call(`${admin}/participants/${ids.admin}/deactivation`, asAdmin(), "POST", {})).status, 404);
  assert.equal((await call(`${admin}/participants/not-a-uuid/deactivation`, asAdmin(), "POST", {})).status, 400);
});
