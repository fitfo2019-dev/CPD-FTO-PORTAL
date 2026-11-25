import assert from "node:assert/strict";
import test from "node:test";
import express, { type RequestHandler } from "express";
import type pg from "pg";
import { agencyIdentityFromClaims, type AgencyIdentity } from "../src/security/agencyIdentity.js";
import { createTrainingPacketsRouter, safePacketTree, PACKET_SEG_KEYS } from "../src/routes/training-packets.js";
import { createAgencyPacketStore, encodePacketCursor, PacketError } from "../src/lib/agency-packet-store.js";
import { hashUserIdentifier } from "../src/utils/cryptoUtils.js";
import { CATEGORIES } from "../../field-training/src/lib/model.js";
import { CompletePacketInput } from "../src/lib/packet-contract.js";

const fto: AgencyIdentity = { id: "verified-fto", badge: "1234", role: "FTO" };
const audit = { requestId: crypto.randomUUID(), clientIp: "192.0.2.1" };

test("signed agency claims require explicit verification and valid badge; browser assignment claims do not authorize", () => {
  const before = { role: process.env.AGENCY_ROLE_CLAIM_PATH, badge: process.env.AGENCY_BADGE_CLAIM_PATH,
    verified: process.env.AGENCY_VERIFIED_CLAIM_PATH };
  process.env.AGENCY_ROLE_CLAIM_PATH = "agency.role";
  process.env.AGENCY_BADGE_CLAIM_PATH = "agency.badge";
  process.env.AGENCY_VERIFIED_CLAIM_PATH = "agency.verified";
  try {
    assert.equal(agencyIdentityFromClaims(fto.id, { role: "FTO", badge: "1234" }), null);
    assert.equal(agencyIdentityFromClaims(fto.id, { agency: { role: "FTO", badge: "1234", verified: "true" } }), null);
    assert.deepEqual(agencyIdentityFromClaims(fto.id, {
      agency: { role: "FTO", badge: "1234", verified: true }, assignments: ["spoofed"],
    }), fto);
  } finally {
    for (const [key, value] of Object.entries({
      AGENCY_ROLE_CLAIM_PATH: before.role, AGENCY_BADGE_CLAIM_PATH: before.badge,
      AGENCY_VERIFIED_CLAIM_PATH: before.verified,
    })) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

test("packet category keys match the portal's exact 30-category contract", () => {
  assert.deepEqual(PACKET_SEG_KEYS, CATEGORIES);
});
test("the generated-contract bridge preserves complete report details rather than stripping them", () => {
  const report = {
    id: "packet-1", date: "2026-11-23", phase: 1, className: "test",
    recruitName: "Test PO", recruitBadge: "99", ftoName: "Test FTO", ftoBadge: "1234",
    runs: [{
      id:"run-specific-failure",runKind:"traffic_stop",
      checklist:{"task-6":false},
      checklistFailures:{"task-6":["Marked the call number"]},
    }], activity: {}, reportingForDuty: {}, ratings: {}, narrative: "full narrative",
    remedial: "", recruitComments: "", status: "draft", signatures: {}, shift: "A-Co",
    zone: "1", precinct: "1", cruiserDistrict: "11", createdAt: "", updatedAt: "",
    checklistDeficiencies: [{ category: "dutyReadiness", narrative: "Preserve this evidence" }],
  };
  const result = CompletePacketInput.parse({ packets: [
    { operation_id: crypto.randomUUID(), base_version: 0, report },
  ] });
  assert.deepEqual(result.packets[0].report.checklistDeficiencies, report.checklistDeficiencies);
  assert.deepEqual(result.packets[0].report.runs, report.runs);
  assert.equal(result.packets[0].report.date, report.date);
});
test("packet tree rejects prototype pollution, deep nesting and non-JSON values without damaging ordinary prose", () => {
  assert.equal(safePacketTree(JSON.parse('{"__proto__":{"admin":true}}')), false);
  assert.equal(safePacketTree({ name: "O'Brien", notes: "A < B; lines\ncontinue" }), true);
  assert.equal(safePacketTree({ score: Infinity }), false);
  let deep: unknown = {};
  for (let index = 0; index < 20; index++) deep = { nested: deep };
  assert.equal(safePacketTree(deep), false);
});

async function withApi(auth: RequestHandler | undefined,
  callback: (base: string) => Promise<void>, store?: ReturnType<typeof createAgencyPacketStore>) {
  const app = express();
  app.use("/api", createTrainingPacketsRouter(auth, () => store ?? null));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try { await callback(`http://127.0.0.1:${address.port}/api/v1/training-packets`); }
  finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}
const asRole = (identity: AgencyIdentity): RequestHandler => (_req, res, next) => {
  res.locals.agencyIdentity = identity; next();
};

test("routes fail closed without verified sign-in and reject PO/coordinator uploads", async () => {
  await withApi(undefined, async base => {
    const response = await fetch(base);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).status, "error");
  });
  for (const role of ["PO", "FTO_COORDINATOR"] as const) {
    await withApi(asRole({ ...fto, role }), async base => {
      const response = await fetch(`${base}/sync`, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ packets: [] }) });
      assert.equal(response.status, 403);
    });
  }
});

test("valid identity cannot upload malformed packets or use an unconfigured database", async () => {
  await withApi(asRole(fto), async base => {
    assert.equal((await fetch(base)).status, 503);
    const bad = await fetch(`${base}/sync`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ packets: [{ operation_id: crypto.randomUUID(), base_version: 0,
        report: { id: "packet-1" } }] }) });
    assert.equal(bad.status, 400);
  });
});

test("roster denial rolls back the batch and never inserts packet contents", async () => {
  const queries: string[] = [];
  const client = {
    async query(sql: string) { queries.push(sql); return { rows: [] }; }, release() {},
  };
  const pool = { async connect() { return client; } } as unknown as pg.Pool;
  const store = createAgencyPacketStore(pool);
  await assert.rejects(store.sync(fto, audit, [{
    operation_id: crypto.randomUUID(), base_version: 0,
    report: { id: "packet-1", date: "2026-11-23", phase: 1, className: "test", recruitBadge: "99", ftoBadge: "1234" },
  }]), error => error instanceof PacketError && error.status === 403);
  assert.ok(queries.includes("ROLLBACK"));
  assert.ok(!queries.some(sql => sql.includes("INSERT INTO agency_training.packets")));
});

test("coordinator read scope is specific to its server roster identity, never a blanket boolean", async () => {
  const calls: Array<{ sql: string; parameters?: unknown[] }> = [];
  const client = {
    async query(sql: string, parameters?: unknown[]) { calls.push({ sql, parameters }); return { rows: [] }; }, release() {},
  };
  const pool = { async connect() { return client; } } as unknown as pg.Pool;
  await createAgencyPacketStore(pool).read({ ...fto, role: "FTO_COORDINATOR" }, audit);
  const read = calls.find(call => call.sql.includes("FROM agency_training.packets"));
  assert.ok(read?.sql.includes("a.coordinator_id_hash = $2"));
  assert.equal(read?.parameters?.[0], "FTO_COORDINATOR");
  assert.match(String(read?.parameters?.[1]), /^[a-f0-9]{64}$/);
  assert.match(String(read?.parameters?.[2]), /^[a-f0-9]{64}$/);
});

test("packet history cursors cannot cross FTO or Coordinator roster scopes", async () => {
  type ScopedPacket = {
    row: Record<string, unknown>;
    ftoId: string;
    ftoBadge: string;
    coordinatorId: string;
  };
  const coordinator = { id: "assigned-coordinator", badge: "coord-badge", role: "FTO_COORDINATOR" as const };
  const otherCoordinator = { id: "other-coordinator", badge: "other-coord-badge", role: "FTO_COORDINATOR" as const };
  const otherFto = { id: "other-fto", badge: "other-fto-badge", role: "FTO" as const };
  const packets: ScopedPacket[] = [];
  const addPackets = (prefix: string, count: number, owner: AgencyIdentity, assignedCoordinator: string) => {
    for (let index = 0; index < count; index++) {
      const id = `${prefix}-${String(index).padStart(3, "0")}`;
      packets.push({
        ftoId: owner.id,
        ftoBadge: owner.badge,
        coordinatorId: assignedCoordinator,
        row: {
          id,
          assignment_id: `${prefix}-assignment`,
          record_date: "2026-11-23",
          phase: 1,
          server_version: 1,
          report: { id },
          submission_status: "submitted",
          content_hash: "a".repeat(64),
          released_to_po: false,
          released_at: null,
          withdrawn_at: null,
          withdrawal_reason: null,
          amendment_of: null,
          amendment_reason: null,
          acknowledgment: null,
        },
      });
    }
  };
  addPackets("fto-a", 101, fto, otherCoordinator.id);
  addPackets("fto-0", 4, otherFto, otherCoordinator.id);
  const calls: Array<{ sql: string; parameters: unknown[] }> = [];
  const client = {
    async query(sql: string, parameters: unknown[] = []) {
      if (sql.includes("FROM agency_training.packets p JOIN agency_training.packet_assignments")) {
        calls.push({ sql, parameters });
        // Model the roster predicate against fixture assignments while also
        // asserting every DB read carries that predicate and the keyset bound.
        assert.match(sql, /WHERE \(a\.active AND pa\.active AND/);
        assert.match(sql, /\(p\.record_date, p\.id\) < \(\$8::date, \$9::text\)/);
        const [role, identityHash, badgeHash, , coordinatorId, , , afterDate, afterId, limit] = parameters;
        const visible = packets.filter(packet => {
          if (role === "FTO")
            return hashUserIdentifier(packet.ftoId) === identityHash &&
              hashUserIdentifier(packet.ftoBadge) === badgeHash;
          if (role === "FTO_COORDINATOR")
            return packet.coordinatorId === coordinatorId ||
              hashUserIdentifier(packet.coordinatorId) === identityHash;
          return false;
        }).filter(packet => afterDate == null || String(packet.row.record_date) < String(afterDate) ||
          (String(packet.row.record_date) === String(afterDate) &&
            String(packet.row.id) < String(afterId)))
          .sort((left, right) => String(right.row.record_date).localeCompare(String(left.row.record_date)) ||
            String(right.row.id).localeCompare(String(left.row.id)))
          .slice(0, Number(limit))
          .map(packet => packet.row);
        return { rows: visible };
      }
      return { rows: [] };
    },
    release() {},
  };
  const store = createAgencyPacketStore({ connect: async () => client } as unknown as pg.Pool);
  const readPage = (identity: AgencyIdentity, cursor?: string) =>
    store.readPage(identity, audit, cursor);
  const firstFtoPage = await readPage(fto);
  assert.equal(firstFtoPage.data.length, 100);
  assert.equal(firstFtoPage.hasMore, true);
  const ftoCursor = encodePacketCursor(
    String(firstFtoPage.data.at(-1)!.record_date),
    String(firstFtoPage.data.at(-1)!.id),
  );
  const secondFtoPage = await readPage(fto, ftoCursor);
  assert.equal(secondFtoPage.data.length, 1);
  assert.equal(secondFtoPage.hasMore, false);
  assert.ok([...firstFtoPage.data, ...secondFtoPage.data].every(packet =>
    String(packet.assignment_id) === "fto-a-assignment"));

  // A cursor copied from one signed-in person must still use the next
  // request's identity and roster, rather than carrying authorization.
  const reusedByOtherFto = await readPage(otherFto, ftoCursor);
  assert.ok(reusedByOtherFto.data.length > 0);
  assert.ok(reusedByOtherFto.data.every(packet => String(packet.assignment_id) === "fto-0-assignment"));

  // Cursor contents are not trusted as authorization either: moving its
  // position to the start of the sort range may change pagination, not scope.
  const editedCursor = encodePacketCursor("2026-11-23", "zzzz");
  const editedByOtherFto = await readPage(otherFto, editedCursor);
  assert.ok(editedByOtherFto.data.length > 0);
  assert.ok(editedByOtherFto.data.every(packet => String(packet.assignment_id) === "fto-0-assignment"));

  // Coordinator pagination remains limited to packets assigned in its
  // roster, even with another Coordinator's cursor.
  const coordinatorPackets: ScopedPacket[] = [];
  for (let index = 0; index < 101; index++) {
    const id = `coord-a-${String(index).padStart(3, "0")}`;
    coordinatorPackets.push({
      ftoId: fto.id,
      ftoBadge: fto.badge,
      coordinatorId: coordinator.id,
      row: { ...packets[0]!.row, id, assignment_id: "coord-a-assignment" },
    });
  }
  for (let index = 0; index < 3; index++) {
    const id = `coord-0-${String(index).padStart(3, "0")}`;
    coordinatorPackets.push({
      ftoId: otherFto.id,
      ftoBadge: otherFto.badge,
      coordinatorId: otherCoordinator.id,
      row: { ...packets[0]!.row, id, assignment_id: "coord-b-assignment" },
    });
  }
  packets.push(...coordinatorPackets);
  const firstCoordinatorPage = await readPage(coordinator);
  assert.equal(firstCoordinatorPage.data.length, 100);
  assert.equal(firstCoordinatorPage.hasMore, true);
  const coordinatorCursor = encodePacketCursor(
    String(firstCoordinatorPage.data.at(-1)!.record_date),
    String(firstCoordinatorPage.data.at(-1)!.id),
  );
  const secondCoordinatorPage = await readPage(coordinator, coordinatorCursor);
  assert.equal(secondCoordinatorPage.data.length, 1);
  assert.ok([...firstCoordinatorPage.data, ...secondCoordinatorPage.data].every(packet =>
    String(packet.assignment_id) === "coord-a-assignment"));
  const reusedByOtherCoordinator = await readPage(otherCoordinator, coordinatorCursor);
  assert.ok(reusedByOtherCoordinator.data.length > 0);
  assert.ok(reusedByOtherCoordinator.data.every(packet => String(packet.assignment_id) === "coord-b-assignment"));

  assert.ok(calls.every(call => call.parameters[0] === "FTO" || call.parameters[0] === "FTO_COORDINATOR"));
  const ftoRead = calls.find(call => call.parameters[0] === "FTO");
  assert.ok(ftoRead?.sql.includes("a.fto_id_hash = $2 AND a.fto_badge_hash = $3"));
  const coordinatorRead = calls.find(call => call.parameters[0] === "FTO_COORDINATOR");
  assert.ok(coordinatorRead?.sql.includes("pc.coordinator_id=$5"));
  assert.ok(coordinatorRead?.sql.includes("a.coordinator_id_hash = $2"));
});

test("PO packet history pagination excludes drafts, unreleased and withdrawn packets", async () => {
  type PoPacket = {
    poId: string;
    poBadge: string;
    row: Record<string, unknown>;
  };
  const po: AgencyIdentity = { id: "assigned-po", badge: "po-badge", role: "PO" };
  const otherPo: AgencyIdentity = { id: "other-po", badge: "other-po-badge", role: "PO" };
  const packets: PoPacket[] = [];
  const addPacket = (id: string, owner: AgencyIdentity, options: {
    released?: boolean;
    withdrawn?: boolean;
    submissionStatus?: string;
  } = {}) => {
    const released = options.released ?? true;
    const withdrawn = options.withdrawn ?? false;
    packets.push({
      poId: owner.id,
      poBadge: owner.badge,
      row: {
        id,
        assignment_id: `${owner.id}-assignment`,
        record_date: "2026-11-23",
        phase: 1,
        server_version: 1,
        report: { id },
        submission_status: options.submissionStatus ?? "submitted",
        content_hash: "a".repeat(64),
        released_to_po: released,
        released_at: released ? "2026-11-24T12:00:00Z" : null,
        withdrawn_at: withdrawn ? "2026-11-25T12:00:00Z" : null,
        withdrawal_reason: withdrawn ? "Corrected packet" : null,
        amendment_of: null,
        amendment_reason: null,
        acknowledgment: null,
      },
    });
  };

  // More than one page of visible packets ensures the hidden records cannot
  // leak in either the initial query or a subsequent keyset query.
  for (let index = 0; index < 101; index++)
    addPacket(`po-a-released-${String(index).padStart(3, "0")}`, po);
  addPacket("po-a-unreleased-submitted", po, { released: false });
  addPacket("po-a-unreleased-draft", po, { released: false, submissionStatus: "draft" });
  addPacket("po-a-released-draft", po, { submissionStatus: "draft" });
  addPacket("po-a-withdrawn", po, { released: false, withdrawn: true });
  for (let index = 0; index < 3; index++)
    addPacket(`aa-po-b-released-${String(index).padStart(3, "0")}`, otherPo);

  const calls: Array<{ sql: string; parameters: unknown[] }> = [];
  const client = {
    async query(sql: string, parameters: unknown[] = []) {
      if (sql.includes("FROM agency_training.packets p JOIN agency_training.packet_assignments")) {
        calls.push({ sql, parameters });
        assert.match(sql, /a\.po_id_hash = \$2 AND a\.po_badge_hash = \$3/);
        assert.match(sql, /p\.released_to_po = true AND p\.withdrawn_at IS NULL/);
        assert.match(sql, /p\.submission_status = 'submitted' OR \$1 = 'FTO'/);
        assert.match(sql, /\(p\.record_date, p\.id\) < \(\$8::date, \$9::text\)/);
        const [role, identityHash, badgeHash, , , , , afterDate, afterId, limit] = parameters;
        const visible = packets.filter(packet =>
          role === "PO" &&
          hashUserIdentifier(packet.poId) === identityHash &&
          hashUserIdentifier(packet.poBadge) === badgeHash &&
          packet.row.released_to_po === true &&
          packet.row.withdrawn_at === null &&
          packet.row.submission_status === "submitted",
        ).filter(packet => afterDate == null || String(packet.row.record_date) < String(afterDate) ||
          (String(packet.row.record_date) === String(afterDate) &&
            String(packet.row.id) < String(afterId)))
          .sort((left, right) => String(right.row.record_date).localeCompare(String(left.row.record_date)) ||
            String(right.row.id).localeCompare(String(left.row.id)))
          .slice(0, Number(limit))
          .map(packet => packet.row);
        return { rows: visible };
      }
      return { rows: [] };
    },
    release() {},
  };
  const store = createAgencyPacketStore({ connect: async () => client } as unknown as pg.Pool);
  const firstPage = await store.readPage(po, audit);
  assert.equal(firstPage.data.length, 100);
  assert.equal(firstPage.hasMore, true);
  const cursor = encodePacketCursor(
    String(firstPage.data.at(-1)!.record_date),
    String(firstPage.data.at(-1)!.id),
  );
  const secondPage = await store.readPage(po, audit, cursor);
  assert.equal(secondPage.data.length, 1);
  assert.equal(secondPage.hasMore, false);

  const allPoPages = [...firstPage.data, ...secondPage.data];
  assert.equal(allPoPages.length, 101);
  assert.ok(allPoPages.every(packet =>
    String(packet.assignment_id) === "assigned-po-assignment" &&
    packet.released_to_po === true &&
    packet.withdrawn_at === null &&
    packet.sync_status === "submitted_complete",
  ));
  assert.ok(allPoPages.every(packet => !String(packet.id).includes("unreleased") &&
    !String(packet.id).includes("draft") && !String(packet.id).includes("withdrawn")));

  // A cursor only carries position; a new PO request must still apply that
  // request's own identity and the same visibility rules.
  const reusedByOtherPo = await store.readPage(otherPo, audit, cursor);
  assert.equal(reusedByOtherPo.data.length, 3);
  assert.ok(reusedByOtherPo.data.every(packet =>
    String(packet.assignment_id) === "other-po-assignment" &&
    packet.released_to_po === true &&
    packet.withdrawn_at === null &&
    packet.sync_status === "submitted_complete",
  ));
  assert.ok(calls.every(call => call.parameters[0] === "PO"));
});
