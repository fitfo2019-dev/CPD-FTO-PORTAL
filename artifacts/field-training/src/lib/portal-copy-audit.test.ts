import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { APPLICATION_HELP_TOPICS } from './application-help.js';

const source = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');
const shell = source('../components/shell.tsx');
const app = source('../App.tsx');
const helpPage = source('../pages/help.tsx');
const helpDesk = source('../components/application-help-desk.tsx');
const roleAccess = source('../pages/role-access.tsx');
const rosterPanel = source('../components/training-assignments-panel.tsx');
const reportEditor = source('../pages/report-editor.tsx');
const agencyPackets = source('../pages/agency-packets.tsx');
const packetReview = source('../components/agency-packet-review.tsx');
const forum = source('../pages/fto-forum.tsx');
const phaseExtension = source('../components/phase-extension-panel.tsx');
const ftoHelp = source('./fto-help.ts');
const directiveIndex = source('./directive-pdf-index.ts');

test('application-use topics are searchable and include steps, results, and recovery', () => {
  const ids = new Set(APPLICATION_HELP_TOPICS.map(topic => topic.id));
  assert.equal(ids.size, APPLICATION_HELP_TOPICS.length, 'topic ids must be unique');
  for (const topic of APPLICATION_HELP_TOPICS) {
    assert.ok(topic.title.trim());
    assert.ok(topic.keywords.trim());
    assert.ok(topic.steps.length > 0);
    assert.ok(topic.expectedResult.trim());
    assert.ok(topic.recovery.trim());
  }
  const search = (query: string) => APPLICATION_HELP_TOPICS.filter(topic =>
    `${topic.title} ${topic.keywords} ${topic.steps.join(' ')} ${topic.expectedResult} ${topic.recovery}`
      .toLowerCase().includes(query.toLowerCase()),
  );
  assert.ok(search('roster').some(topic => topic.id === 'roster-import'));
  assert.ok(search('XLSX').some(topic => topic.id === 'roster-import'));
  assert.ok(search('pending').some(topic => topic.id === 'record-status'));
  assert.ok(search('acknowledgment').some(topic => topic.id === 'packet-status'));
  assert.ok(search('Coordinator review').some(topic => topic.id === 'phase-request'));
});

test('help keeps application-use guidance separate from sourced policy', () => {
  assert.match(helpPage, /<ApplicationHelpDesk \/>/);
  assert.ok(helpDesk.includes('w-full sm:min-w-[14rem] sm:flex-1 sm:max-w-md'));
  assert.match(helpPage, /Resources \/ Law Library/);
  assert.match(ftoHelp, /Uploaded Final FTO Manual · updated 03\/10\/2026/);
  assert.match(directiveIndex, /https:\/\/www\.columbus\.gov\/Services\/Public-Safety\/Police\/About-the-Columbus-Division-of-Police\/Directives/);
  const applicationHelpCopy = APPLICATION_HELP_TOPICS.map(topic =>
    [topic.title, topic.keywords, ...topic.steps, topic.expectedResult, topic.recovery].join(' '),
  ).join(' ');
  assert.doesNotMatch(applicationHelpCopy, /IT setup|access path|preview selector|selector implementation/i);
});

test('every portal role can find Help Desk on desktop and mobile navigation', () => {
  const roleNavStart = shell.indexOf('const ROLE_NAV');
  const roleNavEnd = shell.indexOf('const navTestId');
  const roleNavSource = shell.slice(roleNavStart, roleNavEnd);
  assert.equal((roleNavSource.match(/\bRESOURCES\b/g) ?? []).length, 6);
  assert.match(shell, /label: 'Help Desk'/);
  assert.match(shell, /visibleNav\.slice\(0, 4\), RESOURCES/);
  assert.equal((app.match(/<Route path="\/resources" component=\{HelpPage\}/g) ?? []).length, 4);
});

test('relevant screens link directly to practical help topics', () => {
  assert.match(shell, /\/resources\?topic=record-status#application-help/);
  assert.match(rosterPanel, /\/resources\?topic=roster-import#application-help/);
  assert.match(reportEditor, /\/resources\?topic=local-save#application-help/);
  assert.match(roleAccess, /\/resources\?topic=account-access#application-help/);
  assert.match(packetReview, /\/resources\?topic=packet-status#application-help/);
  assert.match(forum, /\/resources\?topic=record-status#application-help/);
  assert.match(phaseExtension, /\/resources\?topic=phase-request#application-help/);
});

test('copy cleanup preserves local, unsaved, role, and irreversible-action warnings', () => {
  assert.match(shell, /Local drafts are not submitted/);
  assert.match(shell, /Fictional \$\{w\.previewLabel\}/);
  assert.match(shell, /changes clear on refresh/i);
  assert.match(shell, /Local save failed\.<\/b> Changes on screen are not stored/);
  assert.match(shell, /Locking clears them from this screen and they cannot be recovered/);
  assert.match(shell, /Unsaved report or run edits will be lost if you leave/);
  assert.match(shell, /Restoring saved work will replace unsaved changes/);
  assert.match(reportEditor, /Fictional preview · no operational data/);
  assert.match(roleAccess, /This role cannot access operational training records/);
  assert.match(packetReview, /permanently closed and remains immutable/);
  assert.match(packetReview, /Receipt is not agreement and is not an electronic signature/);
});

test('routine screens do not show removed developer notes or invented office contacts', () => {
  assert.doesNotMatch(app, /Contact FTO Office Admin/);
  assert.match(app, /Account activation is invitation-only/);
  assert.doesNotMatch(roleAccess, /FTO Office Admin|training contact|No deletion tool is connected/);
  assert.doesNotMatch(rosterPanel, /Ask FTO Office Admin/);
  assert.doesNotMatch(agencyPackets, /separate approval preview/);
});
