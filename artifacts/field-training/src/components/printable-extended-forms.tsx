import React from 'react';
import { phaseLabel, type Phase, type WeeklyPerformanceLog, type SubstationOrientationRecord } from '@/lib/model.js';
import { formatDateDMY, formatDateTimeMDY } from '@/lib/training-calendar.js';
import { SUBSTATION_ORIENTATION_GROUPED_SECTIONS } from '@/lib/substation-orientation.js';
import { orientationPrintLayout } from '@/lib/orientation-print-layout.js';
import { substationDisplay } from '@/lib/substations.js';
import { categoryNumberLabel, paginateWeeklyLogEntries, type PrintableLogEntry } from '@/lib/weekly-log-layout.js';

type OrientationSection=typeof SUBSTATION_ORIENTATION_GROUPED_SECTIONS[number];
const ORIENTATION_COLUMNS:readonly (readonly number[])[]=[[0],[1,2],[3,4]];

function overflowRefs(record:SubstationOrientationRecord,refs?:readonly (string|undefined)[]) {
  const {continuations}=orientationPrintLayout(record);
  return continuations.map((item,index)=>({...item,index,reference:refs?.[index]}));
}

function refLabel(index:number,reference?:string) {
  return reference?`continuation ${index+1} (${reference})`:`unindexed continuation ${index+1}`;
}

export function PrintableSubstationOrientation({record,pageReference,continuationReferences,includeContinuations=true}:{record:SubstationOrientationRecord;pageReference?:string;continuationReferences?:readonly (string|undefined)[];includeContinuations?:boolean}) {
  const phase=(record.phase??1) as Phase;
  const layout=orientationPrintLayout(record);
  const pages=overflowRefs(record,continuationReferences);
  const refsFor=(label:string)=>{
    const matching=pages.filter(page=>page.label===label);
    const first=matching[0], last=matching.at(-1);
    if(!first||!last)return '';
    return first===last?refLabel(first.index,first.reference):`${refLabel(first.index,first.reference)} through ${refLabel(last.index,last.reference)}`;
  };
  const [date,time]=formatDateTimeMDY(record.dateTime).split(' ');
  const originalTotal=SUBSTATION_ORIENTATION_GROUPED_SECTIONS.reduce((sum,section)=>sum+section.items.length,0);
  const rowTotal=SUBSTATION_ORIENTATION_GROUPED_SECTIONS.reduce((sum,section)=>sum+section.rows.length,0);
  const coveredTasks=SUBSTATION_ORIENTATION_GROUPED_SECTIONS.reduce((sum,section)=>sum+section.items.filter(([key])=>record.checklist[key]!==false).length,0);
  const directivesLabel='Division Directives / SOP reviewed';
  const narrativeLabel='Additional narrative / continuation';
  const reviewSection=SUBSTATION_ORIENTATION_GROUPED_SECTIONS[5];
  return <>
    <section className="print-substation print-orientation-b" aria-hidden="true" data-testid="print-substation-orientation">
      <header className="print-extended-header">
        <div><p>Columbus Division of Police · Field Training Program</p><h1>Substation Orientation</h1><b>U-10.181 (05/23)</b></div>
        <span>Complete on the first scheduled day of each phase.</span>
      </header>
      <p className="print-orientation-sub">FTO / PO walkthrough checklist · records items covered, not performance ratings.</p>
      <div className="print-orientation-meta">
        <span><b>Probationary Officer</b>{record.recruitName} · {record.recruitBadge}</span>
        <span><b>FTO</b>{record.ftoName} · {record.ftoBadge}</span>
        <span><b>Substation</b>{substationDisplay(record.substation)}</span>
        <span><b>Date</b>{date||'Not recorded'}</span>
        <span><b>Time</b>{time||'Not recorded'}</span>
        <span><b>Class / phase</b>{record.className||'—'} · {phaseLabel(phase)}</span>
        <span className="print-orientation-wide" data-training-folder-page={pageReference}><b>Training-folder reference</b>{pageReference??'Training-folder reference unavailable'}</span>
      </div>
      <p className="print-orientation-note">☒ covered · ☐ not yet covered. A combined row is checked only when ALL listed tasks were covered. {coveredTasks} of {originalTotal} original tasks covered · {rowTotal} printed rows. New forms start checked; the FTO reviews every row before treating it as covered.</p>
      <div className="print-orientation-cols">
        {ORIENTATION_COLUMNS.map((column,ci)=><div key={ci} className="print-orientation-col">
          {column.map(index=><PrintOrientationSection key={index} section={SUBSTATION_ORIENTATION_GROUPED_SECTIONS[index]} record={record}/>)}
        </div>)}
      </div>
      <div className="print-orientation-bottom">
        <PrintOrientationSection section={reviewSection} record={record}/>
        <div className="print-orientation-box">
          <b>{directivesLabel}:</b>
          <p data-testid="print-orientation-directives">{layout.directives||(refsFor(directivesLabel)?`See ${refsFor(directivesLabel)}.`:'None recorded.')}</p>
          <b>{narrativeLabel}</b>
          <p data-testid="print-orientation-narrative">{layout.narrative||(refsFor(narrativeLabel)?`See ${refsFor(narrativeLabel)}.`:'None recorded.')}</p>
        </div>
      </div>
      <div className="print-orientation-review">Checklist review: {record.checklistReviewedAt?'☒ Confirmed':'☐ Not confirmed'} — FTO and PO went over every row above.</div>
      <footer className="print-orientation-footer"><span>FTO / PO walkthrough checklist · records items covered, not performance ratings.{pages.length>0?` Overflow text: ${pages.length} U-10.192 attachments.`:''}</span><span>Local copy · not server-confirmed or electronically signed.</span></footer>
    </section>
    {includeContinuations&&<PrintableOrientationContinuations record={record} pageReferences={continuationReferences}/>}
  </>;
}

function PrintOrientationSection({section,record}:{section:OrientationSection;record:SubstationOrientationRecord}) {
  return <section>
    <h2>{section.title}</h2><p className="print-orientation-description">{section.description}</p>
    <ul>{section.rows.map(row=><li key={row.id} className={row.keys.length>1?'is-group':undefined}><b>{row.keys.every(key=>record.checklist[key]!==false)?'☒':'☐'}</b><span>{row.label}</span></li>)}</ul>
  </section>;
}

export function PrintableOrientationContinuations({record,pageReferences}:{record:SubstationOrientationRecord;pageReferences?:readonly (string|undefined)[]}) {
  const pages=overflowRefs(record,pageReferences);
  if(pages.length===0) return null;
  return <>{pages.map(page=><section key={page.index} className="print-substation print-orientation-continuation" aria-hidden="true" data-testid={`print-orientation-continuation-${page.index+1}`}>
    <header className="print-orientation-cont-head">
      <span>Columbus Division of Police · U-10.192 continuation of U-10.181 Substation Orientation</span>
      <span data-training-folder-page={page.reference}>Continuation {page.index+1} of {pages.length} · {page.reference??'Unindexed attachment · no packet reference yet'}</span>
    </header>
    <p className="print-orientation-cont-meta">{record.recruitName} · {record.recruitBadge} · FTO {record.ftoName} · {record.ftoBadge}</p>
    <h2>{page.label}</h2>
    <div className="print-orientation-cont-text">{page.text}</div>
    <footer className="print-orientation-footer"><span>Full saved text, unedited.</span><span>Local copy · not electronically signed.</span></footer>
  </section>)}</>;
}

export function PrintableWeeklyPerformanceLog({log,preview=false}:{log:WeeklyPerformanceLog;preview?:boolean}) {
  const pages=paginateWeeklyLogEntries(log.entries);
  return <section className={`print-weekly-log${preview?' is-preview':''}`} aria-hidden={!preview} data-testid="print-weekly-performance-log">
    {pages.map((page,pageIndex)=>{
      const totalPages=pages.length;
      return <article className="print-weekly-log-page" key={pageIndex} data-testid={`print-weekly-log-page-${pageIndex+1}`}>
        <header className="print-extended-header">
          <div><p>Columbus Division of Police · Field Training Program</p><h1>Probationary Officer Weekly Performance Log</h1><b>U-10.174S</b></div>
          <span>Page {pageIndex+1} of {totalPages}<br/>Date {formatDateDMY(log.weekEnd)}</span>
        </header>
        <div className="print-extended-meta">
          <span><b>Probationary Officer</b>{log.recruitName} · {log.recruitBadge}</span>
          <span><b>Field Training Officer</b>{log.ftoName} · {log.ftoBadge}</span>
          <span><b>Class / phase</b>{log.className||'—'} · {phaseLabel(log.phase)}</span>
          <span><b>Week</b>{log.weekNumber} · {formatDateDMY(log.weekStart)} – {formatDateDMY(log.weekEnd)}</span>
        </div>
        {page.strengths.length>0&&<section className="print-weekly-log-strengths">
          <h2>{pageIndex===0?'Probationary Officer Strengths':'Probationary Officer Strengths Continued'}</h2>
          <table className="print-weekly-log-table print-weekly-log-strength-table">
            <thead><tr><th>CATEGORY</th><th>Probationary Officer Strengths</th></tr></thead>
            <tbody>{page.strengths.map((row,index)=><LogEntry key={`${row.entry.id}-${pageIndex}-${index}`} row={row} showTime={false}/>)}</tbody>
          </table>
        </section>}
        <section className="print-weekly-log-corrective">
          <h2>{pageIndex===0?'Probationary Officer Deficient & Weekly Corrective Training':'Probationary Officer Deficient & Weekly Corrective Training Continued'}</h2>
          <table className="print-weekly-log-table">
            <thead><tr><th>CATEGORY</th><th>TOTAL TIME</th><th>Probationary Officer Deficient & Weekly Corrective Training{pageIndex===0?'':' Continued'}</th></tr></thead>
            <tbody>{page.corrective.map((row,index)=><LogEntry key={`${row.entry.id}-${pageIndex}-${index}`} row={row} showTime/>)}{page.corrective.length===0&&pageIndex===0&&log.entries.length===0&&<tr className="print-weekly-log-entry"><td colSpan={3}>No log entries recorded.</td></tr>}{Array.from({length:page.blankCorrectiveRows},(_,index)=><tr key={`blank-${pageIndex}-${index}`} className="print-weekly-log-blank-row" aria-hidden="true"><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>)}</tbody>
          </table>
        </section>
        <footer className="print-extended-footer">{pageIndex<totalPages-1?'Continued on the next printed page.':'End of weekly log.'} Training-folder references in narratives are separate from printed page numbers.</footer>
      </article>;
    })}
  </section>;
}

function LogEntry({row,showTime}:{row:PrintableLogEntry;showTime:boolean}) {
  const references=row.entry.sourceReferences?.filter(Boolean).join(', ')??'';
  return <tr className="print-weekly-log-entry">
    <td>{categoryNumberLabel(row.entry.category)}</td>
    {showTime&&<td>{row.entry.totalTime||'—'}</td>}
    <td className="print-weekly-log-narrative">{references&&<b>{references}{row.continuation?' (continued)':''}</b>}{row.narrativePart&&<> {row.narrativePart}</>}{!references&&!row.narrativePart?'—':null}</td>
  </tr>;
}

