import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import type pg from "pg";
import express from "express";
import type { Server } from "node:http";
import { PGlite } from "@electric-sql/pglite";
import { createAgencyPacketStore } from "../src/lib/agency-packet-store.js";
import { createPacketReviewStore } from "../src/lib/packet-review-store.js";
import { createTrainingAlertStore, nrtCategories } from "../src/lib/training-alert-store.js";
import { createTrainingAlertsRouter } from "../src/routes/training-alerts.js";
import type { AgencyIdentity } from "../src/security/agencyIdentity.js";
import { hashUserIdentifier as hash } from "../src/utils/cryptoUtils.js";

// Isolated, in-memory PostgreSQL engine with fictional TEST identities only.
const fto: AgencyIdentity = { id: "TEST-fto", badge: "TEST-2", role: "FTO" };
const otherFto: AgencyIdentity = { id: "TEST-other-fto", badge: "TEST-5", role: "FTO" };
const po: AgencyIdentity = { id: "TEST-po", badge: "TEST-1", role: "PO" };
const coord: AgencyIdentity = { id: "TEST-coordinator", badge: "TEST-3", role: "FTO_COORDINATOR" };
const other: AgencyIdentity = { id: "TEST-other-coordinator", badge: "TEST-4", role: "FTO_COORDINATOR" };
const sgt: AgencyIdentity = { id: "TEST-sergeant", badge: "TEST-6", role: "FTO_SGT" };
const sgt2: AgencyIdentity = { id: "TEST-sergeant-2", badge: "TEST-7", role: "FTO_SGT" };
const coc: AgencyIdentity = { id: "TEST-coc", badge: "TEST-8", role: "FTO_COC" };
const report = { id: "TEST-packet", date: "2026-11-22", phase: 4, className: "TEST ONLY",
  recruitBadge: po.badge, ftoBadge: fto.badge, recruitName: "TEST PO", ftoName: "TEST FTO", status: "draft",
  reportingForDuty: { reviewedAt: "2026-11-22T12:00:00Z" }, ratingsReviewedAt: "2026-11-22T12:00:00Z",
  runs: [], narrative: "TEST narrative", remedial: "", recruitComments: "", activity: {},
  ratings: { officerSafety: { rating: "NRT", justification: "TEST" }, reportWriting: { rating: "NRT", justification: "TEST" },
    driving: { rating: "Acceptable", justification: "" } } };

const baseMigrations = ["agency-training.sql", "agency-training-packet-review.sql", "agency-training-po-totals-review-upgrade.sql",
  "agency-training-staff-class-access.sql", "agency-training-packet-guards.sql"];
async function setup() {
  const db = new PGlite();
  for (const file of [...baseMigrations, "agency-training-alerts.sql"])
    await db.exec(await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
  const query = async (sql: string, params: unknown[] = []) => db.query(sql, params);
  let queue = Promise.resolve();
  const pool = { query, connect: async () => {
    const previous = queue; let release!: () => void;
    queue = new Promise<void>(resolve => { release = resolve; });
    await previous; return { query, release };
  } } as unknown as pg.Pool;
  await query("INSERT INTO agency_training.coordinator_directory (id,name) VALUES ($1,'TEST Coordinator'),($2,'TEST Other')", [coord.id, other.id]);
  await query(`INSERT INTO agency_training.assignments
    (id,class_name,phase,fto_id_hash,fto_badge_hash,fto_name,po_id_hash,po_badge_hash,po_name,
     coordinator_id_hash,starts_on,ends_on,fto_id,fto_badge,po_id,po_badge,coordinator_id)
    VALUES ($1,$2,4,$3,$4,'TEST FTO',$5,$6,'TEST PO',$7,'2026-01-01','2026-12-31',$8,$9,$10,$11,$12)`,
    [randomUUID(), report.className, hash(fto.id), hash(fto.badge), hash(po.id), hash(po.badge), hash(coord.id),
      fto.id, fto.badge, po.id, po.badge, coord.id]);
  const review = createPacketReviewStore(pool);
  await review.assign(po, { po_id: po.id, coordinator_id: coord.id, expected_revision: 0 });
  return { db, query, pool, packets: createAgencyPacketStore(pool), alerts: createTrainingAlertStore(pool) };
}
const audit = () => ({ requestId: randomUUID(), clientIp: "192.0.2.1" });

test("NRT categories skip limbo days and ignore other ratings", () => {
  assert.deepEqual(nrtCategories(report), ["officerSafety", "reportWriting"]);
  assert.deepEqual(nrtCategories({ ...report, limboDay: true }), []);
  assert.deepEqual(nrtCategories({ ratings: { "bad key": { rating: "NRT" } } }), []);
});

test("server alerts: NRT on finalize, review request, Week 15 and closing", async t => {
  const { db, query, packets, alerts } = await setup();
  try {
    await alerts.registerRecipient(coord, "coordinator@example.test");
    await alerts.registerRecipient(other, "other@example.test");
    await alerts.registerRecipient(sgt, "sergeant@example.test");
    await alerts.registerRecipient(sgt2, "sergeant2@example.test");
    await alerts.registerRecipient(fto, "fto@example.test");

    await t.test("finalizing a Daily Packet with NRT opens one alert per category for the assigned Coordinator and every Sergeant", async () => {
      await packets.sync(fto, audit(), [{ operation_id: randomUUID(), base_version: 0, report }]);
      const hashRow = await query("SELECT content_hash FROM agency_training.packets WHERE id=$1", [report.id]);
      await packets.finalize(fto, audit(), report.id, { operation_id: randomUUID(), base_version: 1, content_hash: String(hashRow.rows[0].content_hash) });
      const coordList = (await alerts.list(coord, "open")).items;
      assert.deepEqual(coordList.map(a => [a.kind, a.category]).sort(), [["NRT", "officerSafety"], ["NRT", "reportWriting"]]);
      assert.equal((await alerts.list(other, "open")).items.length, 0);
      assert.equal((await alerts.list(sgt, "open")).items.length, 2);
      assert.equal((await alerts.list(sgt2, "open")).items.length, 2);
      await assert.rejects(alerts.list(coc, "open"), /ALERT_FORBIDDEN/);
      await assert.rejects(alerts.list(po, "open"), /ALERT_FORBIDDEN/);
      const outbox = await query(`SELECT recipient_id FROM agency_training.alert_email_outbox ORDER BY recipient_id`);
      assert.deepEqual([...new Set(outbox.rows.map((r: any) => r.recipient_id))].sort(), [coord.id, sgt.id, sgt2.id].sort());
      assert.equal(outbox.rows.length, 6);
    });

    await t.test("a corrected resubmission of the same packet does not duplicate NRT alerts", async () => {
      const sub = await query("SELECT id FROM agency_training.packet_submissions");
      const review = createPacketReviewStore({ query, connect: async () => ({ query, release() {} }) } as unknown as pg.Pool);
      await review.act(po, String(sub.rows[0].id), { operation_id: randomUUID(), action: "review_totals", note: "" });
      await review.act(coord, String(sub.rows[0].id), { operation_id: randomUUID(), action: "acknowledge", note: "" });
      await review.detail(coord, String(sub.rows[0].id));
      await review.act(coord, String(sub.rows[0].id), { operation_id: randomUUID(), action: "return", note: "TEST correction" });
      await packets.sync(fto, audit(), [{ operation_id: randomUUID(), base_version: 1, report: { ...report, narrative: "TEST corrected" } }]);
      const hashRow = await query("SELECT content_hash FROM agency_training.packets WHERE id=$1", [report.id]);
      await packets.finalize(fto, audit(), report.id, { operation_id: randomUUID(), base_version: 2, content_hash: String(hashRow.rows[0].content_hash) });
      assert.equal((await alerts.list(sgt, "open")).items.length, 2);
    });

    await t.test("NRT review request requires an active assignment to the PO", async () => {
      await assert.rejects(alerts.requestNrtReview(otherFto, { po_badge: po.badge, report_ids: [report.id], summary: "" }), /ASSIGNMENT_REQUIRED/);
      await assert.rejects(alerts.requestNrtReview(coord, { po_badge: po.badge, report_ids: [report.id], summary: "" }), /ALERT_FORBIDDEN/);
      const created = await alerts.requestNrtReview(fto, { po_badge: po.badge, report_ids: [report.id], summary: "TEST summary" });
      assert.equal(created.kind, "NRT_REVIEW_REQUEST");
      assert.equal(created.po_name, "TEST PO");
      assert.equal((await alerts.list(fto, "open")).items.length, 3);
    });

    await t.test("Not release opens an alert when saved; a change to Release stays on the same alert", async () => {
      assert.equal((await alerts.saveWeek15(fto, { po_badge: po.badge, choice: "release" })).alert, null);
      const opened = (await alerts.saveWeek15(fto, { po_badge: po.badge, choice: "not_release" })).alert!;
      assert.equal(opened.kind, "NOT_RELEASE");
      assert.equal((await alerts.saveWeek15(fto, { po_badge: po.badge, choice: "not_release" })).alert!.id, opened.id);
      const changed = (await alerts.saveWeek15(fto, { po_badge: po.badge, choice: "release" })).alert!;
      assert.equal(changed.id, opened.id);
      assert.equal(changed.week15_choice, "release");
      assert.ok(changed.week15_changed_at);
      const notices = await query(`SELECT notice FROM agency_training.alert_email_outbox WHERE alert_id=$1 AND recipient_id=$2 ORDER BY id`, [opened.id, coord.id]);
      assert.deepEqual(notices.rows.map((r: any) => r.notice), ["NOT_RELEASE", "NOT_RELEASE_CHANGED"]);
    });

    await t.test("a Coordinator or Sergeant closes for everyone with a required note", async () => {
      const first = (await alerts.list(sgt, "open")).items.find(a => a.kind === "NRT")!;
      await assert.rejects(alerts.close(sgt, first.id, "   "), /NOTE_REQUIRED/);
      await assert.rejects(alerts.close(fto, first.id, "TEST"), /CLOSE_FORBIDDEN/);
      await assert.rejects(alerts.close(other, first.id, "TEST"), /ALERT_NOT_FOUND/);
      const closed = await alerts.close(sgt, first.id, "TEST reviewed with the FTO", "TEST Sergeant");
      assert.equal(closed.state, "closed");
      assert.equal(closed.closed_by_role, "FTO_SGT");
      assert.equal(closed.closed_by_name, "TEST Sergeant");
      assert.match(closed.closed_at!, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/);
      assert.ok(closed.closed_at);
      assert.ok(!(await alerts.list(coord, "open")).items.some(a => a.id === first.id));
      assert.ok((await alerts.list(coord, "closed")).items.some(a => a.id === first.id));
      await assert.rejects(alerts.close(coord, first.id, "TEST again"), /ALREADY_CLOSED/);
      const events = await query(`SELECT action FROM agency_training.training_alert_events WHERE alert_id=$1 ORDER BY id`, [first.id]);
      assert.deepEqual(events.rows.map((r: any) => r.action), ["CREATED", "CLOSED"]);
    });

    await t.test("restricted runtime can raise and close alerts but cannot edit or delete alert history", async () => {
      await db.exec(`CREATE ROLE test_alert_runtime;
        GRANT USAGE ON SCHEMA agency_training TO test_alert_runtime;
        GRANT SELECT ON agency_training.assignments,agency_training.po_coordinators,agency_training.coordinator_directory TO test_alert_runtime;
        GRANT SELECT,INSERT ON agency_training.training_alerts,agency_training.alert_recipients,
          agency_training.alert_email_outbox,agency_training.training_alert_events TO test_alert_runtime;
        GRANT UPDATE(week15_choice,week15_changed_at,summary,report_ids,state,closed_by_hash,closed_by_name,closed_by_role,closed_at,close_note)
          ON agency_training.training_alerts TO test_alert_runtime;
        GRANT UPDATE(role,email,active,updated_at) ON agency_training.alert_recipients TO test_alert_runtime;
        GRANT UPDATE(status,attempts,last_error_code,sent_at) ON agency_training.alert_email_outbox TO test_alert_runtime;
        GRANT USAGE ON ALL SEQUENCES IN SCHEMA agency_training TO test_alert_runtime;
        SET ROLE test_alert_runtime;`);
      try {
        await alerts.registerRecipient(sgt, "sergeant-new@example.test");
        const opened = (await alerts.saveWeek15(fto, { po_badge: po.badge, choice: "not_release" })).alert!;
        assert.equal((await alerts.close(coord, opened.id, "TEST runtime close")).state, "closed");
        await assert.rejects(query("UPDATE agency_training.training_alerts SET po_name='tampered'"), /permission denied/);
        await assert.rejects(query("DELETE FROM agency_training.training_alerts"), /permission denied/);
        await assert.rejects(query("UPDATE agency_training.training_alert_events SET note='tampered'"), /permission denied/);
        await assert.rejects(query("DELETE FROM agency_training.alert_email_outbox"), /permission denied/);
      } finally { await db.exec("RESET ROLE"); }
    });

    await t.test("routes validate input and scope by the verified identity", async () => {
      const app = express(); app.use(express.json());
      let who = sgt;
      app.use(createTrainingAlertsRouter((_req, res, next) => { res.locals.agencyIdentity = who; next(); }, () => alerts, async () => ({ email: null, name: null })));
      await serve(app, async url => {
        const list = await fetch(`${url}/v1/alerts`);
        assert.equal(list.status, 200);
        const id = ((await list.json()) as { items: Array<{ id: string }> }).items[0].id;
        assert.equal((await fetch(`${url}/v1/alerts/${id}/close`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ note: "" }) })).status, 400);
        who = coc;
        assert.equal((await fetch(`${url}/v1/alerts`)).status, 403);
        who = fto;
        const bad = await fetch(`${url}/v1/alerts/week15`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ po_badge: po.badge, choice: "maybe" }) });
        assert.equal(bad.status, 400);
      });
    });
  } finally { await db.close(); }
});

test("finalization still succeeds when the alert migration has not been applied", async () => {
  const db = new PGlite();
  try {
    for (const file of baseMigrations)
      await db.exec(await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
    const query = async (sql: string, params: unknown[] = []) => db.query(sql, params);
    const pool = { query, connect: async () => ({ query, release() {} }) } as unknown as pg.Pool;
    await query("INSERT INTO agency_training.coordinator_directory (id,name) VALUES ($1,'TEST Coordinator')", [coord.id]);
    await query(`INSERT INTO agency_training.assignments
      (id,class_name,phase,fto_id_hash,fto_badge_hash,fto_name,po_id_hash,po_badge_hash,po_name,
       coordinator_id_hash,starts_on,ends_on,fto_id,fto_badge,po_id,po_badge,coordinator_id)
      VALUES ($1,$2,4,$3,$4,'TEST FTO',$5,$6,'TEST PO',$7,'2026-01-01','2026-12-31',$8,$9,$10,$11,$12)`,
      [randomUUID(), report.className, hash(fto.id), hash(fto.badge), hash(po.id), hash(po.badge), hash(coord.id),
        fto.id, fto.badge, po.id, po.badge, coord.id]);
    await createPacketReviewStore(pool).assign(po, { po_id: po.id, coordinator_id: coord.id, expected_revision: 0 });
    const packets = createAgencyPacketStore(pool);
    await packets.sync(fto, audit(), [{ operation_id: randomUUID(), base_version: 0, report }]);
    const hashRow = await query("SELECT content_hash FROM agency_training.packets WHERE id=$1", [report.id]);
    const saved = await packets.finalize(fto, audit(), report.id, { operation_id: randomUUID(), base_version: 1, content_hash: String(hashRow.rows[0].content_hash) });
    assert.equal(saved[0].sync_status, "submitted_complete");
    await assert.rejects(createTrainingAlertStore(pool).list(sgt, "open"), /ALERTS_NOT_INSTALLED/);
  } finally { await db.close(); }
});

async function serve(app: express.Express, run: (url: string) => Promise<void>) {
  let server: Server | undefined;
  try {
    server = await new Promise<Server>(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
    const address = server.address(); assert.ok(address && typeof address === "object");
    await run(`http://127.0.0.1:${address.port}`);
  } finally { if (server) await new Promise<void>((resolve, reject) => server!.close(e => e ? reject(e) : resolve())); }
}

test("test email sender renders notices without names and leaves them queued for the relay", async () => {
  const { db, query, packets, alerts } = await setup();
  try {
    const { alertEmailMode, renderNotice, runTestEmailPass, TEST_MODE_MARK } = await import("../src/lib/alert-email-sender.js");
    assert.deepEqual(alertEmailMode({}), { mode: "off" });
    assert.deepEqual(alertEmailMode({ ALERT_EMAIL_MODE: "Test" }), { mode: "test" });
    assert.deepEqual(alertEmailMode({ ALERT_EMAIL_MODE: "relay" }), { mode: "off", unknown: "relay" });
    assert.equal(renderNotice("NRT", "http://insecure.example.test").text.includes("http://"), false);
    assert.match(renderNotice("NRT", "https://portal.example.test").text, /https:\/\/portal\.example\.test$/);

    await alerts.registerRecipient(coord, "coordinator@example.test");
    await alerts.registerRecipient(sgt, "sergeant@example.test");
    await packets.sync(fto, audit(), [{ operation_id: randomUUID(), base_version: 0, report }]);
    const hashRow = await query("SELECT content_hash FROM agency_training.packets WHERE id=$1", [report.id]);
    await packets.finalize(fto, audit(), report.id, { operation_id: randomUUID(), base_version: 1, content_hash: String(hashRow.rows[0].content_hash) });

    const seen: any[] = [];
    const pool = { query } as unknown as pg.Pool;
    assert.deepEqual(await runTestEmailPass(pool, m => seen.push(m)), { rendered: 4 });
    assert.equal(seen.length, 4);
    for (const message of seen) {
      const all = JSON.stringify(message);
      for (const secret of ["TEST PO", "TEST FTO", po.badge, fto.badge, "officerSafety", "example.test", coord.id, sgt.id])
        assert.equal(all.includes(secret), false, `notice leaked ${secret}`);
      assert.equal(message.subject, "FTO Portal alert: NRT rating");
    }
    const rows = await query("SELECT status,attempts,last_error_code,sent_at FROM agency_training.alert_email_outbox");
    assert.ok(rows.rows.every((r: any) => r.status === "queued" && r.attempts === 0 && r.last_error_code === TEST_MODE_MARK && r.sent_at === null));
    assert.deepEqual(await runTestEmailPass(pool, m => seen.push(m)), { rendered: 0 });
  } finally { await db.close(); }
});

test("test email sender does nothing before the alert migration is applied", async () => {
  const db = new PGlite();
  try {
    const { runTestEmailPass } = await import("../src/lib/alert-email-sender.js");
    const pool = { query: async (sql: string, params: unknown[] = []) => db.query(sql, params) } as unknown as pg.Pool;
    assert.deepEqual(await runTestEmailPass(pool, () => assert.fail("no notices")), { rendered: 0 });
  } finally { await db.close(); }
});
