import * as XLSX from 'xlsx';
import { DAILY_ACTIVITY_FIELDS, phaseAssignmentLabel, RATINGS, SEG_CATEGORIES, type Report } from './model.js';
import { formatDateDMY, getSundaySaturdayWeek } from './training-calendar.js';
import { activityTotals } from './run-activity.js';

// Three category columns and four activity columns follow the supplied worksheet photo.
export function weeklyWorkbookForm(reports: Report[], ratingReports=reports): XLSX.WorkSheet {
  const first = reports[0];
  const week = getSundaySaturdayWeek(first.date);
  const safe = (value: string) => /^[=+\-@]/.test(value) ? `'${value}` : value;
  const rows: (string | number)[][] = [
    ['Probationary Officer Weekly Performance Summary · U-10.173'],
    ['DEVICE-LOCAL RECORD · Not submitted or digitally signed'],
    ['PO', safe(first.recruitName), 'Badge', safe(first.recruitBadge), 'Class', safe(first.className ?? '')],
    ['FTO', safe(first.ftoName), 'Phase', first.phase, 'Week of', week ? formatDateDMY(week.start) : '', 'FTO Assignment', safe(phaseAssignmentLabel(first.ftoAssignment,first.shift))],
    ['Phase week', first.phaseWeek ?? 'Not confirmed', 'FTO week', first.ftoWeek ?? 'Not confirmed'],
    ['Source daily logs', reports.map(report=>safe(report.id)).join(', ')],
    ['Rating counts', `${ratingReports.length} daily performance logs reviewed; unreviewed ratings excluded`],
    [],
  ];
  const blocks = [
    SEG_CATEGORIES.slice(0, 7),
    SEG_CATEGORIES.slice(7, 17),
    SEG_CATEGORIES.slice(17),
  ];
  const blockRows = blocks.map(categories => {
    const result: (string | number)[][] = [];
    let group = '';
    for (const category of categories) {
      if (category.group !== group) {
        group = category.group;
        result.push([group, ...RATINGS]);
      }
      result.push([category.label, ...RATINGS.map(rating=>ratingReports.filter(report=>report.ratings[category.key]?.rating===rating).length)]);
    }
    return result;
  });
  const height = Math.max(...blockRows.map(block=>block.length));
  for (let index=0; index<height; index++) {
    rows.push(blockRows.flatMap(block=>[...(block[index] ?? Array(6).fill('')), '']));
  }
  rows.push([], ['Weekly Activity Summary · factual counts']);
  const activityHeight = Math.ceil(DAILY_ACTIVITY_FIELDS.length / 4);
  for (let row=0; row<activityHeight; row++) {
    rows.push(Array.from({length:4},(_,column)=>{
      const field=DAILY_ACTIVITY_FIELDS[column*activityHeight+row];
      return field ? [field.label, reports.reduce((sum,report)=>sum+(activityTotals(report)[field.key] ?? 0),0), '', '', ''] : Array(5).fill('');
    }).flat());
  }
  rows.push([], ['Ratings are counts of descriptive selections, not performance scores, averages, or rankings.'],
    ['Summons Re-issued appears twice in the supplied photo; it is collected and counted once.']);
  const worksheet=XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols']=Array.from({length:21},(_,column)=>({wch:column%7===0 ? 31 : 8}));
  return worksheet;
}
