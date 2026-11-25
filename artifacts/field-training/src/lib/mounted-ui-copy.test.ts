import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { auditCopyGraph, formatCopyFindings } from '../../test-support/ui-copy-audit.js';

const root = new URL('../../', import.meta.url);
const read = (file: string) => {
  const url = new URL(file, root);
  return existsSync(url) ? readFileSync(url, 'utf8') : undefined;
};

test('mounted portal import graph contains no known development or task-summary copy', () => {
  const { modules, findings } = auditCopyGraph('src/App.tsx', read);
  // Detect accidental narrowing of the graph as well as forbidden wording.
  for (const file of readdirSync(new URL('src/pages/', root))) {
    if (file.endsWith('.tsx') && !/\.(?:test|spec|stories)\.tsx$/.test(file)) {
      assert.ok(modules.has(`src/pages/${file}`), `Page missing from mounted copy coverage: ${file}`);
    }
  }
  for (const file of [
    'src/components/shell.tsx',
    'src/components/new-run-dialog.tsx',
    'src/components/traffic-stop-risk-choice.tsx',
    'src/components/packet-review/submit-control.tsx',
    'src/state/workspace.tsx',
  ]) assert.ok(modules.has(file), `Conditional panel/provider missing from copy coverage: ${file}`);
  assert.equal(findings.length, 0, `Correct operator copy intentionally; do not remove valid help or warnings:\n${formatCopyFindings(findings)}`);
});

function fixture(files: Record<string, string>) {
  return auditCopyGraph('src/App.tsx', file => files[file]);
}

test('conditional panels, lazy imports, aliases, re-exports and imported copy are audited', () => {
  const result = fixture({
    'src/App.tsx': `import Panel from '@/pages/panel.js'; import type { Notes } from './types.js';
      const Lazy = () => import('./pages/lazy.js'); export default () => open && <Panel/>;`,
    'src/pages/panel.tsx': `export { default } from '../components/dialog.js';`,
    'src/components/dialog.tsx': `import { label } from '../lib/labels.js';
      export default () => open ? <p>{label}</p> : null;`,
    'src/lib/labels.ts': `export const label = 'Developer note: wired up';`,
    'src/pages/lazy.tsx': `export default () => <p>This change adds the new controls.</p>;`,
    'src/types.ts': `export const ignored = 'Developer note: types only';`,
  });
  assert.ok(result.findings.some(item => item.file === 'src/lib/labels.ts' && item.text === 'Developer note: wired up'));
  assert.ok(result.findings.some(item => item.file === 'src/pages/lazy.tsx'));
  assert.equal(result.modules.has('src/types.ts'), false);
  const message = formatCopyFindings(result.findings);
  assert.match(message, /src\/lib\/labels.ts:1/);
  assert.match(message, /Screen\/import path: src\/App.tsx → src\/pages\/panel.tsx → src\/components\/dialog.tsx → src\/lib\/labels.ts/);
  assert.match(message, /Text: "Developer note: wired up"/);
});

test('known removed phrases are caught in visible text, labels, tooltips and expressions', () => {
  for (const copy of [
    'The FTO chooses', 'supplementform',
    'The form suggestion is based only', '10-6 does not determine high risk',
    'runTypeCodeHelp', '1V uses the explicitly selected Traffic Citations metric',
    'Implementation notes', 'Task-summary commentary', 'This update preserves the controls.',
  ]) {
    for (const markup of [
      `<p>${copy}</p>`, `<input aria-label="${copy}" />`,
      `<Panel description="${copy}" />`, `<p>{${JSON.stringify(copy)}}</p>`,
      `<p>{\`${copy}\`}</p>`,
    ]) {
      assert.ok(fixture({ 'src/App.tsx': `export default () => ${markup};` }).findings.length > 0, markup);
    }
  }
  assert.ok(fixture({ 'src/App.tsx': `export default () => <p>Developer {'note:'} hidden panel</p>;` }).findings.length > 0);
  assert.ok(fixture({ 'src/App.tsx': `export default () => <p>Developer <strong>note:</strong> hidden panel</p>;` }).findings.length > 0);
  assert.ok(fixture({ 'src/App.tsx': `const text = 'This change ' + 'adds a panel';` }).findings.length > 0);
});

test('operator instructions, confirmations, official terms and truthful status warnings are allowed', () => {
  const copy = [
    'Review training implementation with the recruit.',
    'FINALIZE AND SUBMIT TO COORDINATOR', 'CONFIRM SUBMISSION',
    'Change and reset primary sheet', 'This code is ambiguous.',
    'Use 24-hour time, for example 08:30 or 17:30.',
    'Required by the FTO manual. Enter the assigned cruiser.',
    'The local queue is encrypted on this device and is not uploaded.',
    'Account invitation and verification are not available here yet.',
    'Dispatch lookup is unavailable. Enter the run details manually.',
    "If the packet doesn't load, keep the original file and retry.",
    'FICTIONAL FTO TEST PACKET · TEST ONLY',
    'No signatures, official approvals, release, or agency sync.',
    'Unsaved form edits may have been lost; unlock to recover the last successful encrypted save.',
  ];
  assert.deepEqual(fixture({
    'src/App.tsx': `export default () => <main>${copy.map(text => `<p>${text}</p>`).join('')}</main>;`,
  }).findings, []);
});

test('comments, metadata, tests, stories, documentation and unmounted source do not become UI findings', () => {
  const result = fixture({
    'src/App.tsx': `// Developer note: this change adds a panel
      import './panel.test.js'; import './docs/notes.js'; import './panel.stories.js';
      /* Implementation notes: The FTO chooses */
      export default () => <p data-testid="Developer note" className="supplementform">Confirm submission</p>;`,
    'src/panel.test.ts': `const example = 'Developer note';`,
    'src/docs/notes.ts': `export const documentation = 'Implementation notes';`,
    'src/panel.stories.tsx': `export default () => <p>Developer note</p>;`,
    'src/pages/unmounted.tsx': `export default () => <p>Developer note</p>;`,
  });
  assert.deepEqual(result.findings, []);
  assert.deepEqual([...result.modules.keys()], ['src/App.tsx']);
});

test('unresolved local imports fail explicitly instead of silently losing panel coverage', () => {
  assert.throws(() => fixture({ 'src/App.tsx': `import './missing-panel.js';` }), /unresolved local runtime import/);
  assert.throws(() => fixture({ 'src/App.tsx': `const panel = import(panelName);` }), /explicit import target/);
});
