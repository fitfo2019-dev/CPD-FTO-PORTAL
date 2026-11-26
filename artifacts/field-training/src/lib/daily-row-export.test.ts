import assert from 'node:assert/strict';
import test from 'node:test';
import * as XLSX from 'xlsx';
import { CATEGORIES, emptyDailyActivitySummary, emptyReportingForDutyRecord, type Report } from './model.js';
import { buildDailyRowWorkbook, dailyRow, dailyRowFilename } from './daily-row-export.js';

const base = (overrides: Partial<Report> = {}): Report => ({
  id: 'TEST-LOG-1', date: '2026-03-04', shift: 'A-Co', phase: 1, zone: '1', precinct: '1', cruiserDistrict: '18', className: 'TEST ONLY 135th Class',
  recruitName: 'TEST ONLY PO Avery', recruitBadge: 'TEST 4747', ftoName: 'TEST ONLY FTO Morgan', ftoBadge: 'TEST-1',
  activity: emptyDailyActivitySummary(), activityCountsIncludeRuns: true, runs: [], reportingForDuty: emptyReportingForDutyRecord(),
  ratings: {} as Report['ratings'], narrative: 'Keep Raw Case', remedial: '', recruitComments: '', status: 'draft', signatures: {},
  createdAt: '2026-03-04T12:00:00.000Z', updatedAt: '2026-03-04T12:00:00.000Z', ...overrides,
});

test('one header row and one data row, one column per category, raw case kept', () => {
  const { header, row } = dailyRow(base({ recruitName: 'mcDonald, Avery' }));
  assert.equal(header.length, row.length);
  for (const category of CATEGORIES) assert.ok(header.length > CATEGORIES.indexOf(category));
  assert.equal(row[header.indexOf('Probationary Officer')], 'mcDonald, Avery');
  assert.equal(row[header.indexOf('Limbo day')], 'No');
});

test('limbo days leave rating cells blank', () => {
  const { header, row } = dailyRow(base({ limboDay: true } as Partial<Report>));
  const firstRating = header.indexOf('Ratings reviewed') + 1;
  assert.ok(row.slice(firstRating, firstRating + CATEGORIES.length).every(cell => cell === ''));
});

test('workbook is a single DAILY sheet and formula text is neutralized', () => {
  const wb = buildDailyRowWorkbook(base({ ftoName: '=cmd|"/c calc"!A1' }));
  assert.deepEqual(wb.SheetNames, ['DAILY']);
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets.DAILY, { header: 1 });
  assert.equal(aoa.length, 2);
  assert.ok(!String(aoa[1][6]).startsWith('='));
});

test('filename uses the PO badge and date with unsafe characters removed', () => {
  assert.equal(dailyRowFilename(base()), 'Daily_Performance_Summary_TEST4747_2026-03-04.xlsx');
});
