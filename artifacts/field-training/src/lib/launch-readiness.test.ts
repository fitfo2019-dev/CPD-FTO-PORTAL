/** Synthetic characterization; passing gap checks are not release approval. */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test from "node:test";
import { MAX_PACKET_BATCH_COUNT, MAX_PACKET_REQUEST_BYTES, OfflineStorage, serializePacketBatchRequest,
  type PacketBatchReceipt, type PendingChange } from "./offlineStorage.js";
import { uploadPacketBatch } from "./training-packet-sync.js";
import { createFtoPacketStressWorkspace } from "./test-packet.js";
import { getSundaySaturdayWeek, parseDateMDY, formatDateTimeMDY } from "./training-calendar.js";

test("LR-09 merged count batching drains 101 saved drafts in two exact acknowledged batches", async () => {
  const vault = new OfflineStorage(`SYNTHETIC-readiness-${crypto.randomUUID()}`);
  const passphrase = new TextEncoder().encode("synthetic-only-readiness-passphrase");
  await vault.unlock(passphrase);
  const reports = Array.from({ length: 101 }, (_, i) => ({ id: `SYNTHETIC-${i}`, status: "draft" }));
  await vault.saveWorkspace({ reports });
  assert.equal(await vault.pendingCount(), 101);
  const sizes: number[] = [];
  const transport = async (changes: import("./offlineStorage.js").PendingChange[]) => {
    sizes.push(changes.length);
    return changes.map(change => ({ id: change.recordId, operation_id: change.operationId,
      server_version: 1, sync_status: "local_draft_pending" as const }));
  };
  await vault.syncPacketBatch(transport);
  assert.equal(await vault.pendingCount(), 1);
  vault.lock(); await vault.unlock(passphrase);
  await vault.syncPacketBatch(transport);
  assert.deepEqual(sizes, [100, 1]);
  assert.equal(await vault.pendingCount(), 0);
  const saved = await vault.get<{ reports: Array<{ id: string; syncStatus: string }> }>("workspace");
  assert.equal(saved?.reports.length, 101);
  assert.ok(saved?.reports.every(item => item.syncStatus === "local_draft_pending"));
  // The transport bound still applies; storage now honors it.
  await assert.rejects(uploadPacketBatch(Array.from({ length: 101 }, () => ({} as import("./offlineStorage.js").PendingChange))), /1–100/);
  vault.lock();
});
test("LR-10 local acknowledgement accepts reordered exact receipts and seals only matching drafts", async () => {
  const vault = new OfflineStorage(`SYNTHETIC-receipt-${crypto.randomUUID()}`);
  await vault.unlock(new TextEncoder().encode("synthetic-only-readiness-passphrase"));
  await vault.saveWorkspace({ reports: [{ id: "SYNTHETIC-A" }, { id: "SYNTHETIC-B" }] });
  const next = await vault.syncPacketBatch(async changes => changes.toReversed().map(change => ({
    id: change.recordId, operation_id: change.operationId, server_version: 1,
    sync_status: "synchronized_complete", submittedVerified: true as const,
  })));
  assert.ok(next?.reports.every(item => item.syncStatus === "synchronized_complete"));
  assert.equal(await vault.pendingCount(), 0);
  vault.lock();
});
test("LR-14 one deliberate sync drains 205 byte-bounded drafts and retries an interrupted batch exactly", async () => {
  const namespace = `SYNTHETIC-205-${crypto.randomUUID()}`;
  const passphrase = new TextEncoder().encode("synthetic-only-205-packet-passphrase");
  const vault = new OfflineStorage(namespace);
  await vault.unlock(passphrase);
  const fixture = createFtoPacketStressWorkspace();
  const reports = fixture.reports.map((report, index) => ({
    ...report,
    narrative: index < 30 ? `FICTIONAL LONG NARRATIVE ${index + 1} `.padEnd(75_000, "L")
      : `FICTIONAL SHORT NARRATIVE ${index + 1} `.padEnd(250 + (index % 17) * 500, "S"),
  }));
  const startedAt = performance.now();
  const saveStarted = performance.now();
  await vault.saveWorkspace({ reports });
  const encryptedSaveMilliseconds = performance.now() - saveStarted;
  assert.equal(await vault.pendingPacketCount(), 205);
  const committed = new Map<string, { operationId: string; value: string; version: number }>();
  const attemptedBodies: string[] = [];
  const batches: Array<{ count: number; bytes: number }> = [];
  let interruptAfterCommit = true;
  const transport = async (changes: PendingChange[]): Promise<PacketBatchReceipt[]> => {
    const body = serializePacketBatchRequest(changes);
    const bytes = new TextEncoder().encode(body).byteLength;
    attemptedBodies.push(body);
    batches.push({ count: changes.length, bytes });
    assert.ok(changes.length > 0 && changes.length <= MAX_PACKET_BATCH_COUNT);
    assert.ok(bytes <= MAX_PACKET_REQUEST_BYTES);
    const receipts = changes.map(change => {
      const value = JSON.stringify(change.value);
      const prior = committed.get(change.recordId);
      if (prior) {
        assert.equal(prior.operationId, change.operationId, "retry must preserve operation ID");
        assert.equal(prior.value, value, "retry must preserve exact packet snapshot");
        return { id: change.recordId, operation_id: change.operationId,
          server_version: prior.version, sync_status: "local_draft_pending" as const };
      }
      const version = 1;
      committed.set(change.recordId, { operationId: change.operationId, value, version });
      return { id: change.recordId, operation_id: change.operationId,
        server_version: version, sync_status: "local_draft_pending" as const };
    });
    if (interruptAfterCommit && attemptedBodies.length === 2) {
      interruptAfterCommit = false;
      throw new Error("synthetic response interruption after commit");
    }
    return receipts;
  };

  await assert.rejects(vault.syncPacketQueue(transport), /response interruption/);
  assert.ok(batches.some(batch => batch.count < 100), "at least one request should be limited by bytes, not count");
  const partiallyAcknowledged = await vault.get<{ reports: Array<{ id: string; syncStatus?: string; serverVersion?: number; syncAttemptPending?: boolean }> }>("workspace");
  assert.ok(partiallyAcknowledged);
  assert.ok(partiallyAcknowledged.reports.some(report => report.syncStatus === "local_draft_pending"));
  assert.ok(partiallyAcknowledged.reports.some(report => report.syncAttemptPending));
  assert.ok(partiallyAcknowledged.reports.some(report =>
    !report.syncAttemptPending && (report.serverVersion ?? 0) === 0));
  assert.equal(await vault.pendingPacketCount(), 205 - batches[0].count);
  vault.lock();

  const reopened = new OfflineStorage(namespace);
  const reopenStarted = performance.now();
  await reopened.unlock(passphrase);
  const localReopenMilliseconds = performance.now() - reopenStarted;
  const retryStarted = performance.now();
  await reopened.syncPacketQueue(transport);
  const retryAndDrainMilliseconds = performance.now() - retryStarted;
  const complete = await reopened.get<{ reports: Array<{ id: string; syncStatus?: string; serverVersion?: number; syncAttemptPending?: boolean }> }>("workspace");
  assert.equal(await reopened.pendingPacketCount(), 0, "success must leave no eligible packet queued");
  assert.equal(complete?.reports.length, 205);
  assert.ok(complete?.reports.every(report => report.syncStatus === "local_draft_pending" &&
    report.serverVersion === 1 && report.syncAttemptPending === false));
  assert.equal(committed.size, 205, "all synthetic POs have one server packet identity");
  assert.equal(new Set([...committed.values()].map(item => item.operationId)).size, 205);
  assert.equal(batches.length, attemptedBodies.length);
  assert.ok(batches.every(batch => batch.count <= 100 && batch.bytes <= 2 * 1024 * 1024));
  assert.ok(complete?.reports.every(report => report.syncStatus !== "synchronized_complete"),
    "draft sync never finalizes packets");
  console.log("SYNTHETIC_LOCAL_PACKET_STRESS_METRICS " + JSON.stringify({
    environment: "Node test runner + fake-indexeddb; not a real browser",
    packets: reports.length,
    encryptedSaveMilliseconds: Math.round(encryptedSaveMilliseconds * 100) / 100,
    localReopenMilliseconds: Math.round(localReopenMilliseconds * 100) / 100,
    requestAttempts: batches.length,
    requestBytes: batches.map(batch => batch.bytes),
    requestCounts: batches.map(batch => batch.count),
    retryAndDrainMilliseconds: Math.round(retryAndDrainMilliseconds * 100) / 100,
    totalMilliseconds: Math.round((performance.now() - startedAt) * 100) / 100,
    localQueueEmpty: await reopened.pendingPacketCount() === 0,
    syncFinalizedPackets: false,
  }));
  reopened.lock();
});

test("an individually oversized packet stays unattempted and cancellation does not start a request", async () => {
  const vault = new OfflineStorage(`SYNTHETIC-too-large-${crypto.randomUUID()}`);
  await vault.unlock(new TextEncoder().encode("synthetic-only-oversize-test-passphrase"));
  const report = { id: "SYNTHETIC-OVERSIZE", narrative: "F".repeat(2 * 1024 * 1024) };
  await vault.saveWorkspace({ reports: [report] });
  let requests = 0;
  await assert.rejects(
    vault.syncPacketQueue(async () => { requests++; return []; }),
    /cannot fit in the 2 MB sync request limit/,
  );
  assert.equal(requests, 0);
  assert.equal(await vault.pendingPacketCount(), 1);
  const saved = await vault.get<{ reports: Array<typeof report & { syncAttemptPending?: boolean }> }>("workspace");
  assert.equal(saved?.reports[0]?.syncAttemptPending, undefined);
  assert.equal(await vault.syncPacketQueue(async () => { requests++; return []; }, undefined, () => false), undefined);
  assert.equal(requests, 0);
  assert.equal(await vault.pendingPacketCount(), 1);
  vault.lock();
});

test("LR-13 stale sessions cannot overwrite a newer unsynchronized draft", async () => {
  const namespace = `SYNTHETIC-two-tabs-${crypto.randomUUID()}`;
  const a = new OfflineStorage(namespace), b = new OfflineStorage(namespace);
  const passphrase = new TextEncoder().encode("synthetic-only-readiness-passphrase");
  await a.unlock(passphrase);
  await a.saveWorkspace({ reports: [{ id: "SYNTHETIC-A", narrative: "original" }] });
  await b.unlock(passphrase);
  const stale = await b.get<{ reports: Array<{ id: string; narrative: string }> }>("workspace");
  assert.ok(stale);
  await a.saveWorkspace({ reports: [{ id: "SYNTHETIC-A", narrative: "new unsynchronized work" }] });
  await assert.rejects(b.saveWorkspace(stale), /newer workspace/);
  assert.equal((await a.get<typeof stale>("workspace"))?.reports[0].narrative, "new unsynchronized work");
  a.lock(); b.lock();
});
test("LR-11 calendar date boundaries preserve Sunday weeks across DST, month/year and leap day", () => {
  for (const [date, start, end] of [
    ["2026-03-08", "2026-03-08", "2026-03-14"],
    ["2026-11-01", "2026-11-01", "2026-11-07"],
    ["2026-12-31", "2026-12-27", "2027-01-02"],
    ["2028-02-29", "2028-02-27", "2028-03-04"],
  ]) assert.deepEqual(getSundaySaturdayWeek(date), { start, end });
  assert.equal(parseDateMDY("02/29/2028"), "2028-02-29");
  assert.equal(parseDateMDY("02/29/2027"), undefined);
});
test("LR-12 New York overnight/DST display is consistent but fall-back local time is ambiguous", () => {
  assert.equal(process.env.TZ, "America/New_York", "run with the documented timezone");
  assert.equal(formatDateTimeMDY("2026-03-08T06:59:00Z"), "03/08/2026 01:59");
  assert.equal(formatDateTimeMDY("2026-03-08T07:00:00Z"), "03/08/2026 03:00");
  assert.equal(formatDateTimeMDY("2026-11-01T05:30:00Z"), "11/01/2026 01:30");
  assert.equal(formatDateTimeMDY("2026-11-01T06:30:00Z"), "11/01/2026 01:30");
  assert.equal(formatDateTimeMDY("2026-12-31T04:59:00Z"), "12/30/2026 23:59");
  assert.equal(formatDateTimeMDY("2026-12-31T05:00:00Z"), "12/31/2026 00:00");
});
