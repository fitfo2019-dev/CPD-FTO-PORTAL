import assert from 'node:assert/strict';
import test from 'node:test';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { ArrestClassificationFields } from '../components/arrest-classification-fields.js';

test('classification fields expose labeled editable controls and become non-focusable in read-only mode', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { pretendToBeVisual: true });
  const globalKeys = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'getComputedStyle'] as const;
  const previous = new Map(globalKeys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const previousAct = Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
  for (const key of globalKeys) {
    const value = key === 'window' ? dom.window
      : key === 'document' ? dom.window.document
        : key === 'HTMLElement' ? dom.window.HTMLElement
          : key === 'Node' ? dom.window.Node
            : key === 'navigator' ? dom.window.navigator
              : dom.window.getComputedStyle.bind(dom.window);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, writable: true, value: true });
  const container = dom.window.document.getElementById('root')!;
  const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(ArrestClassificationFields, {
      severity: '',
      arrestType: '',
      disabled: false,
      inputClassName: 'field-control',
      onSeverityChange: () => undefined,
      onArrestTypeChange: () => undefined,
    })));
    const severity = container.querySelector<HTMLInputElement>('[data-testid="input-arrest-severity"]')!;
    const type = container.querySelector<HTMLInputElement>('[data-testid="input-arrest-type"]')!;
    assert.equal(container.querySelectorAll('input').length, 2);
    assert.equal(severity.placeholder, 'Felony/Misdemeanor');
    assert.equal(type.placeholder, 'Warrant/On-view');
    assert.equal(severity.value, '');
    assert.equal(type.value, '');
    assert.match(severity.closest('label')?.textContent ?? '', /Arrest severity/);
    assert.match(type.closest('label')?.textContent ?? '', /Arrest type/);
    assert.equal(severity.disabled, false);

    await act(async () => root.render(createElement(ArrestClassificationFields, {
      severity: '',
      arrestType: '',
      disabled: true,
      inputClassName: 'field-control',
      onSeverityChange: () => undefined,
      onArrestTypeChange: () => undefined,
    })));
    const readOnlySeverity = container.querySelector<HTMLInputElement>('[data-testid="input-arrest-severity"]')!;
    const readOnlyType = container.querySelector<HTMLInputElement>('[data-testid="input-arrest-type"]')!;
    assert.equal(readOnlySeverity.disabled, true);
    assert.equal(readOnlyType.disabled, true);
  } finally {
    await act(async () => root.unmount());
    for (const key of globalKeys) {
      const descriptor = previous.get(key);
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete (globalThis as Record<string, unknown>)[key];
    }
    if (previousAct) Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', previousAct);
    else delete (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT;
    dom.window.close();
  }
});
