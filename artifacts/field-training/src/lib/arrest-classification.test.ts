import assert from 'node:assert/strict';
import test from 'node:test';
import XLSX from 'xlsx-js-style';
import { seedReports } from './seed.js';
import { newRunChecklist, type Report, type TrainingRun } from './model.js';
import {
  ARREST_SEVERITIES,
  ARREST_TYPES,
  expandArrestClassificationShortcut,
} from './arrest-classification.js';
import {
  activityTotals,
  buildClearanceDocuments,
  clearanceDerivedActivityCounts,
  runActivityValidationError,
} from './run-activity.js';
import { validateReport } from './model.js';
import { validateReportsForExport } from './export-validation.js';
import { buildClassWorkbook } from './exportWorkbook.js';
import { buildPhaseWorkbook } from './monthly-export.js';

function reviewedArrest(
  id: string,
  severity: TrainingRun['arrestSeverity'] = 'Felony',
  type: TrainingRun['arrestType'] = 'On-view',
): TrainingRun {
  return {
    id,
    occurredAt: '2026-11-09T18:30:00.000Z',
    runKind: 'call_for_service',
    isDispatched: true,
    trafficMode: 'none',
    clearanceRulesVersion: 1,
    arrestClassificationVersion: 1,
    arrestSeverity: severity,
    arrestType: type,
    clearanceCode: '3V',
    arrestMade: true,
    transportedAfterArrest: true,
    transportDestination: 'Fictional County Jail',
    transportDestinationType: 'Jail',
    oviProcessed: false,
    narrativeAdditionRequired: false,
    formStatus: 'complete',
    checklist: newRunChecklist('call_for_service'),
    checklistReviewedAt: '2026-11-09T20:00:00.000Z',
    narrative: 'Fictional reviewed arrest record.',
  };
}

function reportWithRun(run: TrainingRun): Report {
  const report = seedReports()[0];
  return {
    ...report,
    id: 'fictional-arrest-report',
    date: '2026-11-09',
    activity: { ...report.activity },
    runs: [run],
  };
}

test('classification shortcuts expand case-insensitively without selecting a default', () => {
  assert.deepEqual(ARREST_SEVERITIES, ['Felony', 'Misdemeanor']);
  assert.deepEqual(ARREST_TYPES, ['Warrant', 'On-view']);
  assert.equal(expandArrestClassificationShortcut('severity', 'F'), 'Felony');
  assert.equal(expandArrestClassificationShortcut('severity', 'm'), 'Misdemeanor');
  assert.equal(expandArrestClassificationShortcut('severity', 'MISDEMEANOR'), 'Misdemeanor');
  assert.equal(expandArrestClassificationShortcut('type', 'W'), 'Warrant');
  assert.equal(expandArrestClassificationShortcut('type', 'o'), 'On-view');
  assert.equal(expandArrestClassificationShortcut('type', 'ON VIEW'), 'On-view');
  assert.equal(expandArrestClassificationShortcut('severity', ''), '');
  assert.equal(expandArrestClassificationShortcut('type', 'x'), 'x');
  assert.equal(expandArrestClassificationShortcut('severity', 'M'), 'Misdemeanor');
  assert.equal(expandArrestClassificationShortcut('severity', ''), '');
  assert.equal(expandArrestClassificationShortcut('type', 'O'), 'On-view');
  assert.equal(expandArrestClassificationShortcut('type', ''), '');
});

test('all explicit severity and arrest-type combinations count one reviewed event', () => {
  for (const severity of ARREST_SEVERITIES) {
    for (const type of ARREST_TYPES) {
      const run = reviewedArrest(`run-${severity}-${type}`, severity, type);
      const repeatedRun = { ...run };
      const counts = clearanceDerivedActivityCounts([run, repeatedRun]);
      assert.equal(counts.u10100Reports, 1);
      assert.equal(counts.prisonersSlated, 1);
      assert.equal(counts.premierOneReports, 1);
      assert.equal(counts.felonyArrests, severity === 'Felony' ? 1 : 0);
      assert.equal(counts.misdemeanorArrests, severity === 'Misdemeanor' ? 1 : 0);
      assert.equal(counts.attemptedWarrantsServed, type === 'Warrant' ? 1 : 0);
      assert.equal(counts.pcAffidavits, type === 'On-view' ? 1 : 0);
      assert.equal(counts.criminalComplaints, 0);

      const documents = buildClearanceDocuments({
        ...run,
        charges: [{ id: 'legacy-charge', description: 'Fictional historical charge text' }],
      });
      assert.deepEqual(documents.map(document => document.kind), type === 'Warrant'
        ? ['U-10.100']
        : ['U-10.100', 'Probable Cause Affidavit']);
      assert.equal(new Set(documents.map(document => document.id)).size, documents.length);
      assert.deepEqual(buildClearanceDocuments(run), buildClearanceDocuments(run));
    }
  }
});

test('new 3V review rejects missing or invalid classifications while legacy records remain exportable', () => {
  const run = reviewedArrest('validation-run');
  assert.equal(runActivityValidationError({ ...run, arrestSeverity: '' })?.includes('severity'), true);
  assert.equal(runActivityValidationError({ ...run, arrestType: 'Other' })?.includes('type'), true);
  assert.equal(runActivityValidationError(run), undefined);

  const missingSeverity = { ...run, arrestSeverity: undefined };
  const newReport = reportWithRun(missingSeverity);
  assert.ok(validateReport(newReport).some(message => message.includes('Felony or Misdemeanor')));
  assert.throws(() => validateReportsForExport([newReport]));
  assert.throws(() => validateReportsForExport([{
    ...reportWithRun(run),
    runs: [{ ...run, arrestType: 'Unknown' }],
  }]));
  assert.doesNotThrow(() => validateReportsForExport([reportWithRun({
    ...run,
    arrestClassificationVersion: undefined,
    arrestSeverity: undefined,
    arrestType: undefined,
    charges: [{ id: 'legacy-charge', description: 'Fictional saved charge detail' }],
  })]));
});

test('legacy charge and document details are preserved without inferred arrest totals', () => {
  const legacyDocs: NonNullable<TrainingRun['generatedDocuments']> = [
    { id: 'legacy:complaint:charge-1', kind: 'Criminal Complaint Form', chargeId: 'charge-1', description: 'Saved historical detail' },
  ];
  const legacy = {
    ...reviewedArrest('legacy-run'),
    arrestClassificationVersion: undefined,
    arrestSeverity: undefined,
    arrestType: undefined,
    charges: [{ id: 'charge-1', description: 'Saved historical charge text' }],
    generatedDocuments: legacyDocs,
  };
  const counts = clearanceDerivedActivityCounts([legacy]);
  assert.equal(counts.felonyArrests, 0);
  assert.equal(counts.misdemeanorArrests, 0);
  assert.equal(counts.attemptedWarrantsServed, 0);
  assert.equal(counts.pcAffidavits, 1);
  assert.deepEqual(buildClearanceDocuments(legacy), legacyDocs);
  assert.equal(legacy.charges[0].description, 'Saved historical charge text');

  const explicitlyReviewedLegacy = {
    ...legacy,
    clearanceRulesVersion: undefined,
    arrestClassificationVersion: 1 as const,
    arrestSeverity: 'Misdemeanor' as const,
    arrestType: 'Warrant' as const,
  };
  const reviewedCounts = clearanceDerivedActivityCounts([explicitlyReviewedLegacy]);
  assert.equal(reviewedCounts.misdemeanorArrests, 1);
  assert.equal(reviewedCounts.attemptedWarrantsServed, 1);
  assert.equal(reviewedCounts.u10100Reports, 0);
  assert.equal(reviewedCounts.prisonersSlated, 0);
  assert.equal(reviewedCounts.pcAffidavits, 0);
  assert.deepEqual(buildClearanceDocuments(explicitlyReviewedLegacy).map(document=>document.kind),['U-10.100']);
});

test('daily, weekly, phase, and monthly workbook totals use the same one-arrest count', () => {
  const run = reviewedArrest('workbook-arrest', 'Misdemeanor', 'Warrant');
  const report = reportWithRun(run);
  const classWorkbook = buildClassWorkbook([report]);
  const dailyRows = XLSX.utils.sheet_to_json(classWorkbook.Sheets['Daily Activity'], { header: 1 }) as unknown[][];
  const dailyRow = dailyRows.find(row => row[6] === 'Misdemeanor Arrests');
  assert.equal(dailyRow?.[7], 1);
  const weeklyRows = XLSX.utils.sheet_to_json(classWorkbook.Sheets['Weekly Totals'], { header: 1 }) as unknown[][];
  const weeklyHeader = weeklyRows[0] as string[];
  const weeklyValues = weeklyRows[1] as unknown[];
  assert.equal(weeklyValues[weeklyHeader.indexOf('Misdemeanor Arrests')], 1);
  assert.equal(weeklyValues[weeklyHeader.indexOf('Attempted / Warrants Served')], 1);
  const phaseRows = XLSX.utils.sheet_to_json(classWorkbook.Sheets['Phase Totals'], { header: 1 }) as unknown[][];
  const phaseHeader = phaseRows[0] as string[];
  const phaseValues = phaseRows[1] as unknown[];
  assert.equal(phaseValues[phaseHeader.indexOf('Misdemeanor Arrests')], 1);
  assert.equal(phaseValues[phaseHeader.indexOf('Attempted / Warrants Served')], 1);

  const fourWeeks = [
    { startDate: '2026-11-01', endDate: '2026-11-07' },
    { startDate: '2026-11-08', endDate: '2026-11-14' },
    { startDate: '2026-11-15', endDate: '2026-11-21' },
    { startDate: '2026-11-22', endDate: '2026-11-28' },
  ];
  const monthlyWorkbook = buildPhaseWorkbook([report], report.phase, { phaseStartDate: '2026-11-01', phaseWeekRanges: fourWeeks });
  const monthRows = XLSX.utils.sheet_to_json(monthlyWorkbook.Sheets['Week 2'], { header: 1 }) as unknown[][];
  const monthActivity = monthRows.find(row => row.includes('Misdemeanor Arrests'));
  assert.ok(monthActivity);
  const monthIndex = monthActivity.indexOf('Misdemeanor Arrests');
  assert.equal(monthActivity[monthIndex + 5], 1);
  assert.equal(activityTotals(report).misdemeanorArrests, 1);
});
