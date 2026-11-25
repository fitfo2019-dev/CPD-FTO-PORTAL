import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const previousAssignmentId = "11111111-1111-4111-8111-111111111111";
const successorAssignmentId = "22222222-2222-4222-8222-222222222222";
const className = "TEST 135TH CLASS";
const earlierTransition = {
  operation_id: "44444444-4444-4444-8444-444444444444",
  occurred_at: "2026-01-01T12:00:00.000Z",
  class_name: className,
  po_name: "PO Example",
  po_badge: "P-101",
  previous_assignment_id: "55555555-5555-4555-8555-555555555555",
  successor_assignment_id: previousAssignmentId,
  previous_phase: 1,
  successor_phase: 1,
  previous_fto_name: "Earlier FTO",
  previous_fto_badge: "F-099",
  successor_fto_name: "FTO Original",
  successor_fto_badge: "F-101",
  previous_ends_on: "2025-12-31",
  successor_starts_on: "2026-01-01",
  successor_ends_on: "2026-12-31",
};

test("Coordinator assignment flow reads trusted roster and writes only after explicit confirmation", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const context = {
    available: true,
    role: "FTO_COORDINATOR",
    assignments: [{
      id: previousAssignmentId,
      class_name: className,
      phase: 1,
      fto_name: "FTO Original",
      fto_badge: "F-101",
      po_name: "PO Example",
      po_badge: "P-101",
      starts_on: "2026-01-01",
      ends_on: "2026-12-31",
    }],
    ftos: [{
      class_name: className,
      fto_id: "trusted-fto-successor",
      fto_name: "FTO Successor",
      fto_badge: "F-202",
    }],
    transitions: [earlierTransition],
  };
  const transition = {
    operation_id: "33333333-3333-4333-8333-333333333333",
    occurred_at: "2026-11-25T16:30:00.000Z",
    class_name: className,
    po_name: "PO Example",
    po_badge: "P-101",
    previous_assignment_id: previousAssignmentId,
    successor_assignment_id: successorAssignmentId,
    previous_phase: 1,
    successor_phase: 2,
    previous_fto_name: "FTO Original",
    previous_fto_badge: "F-101",
    successor_fto_name: "FTO Successor",
    successor_fto_badge: "F-202",
    previous_ends_on: "2026-11-30",
    successor_starts_on: "2026-12-01",
    successor_ends_on: "2026-12-31",
  };
  const oldFetch = globalThis.fetch;
  const oldDescriptors = new Map<string, PropertyDescriptor | undefined>();
  const dom = new JSDOM("<div id='root'></div>", {
    pretendToBeVisual: true,
    url: "http://localhost/phase-setup",
  });
  const globals = {
    window: dom.window,
    document: dom.window.document,
    location: dom.window.location,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    Node: dom.window.Node,
    Event: dom.window.Event,
    InputEvent: dom.window.InputEvent,
    MutationObserver: dom.window.MutationObserver,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  for (const [key, value] of Object.entries(globals)) {
    oldDescriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const { OfficialAssignmentTransitionController } = await import(
    "../components/official-assignment-transitions.js"
  );
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      requests.push({ method, url, body });
      if (method === "GET") {
        return new Response(JSON.stringify(context), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      assert.equal(method, "POST");
      assert.equal(url, "/api/v1/agency/assignment-transitions");
      const responseTransition = {
        ...transition,
        operation_id: String((body as { operation_id: string }).operation_id),
      };
      context.transitions = [earlierTransition, responseTransition];
      return new Response(JSON.stringify({
        status: "success",
        metadata: { total_records: 1, role: "FTO_COORDINATOR" },
        data: [responseTransition],
      }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const container = dom.window.document.getElementById("root")!;
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(container);
  const element = <T extends HTMLElement = HTMLElement>(id: string): T => {
    const node = dom.window.document.querySelector<T>(`[data-testid="${id}"]`);
    assert.ok(node, `Expected ${id} to render`);
    return node;
  };
  const flush = async () => act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });

  try {
    await act(async () => {
      root.render(
        <QueryClientProvider client={cache}>
          <OfficialAssignmentTransitionController userId="TEST-coordinator" />
        </QueryClientProvider>,
      );
    });
    await flush();
    assert.ok(element("select-official-predecessor"));
    assert.ok(element("select-successor-fto"));
    assert.equal(
      requests.filter(item => item.method === "POST").length,
      0,
      "opening the manager panel never changes the server roster",
    );
    await act(async () => element("button-open-assignment-history").click());
    assert.match(element("successor-assignment-history").textContent ?? "", /Earlier FTO/);
    await act(async () => element<HTMLButtonElement>("successor-assignment-history").querySelector("button")!.click());

    const writeDate = async (testId: string, value: string) => {
      await act(async () => {
        const input = element<HTMLInputElement>(testId);
        const setter = Object.getOwnPropertyDescriptor(
          dom.window.HTMLInputElement.prototype,
          "value",
        )?.set;
        setter?.call(input, value);
        input.dispatchEvent(new dom.window.InputEvent("input", {
          data: value,
          inputType: "insertText",
          bubbles: true,
        }));
        input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
      });
    };
    await writeDate("input-successor-start-date", "2026-12-01");
    await writeDate("input-successor-end-date", "2026-12-31");
    assert.equal(element<HTMLInputElement>("input-successor-start-date").value, "2026-12-01");
    assert.equal(element<HTMLInputElement>("input-successor-end-date").value, "2026-12-31");
    assert.equal(element<HTMLSelectElement>("select-successor-fto").value, "trusted-fto-successor");
    assert.equal(element<HTMLSelectElement>("select-successor-phase").value, "2");
    assert.equal(element<HTMLButtonElement>("button-review-successor-assignment").disabled, false);
    await act(async () => element("button-review-successor-assignment").click());
    assert.ok(element("successor-assignment-confirmation"));
    assert.equal(requests.filter(item => item.method === "POST").length, 0,
      "reviewing the details does not write an assignment");
    assert.match(element("successor-assignment-confirmation").textContent ?? "", /does not finalize a packet/i);

    await act(async () => element("button-confirm-successor-assignment").click());
    await flush();
    assert.ok(element("successor-assignment-complete"));
    const writes = requests.filter(item => item.method === "POST");
    assert.equal(writes.length, 1);
    const sent = writes[0]?.body as Record<string, unknown>;
    assert.match(String(sent.operation_id), /^[0-9a-f-]{36}$/i);
    assert.deepEqual(Object.keys(sent).sort(), [
      "ends_on", "fto_id", "operation_id", "phase", "previous_assignment_id", "starts_on",
    ].sort());
    assert.equal(sent.previous_assignment_id, previousAssignmentId);
    assert.equal(sent.fto_id, "trusted-fto-successor");
    assert.equal(sent.phase, 2);
    assert.equal(sent.starts_on, "2026-12-01");
    assert.equal(sent.ends_on, "2026-12-31");
    assert.ok(requests.every(item => !item.url.includes("/training-packets")),
      "assignment changes do not call packet sync or finalization");
    await act(async () => element("button-view-assignment-history").click());
    assert.match(element("successor-assignment-history").textContent ?? "", /FTO Original/);
    assert.match(element("successor-assignment-history").textContent ?? "", /FTO Successor/);
    assert.match(element("successor-assignment-history").textContent ?? "", /Earlier FTO/);
  } finally {
    await act(async () => root.unmount());
    cache.clear();
    dom.window.close();
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: oldFetch,
    });
    for (const [key, descriptor] of oldDescriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
