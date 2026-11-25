import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { OperationalProfileHistory } from "@workspace/api-client-react";

test("history loads older entries, refreshes on saves and fails closed across errors and account changes", async t => {
  const dom = new JSDOM("<div id='root'></div>", { url: "https://localhost/settings", pretendToBeVisual: true });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  const { createRoot } = await import("react-dom/client");
  const { OperationalProfileHistoryPanel } = await import("../components/operational-profile-history.js");
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const root = createRoot(dom.window.document.getElementById("root")!);
  const entry = (version: number, newToken = "9150E"): OperationalProfileHistory["entries"][number] => ({
    version, oldToken: "9150E-1", newToken, actor: "self", event: "changed", recordedAt: "2026-11-25T06:10:00.000Z",
  });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  let subject = "TEST-A", version = 2, unavailable = false, fail = false, hold = true;
  let release: ((response: Response) => void) | undefined;
  let lastSignal: AbortSignal | undefined;
  let requests = 0;
  let serverSubject = subject;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    requests++;
    assert.equal(init?.credentials, "include");
    lastSignal = init?.signal as AbortSignal;
    if (hold) return new Promise<Response>(resolve => { release = resolve; });
    if (fail) return json({ error: "PROFILE_ACCESS_DENIED" }, 403);
    const older = String(input).includes("beforeVersion");
    return json({ subject: serverSubject, entries: older ? [{ ...entry(1), oldToken: null, event: "baseline", actor: "agency_migration" }] : [entry(version)],
      nextBeforeVersion: older ? null : 2 });
  });
  const render = () => root.render(<QueryClientProvider client={cache}>
    <OperationalProfileHistoryPanel key={subject} subject={subject} version={version} unavailable={unavailable}/>
  </QueryClientProvider>);
  const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
  const text = () => dom.window.document.body.textContent!;
  const button = (label: string) => {
    const node = [...dom.window.document.querySelectorAll("button")].find(node => node.textContent === label);
    assert.ok(node, label); return node;
  };
  try {
    await act(async () => render());
    assert.match(text(), /Loading assignment history/);
    hold = false;
    await act(async () => { release!(json({ subject, entries: [entry(2)], nextBeforeVersion: 2 })); });
    await settle();
    assert.match(text(), /9150E-1/);
    assert.match(text(), /Your verified account/);
    assert.match(text(), /EST/);
    assert.equal(dom.window.document.querySelector("time")?.dateTime, "2026-11-25T06:10:00.000Z");
    await act(async () => button("Load older history").click()); await settle();
    assert.match(text(), /History tracking started/);
    assert.match(text(), /not the original assignment date/);
    assert.equal(dom.window.document.querySelectorAll("li").length, 2);
    fail = true;
    await act(async () => button("Refresh history").click()); await settle();
    assert.match(text(), /could not be loaded/);
    assert.equal(dom.window.document.querySelectorAll("li").length, 0, "Failed refresh hides stale history");
    fail = false;
    await act(async () => button("Retry history").click()); await settle();
    assert.match(text(), /Assignment changed/);
    version = 3;
    await act(async () => render()); await settle();
    assert.match(text(), /Version 3/);
    assert.equal(dom.window.document.querySelectorAll("li").length, 1, "Saved version starts a fresh history pagination");

    hold = true; version = 4;
    await act(async () => render());
    const formerSignal = lastSignal!;
    subject = "TEST-B"; serverSubject = subject; hold = false;
    await act(async () => render()); await settle();
    assert.equal(formerSignal.aborted, true, "Former account request is aborted");
    await act(async () => release!(json({ subject: "TEST-A", entries: [entry(4, "9999Z")], nextBeforeVersion: null })));
    await settle();
    assert.doesNotMatch(text(), /9999Z/);
    unavailable = true;
    await act(async () => render());
    assert.match(text(), /could not be loaded/);
    assert.equal(dom.window.document.querySelectorAll("li").length, 0);
    unavailable = false; subject = "TEST-C"; serverSubject = "TEST-B";
    await act(async () => render()); await settle();
    assert.match(text(), /could not be loaded/, "Mismatched response subject is rejected");

    subject = "TEST-EMPTY"; serverSubject = subject;
    t.mock.method(globalThis, "fetch", async () => json({ subject, entries: [], nextBeforeVersion: null }));
    await act(async () => render()); await settle();
    assert.match(text(), /No assignment history yet/);
    assert.ok(requests >= 7);
  } finally {
    await act(async () => root.unmount());
    cache.clear(); dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
