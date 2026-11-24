/** Synthetic characterization checks, not agency DB/SSO certification.
 * Some passing assertions deliberately reproduce launch blockers. */
import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import type pg from "pg";
import { createTrainingPacketsRouter } from "../src/routes/training-packets.js";
import { createAgencyPacketStore, PacketError } from "../src/lib/agency-packet-store.js";
import { hashUserIdentifier } from "../src/utils/cryptoUtils.js";
import { CATEGORIES, emptyRatings, emptyDailyActivitySummary, emptyReportingForDutyRecord } from "../../field-training/src/lib/model.js";

const identity = { id: "SYNTHETIC-READINESS-FTO", badge: "TEST-FTO", role: "FTO" as const };
const audit = { requestId: crypto.randomUUID(), clientIp: "192.0.2.52" };
const assignmentId = "00000000-0000-4000-8000-000000000052";
function report(id = "SYNTHETIC-packet") {
  return { id, date: "2026-11-23", phase: 2, className: "SYNTHETIC ONLY",
    recruitName: "Fictional PO", recruitBadge: "TEST-PO", ftoName: "Fictional FTO",
    ftoBadge: identity.badge, shift: "B-Co", zone: "", precinct: "", cruiserDistrict: "",
    createdAt: "", updatedAt: "", signatures: {}, activity: emptyDailyActivitySummary(),
    reportingForDuty: emptyReportingForDutyRecord(), ratings: emptyRatings(), runs: [],
    status: "draft" as const, narrative: "", remedial: "", recruitComments: "" };
}
function fakeDatabase() {
  const queries: string[] = [];
  const packets = new Map<string, Record<string, unknown>>();
  let failAudit = false;
  const client = {
    async query(sql: string, args: unknown[] = []) {
      queries.push(sql);
      if (sql.includes("FROM agency_training.assignments")) return { rows: [{
        id: assignmentId, fto_name: "Fictional FTO", po_name: "Fictional PO",
        fto_badge_hash: hashUserIdentifier(identity.badge), po_badge_hash: hashUserIdentifier("TEST-PO"),
        class_name: "SYNTHETIC ONLY", phase: 2,
      }] };
      if (sql.startsWith("SELECT operation_id")) return { rows: packets.has(String(args[0])) ? [packets.get(String(args[0]))] : [] };
      if (sql.includes("INSERT INTO agency_training.packets")) packets.set(String(args[0]), {
        assignment_id: args[1], operation_id: args[4], content_hash: args[5], server_version: 1,
      });
      if (sql.includes("INSERT INTO agency_training.packet_events") && failAudit) throw new Error("SYNTHETIC audit failure");
      return { rows: [] };
    }, release() {},
  };
  return { queries, packets, client, setFailAudit() { failAudit = true; },
    store: createAgencyPacketStore({ connect: async () => client } as unknown as pg.Pool) };
}
async function withApi(store: ReturnType<typeof createAgencyPacketStore>, run: (url: string) => Promise<void>) {
  const app = express();
  app.use(createTrainingPacketsRouter((_req, res, next) => {
    res.locals.agencyIdentity = identity; next();
  }, () => store));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try { await run(`http://127.0.0.1:${address.port}/v1/training-packets`); }
  finally { await new Promise<void>(resolve => server.close(() => resolve())); }
}
test("LR-01 CONFIRMED GAP: structurally valid unfinished daily draft receives a sealing receipt", async () => {
  const db = fakeDatabase();
  const unfinished = report();
  assert.equal(CATEGORIES.length, 30);
  await withApi(db.store, async url => {
    const res = await fetch(`${url}/sync`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ packets: [{ operation_id: crypto.randomUUID(), base_version: 0, report: unfinished }] }) });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).data[0].sync_status, "synchronized_complete");
    assert.equal(res.headers.get("cache-control"), null, "packet responses currently lack no-store");
  });
  assert.ok(db.queries.some(sql => sql.includes("INSERT INTO agency_training.packet_assignments")),
    "current store creates packet binding after roster verification; no per-packet preprovision required");
});
test("LR-02 exact retry after lost response is idempotent; changed operation/content conflicts", async () => {
  const db = fakeDatabase();
  const change = { operation_id: crypto.randomUUID(), base_version: 0, report: report() };
  const receipt = await db.store.sync(identity, audit, [change]);
  assert.deepEqual(await db.store.sync(identity, audit, [change]), receipt);
  assert.equal(db.queries.filter(sql => sql.includes("INSERT INTO agency_training.packets")).length, 1);
  for (const altered of [
    { ...change, operation_id: crypto.randomUUID() },
    { ...change, report: { ...change.report, narrative: "Corrected synthetic draft" } },
  ]) await assert.rejects(db.store.sync(identity, audit, [altered]),
    error => error instanceof PacketError && error.status === 409);
});
test("LR-03 reordered batches lock by packet ID and reordered receipts remain valid", async () => {
  const db = fakeDatabase();
  const changes = ["SYNTHETIC-Z", "SYNTHETIC-A"].map(id => ({
    operation_id: crypto.randomUUID(), base_version: 0, report: report(id),
  }));
  assert.deepEqual((await db.store.sync(identity, audit, changes)).map(item => item.id), ["SYNTHETIC-A", "SYNTHETIC-Z"]);
});
test("LR-04 audit failure issues ROLLBACK, never COMMIT (query-contract only)", async () => {
  const db = fakeDatabase(); db.setFailAudit();
  await assert.rejects(db.store.sync(identity, audit, [{
    operation_id: crypto.randomUUID(), base_version: 0, report: report(),
  }]));
  assert.equal(db.queries.at(-1), "ROLLBACK");
  assert.equal(db.queries.includes("COMMIT"), false);
  // This fake does not implement database transactions; actual persistence rollback is an agency staging gate.
});
test("LR-05 101 packet route input is rejected before store execution", async () => {
  const db = fakeDatabase();
  await withApi(db.store, async url => {
    const res = await fetch(`${url}/sync`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ packets: Array.from({ length: 101 }, (_, i) => ({
        operation_id: crypto.randomUUID(), base_version: 0, report: report(`SYNTHETIC-${i}`),
      })) }) });
    assert.equal(res.status, 400);
    assert.equal(db.queries.length, 0);
  });
});
test("LR-06 packet history uses stable 100-record pages and follows records added between requests", async () => {
  const historical = Array.from({ length: 101 }, (_, i) => ({
    id: `SYNTHETIC-${String(i).padStart(3, "0")}`, assignment_id: assignmentId, record_date: "2026-11-23",
    phase: 2, server_version: 1,
    report: { ...report(`SYNTHETIC-${String(i).padStart(3, "0")}`), narrative: "S".repeat(45_000) },
    submission_status: "submitted", content_hash: "a".repeat(64), released_to_po: false,
    released_at: null, withdrawn_at: null, withdrawal_reason: null, amendment_of: null,
    amendment_reason: null, acknowledgment: null,
  }));
  const requests: unknown[][] = [];
  const client = { async query(sql: string, args: unknown[] = []) {
    if (sql.includes("FROM agency_training.packets")) {
      assert.match(sql, /ORDER BY p\.record_date DESC, p\.id DESC LIMIT \$8/);
      assert.match(sql, /a\.fto_id_hash = \$2 AND a\.fto_badge_hash = \$3/);
      requests.push(args);
      const cursorDate = args[5];
      const cursorId = args[6];
      const eligible = cursorDate == null ? historical : historical.filter(packet =>
        packet.record_date < cursorDate || (packet.record_date === cursorDate && packet.id < cursorId));
      return { rows: eligible.slice().sort((a, b) => b.id.localeCompare(a.id)).slice(0, Number(args[7])) };
    }
    return { rows: [] };
  }, release() {} };
  const store = createAgencyPacketStore({ connect: async () => client } as unknown as pg.Pool);
  await withApi(store, async url => {
    let cursor: string | null = null;
    const observed: string[] = [];
    let pageNumber = 0;
    while (true) {
      const response = await fetch(cursor ? `${url}?cursor=${encodeURIComponent(cursor)}` : url);
      assert.equal(response.status, 200);
      const body = await response.text();
      assert.ok(Buffer.byteLength(body, "utf8") <= 2 * 1024 * 1024);
      const result = JSON.parse(body);
      assert.ok(result.data.length <= 100);
      assert.equal(result.metadata.total_records, result.data.length);
      observed.push(...result.data.map((packet: { id: string }) => packet.id));
      pageNumber++;
      if (pageNumber === 1) {
        assert.equal(result.metadata.has_more, true);
        assert.ok(result.data.length < 100, "the byte cap must bound large pages too");
        assert.equal(result.data[0].id, "SYNTHETIC-100");
        historical.push({ ...historical[0], id: "SYNTHETIC-NEW" });
      }
      if (!result.metadata.has_more) {
        assert.equal(result.metadata.next_cursor, null);
        break;
      }
      assert.equal(typeof result.metadata.next_cursor, "string");
      cursor = result.metadata.next_cursor;
    }
    assert.equal(pageNumber, 3);
    assert.equal(new Set(observed).size, 101, "continuations must neither duplicate nor skip existing records");
    assert.equal(observed.at(-1), "SYNTHETIC-000");
    assert.equal(observed.includes("SYNTHETIC-NEW"), false, "newer records do not shift an active history cursor");
    assert.deepEqual(observed, [...observed].sort((a, b) => b.localeCompare(a)));
    assert.equal(requests.length, 3);
    assert.equal(requests[0][0], identity.role);
    assert.equal(requests[1][0], identity.role);
    assert.equal(requests[2][0], identity.role);
    assert.equal(requests[0][4], identity.id);
    assert.equal(requests[1][4], identity.id, "each page uses the signed-in identity and roster scope");
    assert.equal(requests[2][4], identity.id);
    assert.equal(requests[0][7], 101);
    const invalidCursor = await fetch(`${url}?cursor=not-a-valid-cursor`);
    assert.equal(invalidCursor.status, 400);
    assert.equal(requests.length, 3, "invalid cursors are rejected before database access");
  });
});
test("LR-07 readiness reports true for an injected unavailable store without probing it", async () => {
  const db = fakeDatabase();
  await withApi(db.store, async url => {
    const res = await fetch(`${url}/sync-readiness`);
    assert.equal((await res.json()).metadata.can_sync, true);
    assert.equal(db.queries.length, 0);
  });
});
test("LR-08 narratives above the contract limit are rejected without a write", async () => {
  const db = fakeDatabase();
  await withApi(db.store, async url => {
    const res = await fetch(`${url}/sync`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ packets: [{ operation_id: crypto.randomUUID(), base_version: 0,
        report: { ...report(), narrative: "S".repeat(100001) } }] }) });
    assert.equal(res.status, 400); assert.equal(db.queries.length, 0);
  });
});
test("LR-14 aggregate packet payload over 2 MB is rejected before store execution", async () => {
  const db = fakeDatabase();
  await withApi(db.store, async url => {
    const res = await fetch(`${url}/sync`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ packets: Array.from({ length: 50 }, (_, i) => ({
        operation_id: crypto.randomUUID(), base_version: 0,
        report: { ...report(`SYNTHETIC-LARGE-${i}`), narrative: "S".repeat(45000) },
      })) }) });
    assert.equal(res.status, 413);
    assert.equal(db.queries.length, 0);
  });
});
