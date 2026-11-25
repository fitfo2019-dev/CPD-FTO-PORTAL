import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { act } from 'react';
import { JSDOM } from 'jsdom';
import { ErrorBoundary } from '../components/error-boundary.js';
import { listSharedPhaseExtensionRequests } from './phase-extension-api.js';
import { OperatorFacingError, operatorErrorToast } from './operator-errors.js';
import { packetReviewError } from '../state/packet-review.js';

test('the error boundary gives operators recovery guidance without rendering a technical crash message', async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true,
  });
  const globals: Record<string, unknown> = {
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const originals = new Map(Object.keys(globals).map(key => [
    key,
    Object.getOwnPropertyDescriptor(globalThis, key),
  ]));
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }

  const { createRoot } = await import('react-dom/client');
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const diagnostics: string[] = [];
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => diagnostics.push(args.map(String).join(' '));

  function CrashingChild(): React.ReactNode {
    throw new Error('SQLSTATE 23505 at database.internal: duplicate key');
  }

  try {
    await act(async () => root.render(<ErrorBoundary><CrashingChild /></ErrorBoundary>));
    assert.match(host.textContent ?? '', /This part of the portal couldn’t be loaded/);
    assert.match(host.textContent ?? '', /contact the FTO Coordinator/);
    assert.doesNotMatch(host.textContent ?? '', /SQLSTATE|database\.internal|duplicate key/);
    assert.equal(host.querySelector('pre'), null);
    assert.ok(diagnostics.some(line => /SQLSTATE 23505/.test(line)));
  } finally {
    console.error = originalConsoleError;
    await act(async () => root.unmount());
    host.remove();
    dom.window.close();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test('technical phase-extension API messages are mapped before they can reach a toast', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
    status: 'error',
    error_code: 'REQUEST_STORAGE_UNAVAILABLE',
    message: 'postgres://agency-db/private: relation phase_extensions does not exist',
  }), {
    status: 503,
    headers: { 'content-type': 'application/json' },
  }));

  await assert.rejects(
    listSharedPhaseExtensionRequests('fictional-test-token'),
    error => {
      assert.match((error as Error).message, /shared request service is temporarily unavailable/i);
      assert.doesNotMatch((error as Error).message, /postgres|agency-db|relation phase_extensions/);
      return true;
    },
  );
});

test('toast formatting hides unexpected errors and retains reviewed recovery warnings', () => {
  const diagnostics: unknown[][] = [];
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => diagnostics.push(args);
  try {
    const unexpected = operatorErrorToast(
      'Could not restore the previous version',
      new Error('IndexedDB transaction failed in local-drafts'),
      'The previous version could not be confirmed. Review the workspace before trying again.',
    );
    assert.deepEqual(unexpected, {
      title: 'Could not restore the previous version',
      description: 'The previous version could not be confirmed. Review the workspace before trying again.',
      variant: 'destructive',
    });
    assert.doesNotMatch(unexpected.description, /IndexedDB|local-drafts/);
    assert.ok(diagnostics.some(args => args.some(value => String(value).includes('IndexedDB transaction failed'))));

    const expected = operatorErrorToast(
      'Could not restore the previous version',
      new OperatorFacingError('This recovery copy expired and was deleted.'),
      'The previous version could not be restored.',
    );
    assert.equal(expected.description, 'This recovery copy expired and was deleted.');
  } finally {
    console.error = originalConsoleError;
  }
});

test('packet-review failures keep local-data warnings but never trust server error text', () => {
  assert.equal(packetReviewError({
    data: {
      error_code: 'AGENCY_STORAGE_UNAVAILABLE',
      message: 'postgres://internal-db:5432 stack trace omitted',
    },
  }), 'The packet-review operation could not be completed. Local drafts were not removed.');
  assert.equal(packetReviewError({
    data: {
      error_code: 'INVALID_REVIEW_ACTION',
      message: 'TypeError: Cannot read properties of undefined',
    },
  }), 'Check the packet-review details and try again. No records were changed.');
  assert.equal(packetReviewError(new Error('database.internal relation missing')),
    'The shared packet service is unavailable. Local drafts have been retained.');
});
