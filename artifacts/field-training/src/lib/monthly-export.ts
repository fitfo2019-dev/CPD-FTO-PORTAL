import XLSX from 'xlsx-js-style';
import {
  DAILY_ACTIVITY_FIELDS,
  PHASE_LENGTH_WEEKS,
  PHASE_PROGRAM_WEEK_START,
  RATINGS,
  SEG_CATEGORIES,
  type Phase,
  type Report,
} from './model';

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
  alignment: { horizontal: 'center', wrapText: true },
};

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
  if (!reports.length) throw new Error('There are no saved daily logs in this month to export.');
  const sorted = [...reports].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const weeks = phaseProgramWeeks(sorted);
  const weekLabels = weeks.map(week => `Week ${week}`);
  const weekReports = new Map(weeks.map(week => [
    week,
    sorted.filter(report => programWeek(report) === week),
  ]));
  const reviewedReports = sorted.filter(report => !!report.ratingsReviewedAt && !report.limboDay);
  const phases = [...new Set(sorted.map(report => `Phase ${report.phase}`))].join(', ');
  const rows: (string | number)[][] = [
    [`Monthly Statistics · ${formatMonth(monthKey)}`],
    ['Probationary Officer', safeText(first.recruitName), 'Badge', safeText(first.recruitBadge), 'Class', safeText(first.className || 'Unassigned class')],
    ['Phase(s)', phases, 'Daily logs', sorted.length],
    ['Reviewed daily ratings', reviewedReports.length],
    ['Source', 'Saved daily statistics only · no statistics are inferred from run forms'],
    [],
  ];

  const ratingTitleRow = rows.length;
  rows.push(['SEG Rating Counts · Reviewed Daily Logs Only']);
  const ratingHeaderRow = rows.length;
  rows.push([
    'Performance category',
    ...weekLabels.flatMap(label => [label, '', '', '', '']),
    'Monthly total', '', '', '', '',
  ]);
  const ratingSubHeaderRow = rows.length;
  rows.push(['', ...weeks.flatMap(() => RATINGS), ...RATINGS]);
  const ratingRows: { row: number; category: typeof SEG_CATEGORIES[number]['key'] }[] = [];
  for (const category of SEG_CATEGORIES) {
    ratingRows.push({ row: rows.length, category: category.key });
    rows.push([
      category.label,
      ...weeks.flatMap(week => RATINGS.map(rating => reviewedRatingCount(weekReports.get(week) ?? [], category.key, rating))),
      ...RATINGS.map(rating => reviewedRatingCount(sorted, category.key, rating)),
    ]);
  }

  rows.push([]);
  const activityTitleRow = rows.length;
  rows.push(['Daily Activity Statistics · Saved Daily Values']);
  const activityHeaderRow = rows.length;
  rows.push(['Activity category', ...weekLabels, 'Monthly total']);
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
  rows.push(['How to read this sheet', 'Each category appears once. Week columns use program weeks 1–15; monthly totals add the displayed weeks.']);
  rows.push(['Data status', 'Local workspace export only. This workbook is not server-confirmed or uploaded.']);

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const ratingMonthlyStart = 1 + weeks.length * RATINGS.length;
  const ratingLastColumn = ratingMonthlyStart + RATINGS.length - 1;
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
    ...weeks.map((_, index) => ({
      s: { r: ratingHeaderRow, c: 1 + index * RATINGS.length },
      e: { r: ratingHeaderRow, c: (index + 1) * RATINGS.length },
    })),
    { s: { r: ratingHeaderRow, c: ratingMonthlyStart }, e: { r: ratingHeaderRow, c: ratingLastColumn } },
  ];
  sheet['!cols'] = [{ wch: 34 }, ...Array.from({ length: sheetColumnEnd }, () => ({ wch: 10 }))];
  sheet['!freeze'] = { xSplit: 1, ySplit: ratingSubHeaderRow + 1, topLeftCell: `B${ratingSubHeaderRow + 2}`, activePane: 'bottomRight', state: 'frozen' };
  sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: ratingSubHeaderRow, c: 0 }, e: { r: ratingSubHeaderRow + SEG_CATEGORIES.length, c: ratingLastColumn } }) };

  const styleCell = (row: number, column: number, style: Record<string, unknown>) => {
    const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
    if (cell) cell.s = style;
  };
  styleCell(0, 0, { font: { bold: true, sz: 16, color: { rgb: 'FF172B45' } } });
  for (let column = 0; column <= ratingLastColumn; column++) {
    styleCell(ratingTitleRow, column, headingStyle);
    styleCell(ratingHeaderRow, column, tableHeaderStyle);
    styleCell(ratingSubHeaderRow, column, tableHeaderStyle);
  }
  for (let column = 0; column <= activityLastColumn; column++) {
    styleCell(activityTitleRow, column, headingStyle);
    styleCell(activityHeaderRow, column, tableHeaderStyle);
  }
  for (const { row, category } of ratingRows) {
    styleCell(row, 0, { font: { bold: true } });
    for (let index = 0; index < weeks.length; index++) {
      const weekData = weekReports.get(weeks[index]) ?? [];
      RATINGS.forEach((rating, ratingIndex) => {
        const value = reviewedRatingCount(weekData, category, rating);
        if (typeof value === 'number') styleCell(row, 1 + index * RATINGS.length + ratingIndex, {
          ...ratingStyle[rating],
          alignment: { horizontal: 'center' },
          numFmt: '0',
        });
      });
    }
    RATINGS.forEach((rating, ratingIndex) => {
      const value = reviewedRatingCount(sorted, category, rating);
      if (typeof value === 'number') styleCell(row, ratingMonthlyStart + ratingIndex, {
        ...ratingStyle[rating],
        alignment: { horizontal: 'center' },
        numFmt: '0',
      });
    });
  }
  for (const row of activityRows) {
    for (let column = 1; column <= activityLastColumn; column++) {
      styleCell(row, column, { font: { bold: column === activityLastColumn }, alignment: { horizontal: 'center' }, numFmt: '0' });
    }
  }
  XLSX.utils.book_append_sheet(workbook, sheet, 'Monthly Totals');
  return workbook;
}

export function exportMonthlyWorkbook(reports: Report[], monthKey: string) {
  const workbook = buildMonthlyWorkbook(reports, monthKey);
  const name = `Field_Training_Monthly_Summary_${monthKey.replaceAll('-', '')}.xlsx`;
  XLSX.writeFile(workbook, name);
  return name;
}
