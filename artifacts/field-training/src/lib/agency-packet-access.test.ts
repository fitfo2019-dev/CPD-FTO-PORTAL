import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AgencyPacketAccess } from "../components/agency-packet-access.js";
import { createUiPreviewWorkspace } from "./empty-workspace.js";
import { createDailyReportDraft } from "./daily-report-draft.js";

function packetResponse() {
  const report = createDailyReportDraft(createUiPreviewWorkspace().caseFolder!, "2026-11-23");
  report.recruitName = "PRIVATE FICTIONAL PACKET";
  return new Response(JSON.stringify({
    status: "success", metadata: { total_records: 1, role: "FTO" },
    data: [{ id: report.id, assignment_id: crypto.randomUUID(), record_date: report.date, phase: report.phase,
       server_version: 1, sync_status: "local_draft_pending", handoff_status: "draft", po_totals: null,
       report, content_hash: "a".repeat(64),
      released_to_po: false, released_at: null, withdrawn_at: null, withdrawal_reason: null,
      amendment_of: null, amendment_reason: null, acknowledgment: null }],
  }), { headers: { "content-type": "application/json" } });
}

async function withComponent(t: TestContext, run: (h: {
  cache: QueryClient; container: HTMLElement;
  render: (changes?: Partial<Parameters<typeof AgencyPacketAccess>[0]>) => Promise<void>;
}) => Promise<void>) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://localhost/', pretendToBeVisual: true });
  const globals = { window: dom.window, document: dom.window.document, location: dom.window.location,
    addEventListener: dom.window.addEventListener.bind(dom.window),
    removeEventListener: dom.window.removeEventListener.bind(dom.window),
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const container = dom.window.document.getElementById("root")!;
  const root = createRoot(container);
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  async function render(changes: Partial<Parameters<typeof AgencyPacketAccess>[0]> = {}) {
    await act(async () => {
      root.render(createElement(QueryClientProvider, { client: cache },
        createElement(AgencyPacketAccess, {
          userId: "fictional-fto", authenticated: true, previewOnly: false, unlocked: true, ...changes,
        })));
      await new Promise(resolve => setTimeout(resolve, 20));
    });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  }
  try { await run({ cache, container, render }); }
  finally {
    await act(async () => root.unmount());
    cache.clear();
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    t.mock.restoreAll();
  }
}

test("both refresh buttons in preview, locked and signed-out views cannot invoke agency transport", async t => {
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => { requests++; return packetResponse(); });
  await withComponent(t, async ({ container, render, cache }) => {
    for (const changes of [{ previewOnly: true }, { unlocked: false }, { authenticated: false }]) {
      await render(changes);
      for (const id of ["button-refresh-packets", "button-try-refresh"]) {
        const button = container.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`)!;
        assert.ok(button, id);
        assert.equal(button.disabled, true);
        await act(async () => { button.click(); });
      }
      assert.equal(requests, 0);
      assert.equal(cache.getQueryCache().getAll().length, 0);
      assert.ok(!container.textContent?.includes("PRIVATE FICTIONAL PACKET"));
    }
  });
});

test("locking discards loaded snapshots and cache, and unlock starts a fresh scope", async t => {
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => { requests++; return packetResponse(); });
  await withComponent(t, async ({ container, render, cache }) => {
    await render();
    assert.equal(requests, 1, String(cache.getQueryCache().getAll()[0]?.state.error ?? 'No query error recorded'));
    assert.ok(container.textContent?.includes("PRIVATE FICTIONAL PACKET"));
    const oldKey = cache.getQueryCache().getAll()[0].queryKey;
    await render({ unlocked: false });
    assert.equal(cache.getQueryCache().getAll().length, 0);
    assert.equal(cache.getMutationCache().getAll().length, 0);
    assert.ok(!container.textContent?.includes("PRIVATE FICTIONAL PACKET"));
    assert.equal(requests, 1, "locking must not start a new read or polling controller");
    await render();
    assert.equal(requests, 2);
    assert.notDeepEqual(cache.getQueryCache().getAll()[0].queryKey, oldKey);
    await render({ userId: "different-fictional-fto", unlocked: false });
    assert.equal(cache.getQueryCache().getAll().length, 0);
    assert.ok(!container.textContent?.includes("PRIVATE FICTIONAL PACKET"));
  });
});

test("locking cancels an in-flight refresh; a late response cannot restore details or cache", async t => {
  let requests = 0;
  let finish: ((value: Response) => void) | undefined;
  let signal: AbortSignal | null | undefined;
  t.mock.method(globalThis, "fetch", async (_input: unknown, options?: RequestInit) => {
    if (++requests === 1) return packetResponse();
    signal = options?.signal;
    // Deliberately ignore abort here: the controller/cache must still reject
    // data returned by an uncooperative or already-completed transport.
    return new Promise<Response>(resolve => { finish = resolve; });
  });
  await withComponent(t, async ({ container, render, cache }) => {
    await render();
    assert.ok(container.textContent?.includes("PRIVATE FICTIONAL PACKET"));
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="button-refresh-packets"]')!.click();
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    assert.equal(requests, 2);
    await render({ unlocked: false });
    assert.equal(signal?.aborted, true);
    assert.equal(cache.getQueryCache().getAll().length, 0);
    await act(async () => {
      finish!(packetResponse());
      await new Promise(resolve => setTimeout(resolve, 20));
    });
    assert.equal(cache.getQueryCache().getAll().length, 0);
    assert.ok(!container.textContent?.includes("PRIVATE FICTIONAL PACKET"));
    assert.equal(requests, 2);
  });
});
