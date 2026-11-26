import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { WorkspaceProvider, useWorkspace } from "../state/workspace.js";
import { createDailyReportDraft } from "./daily-report-draft.js";
import { createUiPreviewWorkspace } from "./empty-workspace.js";
import { CATEGORIES } from "./model.js";

test("offline local saves stay local and reconnect syncs an editable draft without finalizing", async t => {
  const dom = new JSDOM("<!doctype html><div id='root'></div>", { pretendToBeVisual: true, url: "https://localhost" });
  Object.defineProperty(dom.window.navigator, "onLine", { configurable: true, value: false });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const requests: Array<{ url: string; body: string }> = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input), body = String(init?.body ?? "");
    requests.push({ url, body });
    if (url.includes("/finalize")) {
      const id = decodeURIComponent(url.split("/").at(-2)!);
      const request = JSON.parse(body) as { operation_id: string; content_hash: string };
      return new Response(JSON.stringify({
        id, operation_id: request.operation_id, server_version: 1,
        sync_status: "submitted_complete", content_hash: request.content_hash,
      }), { headers: { "content-type": "application/json" } });
    }
    const packets = (JSON.parse(body) as { packets: Array<{ operation_id: string; report: { id: string } }> }).packets;
    return new Response(JSON.stringify({
      status: "success", metadata: { total_records: packets.length, role: "FTO" },
      data: packets.map(packet => ({ id: packet.report.id, operation_id: packet.operation_id,
        server_version: 1, sync_status: "local_draft_pending", content_hash: "a".repeat(64) })),
    }), { headers: { "content-type": "application/json" } });
  });

  let current: ReturnType<typeof useWorkspace> | undefined;
  function Probe() { current = useWorkspace(); return null; }
  const namespace = `workspace-draft-sync-${crypto.randomUUID()}`;
  const root = createRoot(dom.window.document.getElementById("root")!);
  try {
    await act(async () => {
      root.render(createElement(WorkspaceProvider, {
        storageNamespace: namespace, authSession: { accountId: "FICTIONAL-FTO", sessionId: "FICTIONAL-SESSION" },
        validateSession: async () => {}, children: createElement(Probe),
      }));
    });
    assert.ok(current);
    await act(async () => { await current!.setupAndSave("fictional-local-sync-test-passphrase"); });
    const folder = createUiPreviewWorkspace().caseFolder!;
    const report = createDailyReportDraft(folder, "2026-11-23");
    report.shiftStartTime="07:00";
    report.reportingForDuty.reviewedAt="2026-11-23T17:00:00Z";
    report.ratingsReviewedAt="2026-11-23T17:00:00Z";
    for(const category of CATEGORIES)report.ratings[category].rating="A";
    await act(async () => { current!.upsertReport(report); });
    await act(async () => { await current!.saveNow(); });
    assert.equal(requests.length, 0, "offline local save must not send a request");
    assert.equal(current!.pending, 1);
    assert.equal(current!.dirty, false, "the local workspace save should be complete before reconnect");
    Object.defineProperty(dom.window.navigator, "onLine", { configurable: true, value: true });
    await act(async () => { dom.window.dispatchEvent(new dom.window.Event("online")); });
    for (let attempt = 0; attempt < 30 && current!.packetSyncState !== "synchronized"; attempt++)
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 100)); });
    assert.equal(current!.online, true);
    assert.equal(current!.packetSyncState, "synchronized", `sync state: ${current!.packetSyncState}`);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "/api/v1/training-packets/sync");
    assert.equal(current!.ws.reports[0].syncStatus, "local_draft_pending");
    assert.equal(current!.ws.reports[0].draftSyncPending, false);
    assert.equal(current!.ws.reports[0].serverContentHash, "a".repeat(64));
    assert.equal(current!.pending, 0);

    const secondDraft = createDailyReportDraft(folder, "2026-11-24");
    await act(async () => { current!.upsertReport(secondDraft); });
    await act(async () => { await current!.saveNow(); });
    for (let attempt = 0; attempt < 30 &&
      current!.ws.reports.find(item => item.id === secondDraft.id)?.draftSyncPending !== false; attempt++)
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 100)); });
    assert.equal(requests.filter(request => request.url.endsWith("/sync")).length, 2);
    assert.equal(current!.ws.reports.find(item => item.id === secondDraft.id)?.serverContentHash, "a".repeat(64));

    await act(async () => { await current!.finalizePacket(report.id); });
    assert.equal(current!.ws.reports.find(item => item.id === report.id)?.syncStatus, "submitted_complete");
    assert.throws(() => current!.upsertReport({ ...report, narrative: "Attempted post-submit edit" }),
      /sealed|unconfirmed server transition/i);
    assert.throws(() => current!.upsertReport({ ...report, id: "duplicate-packet" }),
      /finalized packet already exists/i);
    await act(async () => {
      await assert.rejects(current!.finalizePacket(report.id), /already submitted/i);
    });
    assert.equal(requests.filter(request => request.url.includes("/finalize")).length, 1);
    assert.equal(requests.filter(request => request.url.includes("/finalize")).length, 1,
      "ordinary online saves may synchronize drafts but never finalize them");
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    t.mock.restoreAll();
  }
});
