import XLSX from 'xlsx-js-style';
import {
  DAILY_ACTIVITY_FIELDS,
  PHASE_LENGTH_WEEKS,
  PHASE_PROGRAM_WEEK_START,
  RATINGS,
  SEG_CATEGORIES,
  SEG_RATING_COLUMNS,
  SEG_RATING_GROUP_LABELS,
  PRIMARY_RUN_FORMS,
  RUN_CHECKLIST_SECTIONS,
  RUN_SUPPLEMENT_CHECKLIST_SECTIONS,
  SUPPLEMENTAL_RUN_FORMS,
  requiredSupplementalForms,
  type Phase,
  type Report,
} from './model.js';
import { filterReportsForMonth, summarizeMonthlyRunRecords } from './monthly-summary.js';
import { validateReportsForExport } from './export-validation.js';

const ratingStyle = {
  NO: { fill: { patternType: 'solid', fgColor: { rgb: 'FFE5E7EB' } }, font: { bold: true, color: { rgb: 'FF374151' } } },
  A: { fill: { patternType: 'solid', fgColor: { rgb: 'FFDCFCE7' } }, font: { bold: true, color: { rgb: 'FF166534' } } },
  RT: { fill: { patternType: 'solid', fgColor: { rgb: 'FFFEF3C7' } }, font: { bold: true, color: { rgb: 'FF92400E' } } },
  UA: { fill: { patternType: 'solid', fgColor: { rgb: 'FFFEE2E2' } }, font: { bold: true, color: { rgb: 'FF991B1B' } } },
  NRT: { fill: { patternType: 'solid', fgColor: { rgb: 'FFFEE2E2' } }, font: { bold: true, color: { rgb: 'FF991B1B' } } },
} as const;

const headingStyle = {
  fill: { patternType: 'solid', fgColor: { rgb: 'FFDCE5EF' } },
  font: { bold: true, color: { rgb: 'FF172B45' } },
};
const tableHeaderStyle = {
  fill: { patternType: 'solid', fgColor: { rgb: 'FFF1F4F7' } },
  font: { bold: true, color: { rgb: 'FF172B45' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: {
    top: { style: 'thin', color: { rgb: 'FF555555' } },
    bottom: { style: 'thin', color: { rgb: 'FF555555' } },
    left: { style: 'thin', color: { rgb: 'FF555555' } },
    right: { style: 'thin', color: { rgb: 'FF555555' } },
  },
};
const gridBorder = {
  top: { style: 'thin', color: { rgb: 'FF555555' } },
  bottom: { style: 'thin', color: { rgb: 'FF555555' } },
  left: { style: 'thin', color: { rgb: 'FF555555' } },
  right: { style: 'thin', color: { rgb: 'FF555555' } },
};
const ratingAlignment = { horizontal: 'center', vertical: 'center' };

const safeText = (value: unknown) => {
  const text = String(value ?? '');
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
};

function formatMonth(monthKey: string) {
  const date = new Date(`${monthKey}-15T12:00:00`);
  return Number.isNaN(date.getTime())
    ? monthKey
    : new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

function programWeek(report: Report): number | undefined {
  if (Number.isInteger(report.ftoWeek) && report.ftoWeek! >= 1 && report.ftoWeek! <= 15) return report.ftoWeek;
  if (!Number.isInteger(report.phaseWeek) || report.phaseWeek! < 1) return undefined;
  return PHASE_PROGRAM_WEEK_START[report.phase] + report.phaseWeek! - 1;
}

function phaseProgramWeeks(reports: Report[]): number[] {
  const phases = [...new Set(reports.map(report => report.phase))];
  const scheduledWeeks = phases.flatMap(phase => Array.from(
    { length: PHASE_LENGTH_WEEKS[phase as Phase] },
    (_, index) => PHASE_PROGRAM_WEEK_START[phase as Phase] + index,
  ));
  const recordedWeeks = reports.map(programWeek).filter((week): week is number => typeof week === 'number' && Number.isInteger(week) && week >= 1 && week <= 15);
  return [...new Set([...scheduledWeeks, ...recordedWeeks])].sort((a, b) => a - b);
}

function reviewedRatingCount(reports: Report[], category: typeof SEG_CATEGORIES[number]['key'], rating: typeof RATINGS[number]): number | '' {
  const reviewed = reports.filter(report => !!report.ratingsReviewedAt && !report.limboDay);
  if (!reviewed.length) return '';
  return reviewed.reduce((total, report) => total + (report.ratings[category]?.rating === rating ? 1 : 0), 0);
}

function manualActivityTotal(reports: Report[], key: typeof DAILY_ACTIVITY_FIELDS[number]['key']): number | '' {
  const values = reports
    .map(report => report.activity?.[key])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return values.length ? values.reduce((total, value) => total + value, 0) : '';
}

export function buildMonthlyWorkbook(reports: Report[], monthKey: string) {
  const validatedReports = validateReportsForExport(reports);
  const sorted = filterReportsForMonth(validatedReports, monthKey);
  if (!sorted.length) throw new Error('There are no saved daily logs in this month to export.');
  const first = sorted[0];
  const weeks = phaseProgramWeeks(sorted);
  const weekLabels = weeks.map(week => `WEEK ${week}`);
  const weekReports = new Map(weeks.map(week => [
    week,
    sorted.filter(report => programWeek(report) === week),
  ]));
  const reviewedReports = sorted.filter(report => !!report.ratingsReviewedAt && !report.limboDay);
  const phases = [...new Set(sorted.map(report => `Phase ${report.phase}`))].join(', ');
  const rows: (string | number)[][] = [
    [`MONTHLY STATISTICS · ${formatMonth(monthKey).toLocaleUpperCase('en-US')}`],
    ['Probationary Officer', safeText(first.recruitName), 'Badge', safeText(first.recruitBadge), 'Class', safeText(first.className || 'Unassigned class')],
    ['Phase(s)', phases, 'Daily logs', sorted.length],
    ['Reviewed daily ratings', reviewedReports.length],
    ['Source', 'Saved daily statistics only · no statistics are inferred from run forms'],
    [],
  ];

  const ratingTitleRow = rows.length;
  rows.push(['SEG RATING COUNTS · REVIEWED DAILY LOGS ONLY']);
  const ratingHeaderRow = rows.length;
  rows.push([
    'PERFORMANCE CATEGORY',
    ...weekLabels.flatMap(label => [label, '', '', '', '']),
    'MONTHLY TOTAL', '', '', '', '',
  ]);
  const ratingSubHeaderRow = rows.length;
  rows.push(['', ...weeks.flatMap(() => RATINGS), ...RATINGS]);
  const ratingRows: { row: number; category: typeof SEG_CATEGORIES[number]['key'] }[] = [];
  const ratingGroupRows: number[] = [];
  for (const group of SEG_RATING_COLUMNS.flatMap(column => column)) {
    ratingGroupRows.push(rows.length);
    rows.push([safeText(SEG_RATING_GROUP_LABELS[group] ?? group).toLocaleUpperCase('en-US')]);
    for (const category of SEG_CATEGORIES.filter(item => item.group === group)) {
      ratingRows.push({ row: rows.length, category: category.key });
      rows.push([
        safeText(category.label),
        ...weeks.flatMap(week => RATINGS.map(rating => reviewedRatingCount(weekReports.get(week) ?? [], category.key, rating))),
        ...RATINGS.map(rating => reviewedRatingCount(sorted, category.key, rating)),
      ]);
    }
  }

  rows.push([]);
  const activityTitleRow = rows.length;
  rows.push(['DAILY ACTIVITY STATISTICS · SAVED DAILY VALUES']);
  const activityHeaderRow = rows.length;
  rows.push(['ACTIVITY CATEGORY', ...weekLabels, 'MONTHLY TOTAL']);
  const activityRows: number[] = [];
  for (const field of DAILY_ACTIVITY_FIELDS) {
    activityRows.push(rows.length);
    const weeklyValues = weeks.map(week => manualActivityTotal(weekReports.get(week) ?? [], field.key));
    const numericValues = weeklyValues.filter((value): value is number => typeof value === 'number');
    rows.push([
      field.label,
      ...weeklyValues,
      numericValues.length ? numericValues.reduce((total, value) => total + value, 0) : '',
    ]);
  }
  rows.push([]);
  rows.push(['HOW TO READ THIS SHEET', 'Each category appears once. Week columns use program weeks 1–15; monthly totals add the displayed weeks.']);
  rows.push(['DATA STATUS', 'Local workspace export only. This workbook is not server-confirmed or uploaded.']);

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const ratingMonthlyStart = 1 + weeks.length * RATINGS.length;
  const ratingLastColumn = ratingMonthlyStart + RATINGS.length - 1;
  const ratingLastDataRow = ratingRows.at(-1)?.row ?? ratingSubHeaderRow;
  const activityLastColumn = weekLabels.length + 1;
  const sheetColumnEnd = Math.max(ratingLastColumn, activityLastColumn, 5);
  sheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: sheetColumnEnd } },
    { s: { r: 4, c: 1 }, e: { r: 4, c: sheetColumnEnd } },
    { s: { r: ratingTitleRow, c: 0 }, e: { r: ratingTitleRow, c: ratingLastColumn } },
    { s: { r: ratingHeaderRow, c: 0 }, e: { r: ratingSubHeaderRow, c: 0 } },
    { s: { r: activityTitleRow, c: 0 }, e: { r: activityTitleRow, c: activityLastColumn } },
    { s: { r: rows.length - 2, c: 1 }, e: { r: rows.length - 2, c: sheetColumnEnd } },
    { s: { r: rows.length - 1, c: 1 }, e: { r: rows.length - 1, c: sheetColumnEnd } },
    ...ratingGroupRows.map(row => ({ s: { r: row, c: 0 }, e: { r: row, c: ratingLastColumn } })),
    ...weeks.map((_, index) => ({
      s: { r: ratingHeaderRow, c: 1 + index * RATINGS.length },
      e: { r: ratingHeaderRow, c: (index + 1) * RATINGS.length },
    })),
    { s: { r: ratingHeaderRow, c: ratingMonthlyStart }, e: { r: ratingHeaderRow, c: ratingLastColumn } },
  ];
  sheet['!cols'] = [{ wch: 34 }, ...Array.from({ length: sheetColumnEnd }, () => ({ wch: 10 }))];
  sheet['!freeze'] = { xSplit: 1, ySplit: ratingSubHeaderRow + 1, topLeftCell: `B${ratingSubHeaderRow + 2}`, activePane: 'bottomRight', state: 'frozen' };
  sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: ratingSubHeaderRow, c: 0 }, e: { r: ratingLastDataRow, c: ratingLastColumn } }) };

  const styleCell = (row: number, column: number, style: Record<string, unknown>) => {
    const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
    if (cell) cell.s = style;
  };
  styleCell(0, 0, {
    font: { bold: true, sz: 16, color: { rgb: 'FF172B45' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: { bottom: { style: 'medium', color: { rgb: 'FF142D4F' } } },
  });
  for (let column = 0; column <= ratingLastColumn; column++) {
    styleCell(ratingTitleRow, column, headingStyle);
    styleCell(ratingHeaderRow, column, tableHeaderStyle);
    styleCell(ratingSubHeaderRow, column, tableHeaderStyle);
  }
  for (const row of ratingGroupRows) {
    for (let column = 0; column <= ratingLastColumn; column++) {
      styleCell(row, column, {
        fill: { patternType: 'solid', fgColor: { rgb: 'FFDCE5EF' } },
        font: { bold: true, color: { rgb: 'FF172B45' } },
        alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
        border: gridBorder,
      });
    }
  }
  for (let column = 0; column <= activityLastColumn; column++) {
    styleCell(activityTitleRow, column, headingStyle);
    styleCell(activityHeaderRow, column, tableHeaderStyle);
  }
  for (const { row, category } of ratingRows) {
    styleCell(row, 0, {
      font: { bold: true, color: { rgb: 'FF172B45' } },
      alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
      border: gridBorder,
    });
    for (let index = 0; index < weeks.length; index++) {
      const weekData = weekReports.get(weeks[index]) ?? [];
      RATINGS.forEach((rating, ratingIndex) => {
        const value = reviewedRatingCount(weekData, category, rating);
        if (typeof value === 'number') styleCell(row, 1 + index * RATINGS.length + ratingIndex, {
          ...ratingStyle[rating],
          alignment: ratingAlignment,
          border: gridBorder,
          numFmt: '0',
        });
      });
    }
    RATINGS.forEach((rating, ratingIndex) => {
      const value = reviewedRatingCount(sorted, category, rating);
      if (typeof value === 'number') styleCell(row, ratingMonthlyStart + ratingIndex, {
        ...ratingStyle[rating],
        alignment: ratingAlignment,
        border: gridBorder,
        numFmt: '0',
      });
    });
  }
  for (const row of activityRows) {
    styleCell(row, 0, { alignment: { horizontal: 'left', vertical: 'center', wrapText: true }, border: gridBorder });
    for (let column = 1; column <= activityLastColumn; column++) {
      styleCell(row, column, { font: { bold: column === activityLastColumn }, alignment: ratingAlignment, border: gridBorder, numFmt: '0' });
    }
  }
  XLSX.utils.book_append_sheet(workbook, sheet, 'Monthly Totals');

  const runRecords = summarizeMonthlyRunRecords(sorted);
  const runSupportRows: (string | number)[][] = [
    [`Run Support · ${formatMonth(monthKey)}`],
    ['Run records included', runRecords.reviewedRunCount],
    ['Scope', 'Completed run forms with checklist review only · local records'],
    ['Interpretation', 'Run selections are supporting counts, not daily activity totals or SEG ratings. Unchecked items are not classified as deficiencies.'],
    [],
    ['Explicit run activity selections'],
    ['Activity', 'Reviewed run records with selection'],
    ...DAILY_ACTIVITY_FIELDS.map(field => [safeText(field.label), runRecords.activityFlagCounts[field.key]]),
    ['Arrest Made · run metadata', runRecords.arrestMadeRunCount],
    ['Transported after arrest · run metadata', runRecords.transportedAfterArrestRunCount],
    ['OVI processed · run metadata', runRecords.oviProcessedRunCount],
    [],
    ['Run checklist item totals'],
    ['Run form', 'Section', 'Checklist item', 'Reviewed runs', 'Selected', 'Not applicable', 'Not selected / other', 'Source daily log IDs', 'Source run IDs'],
    ...runRecords.checklistItems.map(item => [
      safeText(item.form),
      safeText(item.section),
      safeText(item.item),
      item.runCount,
      item.selectedCount,
      item.notApplicableCount,
      item.otherCount,
      safeText(item.sourceReportIds.join('; ')),
      safeText(item.sourceRunIds.join('; ')),
    ]),
  ];
  const runSupportSheet = XLSX.utils.aoa_to_sheet(runSupportRows);
  runSupportSheet['!cols'] = [
    { wch: 32 }, { wch: 30 }, { wch: 54 }, ...Array.from({ length: 6 }, () => ({ wch: 18 })),
  ];
  const runSupportRange = XLSX.utils.decode_range(runSupportSheet['!ref'] ?? 'A1');
  runSupportSheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: runSupportRange.e.c } },
    { s: { r: 5, c: 0 }, e: { r: 5, c: runSupportRange.e.c } },
    { s: { r: 41, c: 0 }, e: { r: 41, c: runSupportRange.e.c } },
  ];
  for (let row = runSupportRange.s.r; row <= runSupportRange.e.r; row++) {
    for (let column = runSupportRange.s.c; column <= runSupportRange.e.c; column++) {
      const cell = runSupportSheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (!cell) continue;
      const isNumeric = typeof cell.v === 'number' && Number.isFinite(cell.v);
      if ((row === 0 || row === 5 || row === 6 || row === 41 || row === 42) && typeof cell.v === 'string') {
        cell.v = cell.v.toLocaleUpperCase('en-US');
      }
      cell.s = {
        border: gridBorder,
        alignment: { horizontal: isNumeric ? 'center' : 'left', vertical: 'center', wrapText: true },
        ...(isNumeric ? { numFmt: '0' } : {}),
        ...([6, 42].includes(row) ? tableHeaderStyle : {}),
        ...([5, 41].includes(row) ? headingStyle : {}),
        ...(row === 0 ? {
          fill: { patternType: 'solid', fgColor: { rgb: 'FFDCE5EF' } },
          font: { bold: true, sz: 14, color: { rgb: 'FF142D4F' } },
        } : {}),
      };
    }
  }
  XLSX.utils.book_append_sheet(workbook, runSupportSheet, 'Run Support');
  return workbook;
}

export function exportMonthlyWorkbook(reports: Report[], monthKey: string) {
  const workbook = buildMonthlyWorkbook(reports, monthKey);
  const name = `Field_Training_Monthly_Summary_${monthKey.replaceAll('-', '')}.xlsx`;
  XLSX.writeFile(workbook, name);
  return name;
}
