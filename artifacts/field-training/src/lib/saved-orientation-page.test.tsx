import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { register } from 'node:module';
import React, { act, createElement } from 'react';
import { JSDOM } from 'jsdom';
import { createFtoTestPacketWorkspace } from './test-packet.js';
import type { Workspace } from './model.js';

register('data:text/javascript,' + encodeURIComponent(
  "export async function load(url,ctx,next){if(/printable-extended-forms\\.(tsx|js)$/.test(new URL(url).pathname))return {format:'module',shortCircuit:true,source:'export const PrintableSubstationOrientation=()=>null'};return next(url,ctx)}",
), import.meta.url);

test('historical phase links mount saved answers while Phase I remains active', async () => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'https://localhost/substation-orientation', pretendToBeVisual: true,
  });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    React, window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    location: dom.window.location, history: dom.window.history,
    addEventListener: dom.window.addEventListener.bind(dom.window),
    removeEventListener: dom.window.removeEventListener.bind(dom.window),
    dispatchEvent: dom.window.dispatchEvent.bind(dom.window), Event: dom.window.Event,
    HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const { createRoot } = await import('react-dom/client');
  const { Router } = await import('wouter');
  const { WorkspaceProvider, useWorkspace } = await import('../state/workspace.js');
  const { default: OrientationPage } = await import('../pages/substation-orientation.js');
  const root = createRoot(dom.window.document.getElementById('root')!);
  let current: Workspace | undefined;
  function Probe() {
    current = useWorkspace().ws;
    return createElement(OrientationPage);
  }
  try {
    for (const role of ['fto', 'fto_coordinator'] as const) {
      for (const phase of [2, 3, 4] as const) {
        const workspace = createFtoTestPacketWorkspace();
        workspace.role = role;
        workspace.caseFolder = workspace.phaseFolders.find(folder => folder.phase === 1)!;
        const saved = workspace.substationOrientations.find(item => item.phase === phase)!;
        const before = JSON.stringify(saved);
        await act(async () => {
          dom.window.history.replaceState(null, '', `/substation-orientation?orientation=${encodeURIComponent(saved.id)}`);
          root.render(createElement(Router, {
            children: createElement(WorkspaceProvider, {
              key: `${role}-${phase}`, storageNamespace: `orientation-page-${role}-${phase}`,
              previewOnly: true, previewWorkspace: () => workspace, children: createElement(Probe),
            }),
          }));
        });
        assert.match(dom.window.document.querySelector('.label-caps')?.textContent ?? '', new RegExp(`Phase ${phase}`));
        const substation = dom.window.document.querySelector<HTMLInputElement>('[data-testid="input-orientation-substation"]')!;
        assert.equal(substation.value, saved.substation);
        assert.equal(substation.disabled, role === 'fto_coordinator');
        const textareas = [...dom.window.document.querySelectorAll('textarea')].map(input => input.value);
        assert.ok(textareas.includes(saved.narrative));
        assert.equal(dom.window.document.querySelector<HTMLInputElement>('[data-testid="input-orientation-directives"]')?.value, saved.directivesReview);
        assert.equal(current?.caseFolder?.phase, 1);
        assert.equal(JSON.stringify(current?.substationOrientations.find(item => item.id === saved.id)), before);
      }
    }
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
