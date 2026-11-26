import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act, createElement } from 'react';
import { JSDOM } from 'jsdom';
import { register } from 'node:module';
import { seedReports } from './seed.js';
import { createFtoTestPacketWorkspace } from './test-packet.js';

register('data:text/javascript,' + encodeURIComponent(
  `export async function load(url,ctx,next){
    const path=new URL(url).pathname;
    if(/\\.(css|svg|png)$/.test(path))return {format:'module',shortCircuit:true,source:'export default ""'};
    return next(url,ctx);
  }`,
), import.meta.url);

test('saved incident search links each cross-day result to its exact run without edit controls', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'http://localhost/reports',
    pretendToBeVisual: true,
  });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    location: dom.window.location,
    history: dom.window.history,
    addEventListener: dom.window.addEventListener.bind(dom.window),
    removeEventListener: dom.window.removeEventListener.bind(dom.window),
    dispatchEvent: dom.window.dispatchEvent.bind(dom.window),
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    Node: dom.window.Node,
    Event: dom.window.Event,
    MutationObserver: dom.window.MutationObserver,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }

  const { createRoot } = await import('react-dom/client');
  const { SavedIncidentSearch } = await import('../components/saved-incident-search.js');
  const template = createFtoTestPacketWorkspace().reports.flatMap(report => report.runs)[0]!;
  const base = seedReports()[0]!;
  const reports = [
    {
      ...structuredClone(base),
      id: 'report-day-one',
      date: '2026-11-19',
      runs: [{ ...template, id: 'run-day-one', incidentNumber: '012345678' }],
    },
    {
      ...structuredClone(base),
      id: 'report-day-two',
      date: '2026-11-15',
      runs: [{ ...template, id: 'run-day-two', incidentNumber: '0123456789012345' }],
    },
  ];
  const root = createRoot(dom.window.document.getElementById('root')!);
  const element = <T extends HTMLElement = HTMLElement>(id: string): T => {
    const node = dom.window.document.querySelector<T>(`[data-testid="${id}"]`);
    assert.ok(node, `missing ${id}`);
    return node;
  };
  const fillSearch = async (value: string) => {
    await act(async () => {
      const input = element<HTMLInputElement>('input-search-incidents-across-reports');
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
  };

  try {
    await act(async () => {
      root.render(createElement(SavedIncidentSearch, { reports }));
    });
    await fillSearch('012345678');

    const first = element('row-incident-result-report-day-one-run-day-one');
    const second = element('row-incident-result-report-day-two-run-day-two');
    assert.match(first.textContent ?? '', /11\/19\/2026/);
    assert.match(second.textContent ?? '', /11\/15\/2026/);
    assert.equal(
      element<HTMLAnchorElement>('link-incident-result-report-day-one-run-day-one').getAttribute('href'),
      '/reports/report-day-one#run-run-day-one',
    );
    assert.equal(
      element<HTMLAnchorElement>('link-incident-result-report-day-two-run-day-two').getAttribute('href'),
      '/reports/report-day-two#run-run-day-two',
    );
    assert.match(element('status-incident-search-count').textContent ?? '', /2 matches/);
    assert.equal(first.querySelectorAll('button').length, 0);
    assert.equal(second.querySelectorAll('button').length, 0);

    await fillSearch('999999999');
    assert.ok(element('text-no-incident-results'));
    await act(async () => element('button-clear-incident-search').click());
    assert.equal(element<HTMLInputElement>('input-search-incidents-across-reports').value, '');
    assert.equal(dom.window.document.querySelector('[data-testid="text-no-incident-results"]'), null);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
