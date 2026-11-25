import XLSX from 'xlsx-js-style';
import { DAILY_ACTIVITY_FIELDS, phaseAssignmentLabel, RATINGS, SEG_CATEGORIES, type Report } from './model.js';
import { formatDateDMY, getSundaySaturdayWeek } from './training-calendar.js';
import { activityTotals } from './run-activity.js';
import { weeklyRatingCount } from './weekly-rating-counts.js';
import { spreadsheetText } from './spreadsheet-text.js';

// Three category columns and four activity columns follow the supplied worksheet photo.
export function weeklyWorkbookForm(reports: Report[], ratingReports=reports): XLSX.WorkSheet {
  const first = reports[0];
  if (!first) throw new Error('At least one daily log is required to build the weekly summary.');
  const week = getSundaySaturdayWeek(first.date);
  const safe = spreadsheetText;
  const rows: (string | number)[][] = [
    ['Probationary Officer Weekly Performance Summary · U-10.173'],
    ['DEVICE-LOCAL RECORD · Not submitted or digitally signed'],
    ['PO', safe(first.recruitName), 'Badge', safe(first.recruitBadge), 'Class', safe(first.className ?? '')],
    ['FTO', safe(first.ftoName), 'Phase', first.phase, 'Week of', week ? formatDateDMY(week.start) : '', 'FTO Assignment', safe(phaseAssignmentLabel(first.ftoAssignment,first.shift,first.cruiserDistrict))],
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
      result.push([category.label, ...RATINGS.map(rating=>weeklyRatingCount(reports,category.key,rating))]);
    }
    return result;
  });
  const height = Math.max(...blockRows.map(block=>block.length));
  for (let index=0; index<height; index++) {
    rows.push(blockRows.flatMap(block=>[...(block[index] ?? Array(6).fill('')), '']));
  }
  rows.push([], ['Weekly Activity Summary · factual counts']);
  const activityTitleRow = rows.length - 1;
  rows[0][0] = String(rows[0][0]).toLocaleUpperCase('en-US');
  rows[activityTitleRow][0] = String(rows[activityTitleRow][0]).toLocaleUpperCase('en-US');
  const activityHeight = Math.ceil(DAILY_ACTIVITY_FIELDS.length / 4);
  for (let row=0; row<activityHeight; row++) {
    rows.push(Array.from({length:4},(_,column)=>{
      const field=DAILY_ACTIVITY_FIELDS[column*activityHeight+row];
      return field ? [field.label, reports.reduce((sum,report)=>sum+(activityTotals(report)[field.key] ?? 0),0), '', '', ''] : Array(5).fill('');
    }).flat());
  }
  rows.push([], ['Ratings are counts of descriptive selections, not performance scores, averages, or rankings.'],
    ['Summons Re-issued appears twice in the supplied photo; it is collected and counted once.']);
  const safeRows = rows.map(row => row.map(value => typeof value === 'string' ? safe(value) : value));
  const worksheet=XLSX.utils.aoa_to_sheet(safeRows);
  worksheet['!cols']=Array.from({length:21},(_,column)=>({wch:column%7===0 ? 31 : 8}));
  const gridBorder = {
    top: { style: 'thin', color: { rgb: 'FF555555' } },
    bottom: { style: 'thin', color: { rgb: 'FF555555' } },
    left: { style: 'thin', color: { rgb: 'FF555555' } },
    right: { style: 'thin', color: { rgb: 'FF555555' } },
  };
  const ratingStyles = {
    NO: { fill: { patternType: 'solid', fgColor: { rgb: 'FFE5E7EB' } }, font: { bold: true, color: { rgb: 'FF374151' } } },
    A: { fill: { patternType: 'solid', fgColor: { rgb: 'FFDCFCE7' } }, font: { bold: true, color: { rgb: 'FF166534' } } },
    RT: { fill: { patternType: 'solid', fgColor: { rgb: 'FFFEF3C7' } }, font: { bold: true, color: { rgb: 'FF92400E' } } },
    UA: { fill: { patternType: 'solid', fgColor: { rgb: 'FFFEE2E2' } }, font: { bold: true, color: { rgb: 'FF991B1B' } } },
    NRT: { fill: { patternType: 'solid', fgColor: { rgb: 'FFFEE2E2' } }, font: { bold: true, color: { rgb: 'FF991B1B' } } },
  } as const;
  const apply = (row: number, column: number, style: Record<string, unknown>) => {
    const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: column })];
    if (cell) cell.s = style;
  };
  const sectionGroups: ReadonlySet<string> = new Set(SEG_CATEGORIES.map(category => category.group));
  const blockStarts = [0, 7, 14];
  apply(0, 0, {
    font: { bold: true, sz: 14, color: { rgb: 'FF142D4F' } },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    border: { bottom: { style: 'medium', color: { rgb: 'FF142D4F' } } },
  });
  for (let row = 2; row < Math.min(rows.length, 7); row++) {
    for (let column = 0; column < 7; column++) {
      apply(row, column, {
        border: gridBorder,
        alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
      });
    }
    for (const column of [0, 2, 4, 6]) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (cell) cell.s = { ...cell.s, font: { bold: true, color: { rgb: 'FF172B45' } } };
    }
  }
  for (let row = 8; row < activityTitleRow; row++) {
    for (const start of blockStarts) {
      const labelCell = worksheet[XLSX.utils.encode_cell({ r: row, c: start })];
      const label = labelCell?.v;
      if (typeof label !== 'string' || !label) continue;
      if (sectionGroups.has(label)) {
        labelCell.v = label.toLocaleUpperCase('en-US');
        apply(row, start, {
          fill: { patternType: 'solid', fgColor: { rgb: 'FFDCE5EF' } },
          font: { bold: true, color: { rgb: 'FF172B45' } },
          alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
          border: gridBorder,
        });
        for (let offset = 1; offset <= RATINGS.length; offset++) {
          const rating = RATINGS[offset - 1];
          apply(row, start + offset, {
            ...ratingStyles[rating],
            alignment: { horizontal: 'center', vertical: 'center' },
            border: gridBorder,
          });
        }
        continue;
      }
      apply(row, start, {
        alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
        border: gridBorder,
      });
      for (let offset = 1; offset <= RATINGS.length; offset++) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: start + offset })];
        if (!cell) continue;
        cell.s = {
          ...(typeof cell.v === 'number' ? ratingStyles[RATINGS[offset - 1]] : {}),
          alignment: { horizontal: 'center', vertical: 'center' },
          border: gridBorder,
          ...(typeof cell.v === 'number' ? { numFmt: '0' } : {}),
        };
      }
    }
  }
  apply(activityTitleRow, 0, {
    fill: { patternType: 'solid', fgColor: { rgb: 'FFDCE5EF' } },
    font: { bold: true, color: { rgb: 'FF172B45' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: gridBorder,
  });
  for (let row = activityTitleRow + 1; row < activityTitleRow + 1 + activityHeight; row++) {
    for (const start of [0, 5, 10, 15]) {
      apply(row, start, {
        alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
        border: gridBorder,
      });
      apply(row, start + 1, {
        alignment: { horizontal: 'center', vertical: 'center' },
        border: gridBorder,
        numFmt: '0',
        font: { bold: true },
      });
    }
  }
  return worksheet;
}
