/** Synthetic packet lifecycle checks, not agency DB/SSO certification. */
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
    reportingForDuty: {...emptyReportingForDutyRecord(),reviewedAt:"2026-11-23T17:00:00Z"},
    ratingsReviewedAt:"2026-11-23T17:00:00Z",ratings: emptyRatings(), runs: [],
    status: "draft" as const, narrative: "", remedial: "", recruitComments: "" };
}
function fakeDatabase() {
  const queries: string[] = [];
  const packets = new Map<string, Record<string, unknown>>();
  const events = new Map<string, Record<string, unknown>>();
  let failAudit = false;
  let rosterAvailable = true;
  const client = {
    async query(sql: string, args: unknown[] = []): Promise<{ rows: Record<string, any>[] }> {
      queries.push(sql);
      if(sql.includes("agency_training.lock_packet_assignment"))
        return {rows:rosterAvailable&&args[1]===identity.id&&args[2]===identity.badge?[{id:assignmentId}]:[]};
      if(sql.includes("agency_training.lock_active_packet_coordinator"))
        return {rows:[{coordinator_id:"SYNTHETIC-COORDINATOR"}]};
      if(sql.includes("SELECT p.server_version,p.content_hash")){
        const packet=packets.get(String(args[0]));
        const content=packet?.report as ReturnType<typeof report>|undefined;
        if(!rosterAvailable||!packet||args[1]!==identity.id||args[2]!==identity.badge||
          content?.recruitBadge!=="TEST-PO"||content.ftoBadge!==identity.badge)return {rows:[]};
        return {rows:[{...packet,po_id:"SYNTHETIC-PO",po_badge:"TEST-PO",
          po_id_hash:hashUserIdentifier("SYNTHETIC-PO"),po_badge_hash:hashUserIdentifier("TEST-PO")}]};
      }
      if (sql.includes("FROM agency_training.assignments")) return { rows: [{
        id: assignmentId, fto_name: "Fictional FTO", po_name: "Fictional PO",
        fto_badge_hash: hashUserIdentifier(identity.badge), po_badge_hash: hashUserIdentifier("TEST-PO"),
        class_name: "SYNTHETIC ONLY", phase: 2,
      }].filter(() => rosterAvailable && args[0] === hashUserIdentifier(identity.id) &&
        args[1] === hashUserIdentifier(identity.badge) &&
        args[2] === hashUserIdentifier("TEST-PO") && args[3] === "SYNTHETIC ONLY" &&
        args[4] === 2 && args[5] === "2026-11-23") };
      if (sql.includes("FROM agency_training.packet_events WHERE operation_id=$1"))
        return { rows: events.has(String(args[0])) ? [events.get(String(args[0]))!] : [] };
      if (sql.includes("FROM agency_training.packets WHERE id=$1 AND assignment_id=$2")) {
        const parent = packets.get(String(args[0]));
        return { rows: parent?.withdrawn_at ? [{ id: parent.id }] : [] };
      }
      if (sql.includes("FROM agency_training.packets WHERE amendment_of=$1")) {
        return { rows: [...packets.values()].some(packet => packet.amendment_of === args[0])
          ? [{ id: args[0] }] : [] };
      }
      if (sql.includes("FOR UPDATE OF p, a")) {
        const packet = packets.get(String(args[0]));
        if (!rosterAvailable || args[1] !== hashUserIdentifier(identity.id) ||
          args[2] !== hashUserIdentifier(identity.badge))
          return { rows: [] };
        const packetReport = packet?.report as ReturnType<typeof report> | undefined;
        if (!packet || packetReport?.className !== "SYNTHETIC ONLY" || packetReport.phase !== 2 ||
          packetReport.date !== packet.record_date || packet.phase !== 2) return { rows: [] };
        return { rows: packet ? [{ ...packet,
          assigned_fto_badge_hash: hashUserIdentifier(identity.badge),
          assigned_po_badge_hash: hashUserIdentifier("TEST-PO") }] : [] };
      }
      if (sql.includes("FROM agency_training.packets p WHERE p.id=$1")) {
        const packet = packets.get(String(args[0]));
        return { rows: packet ? [packet] : [] };
      }
      if (sql.includes("FROM agency_training.packets p JOIN agency_training.packet_assignments pa")) {
        const role = String(args[0]);
        return { rows: [...packets.values()].filter(packet =>
          role === "FTO" || (role === "PO"
            ? packet.sync_status === "submitted_complete" && packet.released_to_po === true && !packet.withdrawn_at
            : packet.sync_status === "submitted_complete")) };
      }
      if (sql.includes("FROM agency_training.packets WHERE id=$1")) {
        const packet = packets.get(String(args[0]));
        return { rows: packet ? [packet] : [] };
      }
      if (sql.includes("INSERT INTO agency_training.packets")) {
        const packet = {
          id: String(args[0]), assignment_id: args[1], record_date: args[2], phase: args[3],
          operation_id: args[4], content_hash: args[5], report: JSON.parse(String(args[6])),
          server_version: 1, sync_status: "local_draft_pending",submission_status:"local_draft_pending", released_to_po: false,
          released_at: null, withdrawn_at: null, withdrawal_reason: null,
          amendment_of: args[7] ?? null, amendment_reason: args[8] ?? null, acknowledgment: null,
        };
        packets.set(packet.id, packet);
      }
      if (sql.includes("UPDATE agency_training.packets") && sql.includes("SET operation_id=$2")) {
        const packet = packets.get(String(args[0]));
        if (packet) Object.assign(packet, { operation_id: args[1], content_hash: args[2],
          report: JSON.parse(String(args[3])), server_version: args[4] });
      }
      if (sql.includes("UPDATE agency_training.packets") && sql.includes("SET submission_status='submitted'")) {
        const packet = packets.get(String(args[0]));
        if (packet) Object.assign(packet,{sync_status:"submitted_complete",submission_status:"submitted",finalization_operation_id:args[1]});
        return { rows: packet ? [{ id: packet.id }] : [] };
      }
      if (sql.includes("INSERT INTO agency_training.packet_events")) {
        if (failAudit) throw new Error("SYNTHETIC audit failure");
        if (sql.includes("'DRAFT_SYNC'") || sql.includes("'FINALIZE'")) {
          events.set(String(args[5]), {
            packet_id: args[1], actor_hash: args[2],
            event_type: sql.includes("'FINALIZE'") ? "FINALIZE" : "DRAFT_SYNC",
            request_hash: args[6], content_hash: args[7], server_version: args[8],
          });
        }
      }
      return { rows: [] };
    }, release() {},
  };
  return { queries, packets, events, client, setFailAudit() { failAudit = true; },
    setRosterAvailable(value: boolean) { rosterAvailable = value; },
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
test("draft synchronization stores an editable snapshot without finalizing it", async () => {
  const db = fakeDatabase();
  const unfinished = report();
  assert.equal(CATEGORIES.length, 30);
  await withApi(db.store, async url => {
    const res = await fetch(`${url}/sync`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ packets: [{ operation_id: crypto.randomUUID(), base_version: 0, report: unfinished }] }) });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data[0].sync_status, "local_draft_pending");
    assert.match(body.data[0].content_hash, /^[a-f0-9]{64}$/);
    assert.equal(res.headers.get("cache-control"), null, "packet responses currently lack no-store");
  });
  assert.ok(db.queries.some(sql => sql.includes("INSERT INTO agency_training.packet_assignments")),
    "current store creates packet binding after roster verification; no per-packet preprovision required");
});
test("draft sync rejects identity or badge claims that do not match the active server roster", async () => {
  const db = fakeDatabase();
  const wrongIdentity = { ...identity, badge: "NOT-ASSIGNED" };
  await assert.rejects(db.store.sync(wrongIdentity, audit, [{
    operation_id: crypto.randomUUID(), base_version: 0, report: report(),
  }]), error => error instanceof PacketError && error.code === "PACKET_ASSIGNMENT_REQUIRED");
  db.setRosterAvailable(false);
  await assert.rejects(db.store.sync(identity, audit, [{
    operation_id: crypto.randomUUID(), base_version: 0, report: report(),
  }]), error => error instanceof PacketError && error.code === "PACKET_ASSIGNMENT_REQUIRED");
  db.setRosterAvailable(true);
  for (const altered of [
    { ...report(), ftoBadge: "NOT-ASSIGNED" },
    { ...report(), recruitBadge: "NOT-ASSIGNED" },
    { ...report(), className: "DIFFERENT CLASS" },
    { ...report(), phase: 3 },
    { ...report(), date: "2026-11-24" },
  ]) await assert.rejects(db.store.sync(identity, audit, [{
    operation_id: crypto.randomUUID(), base_version: 0, report: altered,
  }]), error => error instanceof PacketError && error.code === "PACKET_ASSIGNMENT_REQUIRED");
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
test("LR-06 packet history retains its bounded page and continuation metadata", async () => {
  const historical = Array.from({ length: 101 }, (_, i) => ({
    id: `SYNTHETIC-${i}`, assignment_id: assignmentId, record_date: "2026-11-23",
    phase: 2, server_version: 1, sync_status: "submitted_complete",submission_status:"submitted",
    content_hash: "a".repeat(64), report: report(`SYNTHETIC-${i}`),
    released_to_po: false, released_at: null, withdrawn_at: null, withdrawal_reason: null,
    amendment_of: null, amendment_reason: null, acknowledgment: null,
  }));
  const client = { async query(sql: string) {
    if (sql.includes("FROM agency_training.packets")) {
      assert.match(sql, /LIMIT \$10/);
      return { rows: historical };
    }
    return { rows: [] };
  }, release() {} };
  const store = createAgencyPacketStore({ connect: async () => client } as unknown as pg.Pool);
  await withApi(store, async url => {
    const res = await fetch(url);
    assert.equal(res.status, 200);
    const result = await res.json();
    assert.equal(result.data.length, 100);
    assert.equal(result.metadata.has_more,true);
    assert.equal(typeof result.metadata.next_cursor,"string");
    assert.equal(result.metadata.total_records, 100, "returned count, NOT complete history count");
  });
});
test("LR-07 readiness reports true for an injected unavailable store without probing it", async () => {
  const db = fakeDatabase();
  await withApi(db.store, async url => {
    const res = await fetch(`${url}/sync-readiness`);
    assert.equal((await res.json()).metadata.service_available, true);
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
test("finalization is a distinct idempotent transition and the Coordinator scope excludes drafts", async () => {
  const db = fakeDatabase();
  const initial = { operation_id: crypto.randomUUID(), base_version: 0, report: report() };
  const [draft] = await db.store.sync(identity, audit, [initial]);
  assert.equal(draft.sync_status, "local_draft_pending");
  const coordinator = { id: "SYNTHETIC-COORDINATOR", badge: "TEST-COORD", role: "FTO_COORDINATOR" as const };
  const before = await db.store.read(coordinator, audit);
  assert.equal(before.length, 0);
  const readSql = db.queries.find(sql => sql.includes("FROM agency_training.packets p JOIN agency_training.packet_assignments"));
  assert.match(readSql ?? "", /p\.submission_status = 'submitted'/);
  assert.match(readSql ?? "", /a\.coordinator_id_hash = \$2/);
  const po = { id: "SYNTHETIC-PO", badge: "TEST-PO", role: "PO" as const };
  assert.equal((await db.store.read(po, audit)).length, 0);
  const poSql = db.queries.find(sql => sql.includes("FROM agency_training.packets p JOIN agency_training.packet_assignments")
    && sql.includes("p.released_to_po = true"));
  assert.match(poSql ?? "", /p\.submission_status = 'submitted'/);

  const finalization = { operation_id: crypto.randomUUID(), content_hash: draft.content_hash };
  await assert.rejects(db.store.finalize({ ...identity, badge: "NOT-ASSIGNED" }, audit,
    report().id, finalization),
  error => error instanceof PacketError && error.code === "PACKET_ASSIGNMENT_REQUIRED");
  const saved = db.packets.get(report().id)!;
  const savedReport = saved.report as ReturnType<typeof report>;
  saved.report = { ...savedReport, recruitBadge: "NOT-ASSIGNED" };
  await assert.rejects(db.store.finalize(identity, audit, report().id, finalization),
    error => error instanceof PacketError && error.code === "PACKET_ASSIGNMENT_REQUIRED");
  saved.report = savedReport;
  await assert.rejects(db.store.finalize(identity, audit, report().id, {
    ...finalization, content_hash: "f".repeat(64),
  }), error => error instanceof PacketError && error.code === "PACKET_SNAPSHOT_CONFLICT");
  const [submitted] = await db.store.finalize(identity, audit, report().id, finalization);
  assert.equal(submitted.sync_status, "submitted_complete");
  assert.equal(db.queries.filter(sql=>sql.includes("'SUBMIT'")).length,1);
  const retry = await db.store.finalize(identity, audit, report().id, finalization);
  assert.equal(retry[0].sync_status, "submitted_complete");
  assert.equal(db.queries.filter(sql => sql.includes("'SUBMIT'")).length, 1);

  const after = await db.store.read(coordinator, audit);
  assert.equal(after.length, 1);
  assert.equal(after[0].sync_status, "submitted_complete");
  assert.equal((await db.store.read(po, audit)).length, 0,
    "finalization must not release a packet or make it visible to the PO");
  await assert.rejects(db.store.sync(identity, audit, [{
    ...initial, operation_id: crypto.randomUUID(), base_version: 1,
  }]), error => error instanceof PacketError && error.code === "PACKET_ALREADY_SUBMITTED");
});
test("an authorized withdrawn packet can be replaced only as another editable amendment draft", async () => {
  const db = fakeDatabase();
  const parentId = report().id;
  const [parent] = await db.store.sync(identity, audit, [{
    operation_id: crypto.randomUUID(), base_version: 0, report: report(parentId),
  }]);
  const savedParent = db.packets.get(parentId)!;
  savedParent.withdrawn_at = "2026-11-23T12:00:00.000Z";
  const amendment = report("SYNTHETIC-amendment");
  const [child] = await db.store.sync(identity, audit, [{
    operation_id: crypto.randomUUID(), base_version: 0, report: amendment,
    amendment_of: parentId, amendment_reason: "Corrected fictional record",
  }]);
  assert.equal(child.sync_status, "local_draft_pending");
  assert.equal(db.packets.get(amendment.id)?.amendment_of, parentId);
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
