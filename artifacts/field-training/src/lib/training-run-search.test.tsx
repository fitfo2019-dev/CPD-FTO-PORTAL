import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test from "node:test";
import React, { act, createElement } from "react";
import { JSDOM } from "jsdom";
import { register } from "node:module";
import { createDailyReportDraft } from "./daily-report-draft.js";
import { createUiPreviewWorkspace } from "./empty-workspace.js";
import { createFtoTestPacketWorkspace } from "./test-packet.js";

register("data:text/javascript," + encodeURIComponent(
  `export async function load(url,ctx,next){
    const path=new URL(url).pathname;
    if(/\\.(css|svg|png)$/.test(path))return {format:'module',shortCircuit:true,source:'export default ""'};
    const loaded=await next(url,ctx);
    if(path.endsWith('/printable-columbus-header.tsx'))return {...loaded,
      source:String(loaded.source).replaceAll('import.meta.env.BASE_URL',JSON.stringify('/'))};
    return loaded;
  }`,
), import.meta.url);

test("saved run search keeps incident details and edit actions, and has a clear no-match state", async () => {
  const dom = new JSDOM("<!doctype html><div id='root'></div>", {
    url: "http://localhost/reports/test#runs", pretendToBeVisual: true,
  });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, HTMLInputElement: dom.window.HTMLInputElement,
    Node: dom.window.Node, NodeFilter: dom.window.NodeFilter, MutationObserver: dom.window.MutationObserver,
    CustomEvent: dom.window.CustomEvent, Event: dom.window.Event, React,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  dom.window.scrollTo = () => {};
  const { createRoot } = await import("react-dom/client");
  const { Router, Route } = await import("wouter");
  const { WorkspaceProvider } = await import("../state/workspace.js");
  const { PacketReviewStateContext } = await import("../state/packet-review.js");
  const { default: ReportEditor } = await import("../pages/report-editor.js");
  const workspace = createUiPreviewWorkspace();
  const report = createDailyReportDraft(workspace.caseFolder!, "2026-11-23");
  const template = createFtoTestPacketWorkspace().reports.flatMap(item => item.runs)[0]!;
  const runs = [
    { ...template, id: "incident-nine-digits", incidentNumber: "012345678", occurredAt: "2026-11-23T14:00:00Z" },
    { ...template, id: "incident-sixteen-digits", incidentNumber: "0123456789012345", occurredAt: "2026-11-23T15:00:00Z" },
  ];
  report.runs = runs;
  workspace.reports = [report];
  function Probe() {
    return createElement(PacketReviewStateContext.Provider, {
      value: { loading: false, error: null, previewOnly: true, refresh: async () => {},
        act: async () => { throw new Error("Not part of this test"); }, assign: async () => {},
        finalizeReport: async () => { throw new Error("Never finalize"); }, openCorrection: async () => {} },
      children: createElement(Router, {
        hook: () => [`/reports/${report.id}`, () => {}] as [string, () => void],
        children: createElement(Route, { path: "/reports/:id", component: ReportEditor }),
      }),
    });
  }
  const root = createRoot(dom.window.document.getElementById("root")!);
  const element = <T extends HTMLElement = HTMLElement>(id: string): T => {
    const node = dom.window.document.querySelector<T>(`[data-testid="${id}"]`);
    assert.ok(node, `missing ${id}`); return node;
  };
  const click = async (id: string) => { await act(async () => { element(id).click(); }); };
  const fillSearch = async (value: string) => {
    await act(async () => {
      const input = element<HTMLInputElement>("input-search-runs-by-incident");
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
  };
  try {
    await act(async () => root.render(createElement(WorkspaceProvider, {
      previewOnly: true, previewWorkspace: () => workspace, children: createElement(Probe),
    })));
    await click("button-stage-runs");
    assert.equal(element<HTMLInputElement>("input-search-runs-by-incident").maxLength, 16);
    await fillSearch("012345678");
    assert.ok(dom.window.document.querySelector('[data-testid="row-training-run-incident-nine-digits"]'));
    assert.ok(dom.window.document.querySelector('[data-testid="row-training-run-incident-sixteen-digits"]'));
    await fillSearch("0123456789012345");
    const matchingRow = dom.window.document.querySelector('[data-testid="row-training-run-incident-sixteen-digits"]');
    assert.ok(matchingRow, "A matching 16-digit run remains visible");
    assert.match(element("text-run-incident-number-incident-sixteen-digits").textContent ?? "", /0123456789012345/);
    assert.ok(matchingRow.querySelector('[data-testid="button-edit-run-incident-sixteen-digits"]'),
      "The matching run retains its edit action");
    assert.equal(dom.window.document.querySelector('[data-testid="row-training-run-incident-nine-digits"]'), null);
    await fillSearch("999999999");
    assert.ok(element("text-no-matching-runs"));
    await click("button-clear-run-search");
    assert.ok(dom.window.document.querySelector('[data-testid="row-training-run-incident-nine-digits"]'),
      "Clearing the search restores all saved runs");

    await click("button-delete-run-incident-nine-digits");
    assert.ok(dom.window.document.body.textContent?.includes("Remove this run from the daily log?"),
      "Removing a run first opens the confirmation dialog");
    await click("button-confirm-action-cancel");
    assert.ok(dom.window.document.querySelector('[data-testid="row-training-run-incident-nine-digits"]'),
      "Keeping the run leaves it in the daily-log draft");
    assert.deepEqual(workspace.reports[0]?.runs.map(run => run.id), [
      "incident-nine-digits", "incident-sixteen-digits",
    ], "Cancelling does not change the saved report");

    await click("button-delete-run-incident-nine-digits");
    await click("button-confirm-action");
    assert.equal(dom.window.document.querySelector('[data-testid="row-training-run-incident-nine-digits"]'), null,
      "Confirming removes the selected run from the current draft");
    assert.ok(dom.window.document.querySelector('[data-testid="row-training-run-incident-sixteen-digits"]'),
      "Confirming leaves the other run in the daily-log draft");
    assert.deepEqual(workspace.reports[0]?.runs.map(run => run.id), [
      "incident-nine-digits", "incident-sixteen-digits",
    ], "Removal remains an unsaved draft change");
    assert.match(element("status-daily-save").textContent ?? "", /Unsaved daily log changes/);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  }
});
