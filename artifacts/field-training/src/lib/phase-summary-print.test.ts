import assert from 'node:assert/strict';
import test from 'node:test';
import XLSX from 'xlsx-js-style';
import { phaseSummaryHtml } from './phase-summary-print.js';

const branding = { wordmarkSvg: '<svg data-mark="wordmark"></svg>', patchUrl: '/branding/patch.png', badgeUrl: '/branding/badge.png' };

function workbook() {
  const book = XLSX.utils.book_new();
  for (const name of ['Week 1', 'Week 2 (Extension Week)']) {
    const sheet = XLSX.utils.aoa_to_sheet([["'=Example", '<b>Name</b>'], ['Traffic Stops', 3]]);
    sheet['!merges'] = [{ s: { r: 1, c: 0 }, e: { r: 1, c: 0 } }];
    sheet['!cols'] = [{ wch: 27 }, { wch: 6 }];
    XLSX.utils.book_append_sheet(book, sheet, name);
  }
  return book;
}

test('phase summary print has one landscape US Letter page per weekly tab with the form marks', () => {
  const html = phaseSummaryHtml(workbook(), 'Phase II Performance Summary', branding);
  assert.equal(html.match(/<section class="page"/g)?.length, 2);
  assert.match(html, /@page \{ size: letter landscape; margin: 0\.5in; \}/);
  assert.match(html, /data-tab="Week 2 \(Extension Week\)"/);
  assert.match(html, /data-mark="wordmark"/);
  assert.match(html, /class="patch" src="\/branding\/patch\.png"/);
  assert.match(html, /class="badge" src="\/branding\/badge\.png"/);
  assert.match(html, /Template revised 11\/28\/2026/);
});

test('phase summary print shows text as entered and escapes markup', () => {
  const html = phaseSummaryHtml(workbook(), 'Phase II', branding);
  assert.match(html, />=Example</);
  assert.equal(html.includes('<b>Name</b>'), false);
  assert.match(html, /&lt;b&gt;Name&lt;\/b&gt;/);
});
