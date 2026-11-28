import XLSX from 'xlsx-js-style';
import {
  DAILY_ACTIVITY_FIELDS, PHASE_LENGTH_WEEKS, PHASE_PROGRAM_WEEK_START, PHASE_TIMELINE_REGISTRY, RATINGS, SEG_CATEGORIES,
  SEG_RATING_COLUMNS, SEG_RATING_GROUP_LABELS, phaseAssignmentLabel, phaseLabel,
  type Phase, type PhaseCaseFolder, type Report,
} from './model.js';
import { validateReportsForExport } from './export-validation.js';
import { activityTotals } from './run-activity.js';
import { formatDateMDY, getCaseFolderWeekRanges, getSundaySaturdayWeek } from './training-calendar.js';
import { categoryIsNotApplicable, weeklyRatingCount } from './weekly-rating-counts.js';
import { spreadsheetText } from './spreadsheet-text.js';
import type { PhaseWeekRange } from './model.js';
import { formTemplateRevision } from './form-revisions.js';

const border = Object.fromEntries(['top','bottom','left','right'].map(edge=>[edge,{style:'thin',color:{rgb:'FF000000'}}]));
const allColumns = 24;
export class PhaseWorkbookRangeError extends Error {
  constructor(message:string) {
    super(message);
    this.name='PhaseWorkbookRangeError';
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

type WeeklyTabRange={startDate:string;endDate:string;sheetName:string;phaseWeek:number;extension:boolean};
type PhaseWorkbookFolder=Pick<PhaseCaseFolder,'phaseStartDate'|'scheduledWeeks'|'phaseWeekRanges'|'limboExtensionWeeks'>;

const DAY_MS=86_400_000;
const addDays=(isoDate:string,days:number)=>new Date(Date.parse(`${isoDate}T12:00:00Z`)+days*DAY_MS).toISOString().slice(0,10);
const isIsoDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)===value;
const phaseName=(phase:Phase)=>PHASE_TIMELINE_REGISTRY.find(entry=>entry.phaseId===phase)?.phaseName??phaseLabel(phase);

/** One tab per Sunday–Saturday week of the phase. A limbo extension that
 * lengthens Week 1 is split into separate tabs after Week 1; approved extra
 * training weeks follow the scheduled weeks. Nothing is merged or dropped. */
function buildPhaseTabRanges(phase:Phase,selected:readonly Report[],folder?:PhaseWorkbookFolder):WeeklyTabRange[] {
  const scheduledWeeks=Math.max(1,Math.floor(folder?.scheduledWeeks??PHASE_LENGTH_WEEKS[phase]));
  let sourceRanges:PhaseWeekRange[];
  if(folder) {
    sourceRanges=getCaseFolderWeekRanges({phase,...folder});
  } else {
    const first=selected[0];
    const firstWeek=getSundaySaturdayWeek(first.date);
    if(!firstWeek)throw new PhaseWorkbookRangeError('The saved weekly ranges are invalid. No records were merged or omitted.');
    const anchor=addDays(firstWeek.start,-7*Math.max(0,(first.phaseWeek??1)-1));
    const lastWeek=getSundaySaturdayWeek(selected.at(-1)!.date);
    const neededWeeks=lastWeek?Math.round((Date.parse(lastWeek.start)-Date.parse(anchor))/DAY_MS/7)+1:1;
    sourceRanges=Array.from({length:Math.max(scheduledWeeks,neededWeeks)},(_,index)=>({startDate:addDays(anchor,index*7),endDate:addDays(anchor,index*7+6)}));
  }
  const tabs:WeeklyTabRange[]=[];
  for(const [index,range] of sourceRanges.entries()) {
    if(!isIsoDate(range.startDate)||!isIsoDate(range.endDate)) {
      throw new PhaseWorkbookRangeError('The saved weekly ranges are invalid. No records were merged or omitted.');
    }
    const spanDays=Math.round((Date.parse(`${range.endDate}T12:00:00Z`)-Date.parse(`${range.startDate}T12:00:00Z`))/DAY_MS)+1;
    const weekCount=spanDays/7;
    if(!Number.isInteger(weekCount)||weekCount<1||(index>0&&weekCount!==1)) {
      throw new PhaseWorkbookRangeError('The saved weekly ranges are invalid. No records were merged or omitted.');
    }
    if(index>0&&addDays(sourceRanges[index-1].endDate,1)!==range.startDate) {
      throw new PhaseWorkbookRangeError('The saved weekly ranges contain a gap or overlap. No records were merged or omitted.');
    }
    const phaseWeek=index+1;
    for(let part=0;part<weekCount;part++) {
      const startDate=addDays(range.startDate,part*7);
      const limboExtension=part>0;
      const trainingExtension=phaseWeek>scheduledWeeks;
      tabs.push({
        startDate,endDate:addDays(startDate,6),phaseWeek,
        extension:limboExtension||trainingExtension,
        sheetName:limboExtension?`Week ${phaseWeek} Extension ${part}`:trainingExtension?`Week ${phaseWeek} (Extension Week)`:`Week ${phaseWeek}`,
      });
    }
  }
  if(!tabs.length)throw new Error('No weekly date ranges are available for this workbook.');
  return tabs;
}

function tabForDate(date:string,tabs:readonly WeeklyTabRange[]):number {
  const exact=tabs.findIndex(range=>date>=range.startDate&&date<=range.endDate);
  if(exact>=0)return exact;
  throw new PhaseWorkbookRangeError(`The saved log date ${formatDateMDY(date)} is outside the phase's weekly ranges. No records were merged or omitted.`);
}

/** One workbook per phase: every saved day of the selected phase, one tab per
 * Sunday–Saturday week, whatever calendar month the days fall in. */
export function buildPhaseWorkbook(reports: Report[], phase: Phase, folder?:PhaseWorkbookFolder) {
  const selected = validateReportsForExport(reports).filter(report=>report.phase===phase).sort((a,b)=>a.date.localeCompare(b.date));
  if (!selected.length) throw new Error(`There are no saved daily logs in ${phaseName(phase)} to export.`);
  const first = selected[0];
  if (selected.some(report => report.recruitBadge !== first.recruitBadge || (report.className ?? '') !== (first.className ?? ''))) {
    throw new Error('Select one probationary officer and training class for the phase workbook.');
  }
  const weekRanges=buildPhaseTabRanges(phase,selected,folder);
  for(const report of selected)tabForDate(report.date,weekRanges);
  const workbook=XLSX.utils.book_new();
  for (const [index,weekRange] of weekRanges.entries()) {
    const week=selected.filter(report=>tabForDate(report.date,weekRanges)===index);
    const rows:(string|number)[][]=[];
    const merges:{s:{r:number;c:number};e:{r:number;c:number}}[]=[];
    const phases=phaseName(phase);
    const phaseWeeks=week.length?uniqueDisplay(week.map(report=>report.phaseWeek)):weekRange.phaseWeek;
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
      {start:21,end:23,value:week.length?uniqueDisplay(week.map(report=>PHASE_PROGRAM_WEEK_START[phase]+(report.phaseWeek??weekRange.phaseWeek)-1)):PHASE_PROGRAM_WEEK_START[phase]+weekRange.phaseWeek-1},
    ]);
    appendMergedRow(rows,merges,2,[
      {start:0,end:7,value:'Columbus Division of Police'},
      {start:8,end:9,value:'Date:'},
      {start:10,end:23,value:`${formatDateMDY(weekRange.startDate)} – ${formatDateMDY(weekRange.endDate)} · ${phaseName(phase)}${weekRange.extension?' · Extension Week':''}`},
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
    sheet['!pageSetup']={orientation:'landscape',fitToWidth:1,fitToHeight:1,paperSize:1};
    sheet['!pageMargins']={left:0.5,right:0.5,top:0.5,bottom:0.5,header:0.1,footer:0.1};
    XLSX.utils.book_append_sheet(workbook,sheet,weekRange.sheetName);
  }
  return workbook;
}

/** xlsx-js-style does not serialize !pageSetup. Preserve the worksheet
 * layout/styles and explicitly write the existing print settings into OOXML. */
export function serializePhaseWorkbook(workbook: XLSX.WorkBook): ArrayBuffer {
  const archive=XLSX.CFB.read(new Uint8Array(XLSX.write(workbook,{type:'array',bookType:'xlsx'})),{type:'array'});
  workbook.SheetNames.forEach((_,index)=>{
    const entry=XLSX.CFB.find(archive,`/xl/worksheets/sheet${index+1}.xml`);
    if(!entry?.content)throw new Error(`Phase worksheet ${index+1} could not be prepared for printing.`);
    let xml=new TextDecoder().decode(Uint8Array.from(entry.content));
    const setup='<pageSetUpPr fitToPage="1"/>';
    if(/<sheetPr\b/.test(xml)) {
      xml=xml.replace(/<pageSetUpPr\b[^>]*\/>/g,'');
      xml=xml.replace(/<sheetPr([^>]*)\/>/,`<sheetPr$1>${setup}</sheetPr>`);
      if(!xml.includes(setup))xml=xml.replace(/(<sheetPr\b[^>]*>)/,`$1${setup}`);
    } else xml=xml.replace(/(<worksheet\b[^>]*>)/,`$1<sheetPr>${setup}</sheetPr>`);
    xml=xml.replace(/<(?:pageMargins|pageSetup)\b[^>]*\/>/g,'');
    const printSettings=`<pageMargins left="0.5" right="0.5" top="0.5" bottom="0.5" header="0.1" footer="0.1"/><pageSetup paperSize="1" orientation="landscape" fitToWidth="1" fitToHeight="1"/><headerFooter><oddFooter>&amp;L&amp;8Template revised ${formTemplateRevision('monthly_workbook')}</oddFooter></headerFooter>`;
    xml=xml.replace(/(?=<ignoredErrors\b|<\/worksheet>)/,printSettings);
    entry.content=Array.from(new TextEncoder().encode(xml));
    entry.size=entry.content.length;
  });
  const output=XLSX.CFB.write(archive,{type:'array',fileType:'zip',compression:true});
  return Uint8Array.from(output instanceof ArrayBuffer?new Uint8Array(output):output).buffer;
}

export function exportPhaseWorkbook(reports: Report[], phase: Phase, folder?:PhaseWorkbookFolder) {
  const workbook=buildPhaseWorkbook(reports,phase,folder);
  const badge=reports.find(report=>report.phase===phase)?.recruitBadge.replace(/[^A-Za-z0-9-]+/g,'')||'PO';
  const name=`Field_Training_Phase_${phase}_Summary_${badge}.xlsx`;
  const url=URL.createObjectURL(new Blob([serializePhaseWorkbook(workbook)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  const link=document.createElement('a');
  link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  return name;
}
