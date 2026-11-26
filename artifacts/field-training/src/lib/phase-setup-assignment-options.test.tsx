import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { registerHooks } from "node:module";
import { JSDOM } from "jsdom";
import { createEmptyWorkspace } from "./empty-workspace.js";
import {
  canonicalFtoAssignmentsForPrecinct,
  ftoCruiserDistrictsForShift,
} from "./cpd-geography.js";

registerHooks({
  load(url,ctx,next){
      const path=new URL(url).pathname;
      if(/\.(css|svg|png)$/.test(path))return {format:'module',shortCircuit:true,source:'export default ""'};
      return next(url,ctx);
  },
});

test("phase setup renders shared assignment choices for representative zones and watches", async () => {
  const dom = new JSDOM("<div id='root'></div>", {
    pretendToBeVisual: true,
    url: "https://localhost/phase-setup",
  });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    Node: dom.window.Node,
    Event: dom.window.Event,
    MutationObserver: dom.window.MutationObserver,
    React,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }

  const { createRoot } = await import("react-dom/client");
  const { Router } = await import("wouter");
  const { WorkspaceProvider } = await import("../state/workspace.js");
  const { default: PhaseSetupPage } = await import("../pages/phase-setup.js");
  const workspace = { ...createEmptyWorkspace(), role: "fto_coordinator" as const };
  const container = dom.window.document.getElementById("root")!;
  const root = createRoot(container);

  function element<T extends HTMLElement = HTMLElement>(testId: string): T {
    const node = dom.window.document.querySelector<T>(`[data-testid="${testId}"]`);
    assert.ok(node, `Expected ${testId} to render`);
    return node;
  }

  async function choose(testId: string, label: string) {
    await act(async () => {
      element<HTMLInputElement>(testId).focus();
    });
    const option = [...dom.window.document.querySelectorAll<HTMLElement>('[role="option"]')]
      .find(node => node.textContent?.trim() === label);
    assert.ok(option, `Expected the ${testId} choices to include ${label}`);
    await act(async () => option.click());
  }

  try {
    await act(async () => {
      root.render(
        <WorkspaceProvider
          storageNamespace={`phase-setup-assignment-options-${crypto.randomUUID()}`}
          previewOnly
          previewWorkspace={() => workspace}
        >
          <Router hook={() => ["/phase-setup", () => {}]}>
            <PhaseSetupPage />
          </Router>
        </WorkspaceProvider>,
      );
    });

    const examples = [
      { zone: "1", precinct: "1", shift: "A-Co", zoneLabel: "Zone 1", shiftLabel: "A-Co · Company A" },
      { zone: "2", precinct: "14", shift: "DMW", zoneLabel: "Zone 2", shiftLabel: "DMW · Day Midwatch · 10 hours" },
      { zone: "3", precinct: "8", shift: "C-Co", zoneLabel: "Zone 3", shiftLabel: "C-Co · Company C" },
      { zone: "4", precinct: "17", shift: "EMW", zoneLabel: "Zone 4", shiftLabel: "EMW · Evening Midwatch · 10 hours" },
      { zone: "5", precinct: "12", shift: "B-Co", zoneLabel: "Zone 5", shiftLabel: "B-Co · Company B" },
      { zone: "6", precinct: "5", shift: "C-Co", zoneLabel: "Zone 6", shiftLabel: "C-Co · Company C" },
    ] as const;

    for (const example of examples) {
      await choose("select-zone", example.zoneLabel);
      await choose("select-precinct", `Precinct ${example.precinct}`);
      await choose("select-shift", example.shiftLabel);

      const rendered = [...dom.window.document.querySelectorAll<HTMLInputElement>(
        '[data-testid^="radio-fto-assignment-"]',
      )].map(input => input.value);
      const catalog = canonicalFtoAssignmentsForPrecinct(example.zone, example.precinct, example.shift);
      assert.deepEqual(rendered, catalog, `${example.zone}/${example.precinct}/${example.shift} choices match the shared catalog`);
      assert.equal(new Set(rendered).size, rendered.length, "rendered assignment choices are unique");
    }

    await choose("select-zone", "Zone 3");
    await choose("select-precinct", "Precinct 8");
    const universalChoices = [...dom.window.document.querySelectorAll<HTMLInputElement>(
      '[data-testid^="radio-fto-assignment-80C"]',
    )].map(input => input.value);
    assert.deepEqual(universalChoices.slice().sort(), ["80C", "80C-1", "80C-2"].sort());

    await act(async () => element<HTMLInputElement>("radio-fto-assignment-80C").click());
    assert.ok(element("select-universal-cruiser-district"), "universal 80C requires mapped-district context");
    assert.ok(
      [...dom.window.document.querySelectorAll('[role="alert"]')]
        .some(node => node.textContent?.includes("Select a mapped cruiser district")),
      "universal 80C cannot be selected without its mapped district",
    );
    await act(async () => element<HTMLInputElement>("select-universal-cruiser-district").focus());
    const districtChoices = [...dom.window.document.querySelectorAll<HTMLElement>('[role="option"]')]
      .map(node => node.textContent?.trim());
    assert.equal(districtChoices[0], "Select mapped district");
    assert.deepEqual(districtChoices.slice(1), ftoCruiserDistrictsForShift("3", "8", "C-Co"));
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
