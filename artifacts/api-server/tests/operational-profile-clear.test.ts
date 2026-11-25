import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import express, { type RequestHandler } from "express";
import type pg from "pg";
import { PGlite } from "@electric-sql/pglite";
import { createOperationalProfileStore } from "../src/lib/operational-profile-store.js";
import { createOperationalProfileRouter } from "../src/routes/operational-profile.js";
import type { AgencyIdentity } from "../src/security/agencyIdentity.js";

const fto: AgencyIdentity = { id: "FICTIONAL-CLEAR-FTO", role: "FTO", badge: "TEST-1" };
const po: AgencyIdentity = { id: "FICTIONAL-CLEAR-PO", role: "PO", badge: "TEST-2" };
const conflict = { status: 409, code: "PROFILE_VERSION_CONFLICT" };

test("own-account clearing persists a versioned empty state, rejects stale saves and preserves roster/packet snapshots", async () => {
  const db = new PGlite();
  try {
    await db.exec("CREATE SCHEMA agency_training");
    for (const name of ["operational-profiles", "operational-profile-optional-sides", "operational-profile-history", "operational-profile-clear"])
      await db.exec(await readFile(new URL(`../migrations/${name}.sql`, import.meta.url), "utf8"));
    await db.exec(`CREATE TABLE agency_training.untouched_test (kind text, value jsonb);
      INSERT INTO agency_training.untouched_test VALUES
      ('roster','{"fto":"original"}'),('packet','{"operationalIdentity":{"cadUnit":"9150E-1"},"cruiserId":"MANUAL"}')`);
    const before = await db.query("SELECT * FROM agency_training.untouched_test");
    const store = createOperationalProfileStore({ query: (sql: string, args: unknown[]) => db.query(sql, args) } as unknown as pg.Pool);
    const second = await store.save(po, { assignmentToken: "1234A-2", expectedVersion: 0 });
    const first = await store.save(fto, { assignmentToken: "9150E-1", expectedVersion: 0 });
    for (const input of [
      { expectedVersion: first.version }, { expectedVersion: first.version, confirmedNoVehicle: false },
      { expectedVersion: first.version, confirmedNoVehicle: true, subject: po.id },
      { expectedVersion: first.version, confirmedNoVehicle: true, badge: po.badge },
      { expectedVersion: first.version, confirmedNoVehicle: true, role: "FTO_COORDINATOR" },
    ]) await assert.rejects(store.clear(fto, input));
    assert.deepEqual(await store.read(fto), first);
    const empty = await store.clear(fto, { expectedVersion: first.version, confirmedNoVehicle: true });
    assert.equal(empty.identity, null);
    assert.equal(empty.version, first.version + 1);
    assert.deepEqual(await store.read(fto), empty);
    assert.deepEqual(await store.read(po), second);
    const evidence = (await store.history(fto)).entries;
    assert.equal(evidence[0].event, "cleared");
    assert.equal(evidence[0].oldToken, "9150E-1");
    assert.equal(evidence[0].newToken, null);
    assert.equal(evidence[0].version, empty.version);
    await assert.rejects(store.save(fto, { assignmentToken: "9150E-2", expectedVersion: 0 }), conflict);
    await assert.rejects(store.save(fto, { assignmentToken: "9150E-2", expectedVersion: first.version }), conflict);
    await assert.rejects(store.clear(fto, { expectedVersion: first.version, confirmedNoVehicle: true }), conflict);
    for (const update of ["cad_unit='9150E'", "side='1'", "assignment_token='9150E-1'"])
      await assert.rejects(db.exec(`UPDATE agency_training.operational_profiles SET ${update} WHERE assignment_token IS NULL`));
    const restored = await store.save(fto, { assignmentToken: "9150E-2", expectedVersion: empty.version });
    assert.equal(restored.identity?.cadUnit, "9150E");
    assert.equal(restored.identity?.side, "2");
    assert.deepEqual(await db.query("SELECT * FROM agency_training.untouched_test"), before);

    for (const expectedVersion of [restored.version, 0]) {
      const identity = expectedVersion ? fto : { ...fto, id: "FICTIONAL-NEW-CLEAR" };
      const writes = await Promise.allSettled([
        store.clear(identity, { expectedVersion, confirmedNoVehicle: true }),
        store.save(identity, { assignmentToken: "9151E-1", expectedVersion }),
      ]);
      assert.equal(writes.filter(write => write.status === "fulfilled").length, 1);
      const rejected = writes.find(write => write.status === "rejected");
      assert.ok(rejected?.status === "rejected");
      assert.equal(rejected.reason.status, 409);
      assert.equal((await store.read(identity)).version, expectedVersion + 1);
    }
    await assert.rejects(store.clear({ ...fto, role: "FTO_COORDINATOR" }, { expectedVersion: 1, confirmedNoVehicle: true }), { status: 403 });
  } finally { await db.close(); }
});

test("clear endpoint requires signed identity, explicit confirmation and exact own-account input", async () => {
  let who: AgencyIdentity | undefined;
  let writes = 0;
  const auth: RequestHandler = (_req, res, next) => {
    if (!who) { res.sendStatus(401); return; }
    res.locals.agencyIdentity = who; next();
  };
  const empty = (identity: AgencyIdentity) => ({ subject: identity.id, role: identity.role as "FTO" | "PO", badge: identity.badge, identity: null, version: 2 });
  const router = createOperationalProfileRouter(auth, () => ({
    read: async identity => empty(identity), save: async identity => empty(identity),
    clear: async (identity, input) => {
      assert.equal(identity.id, po.id);
      assert.deepEqual(input, { expectedVersion: 1, confirmedNoVehicle: true });
      writes++; return empty(identity);
    },
  }));
  const app = express(); app.use(express.json(), router);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address(); assert.ok(address && typeof address === "object");
  const post = (body: unknown) => fetch(`http://127.0.0.1:${address.port}/v1/account/operational-profile/clear`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  try {
    const valid = { expectedVersion: 1, confirmedNoVehicle: true };
    assert.equal((await post(valid)).status, 401);
    who = { ...fto, role: "FTO_COORDINATOR" };
    assert.equal((await post(valid)).status, 403);
    who = po;
    for (const body of [{ expectedVersion: 1 }, { ...valid, confirmedNoVehicle: false },
      { ...valid, subject: fto.id }, { ...valid, badge: fto.badge }, { ...valid, expectedVersion: -1 }])
      assert.equal((await post(body)).status, 400);
    assert.equal(writes, 0);
    const response = await post(valid);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), empty(po));
    assert.equal(writes, 1);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
