import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const fieldTrainingRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const workspaceRoot = resolve(fieldTrainingRoot, '../..');

test('print page sizes and margins remain explicit for browser/PDF exports', async () => {
  const css = await readFile(resolve(fieldTrainingRoot, 'src/index.css'), 'utf8');
  assert.match(css, /@page\s*\{\s*size:\s*letter portrait;\s*margin:\s*0\.3in;\s*\}/);
  assert.match(css, /@page fieldready-weekly-log\s*\{\s*size:\s*letter portrait;\s*margin:\s*0\.3in;\s*\}/);
  assert.match(css, /\.print-weekly-log-page:last-child\s*\{\s*break-after:\s*auto;\s*page-break-after:\s*auto;\s*\}/);
});

test('form export guidance distinguishes reconstructed layouts from source PDFs', async () => {
  const guidance = await readFile(resolve(workspaceRoot, 'docs/FTO-FORM-EXPORT-COVERAGE.md'), 'utf8');
  assert.match(guidance, /They are reconstructed layouts, not filled copies of the original forms/);
  assert.match(guidance, /must still be checked against each target printer/);
  assert.match(guidance, /unselected checkboxes, long narratives, margins and page\s+numbering have been checked/);
});
