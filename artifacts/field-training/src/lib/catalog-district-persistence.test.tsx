import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test from "node:test";
import React, { act, createElement } from "react";
import { JSDOM } from "jsdom";
import { registerHooks } from "node:module";
import { createUiPreviewWorkspace } from "./empty-workspace.js";
import { createDailyReportDraft } from "./daily-report-draft.js";

registerHooks({
  load(url,ctx,next){
    const path=new URL(url).pathname;
    if(/\.(css|svg|png)$/.test(path))return {format:'module',shortCircuit:true,source:'export default ""'};
    const loaded=next(url,ctx);
    if(path.endsWith('/printable-columbus-header.tsx'))return {...loaded,
      source:String(loaded.source).replaceAll('import.meta.env.BASE_URL',JSON.stringify('/'))};
    return loaded;
  },
});

test("catalog-only district survives encrypted restoration and opens a new daily report", async () => {
  const dom = new JSDOM("<div id='root'></div>", {
    pretendToBeVisual: true, url: "https://localhost/reports/new#shift-narrative",
  });
  Object.defineProperty(dom.window.navigator, "onLine", { configurable: true, value: false });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, React, IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const { createRoot } = await import("react-dom/client");
  const { Router, Route } = await import("wouter");
  const { WorkspaceProvider, useWorkspace } = await import("../state/workspace.js");
  const { PacketReviewStateContext } = await import("../state/packet-review.js");
  const { default: ReportEditor } = await import("../pages/report-editor.js");
  const namespace = `catalog-restore-${crypto.randomUUID()}`;
  const passphrase = "fictional-catalog-restoration-test";
  const folder = { ...createUiPreviewWorkspace().caseFolder!, zone: "3", precinct: "15",
    cruiserDistrict: "9155", ftoAssignment: "9155E-1", shift: "EMW" as const,
    daysOff: [4, 5, 6] as (0 | 1 | 2 | 3 | 4 | 5 | 6)[], phaseStartDate: "2026-11-22",
    phaseWeekRanges: [],
  };
  const savedReport = createDailyReportDraft(folder, "2026-11-22");
  let current: ReturnType<typeof useWorkspace> | undefined;
  let showEditor = false;
  function Probe() {
    current = useWorkspace();
    return showEditor ? createElement(PacketReviewStateContext.Provider, {
      value: { loading: false, error: null, previewOnly: false, refresh: async () => {},
        assign: async () => {}, act: async () => { throw new Error("Not used"); },
        finalizeReport: async () => {}, openCorrection: async () => {} },
      children: createElement(Router, { hook: () => ["/reports/new", () => {}] as [string, () => void],
        children: createElement(Route, { path: "/reports/:id", component: ReportEditor }) }),
    }) : null;
  }
  const container = dom.window.document.getElementById("root")!;
  let root = createRoot(container);
  const render = () => root.render(createElement(WorkspaceProvider, {
    storageNamespace: namespace, children: createElement(Probe),
  }));
  try {
    await act(async () => { render(); });
    await act(async () => { await current!.setupAndSave(passphrase); });
    await act(async () => { current!.setCaseFolder(folder); current!.upsertReport(savedReport); });
    await act(async () => { await current!.saveNow(); current!.lockNow(); });
    await act(async () => { root.unmount(); });
    root = createRoot(container);
    await act(async () => { render(); });
    await act(async () => { await current!.unlockAndRestore(passphrase); });
    for (const value of [current!.ws.caseFolder!, ...current!.ws.phaseFolders, ...current!.ws.reports]) {
      assert.equal(value.zone, "3");
      assert.equal(value.precinct, "15");
      assert.equal(value.cruiserDistrict, "9155");
      assert.equal(value.ftoAssignment, "9155E-1");
    }
    showEditor = true;
    await act(async () => { render(); });
    assert.ok(dom.window.document.querySelector('[data-testid="button-stage-runs"]'),
      "The new-report editor must open rather than displaying the phase-setup lock");
    assert.doesNotMatch(dom.window.document.body.textContent!, /Complete the shift schedule/);
  } finally {
    await act(async () => { root.unmount(); });
    dom.window.close();
    for (const [key, descriptor] of previous)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  }
});
