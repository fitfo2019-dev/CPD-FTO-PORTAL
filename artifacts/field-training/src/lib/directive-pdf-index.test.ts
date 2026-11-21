import assert from 'node:assert/strict';
import test from 'node:test';
import { DIVISION_DIRECTIVES } from './division-directives.js';
import { DIRECTIVE_PDF_LINKS, DIRECTIVE_PDF_INDEX_SOURCE } from './directive-pdf-index.js';

test('official directive PDF links map to the portal directive index', () => {
  const directiveNumbers = new Set(DIVISION_DIRECTIVES.map((item) => item.number));
  const linkedNumbers = new Set<string>();

  assert.ok(DIRECTIVE_PDF_LINKS.length > 0);
  assert.match(DIRECTIVE_PDF_INDEX_SOURCE, /^https:\/\/www\.columbus\.gov\//);
  assert.equal(DIVISION_DIRECTIVES.length, DIRECTIVE_PDF_LINKS.length);

  for (const item of DIRECTIVE_PDF_LINKS) {
    assert.ok(!linkedNumbers.has(item.number), `Duplicate PDF mapping for ${item.number}`);
    assert.ok(directiveNumbers.has(item.number), `No index title for ${item.number}`);
    assert.match(item.url, /^https:\/\/www\.columbus\.gov\/files\/sharedassets\/.+\.pdf$/);
    assert.ok(item.title.trim(), `Missing official title for ${item.number}`);
    assert.equal(DIVISION_DIRECTIVES.find((directive) => directive.number === item.number)?.title, item.title);
    linkedNumbers.add(item.number);
  }
});
