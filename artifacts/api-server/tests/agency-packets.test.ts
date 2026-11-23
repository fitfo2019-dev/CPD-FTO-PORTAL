import assert from "node:assert/strict";
import test from "node:test";
import express, { type RequestHandler } from "express";
import type pg from "pg";
import { agencyIdentityFromClaims, type AgencyIdentity } from "../src/security/agencyIdentity.js";
import { createTrainingPacketsRouter, safePacketTree, PACKET_SEG_KEYS } from "../src/routes/training-packets.js";
import { createAgencyPacketStore, PacketError } from "../src/lib/agency-packet-store.js";
import { CATEGORIES } from "../../field-training/src/lib/model.js";

const fto: AgencyIdentity = { id: "verified-fto", badge: "1234", role: "FTO" };

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
  await assert.rejects(store.sync(fto, [{
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
  await createAgencyPacketStore(pool).read({ ...fto, role: "FTO_COORDINATOR" });
  const read = calls.find(call => call.sql.includes("FROM agency_training.packets"));
  assert.ok(read?.sql.includes("a.coordinator_id = $2"));
  assert.deepEqual(read?.parameters?.slice(0, 3), ["FTO_COORDINATOR", fto.id, fto.badge]);
});
