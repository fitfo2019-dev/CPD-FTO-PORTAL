import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import type { Pool } from "pg";
import test from "node:test";
import type { PhaseExtensionRequestInput } from "@workspace/api-zod";
import {
  createPhaseExtensionRequestStore,
  type PhaseExtensionRequestStore,
  type SharedPhaseExtensionRequest,
} from "../lib/phase-extension-store.js";
import { hashUserIdentifier as hash } from "../utils/cryptoUtils.js";
import {
  createPhaseExtensionRequestsRouter,
  getPhaseExtensionRoleFromPublicMetadata,
} from "./phase-extension-requests.js";

const ftoA = { userId: "test-phase-fto-a", role: "FTO" as const };
const ftoB = { userId: "test-phase-fto-b", role: "FTO" as const };
const coordinatorA = { userId: "test-phase-coordinator-a", role: "FTO_COORDINATOR" as const };
const coordinatorB = { userId: "test-phase-coordinator-b", role: "FTO_COORDINATOR" as const };

const request: PhaseExtensionRequestInput = {
  id: "phase-extension-request-a1",
  className: "Class A",
  recruitName: "Client supplied name",
  recruitBadge: "TEST-PO-A",
  phase: 1,
  phaseStartDate: "2026-11-01",
  requestingFtoName: "Client supplied FTO",
  requestingFtoBadge: "TEST-CLIENT",
  extensionType: "training_weeks",
  requestedWeeks: 1,
  justification: "Additional coaching is needed.",
};

async function withApi(
  caller: { userId: string; role: "FTO" | "FTO_COORDINATOR" } | null,
  store: PhaseExtensionRequestStore,
  run: (baseUrl: string) => Promise<void>,
) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    Object.assign(req, {
      log: { error: (..._values: unknown[]) => undefined },
    });
    next();
  });
  app.use(createPhaseExtensionRequestsRouter({
    resolveCaller: async () => caller
      ? { caller }
      : { error: { status: 401, code: "AUTHENTICATION_REQUIRED", message: "Sign in." } },
    getStore: () => store,
  }));
  const server: Server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server failed to start.");
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close(error => error ? reject(error) : resolve()),
    );
  }
}

async function seedAssignment(
  db: PGlite,
  values: {
    ftoId: string;
    ftoBadge: string;
    ftoName: string;
    poId: string;
    poBadge: string;
    poName: string;
    coordinatorId: string;
    className: string;
  },
) {
  await db.query(
    `INSERT INTO agency_training.assignments (
      id, class_name, phase, fto_id_hash, fto_badge_hash, fto_name, po_id_hash,
      po_badge_hash, po_name, coordinator_id_hash, starts_on, ends_on,
      fto_id, fto_badge, po_id, po_badge, coordinator_id
    ) VALUES ($1,$2,1,$3,$4,$5,$6,$7,$8,$9,'2026-11-01','2027-12-31',$10,$11,$12,$13,$14)`,
    [
      randomUUID(),
      values.className,
      hash(values.ftoId),
      hash(values.ftoBadge),
      values.ftoName,
      hash(values.poId),
      hash(values.poBadge),
      values.poName,
      hash(values.coordinatorId),
      values.ftoId,
      values.ftoBadge,
      values.poId,
      values.poBadge,
      values.coordinatorId,
    ],
  );
}

test("agency migration installs phase-extension requests and roster-scoped review works through the API", async t => {
  const db = new PGlite();
  const migration = (name: string) =>
    readFile(new URL(`../../migrations/${name}`, import.meta.url), "utf8");
  try {
    await db.exec(await migration("agency-training.sql"));
    await db.exec(await migration("agency-training-packet-review.sql"));
    await db.exec(await migration("agency-training-phase-extensions.sql"));
    const schema = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema='agency_training' AND table_name='phase_extension_requests'`,
    );
    assert.equal(schema.rows.length, 1);

    await db.query(
      `INSERT INTO agency_training.coordinator_directory(id,name) VALUES
       ($1,'Test Coordinator A'),($2,'Test Coordinator B')`,
      [coordinatorA.userId, coordinatorB.userId],
    );
    await seedAssignment(db, {
      ftoId: ftoA.userId,
      ftoBadge: "TEST-FTO-A",
      ftoName: "Trusted FTO A",
      poId: "test-phase-po-a",
      poBadge: "TEST-PO-A",
      poName: "Trusted Recruit A",
      coordinatorId: coordinatorA.userId,
      className: "Class A",
    });
    await seedAssignment(db, {
      ftoId: ftoB.userId,
      ftoBadge: "TEST-FTO-B",
      ftoName: "Trusted FTO B",
      poId: "test-phase-po-b",
      poBadge: "TEST-PO-B",
      poName: "Trusted Recruit B",
      coordinatorId: coordinatorB.userId,
      className: "Class B",
    });
    await db.query(
      `INSERT INTO agency_training.po_coordinators
       (po_id,po_id_hash,po_badge,coordinator_id) VALUES
       ($1,$2,$3,$4),($5,$6,$7,$8)`,
      [
        "test-phase-po-a",
        hash("test-phase-po-a"),
        "TEST-PO-A",
        coordinatorA.userId,
        "test-phase-po-b",
        hash("test-phase-po-b"),
        "TEST-PO-B",
        coordinatorB.userId,
      ],
    );

    const pool = { query: (sql: string, params?: unknown[]) => db.query(sql, params) } as unknown as Pick<Pool, "query">;
    const store = createPhaseExtensionRequestStore(pool);

    await t.test("only a matching active FTO assignment can submit, and roster details override client claims", async () => {
      await withApi(ftoA, store, async baseUrl => {
        const submitted = await fetch(`${baseUrl}/v1/phase-extension-requests`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(request),
        });
        assert.equal(submitted.status, 201, await submitted.clone().text());
        const payload = await submitted.json() as { data: SharedPhaseExtensionRequest[] };
        assert.equal(payload.data[0].recruitName, "Trusted Recruit A");
        assert.equal(payload.data[0].requestingFtoName, "Trusted FTO A");
        assert.equal(payload.data[0].requestingFtoBadge, "TEST-FTO-A");

        const retried = await fetch(`${baseUrl}/v1/phase-extension-requests`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(request),
        });
        assert.equal(retried.status, 200);
        assert.equal((await db.query("SELECT id FROM agency_training.phase_extension_requests")).rows.length, 1);

        const changedRetry = await fetch(`${baseUrl}/v1/phase-extension-requests`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...request, requestedWeeks: 2 }),
        });
        assert.equal(changedRetry.status, 409);

        const crossClass = await fetch(`${baseUrl}/v1/phase-extension-requests`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...request,
            id: "phase-extension-cross-class",
            className: "Class B",
            recruitBadge: "TEST-PO-B",
          }),
        });
        assert.equal(crossClass.status, 403);
      });
    });

    await t.test("pending requests follow the current Coordinator assignment", async () => {
      await withApi(coordinatorB, store, async baseUrl => {
        const list = await fetch(`${baseUrl}/v1/phase-extension-requests`);
        const payload = await list.json() as { data: SharedPhaseExtensionRequest[] };
        assert.equal(payload.data.length, 0);
        const denied = await fetch(`${baseUrl}/v1/phase-extension-requests/${request.id}/review`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ decision: "approve" }),
        });
        assert.equal(denied.status, 404);
      });

      await withApi(coordinatorA, store, async baseUrl => {
        const list = await fetch(`${baseUrl}/v1/phase-extension-requests`);
        const payload = await list.json() as { data: SharedPhaseExtensionRequest[] };
        assert.equal(payload.data.length, 1);
      });

      await db.query(
        `UPDATE agency_training.po_coordinators SET coordinator_id=$1
         WHERE po_id=$2`,
        [coordinatorB.userId, "test-phase-po-a"],
      );

      await withApi(coordinatorA, store, async baseUrl => {
        const list = await fetch(`${baseUrl}/v1/phase-extension-requests`);
        const payload = await list.json() as { data: SharedPhaseExtensionRequest[] };
        assert.equal(payload.data.length, 0);
        const denied = await fetch(`${baseUrl}/v1/phase-extension-requests/${request.id}/review`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ decision: "approve" }),
        });
        assert.equal(denied.status, 404);
      });

      await withApi(coordinatorB, store, async baseUrl => {
        const list = await fetch(`${baseUrl}/v1/phase-extension-requests`);
        const payload = await list.json() as { data: SharedPhaseExtensionRequest[] };
        assert.equal(payload.data.length, 1);
        assert.equal(payload.data[0].id, request.id);
        assert.equal(payload.data[0].status, "pending");

        const competingDecisions = await Promise.all(["approve", "deny"].map(decision =>
          fetch(`${baseUrl}/v1/phase-extension-requests/${request.id}/review`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ decision }),
          }),
        ));
        assert.deepEqual(
          competingDecisions.map(result => result.status).sort(),
          [200, 409],
        );
      });

      const decision = await db.query<{
        status: string;
        reviewed_by_user_id: string;
        reviewed_at: Date | null;
      }>(
        `SELECT status, reviewed_by_user_id, reviewed_at
         FROM agency_training.phase_extension_requests WHERE id=$1`,
        [request.id],
      );
      assert.ok(["approved", "denied"].includes(decision.rows[0].status));
      assert.equal(decision.rows[0].reviewed_by_user_id, coordinatorB.userId);
      assert.ok(decision.rows[0].reviewed_at instanceof Date);

      await withApi(ftoA, store, async baseUrl => {
        const list = await fetch(`${baseUrl}/v1/phase-extension-requests`);
        const payload = await list.json() as { data: SharedPhaseExtensionRequest[] };
        assert.equal(payload.data[0].status, decision.rows[0].status);
      });
    });

    await t.test("inactive assignments and disabled Coordinator roster entries stop access", async () => {
      await db.query("UPDATE agency_training.assignments SET active=false WHERE class_name='Class A'");
      await withApi(ftoA, store, async baseUrl => {
        const denied = await fetch(`${baseUrl}/v1/phase-extension-requests`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...request, id: "phase-extension-inactive-assignment" }),
        });
        assert.equal(denied.status, 403);
      });
      assert.equal((await store.listPending(coordinatorA.userId)).length, 0);
      await db.query("UPDATE agency_training.assignments SET active=true WHERE class_name='Class A'");
      await db.query(
        "UPDATE agency_training.coordinator_directory SET active=false WHERE id=$1",
        [coordinatorA.userId],
      );
      assert.equal((await store.listPending(coordinatorA.userId)).length, 0);
      const result = await store.review(request.id, coordinatorA.userId, "deny");
      assert.equal(result.request, null);
    });
  } finally {
    await db.close();
  }
});

test("phase-extension requests work with the documented non-owner PostgreSQL grants", async () => {
  const dir = mkdtempSync(join(tmpdir(), "phase-extension-"));
  const dataDir = join(dir, "data");
  const portProbe = createServer();
  await new Promise<void>(resolve => portProbe.listen(0, "127.0.0.1", resolve));
  const address = portProbe.address();
  if (!address || typeof address === "string") throw new Error("Could not reserve a PostgreSQL port.");
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    portProbe.close(error => error ? reject(error) : resolve()),
  );

  let started = false;
  let ownerPool: pg.Pool | undefined;
  let runtimePool: pg.Pool | undefined;
  try {
    execFileSync("initdb", ["-D", dataDir, "-U", "phase_extension_owner", "-A", "trust", "--no-locale"], {
      stdio: "pipe",
    });
    execFileSync("pg_ctl", ["-D", dataDir, "-l", join(dir, "postgres.log"), "-o",
      `-k ${dir} -h '' -p ${port} -F`, "-w", "start"], { stdio: "pipe" });
    started = true;
    ownerPool = new pg.Pool({ host: dir, port, user: "phase_extension_owner", database: "postgres", max: 3 });

    const migration = (name: string) =>
      readFile(new URL(`../../migrations/${name}`, import.meta.url), "utf8");
    await ownerPool.query(await migration("agency-training.sql"));
    await ownerPool.query(await migration("agency-training-packet-review.sql"));
    await ownerPool.query(await migration("agency-training-phase-extensions.sql"));

    const assignmentId = randomUUID();
    await ownerPool.query(
      `INSERT INTO agency_training.coordinator_directory(id,name) VALUES ($1,'Test Coordinator')`,
      [coordinatorA.userId],
    );
    await ownerPool.query(
      `INSERT INTO agency_training.assignments (
        id,class_name,phase,fto_id_hash,fto_badge_hash,fto_name,po_id_hash,
        po_badge_hash,po_name,coordinator_id_hash,starts_on,ends_on,
        fto_id,fto_badge,po_id,po_badge,coordinator_id
      ) VALUES ($1,'Class A',1,$2,$3,'Trusted FTO',$4,$5,'Trusted Recruit',$6,
        '2026-11-01','2027-12-31',$7,'TEST-FTO-A',$8,'TEST-PO-A',$9)`,
      [
        assignmentId,
        hash(ftoA.userId),
        hash("TEST-FTO-A"),
        hash("test-phase-po-a"),
        hash("TEST-PO-A"),
        hash(coordinatorA.userId),
        ftoA.userId,
        "test-phase-po-a",
        coordinatorA.userId,
      ],
    );
    await ownerPool.query(
      `INSERT INTO agency_training.po_coordinators
       (po_id,po_id_hash,po_badge,coordinator_id) VALUES ($1,$2,'TEST-PO-A',$3)`,
      ["test-phase-po-a", hash("test-phase-po-a"), coordinatorA.userId],
    );

    await ownerPool.query(`CREATE ROLE phase_extension_runtime LOGIN;
      GRANT USAGE ON SCHEMA agency_training TO phase_extension_runtime;
      GRANT SELECT (id,class_name,phase,fto_id_hash,fto_name,po_id_hash,
        po_badge_hash,po_name,coordinator_id_hash,starts_on,active,po_id,
        po_badge,fto_id,fto_badge) ON agency_training.assignments TO phase_extension_runtime;
      GRANT SELECT (id,active) ON agency_training.coordinator_directory TO phase_extension_runtime;
      GRANT SELECT (po_id,po_id_hash,coordinator_id)
        ON agency_training.po_coordinators TO phase_extension_runtime;
      GRANT SELECT ON agency_training.phase_extension_requests TO phase_extension_runtime;
      GRANT INSERT (id,assignment_id,requester_user_id,class_name,recruit_name,
        recruit_badge,phase,phase_start_date,requesting_fto_name,
        requesting_fto_badge,extension_type,requested_weeks,justification,
        status,created_at) ON agency_training.phase_extension_requests TO phase_extension_runtime;
      GRANT UPDATE (status,reviewed_at,reviewed_by_user_id)
        ON agency_training.phase_extension_requests TO phase_extension_runtime;`);

    runtimePool = new pg.Pool({ host: dir, port, user: "phase_extension_runtime", database: "postgres", max: 3 });
    const store = createPhaseExtensionRequestStore(runtimePool);
    const requestId = `limited-${randomUUID()}`;
    const submittedRequest = { ...request, id: requestId };

    await withApi(ftoA, store, async baseUrl => {
      const submitted = await fetch(`${baseUrl}/v1/phase-extension-requests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(submittedRequest),
      });
      assert.equal(submitted.status, 201, await submitted.clone().text());
      const ftoList = await fetch(`${baseUrl}/v1/phase-extension-requests`);
      const ftoPayload = await ftoList.json() as { data: SharedPhaseExtensionRequest[] };
      assert.equal(ftoPayload.data[0].id, requestId);
      assert.equal(ftoPayload.data[0].status, "pending");
    });

    await withApi(coordinatorA, store, async baseUrl => {
      const coordinatorList = await fetch(`${baseUrl}/v1/phase-extension-requests`);
      const coordinatorPayload = await coordinatorList.json() as { data: SharedPhaseExtensionRequest[] };
      assert.equal(coordinatorPayload.data.length, 1);
      assert.equal(coordinatorPayload.data[0].id, requestId);
      const reviewed = await fetch(`${baseUrl}/v1/phase-extension-requests/${requestId}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision: "approve" }),
      });
      assert.equal(reviewed.status, 200, await reviewed.clone().text());
      const reviewedPayload = await reviewed.json() as { data: SharedPhaseExtensionRequest[] };
      assert.equal(reviewedPayload.data[0].status, "approved");
    });

    await assert.rejects(runtimePool.query(
      "UPDATE agency_training.assignments SET active=false WHERE id=$1",
      [assignmentId],
    ));
    await assert.rejects(runtimePool.query(
      "UPDATE agency_training.phase_extension_requests SET justification='rewritten' WHERE id=$1",
      [requestId],
    ));
    await assert.rejects(runtimePool.query(
      `UPDATE agency_training.phase_extension_requests
       SET status='denied', reviewed_at=NOW(), reviewed_by_user_id=$2 WHERE id=$1`,
      [requestId, coordinatorA.userId],
    ), /can only be decided once/);
    await assert.rejects(runtimePool.query(
      "DELETE FROM agency_training.phase_extension_requests WHERE id=$1",
      [requestId],
    ));

    const persisted = await ownerPool.query(
      `SELECT status,justification FROM agency_training.phase_extension_requests WHERE id=$1`,
      [requestId],
    );
    assert.deepEqual(persisted.rows[0], {
      status: "approved",
      justification: request.justification,
    });
    const assignment = await ownerPool.query(
      "SELECT active FROM agency_training.assignments WHERE id=$1",
      [assignmentId],
    );
    assert.equal(assignment.rows[0].active, true);
  } finally {
    await runtimePool?.end();
    await ownerPool?.end();
    if (started) {
      execFileSync("pg_ctl", ["-D", dataDir, "-m", "immediate", "-w", "stop"], { stdio: "pipe" });
    }
    rmSync(dir, { recursive: true, force: true });
  }
});

test("client role preview data cannot authorize Coordinator review", async () => {
  const store: PhaseExtensionRequestStore = {
    async listForFto() { return []; },
    async listPending() { return []; },
    async create() { throw new Error("Not used."); },
    async review() { throw new Error("Not used."); },
  };
  await withApi(ftoA, store, async baseUrl => {
    const denied = await fetch(`${baseUrl}/v1/phase-extension-requests/forged/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "approve", role: "FTO_COORDINATOR" }),
    });
    assert.equal(denied.status, 403);
  });
});

test("unauthenticated clients cannot list shared requests", async () => {
  const store: PhaseExtensionRequestStore = {
    async listForFto() { return []; },
    async listPending() { return []; },
    async create() { throw new Error("Not used."); },
    async review() { throw new Error("Not used."); },
  };
  await withApi(null, store, async baseUrl => {
    const response = await fetch(`${baseUrl}/v1/phase-extension-requests`);
    assert.equal(response.status, 401);
  });
});

test("only server-managed FieldReady role metadata grants request access", () => {
  assert.equal(getPhaseExtensionRoleFromPublicMetadata({ fieldreadyRole: "FTO" }), "FTO");
  assert.equal(getPhaseExtensionRoleFromPublicMetadata({ fieldreadyRole: "FTO_COORDINATOR" }), "FTO_COORDINATOR");
  assert.equal(getPhaseExtensionRoleFromPublicMetadata({ fieldreadyRole: "FTO_COORDINATOR", role: "FTO" }), "FTO_COORDINATOR");
  assert.equal(getPhaseExtensionRoleFromPublicMetadata({ fieldreadyRole: "FTO", clientPreview: "FTO_COORDINATOR" }), "FTO");
  assert.equal(getPhaseExtensionRoleFromPublicMetadata({ fieldreadyRole: "fto_coordinator" }), null);
  assert.equal(getPhaseExtensionRoleFromPublicMetadata(null), null);
});
