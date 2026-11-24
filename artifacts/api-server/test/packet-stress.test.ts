import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import express, { type RequestHandler } from "express";
import type pg from "pg";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  createFtoFourPhasePacketStressWorkspace,
  FTO_FOUR_PHASE_STRESS_COUNT,
} from "../../field-training/src/lib/test-packet.js";
import { createTrainingPacketsRouter } from "../src/routes/training-packets.js";
import { createAgencyPacketStore } from "../src/lib/agency-packet-store.js";
import type { AgencyIdentity } from "../src/security/agencyIdentity.js";
import { hashUserIdentifier } from "../src/utils/cryptoUtils.js";

const MAX_PACKETS = 100;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const fto: AgencyIdentity = { id: "SYNTHETIC-stress-fto", badge: "TEST-STRESS-FTO", role: "FTO" };
const coordinatorId = "SYNTHETIC-stress-coordinator";

type Change = { operation_id: string; base_version: number; report: Record<string, unknown> };

function bodyFor(changes: Change[]) {
  return JSON.stringify({ packets: changes });
}

async function withServer(app: express.Express, run: (base: string) => Promise<void>) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    await run(`http://127.0.0.1:${address.port}/api/v1/training-packets`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test("synthetic four-phase API cohort stays bounded, retry-safe, scoped, and explicitly submitted", async () => {
  const startedAt = performance.now();
  const db = new PGlite();
  const migration = (name: string) =>
    readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8");
  let cleanupVerified = false;
  try {
    await db.exec(await migration("agency-training.sql"));
    await db.exec(await migration("agency-training-packet-review.sql"));
    await db.exec(await migration("agency-training-packet-guards.sql"));
    const query = async (sql: string, params: unknown[] = []) => db.query(sql, params);
    let queue = Promise.resolve();
    const pool = {
      query,
      connect: async () => {
        const previous = queue;
        let release!: () => void;
        queue = new Promise<void>(resolve => { release = resolve; });
        await previous;
        return { query, release };
      },
    } as unknown as pg.Pool;
    const store = createAgencyPacketStore(pool);
    const auth: RequestHandler = (_req, res, next) => {
      res.locals.agencyIdentity = fto;
      next();
    };
    const app = express();
    app.use("/api", createTrainingPacketsRouter(auth, () => store));

    const workspace = createFtoFourPhasePacketStressWorkspace();
    const cohortReports = workspace.reports;
    const reports = cohortReports
      .filter(report => report.phase === 4 && report.phaseWeek === 3 && report.date === "2025-04-17")
      .map((report, index) => ({
      ...report,
      ftoBadge: fto.badge,
      ftoName: "Synthetic Stress FTO",
      narrative: `${report.narrative}\n${`Synthetic additional scenario detail ${index + 1}. `.repeat(350 + index % 400)}`,
    })) as unknown as Array<Record<string, unknown>>;
    assert.equal(cohortReports.length, 6_800);
    assert.equal(reports.length, FTO_FOUR_PHASE_STRESS_COUNT);

    await query("INSERT INTO agency_training.coordinator_directory (id,name) VALUES ($1,$2)",
      [coordinatorId, "Synthetic Test Coordinator"]);
    const assignmentIds: string[] = [];
    const poIds: string[] = [];
    for (const report of reports) {
      const poBadge = String(report.recruitBadge);
      const poId = `SYNTHETIC-account-${poBadge}`;
      const folder = workspace.phaseFolders.find(item =>
        item.recruitBadge === poBadge && item.phase === report.phase,
      );
      assert.ok(folder);
      const assignmentId = randomUUID();
      assignmentIds.push(assignmentId);
      poIds.push(poId);
      await query(`INSERT INTO agency_training.assignments
        (id,class_name,phase,fto_id_hash,fto_badge_hash,fto_name,po_id_hash,po_badge_hash,po_name,
         coordinator_id_hash,starts_on,ends_on,fto_id,fto_badge,po_id,po_badge,coordinator_id)
        VALUES ($1,$2,$3,$4,$5,'Synthetic Stress FTO',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [assignmentId, report.className, report.phase, hashUserIdentifier(fto.id), hashUserIdentifier(fto.badge),
          hashUserIdentifier(poId), hashUserIdentifier(poBadge), report.recruitName,
          hashUserIdentifier(coordinatorId), folder.phaseStartDate,
          folder.phaseWeekRanges.at(-1)!.endDate, fto.id, fto.badge, poId, poBadge, coordinatorId]);
      await query(`INSERT INTO agency_training.po_coordinators
        (po_id,po_id_hash,po_badge,coordinator_id) VALUES ($1,$2,$3,$4)`,
        [poId, hashUserIdentifier(poId), poBadge, coordinatorId]);
    }

    const metrics = {
      packets: reports.length,
      batchSizes: [] as number[],
      batchBytes: [] as number[],
      batchMilliseconds: [] as number[],
      draftSyncMilliseconds: 0,
      readinessMilliseconds: 0,
      listReadMilliseconds: 0,
      detailReadMilliseconds: 0,
      finalizationMilliseconds: 0,
      listRecords: 0,
      listPages: 0,
      listPageSizes: [] as number[],
      detailReads: 0,
      failures: 0,
      retries: 0,
    };

    await withServer(app, async base => {
      const readinessStart = performance.now();
      const readiness = await fetch(`${base}/sync-readiness`);
      assert.equal(readiness.status, 200);
      assert.equal((await readiness.json() as { metadata: { can_sync: boolean } }).metadata.can_sync, true);
      metrics.readinessMilliseconds = performance.now() - readinessStart;

      const operations = reports.map(report => ({
        operation_id: randomUUID(), base_version: 0, report,
      }));
      // A mixed valid/invalid transaction must roll back its first insert.
      const invalid = [
        operations[0]!,
        { ...operations[1]!, report: { ...operations[1]!.report, recruitBadge: "TEST-NOT-ROSTERED" } },
      ];
      const invalidResponse = await fetch(`${base}/sync`, {
        method: "POST", headers: { "content-type": "application/json" }, body: bodyFor(invalid),
      });
      assert.equal(invalidResponse.status, 403);
      metrics.failures++;
      assert.equal((await query("SELECT count(*)::int AS n FROM agency_training.packets")).rows[0]?.n, 0);

      let offset = 0;
      const snapshotHashes = new Map<string, string>();
      let interruptedBody: string | undefined;
      const draftSyncStarted = performance.now();
      while (offset < operations.length) {
        const batch: Change[] = [];
        while (offset < operations.length && batch.length < MAX_PACKETS) {
          const candidate = [...batch, operations[offset]!];
          const bytes = new TextEncoder().encode(bodyFor(candidate)).byteLength;
          if (bytes > MAX_BODY_BYTES) {
            if (!batch.length) throw new Error(`Synthetic packet ${offset + 1} exceeds the 2 MB limit.`);
            break;
          }
          batch.push(operations[offset]!);
          offset++;
        }
        const body = bodyFor(batch);
        const bytes = new TextEncoder().encode(body).byteLength;
        metrics.batchSizes.push(batch.length);
        metrics.batchBytes.push(bytes);
        const batchStarted = performance.now();
        const response = await fetch(`${base}/sync`, {
          method: "POST", headers: { "content-type": "application/json" }, body,
        });
        assert.equal(response.status, 200, "synthetic packet batch should be accepted");
        const receipts = await response.json() as {
          data: Array<{
            id: string;
            operation_id: string;
            server_version: number;
            sync_status: string;
            content_hash: string;
          }>;
        };
        assert.equal(receipts.data.length, batch.length);
        assert.ok(receipts.data.every(receipt => receipt.sync_status === "local_draft_pending" && receipt.server_version === 1));
        for (const receipt of receipts.data) {
          assert.match(receipt.content_hash, /^[a-f0-9]{64}$/);
          snapshotHashes.set(receipt.id, receipt.content_hash);
        }
        metrics.batchMilliseconds.push(performance.now() - batchStarted);

        // Discard one successful response and retry its exact request once.
        if (metrics.batchSizes.length === 2) {
          interruptedBody = body;
          metrics.retries++;
          const retryStarted = performance.now();
          const retry = await fetch(`${base}/sync`, {
            method: "POST", headers: { "content-type": "application/json" }, body: interruptedBody,
          });
          assert.equal(retry.status, 200);
          const retried = await retry.json() as typeof receipts;
          assert.deepEqual(retried.data, receipts.data);
          metrics.batchMilliseconds[metrics.batchMilliseconds.length - 1] =
            (metrics.batchMilliseconds.at(-1) ?? 0) + performance.now() - retryStarted;
        }
      }
      metrics.draftSyncMilliseconds = performance.now() - draftSyncStarted;

      assert.ok(metrics.batchSizes.every(size => size > 0 && size <= MAX_PACKETS));
      assert.ok(metrics.batchBytes.every(size => size <= MAX_BODY_BYTES));
      assert.ok(metrics.batchSizes.some(size => size < MAX_PACKETS),
        "the varied full packet payload should exercise the body-size boundary");
      assert.equal(
        (await query("SELECT count(*)::int AS n FROM agency_training.packets WHERE submission_status='local_draft_pending'")).rows[0]?.n,
        FTO_FOUR_PHASE_STRESS_COUNT,
      );
      assert.equal((await query("SELECT count(*)::int AS n FROM agency_training.packet_submissions")).rows[0]?.n, 0,
        "draft synchronization must not create final submissions");
      assert.equal((await query("SELECT count(*)::int AS n FROM agency_training.packet_events WHERE event_type='SUBMIT'")).rows[0]?.n, 0);
      const staleEdit = {
        ...operations[0]!,
        operation_id: randomUUID(),
        report: { ...operations[0]!.report, narrative: "Fictional stale-version edit" },
      };
      const conflict = await fetch(`${base}/sync`, {
        method: "POST", headers: { "content-type": "application/json" }, body: bodyFor([staleEdit]),
      });
      assert.equal(conflict.status, 409);
      metrics.failures++;
      assert.equal((await query("SELECT server_version FROM agency_training.packets WHERE id=$1", [
        reports[0]?.id,
      ])).rows[0]?.server_version, 1, "conflict must not overwrite the acknowledged version");

      const listStarted = performance.now();
      const listIds = new Set<string>();
      let cursor: string | null = null;
      do {
        const listResponse = await fetch(`${base}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
        assert.equal(listResponse.status, 200);
        const list = await listResponse.json() as {
          data: Array<{ id: string }>;
          metadata: { total_records: number; has_more: boolean; next_cursor: string | null };
        };
        assert.ok(list.data.length > 0 && list.data.length <= 100,
          "collection reads are bounded by count and serialized bytes");
        assert.equal(list.metadata.total_records, list.data.length);
        for (const packet of list.data) assert.ok(!listIds.has(packet.id), "paged list returned a duplicate packet");
        for (const packet of list.data) listIds.add(packet.id);
        metrics.listPages++;
        metrics.listPageSizes.push(list.data.length);
        cursor = list.metadata.next_cursor;
        assert.equal(list.metadata.has_more, cursor !== null);
      } while (cursor);
      assert.equal(listIds.size, FTO_FOUR_PHASE_STRESS_COUNT);
      metrics.listReadMilliseconds = performance.now() - listStarted;
      metrics.listRecords = listIds.size;
      const seenDetails = new Set<string>();
      const detailStarted = performance.now();
      for (const report of reports) {
        const response = await fetch(`${base}/${encodeURIComponent(String(report.id))}`);
        assert.equal(response.status, 200);
        const packet = await response.json() as {
          data: Array<{
            id: string;
            sync_status: string;
            report: {
              id: string;
              recruitBadge: string;
              recruitName: string;
              phase: number;
              narrative: string;
            };
          }>;
        };
        assert.equal(packet.data.length, 1);
        assert.equal(packet.data[0]?.sync_status, "local_draft_pending");
        const expected = reports.find(item => item.id === report.id)!;
        assert.equal(packet.data[0]?.report.id, report.id);
        assert.equal(packet.data[0]?.report.recruitBadge, expected.recruitBadge);
        assert.equal(packet.data[0]?.report.recruitName, expected.recruitName);
        assert.equal(packet.data[0]?.report.phase, 4);
        assert.ok(packet.data[0]?.report.narrative.endsWith(
          String(expected.narrative).slice(-40),
        ), `retrieved narrative ended unexpectedly for ${String(report.id)}`);
        seenDetails.add(packet.data[0]!.id);
      }
      assert.equal(seenDetails.size, FTO_FOUR_PHASE_STRESS_COUNT);
      metrics.detailReads = seenDetails.size;
      metrics.detailReadMilliseconds = performance.now() - detailStarted;

      // Final submission is a separate, explicit operation for every selected packet.
      const finalizationStarted = performance.now();
      for (const report of reports) {
        const response = await fetch(`${base}/${encodeURIComponent(String(report.id))}/finalize`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            operation_id: randomUUID(),
            content_hash: snapshotHashes.get(String(report.id)),
          }),
        });
        assert.equal(response.status, 200, "explicit synthetic finalization should be accepted");
        const result = await response.json() as {
          data: Array<{ id: string; server_version: number; sync_status: string }>;
        };
        const receipt = result.data[0]!;
        assert.equal(receipt.id, report.id);
        assert.equal(receipt.server_version, 1);
        assert.equal(receipt.sync_status, "submitted_complete");
      }
      metrics.finalizationMilliseconds = performance.now() - finalizationStarted;
      assert.equal(
        (await query("SELECT count(*)::int AS n FROM agency_training.packets WHERE submission_status='submitted'")).rows[0]?.n,
        FTO_FOUR_PHASE_STRESS_COUNT,
      );
      assert.equal(
        (await query("SELECT count(*)::int AS n FROM agency_training.packet_submissions")).rows[0]?.n,
        FTO_FOUR_PHASE_STRESS_COUNT,
      );
      assert.equal(
        (await query("SELECT count(*)::int AS n FROM agency_training.packet_events WHERE event_type='SUBMIT'")).rows[0]?.n,
        FTO_FOUR_PHASE_STRESS_COUNT,
      );
      assert.equal((await query("SELECT count(*)::int AS n FROM agency_training.packets WHERE released_to_po")).rows[0]?.n, 0);
      assert.equal((await query("SELECT count(*)::int AS n FROM agency_training.packet_acknowledgments")).rows[0]?.n, 0);

      const finalDetails = await fetch(`${base}/${encodeURIComponent(String(reports[0]!.id))}`);
      const finalPacket = await finalDetails.json() as { data: Array<{ sync_status: string }> };
      assert.equal(finalPacket.data[0]?.sync_status, "submitted_complete");
      metrics.failures += 0;
      assert.ok(metrics.readinessMilliseconds >= 0);
    });

    // Remove only this test class, then assert that its disposable data is gone.
    const packetIds = reports.map(report => String(report.id));
    const submissionIds = (await query(
      "SELECT id::text FROM agency_training.packet_submissions WHERE packet_id=ANY($1::text[])",
      [packetIds],
    )).rows.map(row => String(row.id));
    await query("DELETE FROM agency_training.packet_review_events WHERE submission_id=ANY($1::uuid[])", [submissionIds]);
    await query("DELETE FROM agency_training.packet_submissions WHERE packet_id=ANY($1::text[])", [packetIds]);
    await query("DELETE FROM agency_training.packet_acknowledgments WHERE packet_id=ANY($1::text[])", [packetIds]);
    await query("DELETE FROM agency_training.packet_events WHERE packet_id=ANY($1::text[])", [packetIds]);
    await query("DELETE FROM agency_training.packets WHERE id=ANY($1::text[])", [packetIds]);
    await query("DELETE FROM agency_training.packet_assignments WHERE packet_id=ANY($1::text[])", [packetIds]);
    await query("DELETE FROM agency_training.assignments WHERE id=ANY($1::uuid[])", [assignmentIds]);
    await query("DELETE FROM agency_training.po_coordinators WHERE po_id=ANY($1::text[])", [poIds]);
    await query("DELETE FROM agency_training.coordinator_directory WHERE id=$1", [coordinatorId]);
    const remaining = await query(`SELECT
      (SELECT count(*)::int FROM agency_training.assignments WHERE class_name=$1) AS assignments,
      (SELECT count(*)::int FROM agency_training.packets WHERE id=ANY($2::text[])) AS packets,
      (SELECT count(*)::int FROM agency_training.packet_assignments WHERE packet_id=ANY($2::text[])) AS packet_assignments,
      (SELECT count(*)::int FROM agency_training.packet_events WHERE packet_id=ANY($2::text[])) AS events,
      (SELECT count(*)::int FROM agency_training.packet_acknowledgments WHERE packet_id=ANY($2::text[])) AS acknowledgments,
      (SELECT count(*)::int FROM agency_training.packet_submissions WHERE packet_id=ANY($2::text[])) AS submissions,
      (SELECT count(*)::int FROM agency_training.packet_review_events WHERE submission_id=ANY($3::uuid[])) AS review_events,
      (SELECT count(*)::int FROM agency_training.po_coordinators WHERE po_id=ANY($4::text[])) AS po_coordinators,
      (SELECT count(*)::int FROM agency_training.coordinator_directory WHERE id=$5) AS coordinators`,
      [reports[0]?.className, packetIds, submissionIds, poIds, coordinatorId]);
    assert.deepEqual(remaining.rows[0], {
      assignments: 0,
      packets: 0,
      packet_assignments: 0,
      events: 0,
      acknowledgments: 0,
      submissions: 0,
      review_events: 0,
      po_coordinators: 0,
      coordinators: 0,
    });
    cleanupVerified = true;

    const totalMilliseconds = performance.now() - startedAt;
    console.log("SYNTHETIC_PACKET_STRESS_METRICS " + JSON.stringify({
      environment: "Node test runner + in-memory PGlite + loopback HTTP",
      packets: metrics.packets,
      fullCohortRecruits: FTO_FOUR_PHASE_STRESS_COUNT,
      fullCohortDailyReports: cohortReports.length,
      finalizationSelectedBy: "one explicitly selected Phase IV final-week report per fictional recruit",
      batchCount: metrics.batchSizes.length,
      batchSizes: metrics.batchSizes,
      serializedBatchBytes: metrics.batchBytes,
      batchMilliseconds: metrics.batchMilliseconds.map(value => Math.round(value * 100) / 100),
      readinessMilliseconds: Math.round(metrics.readinessMilliseconds * 100) / 100,
      draftSyncMilliseconds: Math.round(metrics.draftSyncMilliseconds * 100) / 100,
      listReadMilliseconds: Math.round(metrics.listReadMilliseconds * 100) / 100,
      detailReadMilliseconds: Math.round(metrics.detailReadMilliseconds * 100) / 100,
      finalizationMilliseconds: Math.round(metrics.finalizationMilliseconds * 100) / 100,
      listRecords: metrics.listRecords,
      listPages: metrics.listPages,
      listPageSizes: metrics.listPageSizes,
      individualDetailReads: metrics.detailReads,
      failures: metrics.failures,
      exactRequestRetries: metrics.retries,
      totalMilliseconds: Math.round(totalMilliseconds * 100) / 100,
      cleanupVerified,
      finalizationWasExplicit: true,
      releasedOrAcknowledged: false,
    }));
  } finally {
    await db.close();
  }
});
