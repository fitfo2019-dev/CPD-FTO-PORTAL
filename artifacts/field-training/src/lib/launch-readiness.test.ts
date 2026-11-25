/** Synthetic characterization; passing gap checks are not release approval. */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test from "node:test";
import { OfflineStorage } from "./offlineStorage.js";
import { uploadPacketBatch } from "./training-packet-sync.js";
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
      server_version: 1, sync_status: "local_draft_pending" as const, content_hash: "a".repeat(64) }));
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
    sync_status: "local_draft_pending", content_hash: "a".repeat(64),
  })));
  assert.ok(next?.reports.every(item => item.syncStatus === "local_draft_pending"));
  assert.equal(await vault.pendingCount(), 0);
  vault.lock();
});
test("LR-13 stale vault writes are rejected and cannot overwrite newer unsynchronized work", async () => {
  const namespace = `SYNTHETIC-two-tabs-${crypto.randomUUID()}`;
  const a = new OfflineStorage(namespace), b = new OfflineStorage(namespace);
  const passphrase = new TextEncoder().encode("synthetic-only-readiness-passphrase");
  await a.unlock(passphrase);
  await a.saveWorkspace({ reports: [{ id: "SYNTHETIC-A", narrative: "original" }] });
  await b.unlock(passphrase);
  const stale = await b.get<{ reports: Array<{ id: string; narrative: string }> }>("workspace");
  assert.ok(stale);
  await a.saveWorkspace({ reports: [{ id: "SYNTHETIC-A", narrative: "new unsynchronized work" }] });
  await assert.rejects(b.saveWorkspace(stale), /Another session saved a newer workspace/);
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
