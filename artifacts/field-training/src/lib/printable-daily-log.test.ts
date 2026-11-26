import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PrintableDailyForms } from '../components/printable-daily-forms.js';
import { PrintableDailyLog } from '../components/printable-daily-log.js';
import { seedReports } from './seed.js';
import { dailyLogContinuations } from './narrative-continuation.js';
import { buildOperationalPacket } from './operational-state-machine.js';
import { assertExportCopy } from '../../test-support/export-copy-boundaries.js';

test('long daily notes get one sequential training-folder reference per future sheet',()=>{
  const report={...seedReports()[0],date:'2026-10-26',phase:1 as const,phaseWeek:2,
    narrative:`FTO narrative: ${'a'.repeat(10000)} end 👮🏽‍♀️`,
    remedial:`Corrective training: ${'b'.repeat(7000)} end.`};
  const dayReference={week:2,day:1};
  const packet=buildOperationalPacket(report,{dayReference});
  const continuations=dailyLogContinuations(report);
  const logMarkup=renderToStaticMarkup(createElement(PrintableDailyLog,{report,dayReference,packet}));
  assertExportCopy('Daily Performance Summary print export',logMarkup,[
    'Probationary Officer Daily Performance Summary',
    'For each row, mark one box. Read the rating key below.',
    'Daily Activity Summary',
    'FTO comments / shift narrative',
    'Local draft · Not server-confirmed',
  ]);
  const printedReferences=[...logMarkup.matchAll(/data-training-folder-page="(W\d+D\d+P\d+)"/g)].map(match=>match[1]);
  assert.deepEqual(printedReferences,[
    ...packet.pages.filter(page=>page.kind==='daily_summary'||page.kind==='daily_continuation').map(page=>page.reference),
  ]);
  assert.equal(continuations.length,packet.pages.filter(page=>page.kind==='daily_continuation').length);
  assert.ok(logMarkup.includes(`See narrative continuation ${packet.pages.find(page=>page.kind==='daily_continuation')?.reference}`));
  assert.match(logMarkup,/👮🏽‍♀️/);

  const followOnMarkup=renderToStaticMarkup(createElement(PrintableDailyForms,{report,dayReference,packet}));
  assertExportCopy('Daily supporting forms print export',followOnMarkup,[
    'Reporting for Duty Form',
    'Checklist items start checked. Review each item and clear anything not completed acceptably',
    'Duty checklist review:',
    'Not an identity-verified or electronically signed record.',
  ]);
  assert.match(followOnMarkup,/data-training-folder-page="W2D1P1"/);
  const allReferences=[...`${followOnMarkup}${logMarkup}`.matchAll(/data-training-folder-page="(W\d+D\d+P\d+)"/g)].map(match=>match[1]);
  assert.deepEqual(allReferences,packet.pages.map(page=>page.reference));
});
