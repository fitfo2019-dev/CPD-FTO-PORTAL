import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { JSDOM } from "jsdom";
import { register } from "node:module";
import { createDailyReportDraft } from "./daily-report-draft.js";
import { createUiPreviewWorkspace } from "./empty-workspace.js";
import { createFtoTestPacketWorkspace } from "./test-packet.js";
import { buildClassWorkbook } from "./exportWorkbook.js";

register("data:text/javascript," + encodeURIComponent(
  "export async function load(url,ctx,next){if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default {}'};return next(url,ctx)}",
), import.meta.url);

test("mounted editor attaches a supplement, records a failure, detaches and saves an exportable run", async () => {
  const dom = new JSDOM("<!doctype html><div id='root'></div>", {
    url: "http://localhost/reports/test#runs", pretendToBeVisual: true,
  });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, HTMLInputElement: dom.window.HTMLInputElement,
    Node: dom.window.Node, NodeFilter: dom.window.NodeFilter, MutationObserver: dom.window.MutationObserver,
    CustomEvent: dom.window.CustomEvent, Event: dom.window.Event,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  dom.window.scrollTo = () => {};
  const { createRoot } = await import("react-dom/client");
  const { Router, Route } = await import("wouter");
  const { WorkspaceProvider, useWorkspace } = await import("../state/workspace.js");
  const { PacketReviewStateContext } = await import("../state/packet-review.js");
  const { default: ReportEditor } = await import("../pages/report-editor.js");
  const workspace = createUiPreviewWorkspace();
  const report = createDailyReportDraft(workspace.caseFolder!, "2026-11-23");
  const template = createFtoTestPacketWorkspace().reports.flatMap(item => item.runs)[0]!;
  const run = { ...template, occurredAt: "2026-11-23T14:00:00Z",
    dispatchedAt: undefined, endedAt: undefined, narrativeAdditionRequired: false };
  report.runs = [run];
  workspace.reports = [report];
  let current: ReturnType<typeof useWorkspace> | undefined;
  function Probe() {
    current = useWorkspace();
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
  try {
    await act(async () => root.render(createElement(WorkspaceProvider, {
      previewOnly: true, previewWorkspace: () => workspace, children: createElement(Probe),
    })));
    await click("button-stage-runs");
    await click(`button-edit-run-${run.id}`);
    await click("button-run-step-details");
    await click("checkbox-quick-add-ovi_process");
    await click("button-run-step-ovi_process");
    await click("checkbox-supplement-ovi_process-2");
    await click("checkbox-run-failure-action-0");
    await click("button-confirm-run-failure");
    assert.equal(element<HTMLInputElement>("checkbox-supplement-ovi_process-2").checked, false);
    assert.match(element("section-supplement-ovi_process").textContent ?? "", /Not completed:.*Observed the driver/);
    await click("button-run-step-details");
    await click("checkbox-quick-add-ovi_process");
    await click("button-confirm-action");
    assert.equal(element<HTMLInputElement>("checkbox-quick-add-ovi_process").checked, false);
    assert.equal(dom.window.document.querySelector('[data-testid="button-run-step-ovi_process"]'), null);
    await click("button-run-step-primary");
    if (!element<HTMLInputElement>("checkbox-sheet-review-primary").checked) await click("checkbox-sheet-review-primary");
    await click("button-run-step-finish");
    await click("button-save-run");
    assert.equal(dom.window.document.querySelector('[data-testid="text-run-error"]'), null);
    await click("button-save-draft");
    const saved = current!.ws.reports.find(item => item.id === report.id)!;
    assert.equal(saved.runs[0]!.oviProcessRequired, false);
    assert.equal(saved.runs[0]!.checklistFailures?.["supp-ovi_process-2"], undefined);
    assert.doesNotThrow(() => buildClassWorkbook([saved]));
  } finally {
    await act(async () => { root.unmount(); await new Promise(resolve => setTimeout(resolve, 25)); });
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
