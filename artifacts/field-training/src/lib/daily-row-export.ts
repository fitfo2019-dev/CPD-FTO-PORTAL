import * as XLSX from 'xlsx';
import { CATEGORIES, CATEGORY_LABEL, DAILY_ACTIVITY_FIELDS, shiftCodeLabel, type Report } from './model.js';
import { activityTotals } from './run-activity.js';
import { spreadsheetText } from './spreadsheet-text.js';
import { effectiveCategoryRating } from './weekly-rating-counts.js';

type Cell = string | number;
const text = (value: unknown): Cell => (typeof value === 'number' ? value : spreadsheetText(value));

/** One Daily Performance Summary as a single spreadsheet row. Raw case is preserved; formulas are neutralized. */
export function dailyRow(report: Report): { header: string[]; row: Cell[] } {
  const ratings = CATEGORIES.map(category => (report.limboDay ? '' : effectiveCategoryRating(report, category) || ''));
  const totals = activityTotals(report);
  const header = [
    'Date', 'Class', 'Phase', 'Phase week', 'Probationary Officer', 'PO badge', 'FTO', 'FTO badge', 'FTO assignment', 'Shift',
    'Zone', 'Precinct', 'Status', 'Limbo day', 'Ratings reviewed',
    ...CATEGORIES.map(category => CATEGORY_LABEL[category]),
    "UA's", 'NRT', ...DAILY_ACTIVITY_FIELDS.map(field => field.label), 'Runs', 'Source log ID',
  ];
  const row: Cell[] = [
    text(report.date), text(report.className ?? ''), report.phase, report.phaseWeek ?? '', text(report.recruitName), text(report.recruitBadge),
    text(report.ftoName), text(report.ftoBadge), text(report.ftoAssignment ?? ''), text(report.shift ? shiftCodeLabel(report.shift) : ''),
    text(report.zone), text(report.precinct), text(report.status), report.limboDay ? 'Yes' : 'No', report.ratingsReviewedAt ? 'Yes' : 'No',
    ...ratings,
    ratings.filter(rating => rating === 'UA' || rating === 'NRT').length, ratings.filter(rating => rating === 'NRT').length,
    ...DAILY_ACTIVITY_FIELDS.map(field => Number(totals[field.key as keyof typeof totals]) || 0),
    report.runs.length, text(report.id),
  ];
  return { header, row };
}

export function buildDailyRowWorkbook(report: Report): XLSX.WorkBook {
  const { header, row } = dailyRow(report);
  const ws = XLSX.utils.aoa_to_sheet([header, row]);
  ws['!cols'] = header.map((label, i) => ({ wch: Math.min(Math.max(label.length, String(row[i] ?? '').length, 10) + 2, 40) }));
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DAILY');
  return wb;
}

export function dailyRowFilename(report: Report): string {
  const badge = String(report.recruitBadge || 'PO').replace(/[^A-Za-z0-9-]+/g, '');
  return `Daily_Performance_Summary_${badge}_${report.date}.xlsx`;
}

export function exportDailyRow(report: Report): string {
  const filename = dailyRowFilename(report);
  XLSX.writeFile(buildDailyRowWorkbook(report), filename);
  return filename;
}
