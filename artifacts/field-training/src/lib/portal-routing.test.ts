import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { Link, Route, Router, Switch, type BaseLocationHook } from 'wouter';
import { PortalRouteSwitch, UiPreviewRouter } from './portal-routing.js';
import { createUiPreviewWorkspace } from './empty-workspace.js';

function locationAt(path: string): BaseLocationHook {
  return () => [path, () => {}];
}

function renderPortalAt(path: string, base = '/field-portal') {
  const routes = createElement(PortalRouteSwitch, {
    signIn: createElement('p', null, 'SIGN IN'),
    signUp: createElement('p', null, 'SIGN UP'),
    uiPreview: createElement(
      UiPreviewRouter,
      null,
      createElement(
        Switch,
        null,
        createElement(Route, { path: '/substation-orientation' }, 'ORIENTATION PREVIEW'),
        createElement(Route, null, 'OTHER PREVIEW PAGE'),
      ),
    ),
    protectedPortal: createElement('p', null, 'PROTECTED PORTAL'),
  });
  return renderToString(
    createElement(Router, { base, hook: locationAt(path) }, routes),
  );
}

test('signed-out deep links under the app base path resolve to the preview, not the protected portal', () => {
  const html = renderPortalAt('/field-portal/ui-preview/substation-orientation');
  assert.match(html, /ORIENTATION PREVIEW/);
  assert.doesNotMatch(html, /PROTECTED PORTAL/);
});

test('preview navigation preserves both the app base path and the isolated preview path', () => {
  const preview = createElement(
    UiPreviewRouter,
    null,
    createElement(Link, { href: '/substation-orientation' }, 'Open orientation'),
  );
  const html = renderToString(
    createElement(
      Router,
      { base: '/field-portal', hook: locationAt('/field-portal/ui-preview') },
      preview,
    ),
  );
  assert.match(html, /href="\/field-portal\/ui-preview\/substation-orientation"/);
});

test('sign-in remains public while every route outside the preview reaches the protected portal', () => {
  assert.match(renderPortalAt('/field-portal/sign-in'), /SIGN IN/);
  assert.match(renderPortalAt('/field-portal/sign-up'), /SIGN UP/);
  for (const path of [
    '/field-portal/',
    '/field-portal/reports',
    '/field-portal/ui-previewish/substation-orientation',
  ]) {
    assert.match(renderPortalAt(path), /PROTECTED PORTAL/, path);
    assert.doesNotMatch(renderPortalAt(path), /ORIENTATION PREVIEW/, path);
  }
});

test('preview workspace contains only fixed fictional starter data', () => {
  const workspace = createUiPreviewWorkspace();
  assert.equal(workspace.caseFolder?.className, 'UI TEST ONLY');
  assert.equal(workspace.caseFolder?.recruitBadge, 'DEMO-PO');
  assert.equal(workspace.caseFolder?.ftoBadge, 'DEMO-FTO');
  assert.deepEqual(workspace.reports, []);
  assert.deepEqual(workspace.tasks, []);
  assert.deepEqual(workspace.substationOrientations, []);
});
