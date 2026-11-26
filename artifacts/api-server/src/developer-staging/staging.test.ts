import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import express from "express";
import pg from "pg";
import { after, before, test } from "node:test";
import { createStagingRouter } from "./router.js";
import { StagingRepository, type StagingContext, type StagingEnvelope } from "./repository.js";
import { hashUserIdentifier } from "../utils/cryptoUtils.js";
import type { VerifiedStagingSession } from "./access.js";

// Only fictional, uniquely namespaced fixture subjects are used. No Clerk
// accounts are granted roles or created by this integration test.
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
const repository = new StagingRepository(pool);
const prefix = `fixture-${randomUUID()}`;
const subjects = { po: `${prefix}-po`, otherPo: `${prefix}-other-po`, fto: `${prefix}-fto`, otherFto: `${prefix}-other-fto`, coordinator: `${prefix}-coordinator`, stranger: `${prefix}-stranger`, testAdmin: `${prefix}-test-admin` };
const ids = Object.fromEntries(Object.keys(subjects).map(key => [key, randomUUID()])) as Record<keyof typeof subjects, string>;
const classId = randomUUID(), assignmentId = randomUUID(), otherAssignmentId = randomUUID();
let selected: VerifiedStagingSession | null = null;
const context = (subject: string): StagingContext => ({
  session: { subject, sessionId: "fixture-session", recentMfa: true, agencyVerified: false },
  requestId: randomUUID(), clientIp: "192.0.2.1",
});
const input = () => ({
  operation_id: randomUUID(), assignment_id: assignmentId,
  record_date: "2026-11-23", narrative: "FICTIONAL synthetic training note.",
  status: "submitted" as const, synthetic: true as const,
});
const app = express();
app.use(express.json({ limit: "16kb" }));
app.use("/api", createStagingRouter(repository, async () => selected));
const server = app.listen(0, "127.0.0.1");
let base = "";
let recordId = "";
const endpoint = "/api/v1/staging/training-records";
const originalEnabled = process.env.SYNTHETIC_STAGING_ENABLED;
const originalMode = process.env.NODE_ENV;
const originalTestAdmin = process.env.PORTAL_TEST_ADMIN_ENABLED;

before(async () => {
  process.env.SYNTHETIC_STAGING_ENABLED = "true";
  process.env.NODE_ENV = "test";
  process.env.PORTAL_TEST_ADMIN_ENABLED = "true";
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test listener.");
  base = `http://127.0.0.1:${address.port}`;
  for (const key of Object.keys(subjects) as (keyof typeof subjects)[]) {
    if (key === "testAdmin") continue;
    const role = key === "coordinator" ? "FTO_COORDINATOR" : key === "fto" || key === "otherFto" ? "FTO" : "PO";
    await pool.query(`INSERT INTO synthetic_training.members
      (id,subject_hash,role,active,agency_verified,terms_accepted) VALUES ($1,$2,$3,true,true,true)`,
    [ids[key], hashUserIdentifier(subjects[key]), role]);
  }
  await pool.query(`INSERT INTO synthetic_training.members
    (id,subject_hash,role,active,agency_verified,terms_accepted) VALUES ($1,$2,'TEST_ADMIN',true,false,true)`,
  [ids.testAdmin, hashUserIdentifier(subjects.testAdmin)]);
  await pool.query("INSERT INTO synthetic_training.classes(id,coordinator_id,active,phase_active) VALUES ($1,$2,true,true)", [classId, ids.coordinator]);
  await pool.query(`INSERT INTO synthetic_training.assignments(id,class_id,po_id,fto_id,phase,starts_on,ends_on,active)
    VALUES ($1,$2,$3,$4,1,'2026-11-01','2026-11-30',true),($5,$2,$6,$7,1,'2026-11-01','2026-11-30',true)`,
  [assignmentId, classId, ids.po, ids.fto, otherAssignmentId, ids.otherPo, ids.otherFto]);
});
after(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  // Remove only these uniquely namespaced synthetic fixtures, never a schema
  // or another developer's records.
  await pool.query("DELETE FROM synthetic_training.receipts WHERE actor_hash=ANY($1::text[])", [Object.values(subjects).map(hashUserIdentifier)]);
  await pool.query("DELETE FROM synthetic_training.audit_events WHERE actor_hash=ANY($1::text[])", [Object.values(subjects).map(hashUserIdentifier)]);
  await pool.query("DELETE FROM synthetic_training.record_versions WHERE record_id IN (SELECT id FROM synthetic_training.records WHERE assignment_id=ANY($1::uuid[]))", [[assignmentId, otherAssignmentId]]);
  await pool.query("DELETE FROM synthetic_training.records WHERE assignment_id=ANY($1::uuid[])", [[assignmentId, otherAssignmentId]]);
  await pool.query("DELETE FROM synthetic_training.assignments WHERE id=ANY($1::uuid[])", [[assignmentId, otherAssignmentId]]);
  await pool.query("DELETE FROM synthetic_training.classes WHERE id=$1", [classId]);
  await pool.query("DELETE FROM synthetic_training.members WHERE id=ANY($1::uuid[])", [Object.values(ids)]);
  await pool.end();
  if (originalEnabled === undefined) delete process.env.SYNTHETIC_STAGING_ENABLED; else process.env.SYNTHETIC_STAGING_ENABLED = originalEnabled;
  if (originalMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = originalMode;
  if (originalTestAdmin === undefined) delete process.env.PORTAL_TEST_ADMIN_ENABLED; else process.env.PORTAL_TEST_ADMIN_ENABLED = originalTestAdmin;
});
async function request(path: string, subject: string | null, method = "GET", body?: unknown) {
  selected = subject ? context(subject).session : null;
  const response = await fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json", "X-Role": "FTO_COORDINATOR" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data: unknown = await response.json();
  return { response, data };
}

test("missing authentication and spoofed role headers fail closed", async () => {
  const { response, data } = await request(endpoint, null);
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((data as { status: string }).status, "error");
});
test("missing MFA and unprovisioned agency identities cannot access records", async () => {
  selected = { ...context(subjects.fto).session, recentMfa: false };
  assert.equal((await fetch(`${base}${endpoint}`)).status, 401);
  assert.equal((await request(endpoint, `${prefix}-unprovisioned`)).response.status, 403);
});
test("production and unset staging switch return 404 before session resolution", async () => {
  process.env.NODE_ENV = "production";
  assert.equal((await request(endpoint, subjects.fto)).response.status, 404);
  process.env.NODE_ENV = "test";
  delete process.env.SYNTHETIC_STAGING_ENABLED;
  assert.equal((await request(endpoint, subjects.fto)).response.status, 404);
  process.env.SYNTHETIC_STAGING_ENABLED = "true";
});
test("FTO creates a persisted, enveloped synthetic record and exact retries are idempotent", async () => {
  const payload = input();
  const first = await request(endpoint, subjects.fto, "POST", payload);
  assert.equal(first.response.status, 201);
  const record = (first.data as StagingEnvelope).data[0];
  assert.equal(record.synthetic, true);
  recordId = record.id;
  const retry = await request(endpoint, subjects.fto, "POST", payload);
  assert.equal((retry.data as StagingEnvelope).data[0].id, recordId);
  const changed = await request(endpoint, subjects.fto, "POST", { ...payload, narrative: "Different payload" });
  assert.equal(changed.response.status, 409);
  const stored = await pool.query("SELECT count(*)::int AS n FROM synthetic_training.audit_events WHERE record_id=$1 AND action='CREATE'", [recordId]);
  assert.equal(stored.rows[0].n, 1);
});
test("PO and coordinator can read only their scoped submitted record; other users cannot", async () => {
  assert.equal((await request(`${endpoint}/${recordId}`, subjects.po)).response.status, 200);
  assert.equal((await request(`${endpoint}/${recordId}`, subjects.coordinator)).response.status, 200);
  for (const subject of [subjects.otherPo, subjects.otherFto, subjects.stranger]) {
    assert.equal((await request(`${endpoint}/${recordId}`, subject)).response.status, 404);
    assert.deepEqual((await request(endpoint, subject)).data, { status: "success", metadata: { total_records: 0, environment: "SYNTHETIC_STAGING" }, data: [] });
  }
});
test("PO and coordinator cannot mutate FTO-owned record content", async () => {
  for (const subject of [subjects.po, subjects.coordinator]) {
    assert.equal((await request(`${endpoint}/${recordId}`, subject, "PUT", {
      operation_id: randomUUID(), base_version: 1, narrative: "Unauthorized", status: "submitted", synthetic: true,
    })).response.status, 403);
  }
});
test("scope and date bounds are enforced by the database query", async () => {
  assert.equal((await request(endpoint, subjects.fto, "POST", { ...input(), assignment_id: otherAssignmentId })).response.status, 404);
  assert.equal((await request(endpoint, subjects.fto, "POST", { ...input(), record_date: "2027-01-01" })).response.status, 404);
});
test("strict validation rejects forged roles, malformed data, invalid calendar dates and real-record flags", async () => {
  for (const payload of [
    { ...input(), role: "FTO_COORDINATOR" }, { ...input(), synthetic: false },
    { ...input(), record_date: "2026-02-30" }, { ...input(), narrative: "\u0000" },
    { ...input(), narrative: 123 }, { ...input(), narrative: "x".repeat(4001) },
    { ...input(), assignment_id: "' OR 1=1 --" }, {},
  ]) assert.equal((await request(endpoint, subjects.fto, "POST", payload)).response.status, 422);
  assert.equal((await request(`${endpoint}/not-a-uuid`, subjects.fto)).response.status, 400);
});
test("only the PO may acknowledge a submitted record and acknowledgement is version-bound", async () => {
  const payload = { operation_id: randomUUID(), base_version: 1, acknowledged: true };
  assert.equal((await request(`${endpoint}/${recordId}/acknowledgement`, subjects.fto, "POST", payload)).response.status, 403);
  assert.equal((await request(`${endpoint}/${recordId}/acknowledgement`, subjects.otherPo, "POST", payload)).response.status, 404);
  const ack = await request(`${endpoint}/${recordId}/acknowledgement`, subjects.po, "POST", payload);
  assert.equal(ack.response.status, 200);
  assert.equal((ack.data as StagingEnvelope).data[0].acknowledged_version, 1);
});
test("FTO updates clear old acknowledgements and stale writes do not overwrite the record", async () => {
  const updated = await request(`${endpoint}/${recordId}`, subjects.fto, "PUT", {
    operation_id: randomUUID(), base_version: 1, narrative: "FICTIONAL revision", status: "submitted", synthetic: true,
  });
  assert.equal(updated.response.status, 200);
  assert.equal((updated.data as StagingEnvelope).data[0].version, 2);
  assert.equal((updated.data as StagingEnvelope).data[0].acknowledged_version, null);
  assert.equal((await request(`${endpoint}/${recordId}`, subjects.fto, "PUT", {
    operation_id: randomUUID(), base_version: 1, narrative: "Stale revision", status: "submitted", synthetic: true,
  })).response.status, 409);
  assert.equal((await request(`${endpoint}/${recordId}/acknowledgement`, subjects.po, "POST", {
    operation_id: randomUUID(), base_version: 1, acknowledged: true,
  })).response.status, 409);
  const history = await pool.query("SELECT version,narrative FROM synthetic_training.record_versions WHERE record_id=$1 ORDER BY version", [recordId]);
  assert.deepEqual(history.rows.map(row => row.version), [1, 2]);
  assert.equal(history.rows[0].narrative, "FICTIONAL synthetic training note.");
});
test("account revocation and phase deactivation take effect on the next request", async () => {
  await pool.query("UPDATE synthetic_training.members SET active=false WHERE id=$1", [ids.fto]);
  assert.equal((await request(endpoint, subjects.fto)).response.status, 403);
  await pool.query("UPDATE synthetic_training.members SET active=true WHERE id=$1", [ids.fto]);
  await pool.query("UPDATE synthetic_training.classes SET phase_active=false WHERE id=$1", [classId]);
  assert.equal((await request(`${endpoint}/${recordId}`, subjects.po)).response.status, 404);
  await pool.query("UPDATE synthetic_training.classes SET phase_active=true WHERE id=$1", [classId]);
});
test("audit events contain HMAC identities/IPs, never raw identities or narrative text", async () => {
  const result = await pool.query("SELECT * FROM synthetic_training.audit_events WHERE record_id=$1", [recordId]);
  assert.ok(result.rows.length >= 5);
  for (const row of result.rows) {
    assert.match(row.actor_hash, /^[a-f0-9]{64}$/);
    assert.match(row.client_ip_hash, /^[a-f0-9]{64}$/);
    assert.equal(JSON.stringify(row).includes(prefix), false);
    assert.equal(JSON.stringify(row).includes("FICTIONAL"), false);
  }
});
test("audit failure rolls back record insertion and leaves no idempotency receipt", async () => {
  const operation = input();
  const ctx = { ...context(subjects.fto), requestId: "" };
  await assert.rejects(repository.create(ctx, { ...operation, record_date: "2026-11-24" }));
  const count = await pool.query("SELECT count(*)::int AS n FROM synthetic_training.records WHERE assignment_id=$1 AND record_date='2026-11-24'", [assignmentId]);
  assert.equal(count.rows[0].n, 0);
  const receipt = await pool.query("SELECT count(*)::int AS n FROM synthetic_training.receipts WHERE operation_id=$1", [operation.operation_id]);
  assert.equal(receipt.rows[0].n, 0);
});

test("provisioned test administrator can read and maintain all synthetic records but cannot acknowledge", async () => {
  const listed = await request(endpoint, subjects.testAdmin);
  assert.equal(listed.response.status, 200);
  assert.ok((listed.data as StagingEnvelope).data.some(record => record.id === recordId));
  assert.equal((await request(`${endpoint}/${recordId}`, subjects.testAdmin)).response.status, 200);
  const created = await request(endpoint, subjects.testAdmin, "POST", {
    ...input(), assignment_id: otherAssignmentId, record_date: "2026-11-25", status: "draft",
  });
  assert.equal(created.response.status, 201);
  const adminRecord = (created.data as StagingEnvelope).data[0];
  assert.equal(adminRecord.synthetic, true);
  const updated = await request(`${endpoint}/${adminRecord.id}`, subjects.testAdmin, "PUT", {
    operation_id: randomUUID(), base_version: 1, narrative: "FICTIONAL admin revision", status: "submitted", synthetic: true,
  });
  assert.equal(updated.response.status, 200);
  assert.equal((await request(`${endpoint}/${adminRecord.id}/acknowledgement`, subjects.testAdmin, "POST", {
    operation_id: randomUUID(), base_version: 2, acknowledged: true,
  })).response.status, 403);
  // Ordinary FTO scope is unchanged: an FTO outside that assignment cannot read it.
  assert.equal((await request(`${endpoint}/${adminRecord.id}`, subjects.fto)).response.status, 404);
  const audit = await pool.query("SELECT DISTINCT role FROM synthetic_training.audit_events WHERE actor_hash=$1", [hashUserIdentifier(subjects.testAdmin)]);
  assert.deepEqual(audit.rows.map(row => row.role), ["TEST_ADMIN"]);
});
test("test authority fails closed without its switch, for agency-verified sessions, in production, and after revocation", async () => {
  delete process.env.PORTAL_TEST_ADMIN_ENABLED;
  assert.equal((await request(endpoint, subjects.testAdmin)).response.status, 403);
  process.env.PORTAL_TEST_ADMIN_ENABLED = "true";
  selected = { ...context(subjects.testAdmin).session, agencyVerified: true };
  assert.equal((await fetch(`${base}${endpoint}`)).status, 403);
  selected = { ...context(subjects.testAdmin).session, recentMfa: false };
  assert.equal((await fetch(`${base}${endpoint}`)).status, 401);
  process.env.NODE_ENV = "production";
  assert.equal((await request(endpoint, subjects.testAdmin)).response.status, 404);
  process.env.NODE_ENV = "test";
  await pool.query("UPDATE synthetic_training.members SET active=false WHERE id=$1", [ids.testAdmin]);
  assert.equal((await request(endpoint, subjects.testAdmin)).response.status, 403);
  await pool.query("UPDATE synthetic_training.members SET active=true WHERE id=$1", [ids.testAdmin]);
});
test("client-supplied roles cannot escalate and test authority cannot be agency-verified", async () => {
  selected = null;
  const mockToken = await fetch(`${base}${endpoint}`, { headers: { "X-Role": "TEST_ADMIN", Authorization: "Bearer mock-jwt-string" } });
  assert.equal(mockToken.status, 401);
  selected = context(subjects.stranger).session;
  const stranger = await fetch(`${base}${endpoint}?role=TEST_ADMIN`, { headers: { "X-Role": "TEST_ADMIN" } });
  // The unassigned directory member still sees nothing despite forged role inputs.
  assert.deepEqual(await stranger.json(), { status: "success", metadata: { total_records: 0, environment: "SYNTHETIC_STAGING" }, data: [] });
  assert.equal((await request(endpoint, `${prefix}-unprovisioned`)).response.status, 403);
  assert.equal((await request(endpoint, subjects.stranger, "POST", { ...input(), role: "TEST_ADMIN" })).response.status, 422);
  await assert.rejects(pool.query("UPDATE synthetic_training.members SET agency_verified=true WHERE id=$1", [ids.testAdmin]));
  await assert.rejects(pool.query(`INSERT INTO synthetic_training.members
    (id,subject_hash,role,active,agency_verified,terms_accepted) VALUES ($1,$2,'TEST_ADMIN',true,true,true)`,
  [randomUUID(), hashUserIdentifier(`${prefix}-verified-admin`)]));
});
