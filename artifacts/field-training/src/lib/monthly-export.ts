import XLSX from 'xlsx-js-style';
import {
  DAILY_ACTIVITY_FIELDS, PHASE_PROGRAM_WEEK_START, RATINGS, SEG_CATEGORIES,
  SEG_RATING_COLUMNS, SEG_RATING_GROUP_LABELS, phaseAssignmentLabel, phaseLabel,
  type Report,
} from './model.js';
import { filterReportsForMonth } from './monthly-summary.js';
import { validateReportsForExport } from './export-validation.js';
import { activityTotals } from './run-activity.js';
import { formatDateMDY, getSundaySaturdayWeek } from './training-calendar.js';
import { weeklyRatingCount } from './weekly-rating-counts.js';
import { spreadsheetText } from './spreadsheet-text.js';

const border = Object.fromEntries(['top','bottom','left','right'].map(edge=>[edge,{style:'thin',color:{rgb:'FF000000'}}]));
const allColumns = 24;
const ratingLabel: Record<(typeof RATINGS)[number],string> = {
  NO:'Not Observed',A:'Acceptable',RT:'Responding to Training',UA:'Unacceptable',NRT:'Not Responding to Training',
};
const uniqueDisplay = (values: (string|number|undefined)[]) => {
  const distinct=[...new Set(values.filter(value=>value!==undefined&&value!==''))];
  return distinct.length===0?'':distinct.length===1?String(distinct[0]):'Multiple';
};

function appendMergedRow(
  rows:(string|number)[][],
  merges:{s:{r:number;c:number};e:{r:number;c:number}}[],
  row:number,
  entries:{start:number;end:number;value:string|number}[],
) {
  rows[row] ??= Array(allColumns).fill('');
  for(const entry of entries) {
    rows[row][entry.start]=entry.value;
    if(entry.end>entry.start)merges.push({s:{r:row,c:entry.start},e:{r:row,c:entry.end}});
  }
}

type PanelRow={cells:(string|number)[];kind:'group'|'header'|'category'};
function buildCategoryPanel(week:Report[], groups:readonly string[]):PanelRow[] {
  const panel:PanelRow[]=[];
  for(const group of groups) {
    const categories=SEG_CATEGORIES.filter(category=>category.group===group);
    if(!categories.length)continue;
    panel.push({kind:'group',cells:[SEG_RATING_GROUP_LABELS[group]??group,...Array(7).fill('')]});
    panel.push({kind:'header',cells:['Performance category','','',...RATINGS]});
    for(const category of categories)panel.push({
      kind:'category',cells:[category.label,'','',...RATINGS.map(rating=>weeklyRatingCount(week,category.key,rating))],
    });
  }
  return panel;
}

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
    const weekDate=getSundaySaturdayWeek(weekStart);
    if(!weekDate)throw new Error('The weekly sheet start date is invalid.');
    const rows:(string|number)[][]=[];
    const merges:{s:{r:number;c:number};e:{r:number;c:number}}[]=[];
    const phases=uniqueDisplay(week.map(report=>phaseLabel(report.phase)));
    const phaseWeeks=uniqueDisplay(week.map(report=>report.phaseWeek));
    const ftoWeeks=uniqueDisplay(week.map(report=>report.ftoWeek));
    const assignments=uniqueDisplay(week.map(report=>phaseAssignmentLabel(report.ftoAssignment,report.shift)));
    const ftos=uniqueDisplay(week.map(report=>report.ftoName));
    const ftoBadges=uniqueDisplay(week.map(report=>report.ftoBadge));
    appendMergedRow(rows,merges,0,[
      {start:0,end:3,value:'Probationary Officer'},
      {start:4,end:4,value:'FTO:'},{start:5,end:9,value:ftos},
      {start:10,end:10,value:'Badge:'},{start:11,end:13,value:ftoBadges},
      {start:14,end:17,value:'FTO Assignment:'},{start:18,end:20,value:assignments},
      {start:21,end:21,value:'Phase:'},{start:22,end:23,value:phases},
    ]);
    appendMergedRow(rows,merges,1,[
      {start:0,end:0,value:'PO:'},{start:1,end:4,value:first.recruitName},
      {start:5,end:5,value:'Badge:'},{start:6,end:7,value:first.recruitBadge},
      {start:8,end:10,value:'Phase Week #:'},{start:11,end:12,value:phaseWeeks},
      {start:13,end:15,value:'FTO Week #:'},{start:16,end:17,value:ftoWeeks},
      {start:18,end:20,value:'Program Week:'},
      {start:21,end:23,value:uniqueDisplay(week.map(report=>PHASE_PROGRAM_WEEK_START[report.phase]+(report.phaseWeek??1)-1))},
    ]);
    appendMergedRow(rows,merges,2,[
      {start:0,end:7,value:'Columbus Division of Police'},
      {start:8,end:9,value:'Date:'},
      {start:10,end:23,value:`${formatDateMDY(weekDate.start)} – ${formatDateMDY(weekDate.end)} · ${monthKey}`},
    ]);
    appendMergedRow(rows,merges,3,[{start:0,end:23,value:'PERFORMANCE CATEGORIES'}]);

    const panels=SEG_RATING_COLUMNS.map(groups=>buildCategoryPanel(week,groups));
    const panelHeight=Math.max(...panels.map(panel=>panel.length));
    const panelStart=4;
    for(let offset=0;offset<panelHeight;offset++) {
      rows[panelStart+offset]=Array(allColumns).fill('');
      for(let panelIndex=0;panelIndex<panels.length;panelIndex++) {
        const panelRow=panels[panelIndex][offset];
        if(!panelRow)continue;
        const columnStart=panelIndex*8;
        for(let column=0;column<panelRow.cells.length;column++)rows[panelStart+offset][columnStart+column]=panelRow.cells[column];
        if(panelRow.kind==='group')merges.push({s:{r:panelStart+offset,c:columnStart},e:{r:panelStart+offset,c:columnStart+7}});
        if(panelRow.kind==='header'||panelRow.kind==='category')merges.push({s:{r:panelStart+offset,c:columnStart},e:{r:panelStart+offset,c:columnStart+2}});
      }
    }
    const activityTitleRow=panelStart+panelHeight+1;
    appendMergedRow(rows,merges,activityTitleRow,[{start:0,end:23,value:'DAILY ACTIVITY SUMMARY'}]);
    const activityStart=activityTitleRow+1;
    const activityColumns=Array.from({length:4},(_,index)=>({start:index*6,end:index*6+5}));
    const fieldsPerPanel=Math.ceil(DAILY_ACTIVITY_FIELDS.length/activityColumns.length);
    const activityGroups=activityColumns.map((_,panelIndex)=>
      DAILY_ACTIVITY_FIELDS.slice(panelIndex*fieldsPerPanel,(panelIndex+1)*fieldsPerPanel));
    for(let activityRow=0;activityRow<fieldsPerPanel;activityRow++) {
      rows[activityStart+activityRow]=Array(allColumns).fill('');
      activityColumns.forEach((columns,panelIndex)=>{
        const field=activityGroups[panelIndex][activityRow];
        if(!field)return;
        rows[activityStart+activityRow][columns.start]=field.label;
        rows[activityStart+activityRow][columns.end]=week.reduce((sum,report)=>sum+activityTotals(report)[field.key],0);
        merges.push({s:{r:activityStart+activityRow,c:columns.start},e:{r:activityStart+activityRow,c:columns.end-1}});
      });
    }
    const commentsRow=activityStart+fieldsPerPanel+1;
    appendMergedRow(rows,merges,commentsRow,[
      {start:0,end:4,value:'FTO Comments (Optional)'},
      {start:5,end:23,value:''},
    ]);
    const legendRow=commentsRow+2;
    const legendEntries:{start:number;end:number;value:string}[]=[
      {start:0,end:3,value:'Rating System:'},
    ];
    RATINGS.forEach((rating,ratingIndex)=>{
      const columnStart=4+ratingIndex*4;
      legendEntries.push({start:columnStart,end:columnStart+3,value:`${rating} — ${ratingLabel[rating]}`});
    });
    appendMergedRow(rows,merges,legendRow,legendEntries);
    const sectionRows=new Set([3,activityTitleRow]);
    const groupHeaderRows=new Set<number>();
    const categoryHeaderRows=new Set<number>();
    panels.forEach((_,panelIndex)=>{
      let row=panelStart;
      for(const group of SEG_RATING_COLUMNS[panelIndex]) {
        const categoryCount=SEG_CATEGORIES.filter(category=>category.group===group).length;
        if(!categoryCount)continue;
        groupHeaderRows.add(row++);
        categoryHeaderRows.add(row++);
        row+=categoryCount;
      }
    });
    const sheet=XLSX.utils.aoa_to_sheet(rows.map(row=>row.map(value=>typeof value==='string'?spreadsheetText(value):value)));
    sheet['!merges']=merges;
    const range=XLSX.utils.decode_range(sheet['!ref']!);
    for(let row=range.s.r;row<=range.e.r;row++)for(let column=0;column<allColumns;column++){
      const address=XLSX.utils.encode_cell({r:row,c:column});
      const cell=sheet[address]??(sheet[address]={t:'s',v:''});
      cell.s={
        border,
        font:{name:'Arial',sz:groupHeaderRows.has(row)||sectionRows.has(row)?11:9,bold:row<=3||sectionRows.has(row)||groupHeaderRows.has(row)||categoryHeaderRows.has(row)||row===activityTitleRow||row===legendRow},
        alignment:{horizontal:typeof cell.v==='number'||(categoryHeaderRows.has(row)&&column%8>=3)?'center':'left',vertical:'center',wrapText:true},
        ...(row===2&&column>=10?{fill:{patternType:'solid',fgColor:{rgb:'FFFFD966'}}}:{}),
        ...(typeof cell.v==='number'?{numFmt:'0'}:{}),
      };
    }
    sheet['!cols']=Array.from({length:allColumns},(_,column)=>({wch:column%8<3?9:4.5}));
    sheet['!rows']=rows.map((_,row)=>({hpt:row===0?24:row===3||row===activityTitleRow?22:row===commentsRow?48:groupHeaderRows.has(row)||categoryHeaderRows.has(row)?18:16}));
    sheet['!pageSetup']={orientation:'landscape',fitToWidth:1,fitToHeight:1,paperSize:9};
    sheet['!pageMargins']={left:0.2,right:0.2,top:0.25,bottom:0.25,header:0.1,footer:0.1};
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
