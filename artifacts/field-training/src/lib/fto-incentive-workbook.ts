import * as XLSX from 'xlsx';
import type { IncentiveRow } from './fto-incentive.js';
import { spreadsheetText } from './spreadsheet-text.js';

const PHASE = ['', 'I', 'II', 'III', 'IV'];

export function buildIncentiveWorkbook(rows: readonly IncentiveRow[], className: string, phase: number): XLSX.WorkBook {
  const header = ['FTO', 'Badge', 'Schedule', "Assigned PO's", 'Assigned days', 'Coverage days', 'Days total', 'Required', 'Scheduled days', 'FULL PHASE'];
  const body = rows.map(r => [spreadsheetText(r.ftoName), spreadsheetText(r.ftoBadge), r.schedule, spreadsheetText(r.poNames),
    r.assignedDays, r.coverageDays, r.totalDays, r.required, r.scheduled, r.fullPhase ? 'YES' : 'NO']);
  const title = [[`FTO Incentive Report · ${spreadsheetText(className)} · Phase ${PHASE[phase] ?? phase}`], []];
  const ws = XLSX.utils.aoa_to_sheet([...title, header, ...body]);
  ws['!cols'] = header.map((label, i) => ({ wch: Math.min(Math.max(label.length, ...body.map(row => String(row[i] ?? '').length), 10) + 2, 48) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `PHASE ${PHASE[phase] ?? phase}`);
  return wb;
}

export function exportIncentiveWorkbook(rows: readonly IncentiveRow[], className: string, phase: number): string {
  const safeClass = className.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'Class';
  const filename = `FTO_Incentive_Report_${safeClass}_Phase_${PHASE[phase] ?? phase}.xlsx`;
  XLSX.writeFile(buildIncentiveWorkbook(rows, className, phase), filename);
  return filename;
}
