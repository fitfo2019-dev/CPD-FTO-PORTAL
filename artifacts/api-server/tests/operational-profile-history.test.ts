import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import express, { type RequestHandler } from "express";
import type pg from "pg";
import { PGlite } from "@electric-sql/pglite";
import { createOperationalProfileStore } from "../src/lib/operational-profile-store.js";
import { createOperationalProfileRouter } from "../src/routes/operational-profile.js";
import { hashUserIdentifier } from "../src/utils/cryptoUtils.js";
import type { AgencyIdentity } from "../src/security/agencyIdentity.js";

const fto: AgencyIdentity = { id: "FICTIONAL-HISTORY-FTO", badge: "TEST-1", role: "FTO" };
const po: AgencyIdentity = { id: "FICTIONAL-HISTORY-PO", badge: "TEST-2", role: "PO" };
const migrate = async (db: PGlite, name: string) =>
  db.exec(await readFile(new URL(`../migrations/${name}.sql`, import.meta.url), "utf8"));

test("history tracks only successful own-account transitions and marks the existing-profile tracking boundary", async () => {
  const db = new PGlite();
  try {
    await db.exec("CREATE SCHEMA agency_training");
    await migrate(db, "operational-profiles");
    await migrate(db, "operational-profile-optional-sides");
    await db.query(`INSERT INTO agency_training.operational_profiles
      (subject_hash,assignment_token,district_token,cad_unit,company,side,version,updated_at)
      VALUES ($1,'9150E-1','9150','9150E-1','E','1',5,'2026-01-01')`, [hashUserIdentifier(fto.id)]);
    await db.exec(`CREATE TABLE agency_training.packet_test(report jsonb);
      INSERT INTO agency_training.packet_test VALUES ('{"operationalIdentity":{"assignmentToken":"9150E-1"}}')`);
    const packets = await db.query("SELECT report FROM agency_training.packet_test");
    const started = Date.now();
    await migrate(db, "operational-profile-history");
    const store = createOperationalProfileStore({ query: (sql: string, args: unknown[]) => db.query(sql, args) } as unknown as pg.Pool);
    const baseline = (await store.history(fto)).entries[0];
    assert.equal(baseline.event, "baseline");
    assert.equal(baseline.actor, "agency_migration");
    assert.equal(baseline.version, 5);
    assert.ok(baseline.recordedAt.getTime() >= started);
    await migrate(db, "operational-profile-clear");
    assert.deepEqual(await store.history(po), { subject: po.id, entries: [], nextBeforeVersion: null });
    await store.save(po, { assignmentToken: "1234A", expectedVersion: 0 });
    const prior = await store.read(fto);
    const results = await Promise.allSettled(["9151E-1", "9152E-2"].map(assignmentToken =>
      store.save(fto, { assignmentToken, expectedVersion: prior.version })));
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    const saved = await store.read(fto);
    const history = await store.history(fto);
    assert.equal(history.entries.length, 2);
    assert.equal(history.entries[0].oldToken, prior.identity?.assignmentToken);
    assert.equal(history.entries[0].newToken, saved.identity?.assignmentToken);
    assert.equal(history.entries[0].actor, "self");
    assert.equal(history.entries[0].recordedAt.toISOString(), saved.updatedAt?.toISOString());
    const noOp = await store.save(fto, { assignmentToken: saved.identity!.assignmentToken, expectedVersion: saved.version });
    assert.deepEqual(await store.history(fto), history, "No-op saves add no token transition");
    for (const input of [
      { assignmentToken: "9150E-2", expectedVersion: 5 },
      { assignmentToken: "INVALID", expectedVersion: 7 },
      { assignmentToken: "9150E-2", expectedVersion: 7, actor: po.id },
    ]) await assert.rejects(store.save(fto, input));
    assert.deepEqual(await store.history(fto), history, "Denied/invalid writes add no history");
    await assert.rejects(store.history({ ...fto, role: "FTO_COORDINATOR" }), { status: 403 });
    const raw = await db.query("SELECT subject_hash,actor_hash FROM agency_training.operational_profile_history WHERE event='changed'");
    assert.deepEqual(raw.rows, [{ subject_hash: hashUserIdentifier(fto.id), actor_hash: hashUserIdentifier(fto.id) }]);
    assert.doesNotMatch(JSON.stringify(raw.rows), /FICTIONAL|TEST-/);
    assert.deepEqual(await db.query("SELECT report FROM agency_training.packet_test"), packets);

    for (let version = noOp.version; version < noOp.version + 56; version++) {
      await store.save(fto, { assignmentToken: version % 2 ? "9150E" : "9150E-2", expectedVersion: version });
    }
    const first = await store.history(fto);
    assert.equal(first.entries.length, 50);
    assert.equal(first.nextBeforeVersion, first.entries.at(-1)?.version);
    const second = await store.history(fto, first.nextBeforeVersion!);
    assert.equal(second.nextBeforeVersion, null);
    const all = [...first.entries, ...second.entries];
    assert.equal(new Set(all.map(entry => entry.version)).size, all.length);
    assert.equal(all.at(-1)?.event, "baseline");
    assert.equal(all.length, 58);
    assert.equal((await store.history(po)).entries.length, 1);
  } finally { await db.close(); }
});

test("history HTTP reads authenticate each page, reject account selectors and fail closed", async () => {
  let identity: AgencyIdentity | undefined;
  let available = true;
  const reads: string[] = [];
  const auth: RequestHandler = (_req, res, next) => {
    if (!identity) { res.sendStatus(401); return; }
    res.locals.agencyIdentity = identity; next();
  };
  const store = {
    read: async () => { throw new Error("Unexpected profile read"); },
    save: async () => { throw new Error("Unexpected profile save"); },
    history: async (who: AgencyIdentity, before?: number) => {
      reads.push(who.id);
      return { subject: who.id, entries: [], nextBeforeVersion: before ?? null };
    },
  };
  const app = express();
  app.use(createOperationalProfileRouter(auth, () => available ? store : null));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address(); assert.ok(address && typeof address === "object");
  const url = `http://127.0.0.1:${address.port}/v1/account/operational-profile/history`;
  try {
    assert.equal((await fetch(url)).status, 401);
    identity = fto;
    const own = await fetch(url);
    assert.equal(own.status, 200);
    assert.equal(own.headers.get("cache-control"), "no-store");
    assert.equal((await own.json()).subject, fto.id);
    for (const query of [
      `subject=${po.id}`, `accountId=${po.id}`, `userId=${po.id}`, `actor=${po.id}`,
      `beforeVersion=1&subject=${po.id}`, "beforeVersion=0", "beforeVersion=-1",
      "beforeVersion=abc", "beforeVersion=1&beforeVersion=2", "beforeVersion=2147483648",
    ]) assert.equal((await fetch(`${url}?${query}`)).status, 400, query);
    assert.equal((await fetch(`${url}/${po.id}`)).status, 404);
    assert.deepEqual(reads, [fto.id], "Denied cross-account attempts never reach the store");
    assert.equal((await fetch(`${url}?beforeVersion=51`)).status, 200);
    identity = po;
    assert.equal((await (await fetch(`${url}?beforeVersion=51`)).json()).subject, po.id);
    identity = { ...fto, role: "FTO_COORDINATOR" };
    assert.equal((await fetch(url)).status, 403);
    identity = undefined;
    assert.equal((await fetch(`${url}?beforeVersion=51`)).status, 401);
    identity = fto; available = false;
    assert.equal((await fetch(url)).status, 503);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
