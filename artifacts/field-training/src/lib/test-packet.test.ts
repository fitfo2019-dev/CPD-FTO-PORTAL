import assert from 'node:assert/strict';
import test from 'node:test';
import * as XLSX from 'xlsx';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PrintableDailyForms } from '../components/printable-daily-forms.js';
import { PrintableDailyLog } from '../components/printable-daily-log.js';
import { PrintableWeeklyPerformanceLog } from '../components/printable-extended-forms.js';
import { createEmptyWorkspace, createUiPreviewWorkspace } from './empty-workspace.js';
import { buildOperationalPacket, resolveOperationalPacket } from './operational-state-machine.js';
import { dailyLogContinuations, splitNarrativeContinuation } from './narrative-continuation.js';
import { buildClassWorkbook } from './exportWorkbook.js';
import { isValidAssignment } from './cpd-geography.js';
import { scanPII, validateReport } from './model.js';
import { FTO_TEST_PACKET_CLASS, createFtoTestPacketWorkspace } from './test-packet.js';

test('fictional FTO packet is stable, spans every phase, and stays separate from empty and UI-preview workspaces', () => {
  const workspace = createFtoTestPacketWorkspace();
  assert.deepEqual(workspace, createFtoTestPacketWorkspace());
  assert.deepEqual(createEmptyWorkspace().reports, []);
  assert.deepEqual(createEmptyWorkspace().tasks, []);
  assert.deepEqual(createUiPreviewWorkspace().reports, []);
  assert.notEqual(workspace.caseFolder?.className, createUiPreviewWorkspace().caseFolder?.className);
  assert.deepEqual(workspace.phaseFolders.map(folder => folder.phase), [1, 2, 3, 4]);
  assert.deepEqual([...new Set(workspace.reports.map(report => report.phase))], [1, 2, 3, 4]);
  assert.deepEqual([...new Set(workspace.substationOrientations.map(record => record.phase))], [1, 2, 3, 4]);
  assert.ok(workspace.reports.every(report => report.className === FTO_TEST_PACKET_CLASS));
  assert.ok(workspace.tasks.every(task => task.title.includes('FICTIONAL TEST ONLY')));
  assert.ok(workspace.weeklyPerformanceLogs.length > 0);
  assert.equal(workspace.weeklyAcknowledgements.length, 1);
  assert.equal(workspace.weeklyAcknowledgements[0].status, 'draft');
  assert.deepEqual(workspace.weeklyAcknowledgements[0].signatures, {});
  assert.equal(workspace.phaseExtensionRequests.length, 0);
  assert.equal(workspace.ftoPhasePostings.length, 0);
  assert.equal(workspace.coverageRequests.length, 0);
  assert.ok(workspace.reports.every(report =>
    report.status === 'draft' &&
    Object.keys(report.signatures).length === 0 &&
    report.syncStatus === undefined &&
    report.syncAttemptPending === undefined,
  ));
  assert.ok(workspace.reports.every(report => isValidAssignment(report.zone, report.precinct, report.cruiserDistrict, report.shift)));
  assert.ok(workspace.reports.every(report => validateReport(report).length === 0));
  assert.ok(workspace.reports.some(report => report.limboDay && !report.ratingsReviewedAt));
  assert.ok(workspace.reports.some(report => !report.limboDay && report.ratingsReviewedAt));
});

test('fictional daily, run, orientation, and weekly text retains ending markers in print layouts', () => {
  const workspace = createFtoTestPacketWorkspace();
  const longDaily = workspace.reports.find(report => report.id === 'fto-test-report-3-2')!;
  const longRunReport = workspace.reports.find(report => report.id === 'fto-test-report-4-2')!;
  const longRun = longRunReport.runs[0];
  const longOrientation = workspace.substationOrientations.find(record => record.phase === 1)!;
  const longWeekly = workspace.weeklyPerformanceLogs.find(log => log.phase === 3)!;

  assert.match(longDaily.narrative, /FICTIONAL DAILY NARRATIVE END MARKER/);
  assert.match(longDaily.remedial, /FICTIONAL REMEDIAL TEXT END MARKER/);
  assert.match(longRun.narrative, /FICTIONAL RUN NARRATIVE END MARKER/);
  assert.match(longOrientation.narrative, /FICTIONAL ORIENTATION END MARKER/);
  assert.match(longWeekly.entries[0].narrative, /FICTIONAL WEEKLY LOG END MARKER/);
  assert.ok(longDaily.narrative.includes('\n\n'));
  assert.ok(longDaily.narrative.length > 30_000);
  assert.ok(scanPII([
    ...workspace.reports.flatMap(report => [report.narrative, report.remedial, report.recruitComments, ...report.runs.map(run => run.narrative)]),
    ...workspace.substationOrientations.map(record => record.narrative),
    ...workspace.weeklyPerformanceLogs.flatMap(log => log.entries.map(entry => entry.narrative)),
  ].join('\n')).length === 0);

  const dailyContinuations = dailyLogContinuations(longDaily);
  assert.ok(dailyContinuations.length > 1);
  assert.ok(dailyContinuations.some(part => part.text.includes('FICTIONAL DAILY NARRATIVE END MARKER')));
  const runContinuations = splitNarrativeContinuation(longRun.narrative);
  assert.ok(runContinuations.length > 1);
  assert.equal(runContinuations.join(''), longRun.narrative);

  const packet = resolveOperationalPacket(longRunReport, workspace.phaseFolders, workspace.substationOrientations);
  const dailyFormMarkup = renderToStaticMarkup(createElement(PrintableDailyForms, {
    report: longRunReport,
    packet,
    dayReference: packet.dayReference,
  }));
  const dailyLogMarkup = renderToStaticMarkup(createElement(PrintableDailyLog, {
    report: longDaily,
    dayReference: resolveOperationalPacket(longDaily, workspace.phaseFolders, workspace.substationOrientations).dayReference,
  }));
  const weeklyMarkup = renderToStaticMarkup(createElement(PrintableWeeklyPerformanceLog, { log: longWeekly, preview: true }));
  assert.match(dailyFormMarkup, /FICTIONAL RUN NARRATIVE END MARKER/);
  assert.match(dailyLogMarkup, /FICTIONAL DAILY NARRATIVE END MARKER/);
  assert.match(weeklyMarkup, /FICTIONAL WEEKLY LOG END MARKER/);
  assert.ok((dailyFormMarkup.match(/print-narrative-continuation/g) ?? []).length > 1);
  assert.ok((weeklyMarkup.match(/print-weekly-log-page-/g) ?? []).length > 1);
  assert.ok(buildOperationalPacket(longRunReport, { dayReference: packet.dayReference }).pages.length > 1);
});

test('class workbook splits oversized daily, run, weekly, and orientation text without losing ending markers', () => {
  const workspace = createFtoTestPacketWorkspace();
  const workbook = buildClassWorkbook(
    workspace.reports,
    workspace.weeklyAcknowledgements,
    workspace.weeklyPerformanceLogs,
    workspace.substationOrientations,
    workspace.phaseFolders,
  );
  const narratives = XLSX.utils.sheet_to_json<(string | number)[]>(workbook.Sheets['Daily Narratives'], { header: 1 });
  const narrativeHeaders = narratives[0].map(String);
  const narrativeTextIndex = narrativeHeaders.indexOf('Daily narrative');
  const narrativeDateIndex = narrativeHeaders.indexOf('Date');
  const narrativeParts = narratives.slice(1)
    .filter(row => row[narrativeDateIndex] === '03/13/2025')
    .map(row => String(row[narrativeTextIndex] ?? ''));
  assert.ok(narrativeParts.length > 1);
  assert.match(narrativeParts.join(''), /FICTIONAL DAILY NARRATIVE END MARKER/);
  assert.ok(narrativeParts.every(part => part.length <= 30_000));

  const runRows = XLSX.utils.sheet_to_json<(string | number)[]>(workbook.Sheets['Run Forms'], { header: 1 });
  const runHeaders = runRows[0].map(String);
  const runTextIndex = runHeaders.indexOf('Run narrative');
  const runDateIndex = runHeaders.indexOf('Date');
  const runParts = runRows.slice(1)
    .filter(row => row[runDateIndex] === '04/14/2025')
    .map(row => String(row[runTextIndex] ?? ''));
  assert.ok(runParts.length > 1);
  assert.match(runParts.join(''), /FICTIONAL RUN NARRATIVE END MARKER/);
  assert.ok(runParts.every(part => part.length <= 30_000));

  const weeklyRows = XLSX.utils.sheet_to_json<(string | number)[]>(workbook.Sheets['Weekly Log Supplement'], { header: 1 });
  const weeklyHeaders = weeklyRows[0].map(String);
  const weeklyTextIndex = weeklyHeaders.indexOf('Narrative');
  const weeklyTypeIndex = weeklyHeaders.indexOf('Entry type');
  const weeklyParts = weeklyRows.slice(1)
    .filter(row => row[weeklyTypeIndex] === 'Strength')
    .map(row => String(row[weeklyTextIndex] ?? ''));
  assert.ok(weeklyParts.some(part => part.includes('FICTIONAL WEEKLY LOG END MARKER')));
  assert.ok(weeklyParts.every(part => part.length <= 30_000));

  const orientationRows = XLSX.utils.sheet_to_json<(string | number)[]>(workbook.Sheets['Substation Orientation'], { header: 1 });
  const orientationHeaders = orientationRows[0].map(String);
  const orientationTextIndex = orientationHeaders.indexOf('Text');
  const orientationParts = orientationRows.slice(1)
    .filter(row => row[orientationHeaders.indexOf('Text type')] === 'Narrative / continuation')
    .map(row => String(row[orientationTextIndex] ?? ''));
  assert.ok(orientationParts.join('').includes('FICTIONAL ORIENTATION END MARKER'));
  assert.ok(orientationParts.every(part => part.length <= 30_000));
});
