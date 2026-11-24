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
import { categoryIsNotApplicable, weeklyRatingCount } from './weekly-rating-counts.js';
import { spreadsheetText } from './spreadsheet-text.js';
import type { PhaseWeekRange } from './model.js';

const border = Object.fromEntries(['top','bottom','left','right'].map(edge=>[edge,{style:'thin',color:{rgb:'FF000000'}}]));
const allColumns = 24;
export class MonthlyWorkbookRangeError extends Error {
  constructor(message:string) {
    super(message);
    this.name='MonthlyWorkbookRangeError';
  }
}
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
      kind:'category',cells:[`${category.label}${week.some(report=>categoryIsNotApplicable(report,category.key))?' · N/A':''}`,'','',...RATINGS.map(rating=>weeklyRatingCount(week,category.key,rating))],
    });
  }
  return panel;
}

type WeeklyTabRange={startDate:string;endDate:string};

function buildWeeklyTabRanges(monthKey:string,phaseWeekRanges?:readonly PhaseWeekRange[]):WeeklyTabRange[] {
  let sourceRanges:WeeklyTabRange[];
  if(phaseWeekRanges?.length) {
    sourceRanges=phaseWeekRanges.map(range=>({startDate:range.startDate,endDate:range.endDate}));
  } else {
    const firstWeek=getSundaySaturdayWeek(`${monthKey}-01`);
    const [year,month]=monthKey.split('-').map(Number);
    const lastDay=new Date(Date.UTC(year,month,0)).toISOString().slice(0,10);
    const lastWeek=getSundaySaturdayWeek(lastDay);
    if(!firstWeek||!lastWeek)throw new Error('The selected month is invalid.');
    sourceRanges=[];
    for(let start=firstWeek.start;start<=lastWeek.start;) {
      const end=new Date(`${start}T12:00:00Z`);
      end.setUTCDate(end.getUTCDate()+6);
      sourceRanges.push({startDate:start,endDate:end.toISOString().slice(0,10)});
      const next=new Date(`${start}T12:00:00Z`);
      next.setUTCDate(next.getUTCDate()+7);
      start=next.toISOString().slice(0,10);
    }
  }
  for(const [index,range] of sourceRanges.entries()) {
    const start=new Date(`${range.startDate}T12:00:00Z`);
    const end=new Date(`${range.endDate}T12:00:00Z`);
    const expectedEnd=new Date(start);
    expectedEnd.setUTCDate(expectedEnd.getUTCDate()+6);
    if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())
      ||start.toISOString().slice(0,10)!==range.startDate
      ||end.toISOString().slice(0,10)!==range.endDate
      ||expectedEnd.toISOString().slice(0,10)!==range.endDate) {
      throw new MonthlyWorkbookRangeError('The saved weekly ranges are invalid. No records were merged or omitted.');
    }
    if(index>0) {
      const expectedStart=new Date(`${sourceRanges[index-1].endDate}T12:00:00Z`);
      expectedStart.setUTCDate(expectedStart.getUTCDate()+1);
      if(expectedStart.toISOString().slice(0,10)!==range.startDate) {
        throw new MonthlyWorkbookRangeError('The saved weekly ranges contain a gap or overlap. No records were merged or omitted.');
      }
    }
  }
  if(sourceRanges.length>4)throw new MonthlyWorkbookRangeError('This month spans more than four Sunday–Saturday weeks. Export stopped; no source weeks were combined or omitted.');
  const tabs=[...sourceRanges];
  while(tabs.length<4) {
    const previous=tabs.at(-1);
    if(!previous)throw new Error('No weekly date ranges are available for this workbook.');
    const start=new Date(`${previous.endDate}T12:00:00Z`);
    start.setUTCDate(start.getUTCDate()+1);
    const end=new Date(start);
    end.setUTCDate(end.getUTCDate()+6);
    tabs.push({startDate:start.toISOString().slice(0,10),endDate:end.toISOString().slice(0,10)});
  }
  return tabs;
}

function tabForDate(date:string,tabs:readonly WeeklyTabRange[]):number {
  const exact=tabs.findIndex(range=>date>=range.startDate&&date<=range.endDate);
  if(exact>=0)return exact;
  throw new MonthlyWorkbookRangeError(`The saved log date ${formatDateMDY(date)} is outside the exported weekly ranges.`);
}

/** Four separate Sunday–Saturday tabs; every source date must fit one weekly range. */
export function buildMonthlyWorkbook(reports: Report[], monthKey: string, phaseWeekRanges?:readonly PhaseWeekRange[]) {
  const selected = filterReportsForMonth(validateReportsForExport(reports), monthKey);
  if (!selected.length) throw new Error('There are no saved daily logs in this month to export.');
  const first = selected[0];
  if (selected.some(report => report.recruitBadge !== first.recruitBadge || (report.className ?? '') !== (first.className ?? ''))) {
    throw new Error('Select one probationary officer and training class for the monthly workbook.');
  }
  const weekRanges=buildWeeklyTabRanges(monthKey,phaseWeekRanges);
  const uncovered=selected.find(report=>!weekRanges.some(range=>report.date>=range.startDate&&report.date<=range.endDate));
  if(uncovered)throw new MonthlyWorkbookRangeError(`The saved log date ${formatDateMDY(uncovered.date)} falls outside the four weekly ranges. No records were merged or omitted.`);
  const workbook=XLSX.utils.book_new();
  for (const [index,weekRange] of weekRanges.entries()) {
    const week=selected.filter(report=>tabForDate(report.date,weekRanges)===index);
    const weekSpanDays=(Date.parse(`${weekRange.endDate}T00:00:00Z`)-Date.parse(`${weekRange.startDate}T00:00:00Z`))/86_400_000+1;
    const rows:(string|number)[][]=[];
    const merges:{s:{r:number;c:number};e:{r:number;c:number}}[]=[];
    const phases=uniqueDisplay(week.map(report=>phaseLabel(report.phase)));
    const phaseWeeks=uniqueDisplay(week.map(report=>report.phaseWeek));
    const ftoWeeks=uniqueDisplay(week.map(report=>report.ftoWeek));
    const assignments=uniqueDisplay(week.map(report=>phaseAssignmentLabel(report.ftoAssignment,report.shift,report.cruiserDistrict)));
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
      {start:10,end:23,value:`${formatDateMDY(weekRange.startDate)} – ${formatDateMDY(weekRange.endDate)} · ${monthKey}${index===3&&weekSpanDays>7?' · includes additional source weeks':''}`},
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

export function exportMonthlyWorkbook(reports: Report[], monthKey: string, phaseWeekRanges?:readonly PhaseWeekRange[]) {
  const workbook=buildMonthlyWorkbook(reports,monthKey,phaseWeekRanges);
  const name=`Field_Training_Monthly_Summary_${monthKey.replaceAll('-','')}.xlsx`;
  XLSX.writeFile(workbook,name);
  return name;
}
