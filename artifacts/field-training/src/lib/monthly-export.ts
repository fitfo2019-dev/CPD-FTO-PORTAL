import XLSX from 'xlsx-js-style';
import { DAILY_ACTIVITY_FIELDS, PRIMARY_RUN_FORMS, RATINGS, SEG_CATEGORIES, type Report } from './model.js';
import { filterReportsForMonth } from './monthly-summary.js';
import { validateReportsForExport } from './export-validation.js';
import { activityTotals } from './run-activity.js';
import { getSundaySaturdayWeek } from './training-calendar.js';
import { weeklyRatingCount } from './weekly-rating-counts.js';
import { spreadsheetText } from './spreadsheet-text.js';

const border = Object.fromEntries(['top','bottom','left','right'].map(edge=>[edge,{style:'thin',color:{rgb:'FF000000'}}]));
const ratingFill={NO:'FFE5E7EB',A:'FFDCFCE7',RT:'FFFEF3C7',UA:'FFFEE2E2',NRT:'FFFEE2E2'} as const;

/** Exactly four consecutive Sunday–Saturday tabs; fail explicitly instead of dropping a fifth week. */
export function buildMonthlyWorkbook(reports: Report[], monthKey: string) {
  const selected = filterReportsForMonth(validateReportsForExport(reports), monthKey);
  if (!selected.length) throw new Error('There are no saved daily logs in this month to export.');
  const first = selected[0];
  if (selected.some(report => report.recruitBadge !== first.recruitBadge || (report.className ?? '') !== (first.className ?? ''))) {
    throw new Error('Select one probationary officer and training class for the four-week workbook.');
  }
  const start = getSundaySaturdayWeek(first.date)?.start;
  if (!start) throw new Error('A daily log has an invalid training date.');
  const weekStarts = Array.from({length:4},(_,index)=>{
    const date=new Date(`${start}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate()+index*7);
    return date.toISOString().slice(0,10);
  });
  if (selected.some(report => !weekStarts.includes(getSundaySaturdayWeek(report.date)?.start ?? ''))) {
    throw new Error('This month spans more than four weekly tabs. No records were omitted. A five-week or split-workbook policy must be approved before export.');
  }
  const workbook=XLSX.utils.book_new();
  for (const [index,weekStart] of weekStarts.entries()) {
    const week=selected.filter(report=>getSundaySaturdayWeek(report.date)?.start===weekStart);
    const rows:(string|number)[][]=[
      [`MONTHLY EXCEL SPREADSHEET · WEEK ${index+1}`],
      ['MONTH',monthKey,'WEEK OF',weekStart],
      ['PROBATIONARY OFFICER',first.recruitName,'BADGE',first.recruitBadge,'CLASS',first.className??''],
      ['FTO',...new Set(week.map(report=>report.ftoName))],
      ['SOURCE DAILY LOGS',week.map(report=>report.id).join(', ')],
      ['SEG EVALUATION COUNTS · REVIEWED NON-LIMBO RECORDS'],
      ['PERFORMANCE CATEGORY',...RATINGS],
      ...SEG_CATEGORIES.map(category=>[
        category.label,...RATINGS.map(rating=>weeklyRatingCount(week,category.key,rating)),
      ]),
      [],
      ['WEEKLY ACTIVITY SUMMARY'],
      ['ACTIVITY CATEGORY','TOTAL'],
      ...DAILY_ACTIVITY_FIELDS.map(field=>[
        field.label,week.reduce((sum,report)=>sum+activityTotals(report)[field.key],0),
      ]),
      [],
      ['PRIMARY RUN TYPE','TOTAL'],
      ...PRIMARY_RUN_FORMS.map(form=>[
        form.label,week.reduce((sum,report)=>sum+report.runs.filter(run=>run.runKind===form.key&&run.formStatus==='complete'&&run.checklistReviewedAt).length,0),
      ]),
    ];
    const sheet=XLSX.utils.aoa_to_sheet(rows.map(row=>row.map(value=>typeof value==='string'?spreadsheetText(value):value)));
    const sectionRows=new Set([0,5,38,40+DAILY_ACTIVITY_FIELDS.length]);
    const headerRows=new Set([6,39,41+DAILY_ACTIVITY_FIELDS.length]);
    const range=XLSX.utils.decode_range(sheet['!ref']!);
    for(let row=range.s.r;row<=range.e.r;row++)for(let column=0;column<=5;column++){
      const address=XLSX.utils.encode_cell({r:row,c:column});
      const cell=sheet[address]??(sheet[address]={t:'s',v:''});
      cell.s={
        border, font:{name:'Arial',sz:10,bold:sectionRows.has(row)||headerRows.has(row)},
        alignment:{horizontal:row>=6&&column>0?'center':'left',vertical:'center',wrapText:true},
        ...(row>=7&&row<37&&column>0?{fill:{patternType:'solid',fgColor:{rgb:ratingFill[RATINGS[column-1]]}}}:{}),
        ...(typeof cell.v==='number'?{numFmt:'0'}:{}),
      };
    }
    sheet['!cols']=[{wch:43},...Array.from({length:5},()=>({wch:14}))];
    sheet['!merges']=[{s:{r:0,c:0},e:{r:0,c:5}},{s:{r:5,c:0},e:{r:5,c:5}},{s:{r:38,c:0},e:{r:38,c:5}}];
    sheet['!rows']=rows.map((_,row)=>({hpt:sectionRows.has(row)?25:20}));
    XLSX.utils.book_append_sheet(workbook,sheet,`Week ${index+1}`);
  }
  return workbook;
}

export function exportMonthlyWorkbook(reports: Report[], monthKey: string) {
  const workbook=buildMonthlyWorkbook(reports,monthKey);
  const name=`Field_Training_Monthly_Summary_${monthKey.replaceAll('-','')}.xlsx`;
  XLSX.writeFile(workbook,name);
  return name;
}
