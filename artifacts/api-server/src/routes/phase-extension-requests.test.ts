import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
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

    await t.test("Coordinators can list and decide only requests in their active roster scope", async () => {
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
      assert.equal(decision.rows[0].reviewed_by_user_id, coordinatorA.userId);
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
