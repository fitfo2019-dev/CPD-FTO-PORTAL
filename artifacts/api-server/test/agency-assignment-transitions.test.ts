import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { PGlite } from "@electric-sql/pglite";
import express from "express";
import { createAgencyAssignmentTransitionStore } from "../src/lib/agency-assignment-transition-store.js";
import { createAgencyPacketStore } from "../src/lib/agency-packet-store.js";
import { createPacketReviewStore } from "../src/lib/packet-review-store.js";
import { PacketError } from "../src/lib/packet-errors.js";
import type { AgencyIdentity } from "../src/security/agencyIdentity.js";
import { hashUserIdentifier as hash } from "../src/utils/cryptoUtils.js";
import { createAgencyAssignmentTransitionsRouter } from "../src/routes/agency-assignment-transitions.js";

const coordinator: AgencyIdentity = {
  id: "TEST-transition-coordinator", badge: "TEST-C1", role: "FTO_COORDINATOR",
};
const unauthorizedCoordinator: AgencyIdentity = {
  id: "TEST-other-coordinator", badge: "TEST-C2", role: "FTO_COORDINATOR",
};
const oldFto: AgencyIdentity = { id: "TEST-old-fto", badge: "TEST-F1", role: "FTO" };
const successorFto: AgencyIdentity = { id: "TEST-successor-fto", badge: "TEST-F2", role: "FTO" };
const poId = "TEST-transition-po";
const poBadge = "TEST-P1";
const className = "TEST TRANSITION CLASS";
const report = {
  id: "TEST-old-packet",
  date: "2026-04-12",
  phase: 1,
  className,
  recruitBadge: poBadge,
  ftoBadge: oldFto.badge,
  recruitName: "TEST PO",
  ftoName: "TEST Old FTO",
  status: "draft",
  reportingForDuty: { reviewedAt: "2026-04-12T12:00:00.000Z" },
  ratingsReviewedAt: "2026-04-12T12:00:00.000Z",
  runs: [],
  narrative: "Original mixed-case draft",
};

async function createFixture() {
  const db = new PGlite();
  for (const name of [
    "agency-training.sql",
    "agency-training-packet-review.sql",
    "agency-training-assignment-transitions.sql",
    "agency-training-packet-guards.sql",
  ]) {
    await db.exec(await readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
  }

  let queue = Promise.resolve();
  const pool = {
    query: (sql: string, values: unknown[] = []) => db.query(sql, values),
    connect: async () => {
      const previous = queue;
      let release!: () => void;
      queue = new Promise<void>(resolve => { release = resolve; });
      await previous;
      return {
        query: (sql: string, values: unknown[] = []) => db.query(sql, values),
        release,
      };
    },
  } as unknown as pg.Pool;

  const previousAssignmentId = randomUUID();
  const trustedFtoAssignmentId = randomUUID();
  await db.query(
    `INSERT INTO agency_training.coordinator_directory (id,name) VALUES ($1,'TEST Coordinator')`,
    [coordinator.id],
  );
  await db.query(
    `INSERT INTO agency_training.assignments (
      id,class_name,phase,fto_id_hash,fto_badge_hash,fto_name,
      po_id_hash,po_badge_hash,po_name,coordinator_id_hash,starts_on,ends_on,
      active,fto_id,fto_badge,po_id,po_badge,coordinator_id
    ) VALUES
      ($1,$2,1,$3,$4,'TEST Old FTO',$5,$6,'TEST PO',$7,'2026-01-01','2026-12-31',true,$8,$9,$10,$11,$12),
      ($13,$2,1,$14,$15,'TEST Successor FTO',$16,$17,'TEST Other PO',$7,'2026-01-01','2026-12-31',true,$18,$19,'TEST-other-po','TEST-P2',$12)`,
    [
      previousAssignmentId, className, hash(oldFto.id), hash(oldFto.badge),
      hash(poId), hash(poBadge), hash(coordinator.id), oldFto.id, oldFto.badge,
      poId, poBadge, coordinator.id,
      trustedFtoAssignmentId, hash(successorFto.id), hash(successorFto.badge),
      hash("TEST-other-po"), hash("TEST-P2"), successorFto.id, successorFto.badge,
    ],
  );
  await db.query(
    `INSERT INTO agency_training.po_coordinators (po_id,po_id_hash,po_badge,coordinator_id)
     VALUES ($1,$2,$3,$4)`,
    [poId, hash(poId), poBadge, coordinator.id],
  );
  const packetStore = createAgencyPacketStore(pool);
  const transitionStore = createAgencyAssignmentTransitionStore(pool);
  const reviewStore = createPacketReviewStore(pool);
  const audit = { requestId: randomUUID(), clientIp: "192.0.2.40" };
  return {
    db, pool, previousAssignmentId, trustedFtoAssignmentId,
    packetStore, transitionStore, reviewStore, audit,
  };
}

const successorInput = (previousAssignmentId: string, operationId = randomUUID()) => ({
  operation_id: operationId,
  previous_assignment_id: previousAssignmentId,
  fto_id: successorFto.id,
  phase: 2,
  starts_on: "2026-05-01",
  ends_on: "2026-12-31",
});

test("a successor assignment preserves late packet work under its original FTO and date", async () => {
  const fixture = await createFixture();
  try {
    const { db, previousAssignmentId, packetStore, transitionStore, reviewStore, audit } = fixture;
    await packetStore.sync(oldFto, audit, [{
      operation_id: randomUUID(), base_version: 0, report,
    }]);
    assert.equal((await reviewStore.pending(coordinator)).count, 0);

    const context = await transitionStore.context(coordinator);
    assert.equal(context.assignments.some(item => item.id === previousAssignmentId), true);
    assert.equal(context.ftos.some(item => item.fto_id === successorFto.id), true);
    assert.equal(context.ftos.some(item => item.fto_id === "TEST-untrusted-fto"), false);

    const input = successorInput(previousAssignmentId);
    const created = await transitionStore.create(coordinator, input);
    assert.equal(created.created, true);
    assert.equal(created.transition.previous_ends_on, "2026-04-30");
    assert.equal(created.transition.successor_starts_on, input.starts_on);
    assert.equal(created.transition.previous_fto_name, "TEST Old FTO");
    assert.equal(created.transition.successor_fto_name, "TEST Successor FTO");

    const originalPacket = await db.query<{
      assignment_id: string; record_date: string; phase: number;
      submission_status: string; report: { narrative: string };
    }>(`SELECT assignment_id, record_date::text, phase, submission_status, report
        FROM agency_training.packets WHERE id=$1`, [report.id]);
    assert.deepEqual(originalPacket.rows[0], {
      assignment_id: previousAssignmentId,
      record_date: report.date,
      phase: report.phase,
      submission_status: "local_draft_pending",
      report,
    });
    assert.equal((await reviewStore.pending(coordinator)).count, 0);

    const newPhasePacket = {
      ...report,
      id: "TEST-successor-phase-packet",
      date: "2026-05-02",
      phase: 2,
      ftoBadge: successorFto.badge,
      ftoName: "TEST Successor FTO",
      narrative: "New phase draft",
    };
    const newReceipt = await packetStore.sync(successorFto, audit, [{
      operation_id: randomUUID(), base_version: 0, report: newPhasePacket,
    }]);
    assert.equal(newReceipt[0]?.sync_status, "local_draft_pending");

    // The original FTO can edit and explicitly finalize late paperwork because
    // its report date is still inside the unchanged predecessor history range.
    await packetStore.sync(oldFto, audit, [{
      operation_id: randomUUID(),
      base_version: 1,
      report: { ...report, narrative: "Late completed work, mixed CASE retained" },
    }]);
    const beforeFinalize = await db.query<{ assignment_id: string; submission_status: string }>(
      "SELECT assignment_id,submission_status FROM agency_training.packets WHERE id=$1",
      [report.id],
    );
    assert.equal(beforeFinalize.rows[0]?.assignment_id, previousAssignmentId);
    assert.equal(beforeFinalize.rows[0]?.submission_status, "local_draft_pending");
    await packetStore.finalize(oldFto, audit, report.id, {
      operation_id: randomUUID(),
      base_version: 2,
      content_hash: (await db.query<{ content_hash: string }>(
        "SELECT content_hash FROM agency_training.packets WHERE id=$1", [report.id],
      )).rows[0]!.content_hash,
    });
    const reviewSubmission = await db.query<{
      state: string; po_reviewed_at: string | null;
    }>(
      "SELECT state,po_reviewed_at FROM agency_training.packet_submissions WHERE packet_id=$1",
      [report.id],
    );
    assert.deepEqual(reviewSubmission.rows[0], { state: "submitted", po_reviewed_at: null });
    assert.equal((await reviewStore.pending({ id: poId, badge: poBadge, role: "PO" })).count, 1);
    assert.equal((await reviewStore.pending(coordinator)).count, 0,
      "the PO totals review remains a gate before Coordinator access");

    const assignments = await db.query<{
      id: string; phase: number; starts_on: string; ends_on: string; active: boolean;
    }>(`SELECT id::text,phase,starts_on::text,ends_on::text,active
        FROM agency_training.assignments WHERE po_id=$1 ORDER BY starts_on,id`, [poId]);
    assert.equal(assignments.rows.length, 2);
    assert.equal(assignments.rows.find(item => item.id === previousAssignmentId)?.active, true);
    assert.equal(assignments.rows.find(item => item.id === previousAssignmentId)?.ends_on, "2026-04-30");
    assert.equal(assignments.rows.find(item => item.phase === 2)?.starts_on, "2026-05-01");

    const submitted = await db.query<{
      assignment_id: string; report: { narrative: string }; submission_status: string;
    }>("SELECT assignment_id,report,submission_status FROM agency_training.packets WHERE id=$1", [report.id]);
    assert.equal(submitted.rows[0]?.assignment_id, previousAssignmentId);
    assert.equal(submitted.rows[0]?.submission_status, "submitted");
    assert.equal(submitted.rows[0]?.report.narrative, "Late completed work, mixed CASE retained");
    const history = await transitionStore.context(coordinator);
    assert.equal(history.transitions.length, 1);
    assert.equal(history.transitions[0]?.operation_id, input.operation_id);
  } finally {
    await fixture.db.close();
  }
});

test("transition authorization, idempotency, and overlapping date changes fail closed", async () => {
  const fixture = await createFixture();
  try {
    const { transitionStore, previousAssignmentId, db } = fixture;
    await assert.rejects(
      transitionStore.create(oldFto, successorInput(previousAssignmentId)),
      error => error instanceof PacketError && error.code === "ASSIGNMENT_TRANSITION_FORBIDDEN",
    );
    await assert.rejects(
      transitionStore.create(unauthorizedCoordinator, successorInput(previousAssignmentId)),
      error => error instanceof PacketError && error.code === "ASSIGNMENT_TRANSITION_FORBIDDEN",
    );

    const input = successorInput(previousAssignmentId);
    const first = await transitionStore.create(coordinator, input);
    const retry = await transitionStore.create(coordinator, input);
    assert.equal(first.created, true);
    assert.equal(retry.created, false);
    assert.deepEqual(retry.transition, first.transition);

    await assert.rejects(
      transitionStore.create(coordinator, {
        ...input,
        operation_id: randomUUID(),
        starts_on: "2026-06-01",
        ends_on: "2026-12-31",
      }),
      error => error instanceof PacketError && error.status === 409 &&
        error.code === "ASSIGNMENT_DATE_CONFLICT",
    );
    await assert.rejects(
      transitionStore.create(coordinator, {
        ...input,
        operation_id: randomUUID(),
        starts_on: "2027-01-01",
        ends_on: "2027-12-31",
      }),
      error => error instanceof PacketError && error.status === 409,
    );
    await db.query(
      "INSERT INTO agency_training.coordinator_directory (id,name) VALUES ($1,'TEST Other Coordinator')",
      [unauthorizedCoordinator.id],
    );
    await db.query(
      "UPDATE agency_training.po_coordinators SET coordinator_id=$2 WHERE po_id=$1",
      [poId, unauthorizedCoordinator.id],
    );
    await assert.rejects(
      transitionStore.create(coordinator, input),
      error => error instanceof PacketError && error.status === 403,
      "an idempotent retry still requires current Coordinator scope",
    );
    const audit = await db.query("SELECT * FROM agency_training.assignment_transitions");
    assert.equal(audit.rows.length, 1);
    await assert.rejects(
      db.query("UPDATE agency_training.assignment_transitions SET class_name='tampered'"),
      /immutable/,
    );
    await assert.rejects(
      db.query("TRUNCATE agency_training.assignment_transitions"),
      /immutable/,
    );

    await db.exec(`CREATE ROLE test_assignment_transition_runtime;
      GRANT USAGE ON SCHEMA agency_training TO test_assignment_transition_runtime;
      GRANT SELECT (id,class_name,phase,fto_name,fto_badge,po_name,po_badge,
        starts_on,ends_on,active,po_id,coordinator_id_hash,po_id_hash,fto_id,
        fto_id_hash,fto_badge_hash)
        ON agency_training.assignments TO test_assignment_transition_runtime;
      GRANT SELECT (po_id,po_id_hash,coordinator_id)
        ON agency_training.po_coordinators TO test_assignment_transition_runtime;
      GRANT SELECT ON agency_training.assignment_transitions TO test_assignment_transition_runtime;
      GRANT EXECUTE ON FUNCTION agency_training.create_successor_assignment(
        text,char(64),uuid,uuid,uuid,char(64),text,integer,date,date
      ) TO test_assignment_transition_runtime;
      SET ROLE test_assignment_transition_runtime;`);
    try {
      await assert.rejects(
        db.query("UPDATE agency_training.assignments SET ends_on='2026-04-30' WHERE id=$1", [previousAssignmentId]),
        /permission denied/,
      );
      await assert.rejects(
        db.query(`INSERT INTO agency_training.assignment_transitions
          (operation_id,actor_hash,request_hash,po_id,po_name,po_badge,class_name,
           previous_assignment_id,successor_assignment_id,previous_phase,successor_phase,
           previous_ends_on,successor_starts_on,successor_ends_on,previous_snapshot,successor_snapshot)
          VALUES($1,$2,$2,$3,'TEST PO','TEST-P1',$4,$5,$6,1,2,'2026-04-30','2026-05-01',
            '2026-12-31','{}','{}')`,
        [randomUUID(), hash("TEST-actor"), poId, className, previousAssignmentId, randomUUID()]),
        /permission denied/,
      );
    } finally {
      await db.exec("RESET ROLE");
    }
  } finally {
    await fixture.db.close();
  }
});

test("concurrent retries of the same operation return one successor and one audit record", async () => {
  const fixture = await createFixture();
  try {
    const { transitionStore, previousAssignmentId, db } = fixture;
    const input = successorInput(previousAssignmentId);
    const outcomes = await Promise.all([
      transitionStore.create(coordinator, input),
      transitionStore.create(coordinator, input),
    ]);
    assert.deepEqual(outcomes.map(result => result.created).sort(), [false, true]);
    const history = await db.query("SELECT operation_id FROM agency_training.assignment_transitions");
    assert.equal(history.rows.length, 1);
    const assignments = await db.query(
      "SELECT id FROM agency_training.assignments WHERE po_id=$1", [poId],
    );
    assert.equal(assignments.rows.length, 2);
  } finally {
    await fixture.db.close();
  }
});

test("only one concurrent successor can claim the same PO date range", async () => {
  const fixture = await createFixture();
  try {
    const { transitionStore, previousAssignmentId, db } = fixture;
    const outcomes = await Promise.allSettled([
      transitionStore.create(coordinator, successorInput(previousAssignmentId)),
      transitionStore.create(coordinator, successorInput(previousAssignmentId)),
    ]);
    assert.equal(outcomes.filter(item => item.status === "fulfilled").length, 1);
    const rejected = outcomes.find(item => item.status === "rejected") as PromiseRejectedResult;
    assert.ok(rejected.reason instanceof PacketError);
    assert.equal(rejected.reason.status, 409);
    const rows = await db.query("SELECT * FROM agency_training.assignment_transitions");
    assert.equal(rows.rows.length, 1);
    const successors = await db.query(
      "SELECT id FROM agency_training.assignments WHERE po_id=$1 AND phase=2", [poId],
    );
    assert.equal(successors.rows.length, 1);
  } finally {
    await fixture.db.close();
  }
});

test("real PostgreSQL serializes concurrent assignment changes and rechecks revoked scope", async () => {
  const dir = mkdtempSync(join(tmpdir(), "assignment-transitions-postgres-"));
  const dataDir = join(dir, "data");
  const portServer = createServer();
  await new Promise<void>((resolve, reject) => {
    portServer.once("error", reject);
    portServer.listen(0, "127.0.0.1", resolve);
  });
  const address = portServer.address();
  assert.ok(address && typeof address === "object");
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    portServer.close(error => error ? reject(error) : resolve()));

  let started = false;
  let pool: pg.Pool | undefined;
  try {
    execFileSync("initdb", ["-D", dataDir, "-U", "transition_test_owner", "-A", "trust", "--no-locale"], {
      stdio: "pipe",
    });
    execFileSync("pg_ctl", ["-D", dataDir, "-l", join(dir, "postgres.log"), "-o",
      `-k ${dir} -h '' -p ${port} -F`, "-w", "start"], { stdio: "pipe" });
    started = true;
    const db = pool = new pg.Pool({
      host: dir,
      port,
      database: "postgres",
      user: "transition_test_owner",
      max: 8,
    });
    for (const name of [
      "agency-training.sql",
      "agency-training-packet-review.sql",
      "agency-training-assignment-transitions.sql",
      "agency-training-packet-guards.sql",
    ]) {
      await db.query(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
    }

    const previousAssignmentId = randomUUID();
    const trustedFtoAssignmentId = randomUUID();
    await db.query(
      `INSERT INTO agency_training.coordinator_directory (id,name) VALUES
        ($1,'TEST Coordinator'),($2,'TEST Other Coordinator')`,
      [coordinator.id, unauthorizedCoordinator.id],
    );
    await db.query(
      `INSERT INTO agency_training.assignments (
        id,class_name,phase,fto_id_hash,fto_badge_hash,fto_name,
        po_id_hash,po_badge_hash,po_name,coordinator_id_hash,starts_on,ends_on,
        active,fto_id,fto_badge,po_id,po_badge,coordinator_id
      ) VALUES
        ($1,$2,1,$3,$4,'TEST Old FTO',$5,$6,'TEST PO',$7,'2026-01-01','2026-12-31',true,$8,$9,$10,$11,$12),
        ($13,$2,1,$14,$15,'TEST Successor FTO',$16,$17,'TEST Other PO',$7,
          '2026-01-01','2026-12-31',true,$18,$19,'TEST-other-po','TEST-P2',$12)`,
      [
        previousAssignmentId, className, hash(oldFto.id), hash(oldFto.badge),
        hash(poId), hash(poBadge), hash(coordinator.id), oldFto.id, oldFto.badge,
        poId, poBadge, coordinator.id,
        trustedFtoAssignmentId, hash(successorFto.id), hash(successorFto.badge),
        hash("TEST-other-po"), hash("TEST-P2"), successorFto.id, successorFto.badge,
      ],
    );
    await db.query(
      `INSERT INTO agency_training.po_coordinators (po_id,po_id_hash,po_badge,coordinator_id)
       VALUES ($1,$2,$3,$4)`,
      [poId, hash(poId), poBadge, coordinator.id],
    );

    const transitionStore = createAgencyAssignmentTransitionStore(db);
    const sameOperation = successorInput(previousAssignmentId);
    const retries = await Promise.all([
      transitionStore.create(coordinator, sameOperation),
      transitionStore.create(coordinator, sameOperation),
    ]);
    assert.deepEqual(retries.map(result => result.created).sort(), [false, true]);
    assert.equal(retries[0]?.transition.successor_assignment_id,
      retries[1]?.transition.successor_assignment_id);
    assert.equal((await db.query(
      "SELECT count(*)::int AS count FROM agency_training.assignment_transitions WHERE po_id=$1",
      [poId],
    )).rows[0]?.count, 1);
    assert.equal((await db.query(
      "SELECT count(*)::int AS count FROM agency_training.assignments WHERE po_id=$1",
      [poId],
    )).rows[0]?.count, 2);

    const competingPoId = "TEST-concurrent-transition-po";
    const competingPoBadge = "TEST-P3";
    const competingAssignmentId = randomUUID();
    await db.query(
      `INSERT INTO agency_training.assignments (
        id,class_name,phase,fto_id_hash,fto_badge_hash,fto_name,
        po_id_hash,po_badge_hash,po_name,coordinator_id_hash,starts_on,ends_on,
        active,fto_id,fto_badge,po_id,po_badge,coordinator_id
      ) VALUES ($1,$2,1,$3,$4,'TEST Old FTO',$5,$6,'TEST Concurrent PO',$7,
        '2026-01-01','2026-12-31',true,$8,$9,$10,$11,$12)`,
      [
        competingAssignmentId, className, hash(oldFto.id), hash(oldFto.badge),
        hash(competingPoId), hash(competingPoBadge), hash(coordinator.id),
        oldFto.id, oldFto.badge, competingPoId, competingPoBadge, coordinator.id,
      ],
    );
    await db.query(
      `INSERT INTO agency_training.po_coordinators (po_id,po_id_hash,po_badge,coordinator_id)
       VALUES ($1,$2,$3,$4)`,
      [competingPoId, hash(competingPoId), competingPoBadge, coordinator.id],
    );
    const contenders = await Promise.allSettled([
      transitionStore.create(coordinator, successorInput(competingAssignmentId)),
      transitionStore.create(coordinator, successorInput(competingAssignmentId)),
    ]);
    assert.equal(contenders.filter(result => result.status === "fulfilled").length, 1);
    const conflict = contenders.find(result => result.status === "rejected");
    assert.ok(conflict?.status === "rejected");
    assert.ok(conflict.reason instanceof PacketError);
    assert.equal(conflict.reason.status, 409);
    assert.equal((await db.query(
      "SELECT count(*)::int AS count FROM agency_training.assignment_transitions WHERE po_id=$1",
      [competingPoId],
    )).rows[0]?.count, 1);
    assert.equal((await db.query(
      "SELECT count(*)::int AS count FROM agency_training.assignments WHERE po_id=$1",
      [competingPoId],
    )).rows[0]?.count, 2);

    await db.query(
      "UPDATE agency_training.po_coordinators SET coordinator_id=$2 WHERE po_id=$1",
      [poId, unauthorizedCoordinator.id],
    );
    await assert.rejects(
      transitionStore.create(coordinator, sameOperation),
      error => error instanceof PacketError && error.status === 403,
      "an idempotent retry must recheck current scope on real PostgreSQL",
    );
    assert.equal((await db.query(
      "SELECT count(*)::int AS count FROM agency_training.assignment_transitions WHERE operation_id=$1",
      [sameOperation.operation_id],
    )).rows[0]?.count, 1);
  } finally {
    await pool?.end();
    if (started) {
      execFileSync("pg_ctl", ["-D", dataDir, "-m", "immediate", "-w", "stop"], { stdio: "pipe" });
    }
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the HTTP routes derive authority from the verified identity and accept no local roster claims", async () => {
  let createCalls = 0;
  let routeIdentity = coordinator;
  const transition = {
    operation_id: randomUUID(),
    occurred_at: new Date("2026-04-30T12:00:00.000Z"),
    class_name: className,
    po_name: "TEST PO",
    po_badge: poBadge,
    previous_assignment_id: randomUUID(),
    successor_assignment_id: randomUUID(),
    previous_phase: 1,
    successor_phase: 2,
    previous_fto_name: "TEST Old FTO",
    previous_fto_badge: oldFto.badge,
    successor_fto_name: "TEST Successor FTO",
    successor_fto_badge: successorFto.badge,
    previous_ends_on: "2026-04-30",
    successor_starts_on: "2026-05-01",
    successor_ends_on: "2026-12-31",
  };
  const stub = {
    context: async () => ({ available: true, role: "FTO_COORDINATOR", assignments: [], ftos: [], transitions: [] }),
    create: async () => { createCalls++; return { created: true, transition }; },
  } as unknown as ReturnType<typeof createAgencyAssignmentTransitionStore>;
  const app = express();
  app.use(express.json());
  app.use(createAgencyAssignmentTransitionsRouter(
    (_req, res, next) => { res.locals.agencyIdentity = routeIdentity; next(); },
    () => stub,
  ));
  const server = await new Promise<ReturnType<typeof app.listen>>(resolve => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}/v1/agency/assignment-transitions`;
    const context = await fetch(`${baseUrl}/context`);
    assert.equal(context.status, 200);
    assert.equal(context.headers.get("cache-control"), "private, no-store");

    const invalid = await fetch(baseUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...successorInput(randomUUID()), fto_name: "Browser-selected FTO" }),
    });
    assert.equal(invalid.status, 400);
    assert.equal(createCalls, 0);

    const valid = await fetch(baseUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(successorInput(randomUUID())),
    });
    assert.equal(valid.status, 201);
    assert.equal(createCalls, 1);
    const body = await valid.json() as { data: Array<{ successor_fto_name: string }> };
    assert.equal(body.data[0]?.successor_fto_name, "TEST Successor FTO");

    routeIdentity = oldFto;
    const forbidden = await fetch(`${baseUrl}/context`);
    assert.equal(forbidden.status, 403);
    assert.equal(createCalls, 1);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close(error => error ? reject(error) : resolve()));
  }
});
