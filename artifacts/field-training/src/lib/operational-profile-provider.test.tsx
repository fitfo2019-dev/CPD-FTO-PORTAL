import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { OperationalProfileContext } from "@workspace/api-client-react";
import { parseOperationalIdentity } from "@workspace/api-zod/operational-profile";
import { OperationalProfileSessionProvider, useOperationalProfile } from "../state/operational-profile.js";

test("real profile provider clears cache immediately, recovers lost responses and ignores former-account writes", async t => {
  const dom = new JSDOM("<div id='root'></div>", { url: "https://localhost/", pretendToBeVisual: true });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  const { createRoot } = await import("react-dom/client");
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  let subject = "TEST-A";
  let sessionId = "SESSION-A";
  let sessionValid = true;
  let serverProfile: OperationalProfileContext = { subject, role: "FTO", badge: "TEST", version: 1, identity: parseOperationalIdentity("9150E-1") };
  let state: ReturnType<typeof useOperationalProfile>;
  let write: { resolve(response: Response): void; reject(error: Error): void; signal: AbortSignal; body: unknown } | undefined;
  let reads = 0;
  let writes = 0;
  const recoveredAccounts: string[] = [];
  let holdRead = false;
  let staleRead: ((response: Response) => void) | undefined;
  const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } });
  t.mock.method(globalThis, "fetch", async (_input: unknown, init?: RequestInit) => {
    if (!init?.method || init.method === "GET") {
      reads++;
      if (holdRead) return new Promise<Response>(resolve => { staleRead = resolve; });
      return json(serverProfile);
    }
    writes++;
    return new Promise<Response>((resolve, reject) => {
      write = { resolve, reject, signal: init.signal as AbortSignal, body: JSON.parse(String(init.body)) };
    });
  });
  function Probe() { state = useOperationalProfile(); return null; }
  const validateSession = async ({ accountId, sessionId: expectedSession }: { accountId: string; sessionId: string }) => {
    if (!sessionValid || accountId !== subject || expectedSession !== sessionId) throw new Error("Expired session");
  };
  const root = createRoot(dom.window.document.getElementById("root")!);
  const render = () => root.render(<QueryClientProvider client={cache}>
    <OperationalProfileSessionProvider subject={subject} authSession={{ accountId: subject, sessionId }}
      validateSession={validateSession} saveAuthRecoverySnapshot={async accountId => {
        if (accountId) recoveredAccounts.push(accountId);
      }}><Probe/></OperationalProfileSessionProvider>
  </QueryClientProvider>);
  const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  try {
    await act(async () => render()); await settle();
    assert.equal(state!.profile?.version, 1);
    const oldProfile=structuredClone(serverProfile);
    holdRead=true;
    let oldRefresh!:Promise<OperationalProfileContext>;
    await act(async()=>{oldRefresh=state!.refresh!();void oldRefresh.catch(()=>{});});
    assert.ok(staleRead);
    let clearing!: Promise<OperationalProfileContext>;
    await act(async () => { clearing = state!.clear!(1); });
    assert.equal(structuredClone(state!.profile), undefined, "Dispatch context is removed before a clear response");
    assert.match(state!.contextKey, /unavailable$/);
    assert.deepEqual(write!.body, { expectedVersion: 1, confirmedNoVehicle: true });
    serverProfile = { ...serverProfile, identity: null, version: 2 };
    await act(async () => { write!.resolve(json(serverProfile)); await clearing; });
    holdRead=false;
    await act(async()=>{staleRead!(json(oldProfile));await assert.rejects(oldRefresh,/could not be refreshed/);});
    assert.equal(structuredClone(state!.profile?.identity), null);
    assert.equal(cache.getQueryData<OperationalProfileContext>(["operational-profile", subject])?.version, 2);

    let saving!: Promise<OperationalProfileContext>;
    await act(async () => { saving = state!.save!("9150E-2", 2); void saving.catch(() => {}); });
    serverProfile = { ...serverProfile, identity: parseOperationalIdentity("9150E-2"), version: 3 };
    await act(async () => { write!.reject(new Error("Lost response after commit")); await assert.rejects(saving, /not confirmed/); });
    assert.equal(structuredClone(state!.profile), undefined, "Unconfirmed writes stay manual-only");
    await act(async () => { await state!.refresh!(); });
    assert.equal(state!.profile?.identity?.assignmentToken, "9150E-2");
    assert.equal(state!.profile?.identity?.cadUnit, "9150E");

    const writesBeforeExpiry = writes;
    sessionValid = false;
    await act(async () => {
      await assert.rejects(state!.save!("1234A", 3), /Sign in again/);
    });
    assert.equal(writes, writesBeforeExpiry, "Expired preflight must block the profile transport.");
    assert.deepEqual(recoveredAccounts, ["TEST-A"]);
    sessionValid = true;

    let rejectedWrite!: Promise<OperationalProfileContext>;
    await act(async () => { rejectedWrite = state!.save!("9151E", 3); void rejectedWrite.catch(() => {}); });
    const unauthorized = write!;
    await act(async () => {
      unauthorized.resolve(new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), {
        status: 401, headers: { "Content-Type": "application/json" },
      }));
      await assert.rejects(rejectedWrite, /Sign in again/);
    });
    assert.deepEqual(recoveredAccounts, ["TEST-A", "TEST-A"], "A server rejection is authoritative after successful preflight.");

    await act(async () => { clearing = state!.clear!(3); void clearing.catch(() => {}); });
    const formerWrite = write!;
    const formerClear = state!.clear!;
    subject = "TEST-B";
    sessionId = "SESSION-B";
    serverProfile = { subject, role: "PO", badge: "OTHER", version: 0, identity: null };
    await act(async () => render()); await settle();
    assert.equal(formerWrite.signal.aborted, true);
    await act(async () => {
      formerWrite.resolve(json({ ...serverProfile, subject: "TEST-A", version: 4 }));
      await assert.rejects(clearing, /account changed/);
    });
    assert.equal(state!.profile?.subject, "TEST-B");
    assert.equal(state!.profile?.version, 0);
    await assert.rejects(formerClear(0), /account changed/, "An old callback cannot clear the newly signed-in account");
    assert.ok(reads >= 3);
  } finally {
    await act(async () => root.unmount()); cache.clear(); dom.window.close();
    for (const [key, descriptor] of previous) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  }
});
