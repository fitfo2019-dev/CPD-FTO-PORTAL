import React, { act } from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

test('new-run retry remains available after repeated outages and preserves review edits', async t => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  const requestBodies: string[] = [];
  let releaseSuccessfulResponse: (() => void) | undefined;
  const successfulResponseReady = new Promise<void>(resolve => { releaseSuccessfulResponse = resolve; });
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (_input, init) => {
    requestBodies.push(String(init?.body));
    attempts += 1;
    if (attempts < 3) throw new Error('temporary outage');
    await successfulResponseReady;
    return new Response(JSON.stringify({
      status: 'success',
      metadata: { total_records: 1 },
      data: [{
        incidentNumber: 'INC-2468',
        unitNumber: 'UNIT-A',
        locationAddress: '100 Main Street',
        locationCity: 'Columbus',
        locationState: 'OH',
        eventDate: '2026-11-23',
        dispatchedCode: '17A',
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const dom = new JSDOM('<div id="root"></div>', { url: 'https://localhost/reports', pretendToBeVisual: true });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    Node: dom.window.Node,
    MutationObserver: dom.window.MutationObserver,
    Event: dom.window.Event,
    CustomEvent: dom.window.CustomEvent,
    MouseEvent: dom.window.MouseEvent,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }

  const { createRoot } = await import('react-dom/client');
  const { NewRunDialog } = await import('../components/new-run-dialog.js');
  const root = createRoot(dom.window.document.getElementById('root')!);
  const element = <T extends HTMLElement = HTMLElement>(testId: string) => {
    const node = dom.window.document.querySelector<T>(`[data-testid="${testId}"]`);
    assert.ok(node, testId);
    return node;
  };
  const settle = () => new Promise(resolve => setTimeout(resolve, 0));
  const click = async (testId: string) => act(async () => {
    element(testId).click();
    await settle();
  });
  const input = async (testId: string, value: string) => act(async () => {
    const node = element<HTMLInputElement>(testId);
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(node, value);
    node.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });

  try {
    await act(async () => root.render(<NewRunDialog
      open
      defaultUnit="UNIT-A"
      onCancel={() => {}}
      onConfirm={() => {}}
    />));
    await input('input-new-run-incident', 'INC-2468');
    await click('button-new-run-lookup');
    assert.ok(dom.window.document.querySelector('[data-testid="text-lookup-failed"]'));
    await click('button-new-run-retry');
    assert.ok(dom.window.document.querySelector('[data-testid="text-lookup-failed"]'), 'a second outage keeps the retry state');
    await click('button-new-run-manual');
    await click('button-review-dispatch-retry');
    await input('input-review-location', 'FTO corrected location');
    await act(async () => {
      releaseSuccessfulResponse?.();
      await settle();
    });

    assert.equal(element<HTMLInputElement>('input-review-location').value, 'FTO corrected location');
    assert.equal(element<HTMLInputElement>('input-review-city').value, 'Columbus');
    assert.equal(element<HTMLInputElement>('input-review-state').value, 'OH');
    assert.equal(element<HTMLInputElement>('input-review-code').value, '17A');
    assert.equal(dom.window.document.querySelector('[data-testid="text-review-lookup-failed"]'), null);
    assert.deepEqual(requestBodies, Array(3).fill(JSON.stringify({ incidentNumber: 'INC-2468', unitNumber: 'UNIT-A' })));
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
