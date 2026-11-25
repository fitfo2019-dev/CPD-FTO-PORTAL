import { CATEGORY_LABEL, type WeeklyPerformanceLog, type SubstationOrientationRecord } from './model.js';
import { SUBSTATION_ORIENTATION_SECTIONS } from './substation-orientation.js';
import { substationDisplay } from './substations.js';
import { formatDateDMY, formatDateTimeMDY } from './training-calendar.js';
import { categoryNumberLabel, weeklyLogNarrativeWithReference } from './weekly-log-layout.js';

export function weeklyPerformanceLogXlsxRows(logs:WeeklyPerformanceLog[]) {
  const rows:(string|number)[][]=[['Class','PO','PO badge','FTO','FTO badge','Phase','Week','Week start','Week end','Entry type','SEG number(s)','SEG category','Total time','Source references','Reference reviewed','Narrative part','Narrative','Source daily report IDs']];
  for(const log of logs) for(const entry of log.entries) {
    const fullNarrative=weeklyLogNarrativeWithReference(entry);
    const chunks=splitExcelText(fullNarrative);
    chunks.forEach((part,index)=>rows.push([
      log.className,log.recruitName,log.recruitBadge,log.ftoName,log.ftoBadge,log.phase,log.weekNumber,
      formatDateDMY(log.weekStart),formatDateDMY(log.weekEnd),entry.kind==='strength'?'Strength':'Corrective training',
        categoryNumberLabel(entry.category),CATEGORY_LABEL[entry.category]??entry.category,entry.totalTime,entry.sourceReferences?.join('; ')??'',entry.sourceReferenceReviewed?'Yes':'No',`${index+1} of ${chunks.length}`,part,entry.sourceReportIds.join('; '),
    ]));
  }
  return rows;
}

export function substationOrientationXlsxRows(records:SubstationOrientationRecord[]) {
  const rows:(string|number)[][]=[['Class','Phase','PO','PO badge','FTO','FTO badge','Date / time','Substation','Checklist section','Orientation item','Checked','Checklist review','Text type','Text part','Text']];
  for(const record of records) {
    for(const section of SUBSTATION_ORIENTATION_SECTIONS) for(const [key,label] of section.items) rows.push([
      record.className,record.phase??1,record.recruitName,record.recruitBadge,record.ftoName,record.ftoBadge,
      formatDateTimeMDY(record.dateTime),substationDisplay(record.substation),section.title,label,record.checklist[key]?'Yes':'No',record.checklistReviewedAt?'Reviewed':'Not reviewed','','','',
    ]);
    for(const [type,text] of [['Division Directives / SOP reviewed',record.directivesReview],['Narrative / continuation',record.narrative]] as const) {
      const chunks=splitExcelText(text);
      chunks.forEach((part,index)=>rows.push([
        record.className,record.phase??1,record.recruitName,record.recruitBadge,record.ftoName,record.ftoBadge,
        formatDateTimeMDY(record.dateTime),substationDisplay(record.substation),'', '', '',record.checklistReviewedAt?'Reviewed':'Not reviewed',type,`${index+1} of ${chunks.length}`,part,
      ]));
    }
  }
  return rows;
}

export function splitExcelText(value:string,maxLength=30000):string[] {
  if(value.length<=maxLength)return [value];
  const chunks:string[]=[];
  for(let start=0;start<value.length;start+=maxLength)chunks.push(value.slice(start,start+maxLength));
  return chunks;
}
