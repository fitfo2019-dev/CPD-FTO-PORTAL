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
const PANEL_COLUMNS = 6;
const allColumns = PANEL_COLUMNS*3;
const CATEGORY_WIDTH = 27;
const RATING_WIDTH = 6;
const columnWidth = (column:number) => column%PANEL_COLUMNS===0?CATEGORY_WIDTH:RATING_WIDTH;
type Merge = {s:{r:number;c:number};e:{r:number;c:number}};
/** Row height that fits wrapped text inside its cell or merged range. */
function fittedRowHeight(rows:(string|number)[][],merges:readonly Merge[],row:number,fontSize:(column:number)=>number,minimum:number):number {
  let lines=1,maxSize=10;
  rows[row]?.forEach((value,column)=>{
    const text=String(value??'');
    if(!text)return;
    const merge=merges.find(entry=>entry.s.r===row&&entry.s.c===column);
    let width=0;
    for(let c=column;c<=(merge?.e.c??column);c++)width+=columnWidth(c);
    const size=fontSize(column);
    const perLine=Math.max(1,Math.floor((width-1)*12/size));
    let count=1,used=0;
    for(const word of text.split(/\s+/)) {
      const step=word.length+(used?1:0);
      if(used+step>perLine&&used){count++;used=word.length;}
      else used+=step;
    }
    lines=Math.max(lines,count);
    maxSize=Math.max(maxSize,size);
  });
  return Math.max(minimum,Math.ceil(lines*maxSize*1.3+6));
}
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
  merges:Merge[],
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
    panel.push({kind:'group',cells:[SEG_RATING_GROUP_LABELS[group]??group,...Array(PANEL_COLUMNS-1).fill('')]});
    panel.push({kind:'header',cells:['Performance category',...RATINGS]});
    for(const category of categories)panel.push({
      kind:'category',cells:[`${category.label}${week.some(report=>categoryIsNotApplicable(report,category.key))?' · N/A':''}`,...RATINGS.map(rating=>weeklyRatingCount(week,category.key,rating))],
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
    const merges:Merge[]=[];
    const phaseWeeks=week.length?uniqueDisplay(week.map(report=>report.phaseWeek)):weekRange.phaseWeek;
    const ftoWeeks=uniqueDisplay(week.map(report=>report.ftoWeek));
    const assignments=uniqueDisplay(week.map(report=>phaseAssignmentLabel(report.ftoAssignment,report.shift,report.cruiserDistrict)));
    const ftos=uniqueDisplay(week.map(report=>report.ftoName));
    const ftoBadges=uniqueDisplay(week.map(report=>report.ftoBadge));
    const trainingWeeks=week.length?uniqueDisplay(week.map(report=>PHASE_PROGRAM_WEEK_START[phase]+(report.phaseWeek??weekRange.phaseWeek)-1)):PHASE_PROGRAM_WEEK_START[phase]+weekRange.phaseWeek-1;
    const labelled=(panel:number,label:string,value:string|number)=>[
      {start:panel*PANEL_COLUMNS,end:panel*PANEL_COLUMNS,value:label},
      {start:panel*PANEL_COLUMNS+1,end:panel*PANEL_COLUMNS+PANEL_COLUMNS-1,value},
    ];
    const dateText=`${formatDateMDY(weekRange.startDate)} – ${formatDateMDY(weekRange.endDate)} · ${phaseName(phase)}${weekRange.extension?' · Extension Week':''}`;
    appendMergedRow(rows,merges,0,[
      {start:0,end:PANEL_COLUMNS-1,value:'Columbus Division of Police'},
      {start:PANEL_COLUMNS,end:PANEL_COLUMNS*2-1,value:'Probationary Officer'},
      ...labelled(2,'Date:',dateText),
    ]);
    appendMergedRow(rows,merges,1,[...labelled(0,'PO:',first.recruitName),...labelled(1,'Badge:',first.recruitBadge),...labelled(2,'Phase:',phaseName(phase))]);
    appendMergedRow(rows,merges,2,[...labelled(0,'FTO:',ftos),...labelled(1,'Badge:',ftoBadges),...labelled(2,'FTO Assignment:',assignments)]);
    appendMergedRow(rows,merges,3,[...labelled(0,'Phase Week #:',phaseWeeks),...labelled(1,'FTO Week #:',ftoWeeks),...labelled(2,'Week:',trainingWeeks)]);
    const headerRows=4;
    appendMergedRow(rows,merges,headerRows,[{start:0,end:allColumns-1,value:'PERFORMANCE CATEGORIES'}]);

    const panels=SEG_RATING_COLUMNS.map(groups=>buildCategoryPanel(week,groups));
    const panelHeight=Math.max(...panels.map(panel=>panel.length));
    const panelStart=headerRows+1;
    const panelKinds=new Map<string,PanelRow['kind']>();
    const kindAt=(row:number,column:number)=>panelKinds.get(`${row}:${Math.floor(column/PANEL_COLUMNS)}`);
    for(let offset=0;offset<panelHeight;offset++) {
      rows[panelStart+offset]=Array(allColumns).fill('');
      for(let panelIndex=0;panelIndex<panels.length;panelIndex++) {
        const panelRow=panels[panelIndex][offset];
        if(!panelRow)continue;
        const columnStart=panelIndex*PANEL_COLUMNS;
        for(let column=0;column<panelRow.cells.length;column++)rows[panelStart+offset][columnStart+column]=panelRow.cells[column];
        panelKinds.set(`${panelStart+offset}:${panelIndex}`,panelRow.kind);
        if(panelRow.kind==='group'){
          merges.push({s:{r:panelStart+offset,c:columnStart},e:{r:panelStart+offset,c:columnStart+PANEL_COLUMNS-1}});
        }
      }
    }
    const activityTitleRow=panelStart+panelHeight+1;
    appendMergedRow(rows,merges,activityTitleRow,[{start:0,end:allColumns-1,value:'DAILY ACTIVITY SUMMARY'}]);
    const activityStart=activityTitleRow+1;
    const fieldsPerPanel=Math.ceil(DAILY_ACTIVITY_FIELDS.length/3);
    for(let activityRow=0;activityRow<fieldsPerPanel;activityRow++) {
      rows[activityStart+activityRow]=Array(allColumns).fill('');
      for(let panelIndex=0;panelIndex<3;panelIndex++) {
        const field=DAILY_ACTIVITY_FIELDS[panelIndex*fieldsPerPanel+activityRow];
        if(!field)continue;
        const columnStart=panelIndex*PANEL_COLUMNS;
        rows[activityStart+activityRow][columnStart]=field.label;
        rows[activityStart+activityRow][columnStart+PANEL_COLUMNS-1]=week.reduce((sum,report)=>sum+activityTotals(report)[field.key],0);
        merges.push({s:{r:activityStart+activityRow,c:columnStart},e:{r:activityStart+activityRow,c:columnStart+PANEL_COLUMNS-2}});
      }
    }
    const commentsRow=activityStart+fieldsPerPanel+1;
    appendMergedRow(rows,merges,commentsRow,[
      {start:0,end:0,value:'FTO Comments (Optional)'},
      {start:1,end:allColumns-1,value:''},
    ]);
    const legendRow=commentsRow+2;
    appendMergedRow(rows,merges,legendRow,[
      {start:0,end:0,value:'Rating System:'},
      {start:1,end:allColumns-1,value:RATINGS.map(rating=>`${rating} — ${ratingLabel[rating]}`).join('     ')},
    ]);
    for(let row=0;row<rows.length;row++)rows[row]??=Array(allColumns).fill('');
    const sectionRows=new Set([headerRows,activityTitleRow]);
    const labelCells=new Set(['Date:','PO:','Badge:','Phase:','FTO:','FTO Assignment:','Phase Week #:','FTO Week #:','Week:','FTO Comments (Optional)','Rating System:']);
    const fontSizeFor=(row:number,column:number)=>sectionRows.has(row)?12:kindAt(row,column)==='group'?11:10;
    const panelEnd=panelStart+panelHeight;
    const blankRow=(row:number)=>rows[row].every(value=>value==='');
    const outsidePanel=(row:number,column:number)=>row>=panelStart&&row<panelEnd&&!kindAt(row,column);
    const sheet=XLSX.utils.aoa_to_sheet(rows.map(row=>row.map(value=>typeof value==='string'?spreadsheetText(value):value)));
    sheet['!merges']=merges;
    const range=XLSX.utils.decode_range(sheet['!ref']!);
    for(let row=range.s.r;row<=range.e.r;row++)for(let column=0;column<allColumns;column++){
      const address=XLSX.utils.encode_cell({r:row,c:column});
      const cell=sheet[address]??(sheet[address]={t:'s',v:''});
      const text=typeof cell.v==='string'?cell.v:'';
      const isNumber=typeof cell.v==='number';
      const kind=kindAt(row,column);
      const bold=sectionRows.has(row)||kind==='group'||kind==='header'||labelCells.has(text)||(row===0&&column<PANEL_COLUMNS*2);
      const unbordered=(blankRow(row)&&row!==commentsRow)||outsidePanel(row,column);
      cell.s={
        ...(unbordered?{}:{border}),
        font:{name:'Arial',sz:fontSizeFor(row,column),bold},
        alignment:{horizontal:isNumber||(kind==='header'&&column%PANEL_COLUMNS>0)?'center':'left',vertical:row===commentsRow?'top':'center',wrapText:true},
        ...(row===0&&column>=PANEL_COLUMNS*2+1?{fill:{patternType:'solid',fgColor:{rgb:'FFFFD966'}}}:{}),
        ...(isNumber?{numFmt:'0'}:{}),
      };
    }
    sheet['!cols']=Array.from({length:allColumns},(_,column)=>({wch:columnWidth(column)}));
    sheet['!rows']=rows.map((_,row)=>({hpt:row===commentsRow?60:blankRow(row)?8:fittedRowHeight(rows,merges,row,column=>fontSizeFor(row,column),sectionRows.has(row)?22:18)}));
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
