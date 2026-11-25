import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { OperationalProfileContext } from "@workspace/api-client-react";
import { parseOperationalIdentity } from "@workspace/api-zod/operational-profile";
import { OperatorFacingError } from "./operator-errors.js";

test("failed editor refresh clears only stale GET feedback after automatic recovery", async t => {
  const dom = new JSDOM("<div id='root'></div>", { url: "https://localhost/settings", pretendToBeVisual: true });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, HTMLInputElement: dom.window.HTMLInputElement,
    Node: dom.window.Node, Event: dom.window.Event, IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({
    subject: "FICTIONAL-RECOVERY", entries: [], nextBeforeVersion: null,
  }), { status: 200, headers: { "Content-Type": "application/json" } }));
  const { createRoot } = await import("react-dom/client");
  const { OperationalProfileStateContext } = await import("../state/operational-profile.js");
  const { OperationalProfilePanel } = await import("../components/operational-profile-panel.js");
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const root = createRoot(dom.window.document.getElementById("root")!);
  let profile: OperationalProfileContext = {
    subject: "FICTIONAL-RECOVERY", role: "FTO", badge: "TEST", version: 1,
    identity: parseOperationalIdentity("9150E-1"),
  };
  let unavailable: string | undefined;
  let successfulRead = 1;
  let writes = 0;
  let refreshes = 0;
  const save = async () => {
    writes++;
    throw new OperatorFacingError("This assignment changed elsewhere. Reload the saved assignment before retrying.");
  };
  const refresh = async () => {
    refreshes++;
    unavailable = "Agency profile unavailable";
    render();
    throw new OperatorFacingError("The agency profile could not be refreshed. Saved packets are unchanged.");
  };
  const render = () => root.render(<QueryClientProvider client={cache}>
    <OperationalProfileStateContext.Provider value={{
      profile: unavailable ? undefined : profile, editorProfile: profile,
      pending: false, contextKey: `${profile.subject}:${profile.version}`,
      error: unavailable, successfulRead, save, refresh,
    }}><OperationalProfilePanel /></OperationalProfileStateContext.Provider>
  </QueryClientProvider>);
  function element<T extends HTMLElement = HTMLElement>(id: string) {
    const node = dom.window.document.querySelector<T>(`[data-testid="${id}"]`);
    assert.ok(node, id);
    return node;
  }
  const errorNode = () => dom.window.document.querySelector('[data-testid="text-profile-error"]');
  const saveButton = () => element<HTMLButtonElement>("button-save-operational-profile");
  async function input(value: string) {
    await act(async () => {
      const node = element<HTMLInputElement>("input-operational-assignment");
      node.focus();
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(node, value);
      node.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
  }
  async function recover() {
    await act(async () => { unavailable = undefined; successfulRead++; render(); });
  }
  async function failedRefresh() {
    await act(async () => element("button-reload-operational-profile").click());
  }
  const submit = () => act(async () => {
    element("form-operational-profile").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  });
  try {
    await act(async () => render());
    await input("9150E-2");
    await failedRefresh();
    assert.match(errorNode()!.textContent!, /could not be refreshed/);
    assert.equal(saveButton().disabled, true);
    assert.equal(element<HTMLInputElement>("input-operational-assignment").value, "9150E-2");
    await act(async () => render());
    assert.ok(errorNode(), "Another failed poll or render does not imply recovery");
    await act(async () => { unavailable = undefined; render(); });
    assert.ok(errorNode(), "A cache change without a successful GET cannot clear refresh feedback");
    await recover();
    assert.equal(errorNode(), null, "Same-version recovery clears the failed manual GET feedback");
    assert.equal(element<HTMLInputElement>("input-operational-assignment").value, "9150E-2");
    assert.equal(element<HTMLInputElement>("input-operational-assignment").getAttribute("aria-invalid"), "false");
    assert.equal(dom.window.document.querySelectorAll('[role="alert"]').length, 0);
    assert.equal(saveButton().disabled, false);
    assert.equal(writes, 0, "Recovery never saves the retained text");
    assert.equal(refreshes, 1, "Recovery did not require a second manual reload");
    assert.equal(dom.window.document.querySelector('[data-testid="text-profile-saved"]'), null);

    await failedRefresh();
    profile = { ...profile, version: 2, identity: parseOperationalIdentity("1234A-1") };
    await recover();
    assert.equal(errorNode(), null);
    assert.equal(element<HTMLInputElement>("input-operational-assignment").value, "9150E-2");
    assert.match(dom.window.document.body.textContent!, /newer saved assignment is available/);
    assert.equal(saveButton().disabled, true, "A recovered newer version cannot bypass the dirty editor's version guard");
    await submit();
    assert.equal(writes, 0);

    profile = { ...profile, subject: "FICTIONAL-SAVE-CONFLICT" };
    await act(async () => render());
    await input("5678B-1");
    await submit();
    assert.match(errorNode()!.textContent!, /changed elsewhere/);
    await act(async () => { unavailable = "Agency profile unavailable"; render(); });
    await recover();
    assert.match(errorNode()!.textContent!, /changed elsewhere/, "GET recovery must not dismiss a PUT conflict");
    assert.equal(element<HTMLInputElement>("input-operational-assignment").value, "5678B-1");
    assert.equal(saveButton().disabled, true);
    await failedRefresh();
    await recover();
    assert.match(errorNode()!.textContent!, /changed elsewhere/, "A failed manual GET cannot replace the unresolved save error");
    assert.equal(saveButton().disabled, true);
    await submit();
    assert.equal(writes, 1, "Only explicit successful reload may release the save gate");

    profile = { ...profile, subject: "FICTIONAL-VALIDATION" };
    await act(async () => render());
    await input("bad");
    await submit();
    await recover();
    assert.match(errorNode()!.textContent!, /four district digits/, "GET recovery cannot dismiss input validation");
    assert.equal(element<HTMLInputElement>("input-operational-assignment").value, "bad");
  } finally {
    await act(async () => root.unmount());
    cache.clear();
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
