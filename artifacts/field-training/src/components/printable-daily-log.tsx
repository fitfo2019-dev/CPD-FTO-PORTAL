import React from 'react';
import {
  SEG_CATEGORIES,
  SEG_RATING_COLUMNS,
  SEG_RATING_GROUP_LABELS,
  phaseAssignmentLabel,
  ratingLabel,
  shiftDisplayLabel,
  type Report,
} from '@/lib/model.js';
import { formatDateDMY, getSundaySaturdayWeek, type TrainingFolderDayReference } from '@/lib/training-calendar.js';
import { activityTotals } from '@/lib/run-activity.js';
import { dailyLogContinuations } from '@/lib/narrative-continuation.js';
import { buildOperationalPacket, type OperationalPacket } from '@/lib/operational-state-machine.js';
import { PrintableColumbusFooterMarks, PrintableColumbusHeader } from '@/components/printable-columbus-header.js';
import { PrintDocument } from '@/components/print-template.js';
import { PrintActivityTotals } from '@/components/print-activity-totals.js';

const RATINGS = ['NO', 'A', 'RT', 'UA', 'NRT'] as const;

export function PrintableDailyLog({ report, dayReference, packet:providedPacket }: { report: Report; dayReference?: TrainingFolderDayReference; packet?:OperationalPacket }) {
  const week = getSundaySaturdayWeek(report.date);
  const weekLabel = week ? `${formatDateDMY(week.start)}–${formatDateDMY(week.end)}` : '—';
  const packet = providedPacket ?? buildOperationalPacket(report, { dayReference });
  const pageReference = packet.pages.find(page => page.kind === 'daily_summary')?.reference;
  const continuationPages = packet.pages.filter(page => page.kind === 'daily_continuation');
  const activityCounts = activityTotals(report);
  const continuations=dailyLogContinuations(report);
  const noteValue=(label:string,value:string)=>{
    const index=continuations.findIndex(page=>page.label===label);
    return index<0?value:`See narrative continuation ${continuationPages[index]?.reference??''}.`;
  };
  const ratingColumns = SEG_RATING_COLUMNS;
  const ratingRows = ratingColumns.map(column => column.flatMap(group => [
    { type: 'group' as const, group },
    ...SEG_CATEGORIES.filter(item => item.group === group).map(item => ({ type: 'category' as const, item })),
  ]));
  const ratingRowCount = Math.max(...ratingRows.map(column => column.length));
  return (
    <><PrintDocument as="section" landscape className="print-form" aria-hidden="true" data-testid="print-daily-log">
      <header className="print-form-header">
        <div>
          <PrintableColumbusHeader formId="U-10.174" />
          <h1>Probationary Officer Daily Performance Summary</h1>
          <p className="print-form-number">Daily Performance Summary · U-10.174</p>
        </div>
        <div className="print-reference">
          <span>Phase {report.phase}</span>
          <span>Week dates {weekLabel}</span>
          <b className="print-folder-page-reference" data-training-folder-page={pageReference}>{pageReference ?? 'Training-folder reference unavailable'}</b>
        </div>
      </header>

      <div className="print-meta-grid">
        <PrintField label="FTO" value={`${report.ftoName} · Badge ${report.ftoBadge}`} />
        <PrintField label="Probationary Officer" value={`${report.recruitName} · Badge ${report.recruitBadge}`} />
        <PrintField label="Date" value={formatDateDMY(report.date)} />
        <PrintField label="Time" value={report.shiftStartTime||'Not recorded'} />
        <PrintField label="Shift" value={shiftDisplayLabel(report.shift)} />
        <PrintField label="FTO assignment" value={phaseAssignmentLabel(report.ftoAssignment,report.shift,report.cruiserDistrict)} />
        <PrintField label="Training week" value={weekLabel} />
      </div>

      <div className="print-rating-instructions">
        <b>Performance Categories</b>
        {report.limboDay
          ? <span>Limbo day — record the paperwork and activity; leave ratings blank.</span>
          : <span>For each row, mark one box. Read the rating key below.</span>}
      </div>

      <div className="print-legend" aria-label="Rating key">
        {RATINGS.map(rating => <span key={rating}><b>{rating}</b><span>{ratingLabel(rating)}</span></span>)}
      </div>

      <div className="print-daily-tables"><div className="print-rating-columns">
        <table className="print-rating-table">
          <colgroup>
            {ratingColumns.flatMap((_, blockIndex) => [
              <col key={`category-${blockIndex}`} className="print-rating-label-column" />,
              ...RATINGS.map(rating => <col key={`rating-${blockIndex}-${rating}`} className="print-rating-choice-column" />),
            ])}
          </colgroup>
          <thead>
            <tr>
              {ratingColumns.flatMap((_, blockIndex) => [
                <th key={`category-heading-${blockIndex}`}>Category</th>,
                ...RATINGS.map(rating => <th key={`rating-heading-${blockIndex}-${rating}`}>{rating}</th>),
              ])}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: ratingRowCount }, (_, rowIndex) => (
              <tr key={`rating-row-${rowIndex}`}>
                {ratingRows.map((column, blockIndex) => {
                  const entry = column[rowIndex];
                  if (!entry) {
                    return Array.from({ length: 6 }, (_, cellIndex) => <td key={`blank-${blockIndex}-${cellIndex}`} className="print-rating-empty" />);
                  }
                  if (entry.type === 'group') {
                    return <td key={`group-${blockIndex}-${entry.group}`} colSpan={6} className="print-rating-group-cell">{SEG_RATING_GROUP_LABELS[entry.group] ?? entry.group}</td>;
                  }
                  const { key, label } = entry.item;
                  const notApplicable=report.notApplicableCategories?.includes(key)===true
                    && !report.checklistDeficiencies?.some(group=>group.category===key)
                    && report.ratings[key]?.rating!=='UA';
                  return [
                    <td key={`category-${blockIndex}-${key}`} className="print-rating-label-cell">{label}{notApplicable?' (N/A)':''}</td>,
                    ...RATINGS.map(rating => (
                      <td key={`rating-${blockIndex}-${key}-${rating}`} className="print-rating-cell">
                        <span className={(notApplicable ? 'NO' : report.ratings[key]?.rating) === rating ? 'is-selected' : ''} aria-label={(notApplicable ? 'NO' : report.ratings[key]?.rating) === rating ? `Selected ${rating}` : 'Not selected'} />
                      </td>
                    )),
                  ];
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="print-activity-section">
        <div className="print-activity-heading">
          <b>Daily Activity Summary</b>
          <span>Enter or review the count for each item. A zero means none were recorded.</span>
        </div>
        <div className="print-activity-columns">
          <PrintActivityTotals totals={activityCounts} blocks={4} countLabel="Count"/>
        </div>
      </section>
      </div>
      <div className="print-notes-grid">
        <PrintText label="FTO comments / shift narrative" value={noteValue('FTO comments / shift narrative',report.narrative)} />
        <PrintText label="Corrective training / retraining" value={noteValue('Corrective training / retraining',report.remedial)} />
      </div>
      <footer className="print-form-footer">
        {report.status === 'draft' ? 'Local draft' : 'Local record'} · Not server-confirmed
        <PrintableColumbusFooterMarks />
      </footer>
    </PrintDocument>
    {continuations.map((page,index)=>{
      const reference=continuationPages[index]?.reference;
      return <PrintDocument key={index} className="print-form print-daily-narrative-continuation">
        <header className="print-form-header"><div><PrintableColumbusHeader formId="U-10.174" /><p>Daily Performance Summary · U-10.174 · Narrative continuation</p><h1>{page.label}</h1></div><b data-training-folder-page={reference}>{reference}</b></header>
        <p>{report.recruitName} · {report.recruitBadge} · {formatDateDMY(report.date)} · FTO {report.ftoName} · {report.ftoBadge}</p>
        <p className="print-daily-continuation-text">{page.text}</p>
        <footer className="print-form-footer">Continuation {page.part} of {page.total} · Local copy · Not server-confirmed<PrintableColumbusFooterMarks /></footer>
      </PrintDocument>;
    })}</>
  );
}

function PrintField({ label, value }: { label: string; value: string }) {
  return <div className="print-field"><span>{label}</span><b>{value || '—'}</b></div>;
}

function PrintText({ label, value }: { label: string; value: string }) {
  return <div className="print-text"><b>{label}</b><p>{value || ' '}</p></div>;
}
