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

const coordinator: AgencyIdentity = { id: "coordinator", badge: "10", role: "FTO_COORDINATOR" };
const po: AgencyIdentity = { id: "po", badge: "20", role: "PO" };
const fto: AgencyIdentity = { id: "fto", badge: "30", role: "FTO" };
const audit = () => ({ requestId: randomUUID(), clientIp: "192.0.2.1" });
const contentHash = (report: unknown) => createHash("sha256").update(JSON.stringify(report)).digest("hex");
const change = (report: unknown) => ({ operation_id: randomUUID(), content_hash: contentHash(report), review_confirmed: true });
const denied = (code: string) => (error: unknown) => error instanceof PacketError && error.code === code;

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
    const db = pool;
    const store = createAgencyPacketStore(db);
    const assignment = randomUUID();
    const otherAssignment = randomUUID();
    const seedAssignment = async (id: string, className: string, coordinatorId: string) => db.query(
      `INSERT INTO agency_training.assignments
       (id,class_name,phase,fto_id_hash,fto_badge_hash,fto_name,po_id_hash,po_badge_hash,po_name,
        coordinator_id_hash,starts_on,ends_on)
       VALUES ($1,$2,1,$3,$4,'Synthetic FTO',$5,$6,'Synthetic PO',$7,'2026-01-01','2026-12-31')`,
      [id, className, hash(fto.id), hash(fto.badge), hash(po.id), hash(po.badge), hash(coordinatorId)],
    );
    await seedAssignment(assignment, "Class A", "another-coordinator");
    // Coordinator scope comes from another roster assignment in the SAME class.
    await seedAssignment(randomUUID(), "Class A", coordinator.id);
    await seedAssignment(otherAssignment, "Class B", "another-coordinator");
    // Avoid duplicate FTO upload matches while retaining active class scope.
    await db.query("UPDATE agency_training.assignments SET fto_id_hash=$1 WHERE coordinator_id_hash=$2",
      [hash("another-fto"), hash(coordinator.id)]);
    const report = { id: "original", date: "2026-11-23", phase: 1, className: "Class A",
      recruitBadge: po.badge, ftoBadge: fto.badge, recruitName: "Synthetic PO", ftoName: "Synthetic FTO",
      status: "recruit_signed", signatures: { recruit: { signed: true } }, runs: [], ratings: {},
      activity: {}, reportingForDuty: {}, narrative: "", remedial: "", recruitComments: "" };
    const upload = { operation_id: randomUUID(), base_version: 0, report };
    await store.sync(fto, audit(), [upload]);
    const review = change(report);
    await t.test("forged client signature and status do not release or acknowledge an upload", async () => {
      assert.deepEqual(await store.read(po, audit()), []);
      const record = (await store.read(coordinator, audit(), report.id))[0];
      assert.equal(record.released_to_po, false);
      assert.equal(record.acknowledgment, null);
      assert.equal(record.content_hash, review.content_hash);
      CompletePacketsEnvelope.parse({ status: "success", metadata: { total_records: 1, role: coordinator.role }, data: [record] });
      await assert.rejects(store.review(fto, audit(), report.id, "release", review), denied("PACKET_REVIEW_FORBIDDEN"));
      await assert.rejects(store.review(po, audit(), report.id, "acknowledge", review), denied("PACKET_NOT_FOUND"));
    });
    await t.test("class access fails closed for another coordinator, badge, inactive assignment and class", async () => {
      await assert.rejects(store.review({ ...coordinator, id: "outsider" }, audit(), report.id, "release", review), denied("PACKET_NOT_FOUND"));
      await db.query("UPDATE agency_training.packet_assignments SET active=false WHERE packet_id=$1", [report.id]);
      await assert.rejects(store.review(coordinator, audit(), report.id, "release", review), denied("PACKET_NOT_FOUND"));
      await db.query("UPDATE agency_training.packet_assignments SET active=true WHERE packet_id=$1", [report.id]);
      const other = { ...report, id: "other-class", className: "Class B" };
      await store.sync(fto, audit(), [{ ...upload, operation_id: randomUUID(), report: other }]);
      await assert.rejects(store.review(coordinator, audit(), other.id, "release", change(other)), denied("PACKET_NOT_FOUND"));
    });
    await t.test("release requires explicit exact-snapshot review and retries create just one audit event", async () => {
      await assert.rejects(store.review(coordinator, audit(), report.id, "release", { ...review, review_confirmed: false }), denied("PACKET_REVIEW_REQUIRED"));
      await assert.rejects(store.review(coordinator, audit(), report.id, "release", { ...review, content_hash: "f".repeat(64) }), denied("PACKET_SNAPSHOT_CONFLICT"));
      await store.review(coordinator, audit(), report.id, "release", review);
      await store.review(coordinator, audit(), report.id, "release", review);
      assert.equal((await db.query("SELECT count(*)::int n FROM agency_training.packet_events WHERE event_type='RELEASE'")).rows[0].n, 1);
      assert.equal((await store.read(po, audit(), report.id))[0].released_to_po, true);
      await assert.rejects(store.read({ ...po, badge: "wrong" }, audit(), report.id), denied("PACKET_NOT_FOUND"));
      await assert.rejects(store.read({ ...po, id: "another-po" }, audit(), report.id), denied("PACKET_NOT_FOUND"));
    });
    await t.test("PO acknowledgment is server-authored, exact-once and bound to the released content", async () => {
      const ack = { ...change(report), comments: "Reviewed, not agreement." };
      const result = await store.review(po, audit(), report.id, "acknowledge", ack);
      assert.equal(result[0].acknowledgment.comments, ack.comments);
      assert.equal(result[0].acknowledgment.content_hash, review.content_hash);
      await store.review(po, audit(), report.id, "acknowledge", ack);
      await assert.rejects(store.review(po, audit(), report.id, "acknowledge", { ...ack, comments: "Changed" }), denied("PACKET_OPERATION_CONFLICT"));
      await assert.rejects(store.review(po, audit(), report.id, "acknowledge", change(report)), denied("PACKET_ALREADY_ACKNOWLEDGED"));
      const events = await db.query("SELECT * FROM agency_training.packet_events WHERE event_type='ACKNOWLEDGE'");
      assert.equal(events.rows.length, 1);
      assert.equal(events.rows[0].actor_hash, hash(po.id));
      assert.equal(events.rows[0].content_hash, review.content_hash);
    });
    await t.test("withdrawal preserves history and replacements require fresh release and acknowledgment", async () => {
      await assert.rejects(store.review(coordinator, audit(), report.id, "withdraw", { ...review, reason: " " }), denied("PACKET_WITHDRAWAL_REASON_REQUIRED"));
      const withdrawal = { ...change(report), reason: "Correct the narrative." };
      await store.review(coordinator, audit(), report.id, "withdraw", withdrawal);
      await store.review(coordinator, audit(), report.id, "withdraw", withdrawal);
      await assert.rejects(store.read(po, audit(), report.id), denied("PACKET_NOT_FOUND"));
      await assert.rejects(store.review(coordinator, audit(), report.id, "release", change(report)), denied("PACKET_WITHDRAWN"));
      assert.equal((await store.read(coordinator, audit(), report.id))[0].acknowledgment.comments, "Reviewed, not agreement.");
      await assert.rejects(store.sync(fto, audit(), [{ ...upload, operation_id: randomUUID(), report: { ...report, narrative: "Overwrite" } }]), denied("PACKET_ALREADY_SYNCHRONIZED"));
      const replacement = { ...report, id: "replacement", narrative: "Corrected" };
      const replacementUpload = { operation_id: randomUUID(), base_version: 0, report: replacement,
        amendment_of: report.id, amendment_reason: "Corrected narrative after withdrawal." };
      await store.sync(fto, audit(), [replacementUpload]);
      await store.sync(fto, audit(), [replacementUpload]);
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
      await assert.rejects(store.review(coordinator, { ...audit(), requestId: "invalid-uuid" }, failing.id, "release", change(failing)));
      assert.equal((await store.read(coordinator, audit(), failing.id))[0].released_to_po, false);
    });
    await t.test("the workflow works with column-only grants and cannot rewrite snapshot content", async () => {
      await db.query(`CREATE ROLE packet_runtime LOGIN;
        GRANT USAGE ON SCHEMA agency_training TO packet_runtime;
        GRANT SELECT ON agency_training.assignments TO packet_runtime;
        GRANT SELECT, INSERT ON agency_training.packets, agency_training.packet_assignments,
          agency_training.packet_acknowledgments, agency_training.packet_events TO packet_runtime;
        GRANT USAGE ON ALL SEQUENCES IN SCHEMA agency_training TO packet_runtime;
        GRANT UPDATE (released_to_po, released_at, released_by_hash, withdrawn_at, withdrawn_by_hash,
          withdrawal_reason) ON agency_training.packets TO packet_runtime;`);
      const limitedPool = new pg.Pool({ host: dir, port, user: "packet_runtime", database: "postgres" });
      try {
        const limited = createAgencyPacketStore(limitedPool);
        const leastPrivilege = { ...report, id: "least-privilege" };
        await limited.sync(fto, audit(), [{ ...upload, operation_id: randomUUID(), report: leastPrivilege }]);
        await limited.review(coordinator, audit(), leastPrivilege.id, "release", change(leastPrivilege));
        await limited.review(po, audit(), leastPrivilege.id, "acknowledge", change(leastPrivilege));
        await limited.review(coordinator, audit(), leastPrivilege.id, "withdraw", { ...change(leastPrivilege), reason: "Correction" });
        await assert.rejects(limitedPool.query("UPDATE agency_training.packets SET report='{}'::jsonb WHERE id=$1", [leastPrivilege.id]));
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
        await legacy.query(readFileSync(new URL("../migrations/agency-training-packet-review.sql", import.meta.url), "utf8"));
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
    current = po;
    assert.equal((await post("release", valid)).status, 403);
    assert.equal((await post("withdraw", valid)).status, 403);
    assert.equal((await post("acknowledge", { ...valid, actor_hash: "forged" })).status, 400);
    assert.equal((await post("acknowledge", valid)).status, 503);
    current = fto;
    assert.equal((await post("acknowledge", valid)).status, 403);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
