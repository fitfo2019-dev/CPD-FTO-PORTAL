import assert from 'node:assert/strict';
import { test } from 'node:test';
import { roleManualHtml } from './role-manual.js';
import { getApplicationHelpTopicsForRole, getApplicationHelpWorkflowsForRole } from './application-help.js';
import { ROLES } from './model.js';

const assets = { wordmarkSvg: '<svg></svg>', patchUrl: '/branding/patch.png', badgeUrl: '/branding/badge.png' };
const esc = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

test('each role manual holds that role\'s Help Desk content and nothing from other roles', () => {
  for (const role of ROLES) {
    const html = roleManualHtml(role, '11/26/2026', assets);
    const own = new Set([...getApplicationHelpTopicsForRole(role).map(t => t.title), ...getApplicationHelpWorkflowsForRole(role).map(w => w.title)]);
    for (const title of own) assert.ok(html.includes(esc(title)), `${role} is missing ${title}`);
    for (const other of ROLES.filter(r => r !== role)) {
      for (const topic of getApplicationHelpTopicsForRole(other)) {
        if (own.has(topic.title)) continue;
        assert.equal(html.includes(`<h3>${esc(topic.title)}`), false, `${role} manual shows ${other} topic ${topic.title}`);
      }
    }
  }
});

test('the manual is US Letter portrait with wordmark, patch and badge on every page', () => {
  const html = roleManualHtml('fto', '11/26/2026', assets);
  assert.match(html, /size: letter portrait/);
  assert.match(html, /<thead>[\s\S]*class="wordmark"[\s\S]*class="patch"[\s\S]*<\/thead>/);
  assert.match(html, /<tfoot>[\s\S]*class="badge"[\s\S]*<\/tfoot>/);
  assert.match(html, /counter\(pages\)/);
});
