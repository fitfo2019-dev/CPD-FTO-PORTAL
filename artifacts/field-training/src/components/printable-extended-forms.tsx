import React from 'react';
import { phaseLabel, type Phase, type WeeklyPerformanceLog, type SubstationOrientationRecord } from '@/lib/model.js';
import { formatDateDMY, formatDateTimeMDY } from '@/lib/training-calendar.js';
import { SUBSTATION_ORIENTATION_SECTIONS } from '@/lib/substation-orientation.js';
import { substationDisplay } from '@/lib/substations.js';
import { categoryNumberLabel, paginateWeeklyLogEntries, type PrintableLogEntry } from '@/lib/weekly-log-layout.js';

export function PrintableSubstationOrientation({record,pageReference,continuationPageReference}:{record:SubstationOrientationRecord;pageReference?:string;continuationPageReference?:string}) {
  const phase=(record.phase??1) as Phase;
  return <>
    <OrientationPage record={record} phase={phase} pageReference={pageReference} title="Substation Orientation" sections={SUBSTATION_ORIENTATION_SECTIONS.slice(0,2)} testId="print-substation-orientation"/>
    <OrientationPage record={record} phase={phase} pageReference={continuationPageReference} title="Substation Orientation · Continued" sections={SUBSTATION_ORIENTATION_SECTIONS.slice(2)} continued testId="print-substation-orientation-continuation"/>
  </>;
}

function OrientationPage({record,phase,pageReference,title,sections,continued,testId}:{record:SubstationOrientationRecord;phase:Phase;pageReference?:string;title:string;sections:typeof SUBSTATION_ORIENTATION_SECTIONS[number][];continued?:boolean;testId:string}) {
  const [date,time]=formatDateTimeMDY(record.dateTime).split(' ');
  return <section className={`print-substation${continued?' print-substation-continuation':''}`} aria-hidden="true" data-testid={testId}>
    <header className="print-extended-header">
      <div><p>Columbus Division of Police · Field Training Program</p><h1>{title}</h1><b>U-10.181 (05/23)</b></div>
      <span>Complete on the first scheduled day of each phase.</span>
    </header>
    <div className="print-extended-meta">
      <span><b>Probationary Officer</b>{record.recruitName} · {record.recruitBadge}</span>
      <span><b>FTO</b>{record.ftoName} · {record.ftoBadge}</span>
       <span><b>Substation</b>{substationDisplay(record.substation)}</span>
       <span><b>Date</b>{date||'Not recorded'}</span>
       <span><b>Time</b>{time||'Not recorded'}</span>
       <span><b>Class / phase</b>{record.className||'—'} · {phaseLabel(phase)}</span>
       <span data-training-folder-page={pageReference}><b>Training-folder reference</b>{pageReference??'Training-folder reference unavailable'}</span>
    </div>
    <p className="print-extended-note">Checklist review: {record.checklistReviewedAt?'Confirmed':'Not confirmed'} · ☒ checked · ☐ unchecked. New forms start checked; review every item before treating it as completed.</p>
    <div className="print-orientation-grid">
      {sections.map(section=><section key={section.title}>
        <h2>{section.title}</h2><p className="print-orientation-description">{section.description}</p>
        <ul>{section.items.map(([key,label])=><li key={key}><b>{record.checklist[key]!==false?'☒':'☐'}</b>{label}</li>)}</ul>
      </section>)}
    </div>
    {continued&&record.directivesReview&&<p className="print-extended-note"><b>Division Directives / SOP reviewed:</b> {record.directivesReview}</p>}
    {continued&&record.narrative&&<div className="print-extended-narrative"><b>Additional narrative / continuation</b><p>{record.narrative}</p></div>}
    <footer className="print-extended-footer">Checklist review: {record.checklistReviewedAt?'Confirmed on this device':'Not confirmed'} · Local copy · not server-confirmed or electronically signed.</footer>
  </section>;
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

