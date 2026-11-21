import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Printer } from 'lucide-react';
import { PageHead, Panel } from '@/components/bits.js';
import { SearchableSelect } from '@/components/searchable-select.js';
import { ManualDefinitionTooltip } from '@/components/manual-definition-tooltip.js';
import { PrintableWeeklySummary } from '@/components/printable-weekly-summary.js';
import { useWorkspace } from '@/state/workspace.js';
import { CATEGORY_GROUPS, DAILY_ACTIVITY_FIELDS, PHASE_PROGRAM_WEEK_START, phaseAssignmentLabel, RATINGS, SEG_CATEGORIES, RATING_LEGEND, RUN_CHECKLIST_ITEMS, RUN_SUPPLEMENT_CHECKLIST_ITEMS, PRIMARY_RUN_FORMS, SUPPLEMENTAL_RUN_FORMS, requiredSupplementalForms } from '@/lib/model.js';
import { formatDateDMY, getSundaySaturdayWeek, getTrainingWeekNumber } from '@/lib/training-calendar.js';
import { activityTotals } from '@/lib/run-activity.js';
import { weeklyRatingCount } from '@/lib/weekly-rating-counts.js';
import { ACTIVITY_MANUAL_DEFINITIONS, SEG_MANUAL_DEFINITIONS, WEEKLY_ACTIVITY_SUMMARY_DEFINITION, WEEKLY_RATING_SUMMARY_DEFINITION } from '@/lib/weekly-summary-manual-definitions.js';

export default function WeeklySummaryPage() {
  const { ws } = useWorkspace();
  const ownerKey=(report:{className?:string;recruitBadge:string;recruitName:string})=>JSON.stringify([report.className ?? '',report.recruitBadge,report.recruitName]);
  const owners=useMemo(()=>[...new Map([...ws.reports,...(ws.caseFolder?[ws.caseFolder]:[])].map(report=>[ownerKey(report),{key:ownerKey(report),name:report.recruitName,badge:report.recruitBadge,className:report.className ?? ''}])).values()]
    .sort((a,b)=>a.className.localeCompare(b.className)||a.name.localeCompare(b.name)),[ws.reports,ws.caseFolder]);
  const [selectedOwner,setSelectedOwner]=useState(()=>{
    const folder=ws.caseFolder;
    return folder ? ownerKey(folder) : owners[0]?.key ?? '';
  });
  const owner=owners.find(person=>person.key===selectedOwner) ?? owners[0];
  const ownerReports=owner ? ws.reports.filter(report=>ownerKey(report)===owner.key) : [];
  const weeks = useMemo(() => {
    const dates = [
      ...ownerReports.map(report => report.date),
      ...(ws.caseFolder && ownerKey(ws.caseFolder)===owner?.key ? [ws.caseFolder.phaseStartDate] : []),
    ];
    const unique = new Map<string, { start: string; end: string }>();
    dates.forEach(date => {
      const week = getSundaySaturdayWeek(date);
      if (week) unique.set(week.start, week);
    });
    return [...unique.values()].sort((a, b) => b.start.localeCompare(a.start));
  }, [ownerReports, ws.caseFolder, owner?.key]);
  const [selectedStart, setSelectedStart] = useState(() => weeks[0]?.start ?? '');
  const week = weeks.find(item => item.start === selectedStart) ?? weeks[0];
  const reports = week
    ? ownerReports.filter(report => getSundaySaturdayWeek(report.date)?.start === week.start)
    : [];
  const reviewedReports=reports.filter(report=>!!report.ratingsReviewedAt&&!report.limboDay);
  const completedRuns=reports.flatMap(report=>report.runs).filter(run=>run.formStatus==='complete' && !!run.checklistReviewedAt);
  const runChecklistGroups=[
    ...PRIMARY_RUN_FORMS.map(form=>({key:form.key,title:`${form.label} · ${form.formNumber}`,runs:completedRuns.filter(run=>run.runKind===form.key),items:RUN_CHECKLIST_ITEMS[form.key].map((label,index)=>({label,key:`task-${index}`}))})),
    ...SUPPLEMENTAL_RUN_FORMS.map(form=>({key:form.key,title:`${form.label}${form.formNumber ? ` · ${form.formNumber}`:''}`,runs:completedRuns.filter(run=>requiredSupplementalForms(run).includes(form.key)),items:RUN_SUPPLEMENT_CHECKLIST_ITEMS[form.key].map((label,index)=>({label,key:`supp-${form.key}-${index}`}))})),
  ];
  const selectClass = 'h-10 min-w-0 max-w-full rounded-sm border bg-card px-3 text-sm';
  const weekPhase=reports[0]?.phase??(ws.caseFolder&&ownerKey(ws.caseFolder)===owner?.key?ws.caseFolder.phase:undefined);
  const phaseFolder=weekPhase?ws.phaseFolders.find(folder=>ownerKey(folder)===owner?.key&&folder.phase===weekPhase)
    ??(ws.caseFolder&&ownerKey(ws.caseFolder)===owner?.key&&ws.caseFolder.phase===weekPhase?ws.caseFolder:undefined):undefined;
  const assignmentLabel=phaseAssignmentLabel(reports[0]?.ftoAssignment??phaseFolder?.ftoAssignment,reports[0]?.shift??phaseFolder?.shift);
  const phaseWeek=reports.find(report=>report.phase===weekPhase&&report.phaseWeek)?.phaseWeek
    ??(week&&phaseFolder?getTrainingWeekNumber(reports[0]?.date??week.start,phaseFolder.phaseStartDate):undefined);
  const weekNumber=weekPhase&&phaseWeek?PHASE_PROGRAM_WEEK_START[weekPhase]+phaseWeek-1:0;
  const title = weekNumber ? `Week ${weekNumber}` : `Week of ${formatDateDMY(week?.start ?? '')}`;
  const weekStart = week?.start ?? '';
  const weekEnd = week?.end ?? '';

  if (!week) {
    return <div className="py-20 text-center text-sm">Create a daily performance log to generate a weekly summary.</div>;
  }

  return (
    <div className="weekly-summary-page min-w-0 max-w-6xl">
      <PageHead kicker="Weekly Performance Summary · U-10.173" title={title}>
        <Link href="/reports/monthly-summary" className="inline-flex h-10 items-center rounded-sm border bg-card px-4 text-sm font-bold">Monthly Performance Summary</Link>
        <Link href="/reports/weekly-log" className="inline-flex h-10 items-center rounded-sm border bg-card px-4 text-sm font-bold">Weekly Performance Log Supplement · U-10.174S</Link>
        <button type="button" onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded-sm border bg-card px-4 text-sm font-bold">
          <Printer className="h-4 w-4" />Print / PDF
        </button>
        <Link href="/reports/weekly-ack" className="inline-flex h-10 items-center rounded-sm bg-primary px-4 text-sm font-bold text-primary-foreground">Weekly Packet Acknowledgement</Link>
      </PageHead>

      <div className="mb-4 flex flex-col items-start gap-3 rounded-sm border bg-card p-3 text-sm sm:flex-row sm:flex-wrap sm:items-center">
        {owners.length>1 && <label className="flex w-full min-w-0 flex-col gap-1 font-semibold sm:w-auto">Probationary Officer
          <SearchableSelect aria-label="Select Probationary Officer" className={selectClass} value={owner?.key ?? ''} onChange={event=>setSelectedOwner(event.target.value)} data-testid="select-weekly-officer">
            {owners.map(person=><option key={person.key} value={person.key}>{person.name} · {person.badge} · {person.className || 'Class not assigned'}</option>)}
          </SearchableSelect>
        </label>}
        <label className="flex w-full min-w-0 flex-col gap-1 font-semibold sm:w-auto sm:flex-row sm:items-center sm:gap-2">
          Select training week
          <SearchableSelect className={selectClass} value={week.start} onChange={event => setSelectedStart(event.target.value)}>
            {weeks.map(item => {
              const itemReports=ownerReports.filter(report=>getSundaySaturdayWeek(report.date)?.start===item.start);
              const itemPhase=itemReports[0]?.phase??(ws.caseFolder&&ownerKey(ws.caseFolder)===owner?.key?ws.caseFolder.phase:undefined);
              const itemFolder=itemPhase?ws.phaseFolders.find(folder=>ownerKey(folder)===owner?.key&&folder.phase===itemPhase)
                ??(ws.caseFolder&&ownerKey(ws.caseFolder)===owner?.key&&ws.caseFolder.phase===itemPhase?ws.caseFolder:undefined):undefined;
              const localWeek=itemReports.find(report=>report.phase===itemPhase&&report.phaseWeek)?.phaseWeek
                ??(itemFolder?getTrainingWeekNumber(itemReports[0]?.date??item.start,itemFolder.phaseStartDate):undefined);
              const number=itemPhase&&localWeek?PHASE_PROGRAM_WEEK_START[itemPhase]+localWeek-1:undefined;
              return <option key={item.start} value={item.start}>{number ? `Week ${number} · Phase ${itemPhase}` : 'Week of'} · {formatDateDMY(item.start)}–{formatDateDMY(item.end)}</option>;
            })}
          </SearchableSelect>
        </label>
        <span className="min-w-0 break-words text-muted-foreground">Sunday {formatDateDMY(week.start)} through Saturday {formatDateDMY(week.end)} · {weekPhase?`Phase ${weekPhase} · phase week ${phaseWeek??'not set'} · `:''}{reports.length} daily logs · FTO assignment {assignmentLabel}</span>
      </div>

      <div role="note" className="mb-4 min-w-0 break-words rounded-sm border bg-muted/60 p-3 text-sm">
        The weekly form counts how often each descriptive rating was selected on reviewed daily performance logs ({reviewedReports.length} of {reports.length} saved logs reviewed). Counts are not numerical performance scores. Run checklist totals below include only completed, reviewed forms ({completedRuns.length} this week). Activity totals come from saved daily logs on this device. Week numbering requires a phase start date from the case folder.
      </div>
      <div role="note" className="mb-4 min-w-0 break-words rounded-sm border border-primary/30 bg-primary/5 p-3 text-sm">
        Faster entry: the case folder fills each day’s PO, FTO, phase, shift, and patrol assignment; the next draft advances to that PO’s next scheduled workday. Required run supplements appear from the run selections. New run checklist items start checked; review exceptions and confirm before adding the run. No prior run results or ratings are copied forward.
      </div>

      <Panel title={
        <ManualDefinitionTooltip
          label="Weekly rating counts by SEG category"
          definition={WEEKLY_RATING_SUMMARY_DEFINITION.definition}
          reference={WEEKLY_RATING_SUMMARY_DEFINITION.reference}
          className="weekly-panel-definition-trigger"
        >
          Weekly rating counts by SEG category
        </ManualDefinitionTooltip>
      } className="mb-4">
        <div className="weekly-rating-legend border-b px-4 py-3 text-xs text-muted-foreground">
          {RATING_LEGEND.map(({code,label}) => <span key={code} className="weekly-rating-legend-item"><b className="mono">{code}</b><span>{label}</span></span>)}
        </div>
        {CATEGORY_GROUPS.map(group => (
          <div key={group} className="weekly-rating-group border-b last:border-b-0">
            <h3 className="weekly-rating-group-title">{group}</h3>
            <div className="weekly-rating-desktop">
              <table className="weekly-rating-table w-full text-sm">
                <thead><tr className="text-left"><th scope="col">Performance category</th>{RATINGS.map(rating => <th scope="col" key={rating} className={`weekly-rating-heading text-center ${rating === 'UA' || rating === 'NRT' ? 'is-flagged' : ''}`}>{rating}</th>)}</tr></thead>
                <tbody className="divide-y">
                  {SEG_CATEGORIES.filter(item => item.group === group).map(({ key, label }) => (
                    <tr key={key}>
                      <th scope="row" className="weekly-rating-category text-left">
                        <ManualDefinitionTooltip
                          label={label}
                          definition={SEG_MANUAL_DEFINITIONS[key].definition}
                          reference={SEG_MANUAL_DEFINITIONS[key].reference}
                          className="weekly-category-definition-trigger"
                        >
                          {label}
                        </ManualDefinitionTooltip>
                      </th>
                      {RATINGS.map(rating => (
                        <td key={rating} className={`weekly-rating-count text-center mono ${rating === 'UA' || rating === 'NRT' ? 'is-flagged' : ''}`}>
                          {weeklyRatingCount(reports,key,rating)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="weekly-rating-mobile">
              {SEG_CATEGORIES.filter(item => item.group === group).map(({ key, label }) => (
                <section key={key} className="weekly-rating-mobile-row">
                  <h4 className="weekly-rating-mobile-label">
                    <ManualDefinitionTooltip
                      label={label}
                      definition={SEG_MANUAL_DEFINITIONS[key].definition}
                      reference={SEG_MANUAL_DEFINITIONS[key].reference}
                      className="weekly-category-definition-trigger"
                    >
                      {label}
                    </ManualDefinitionTooltip>
                  </h4>
                  <div className="weekly-rating-mobile-counts">
                    {RATINGS.map(rating => (
                      <div key={rating} className={`weekly-rating-mobile-count ${rating === 'UA' || rating === 'NRT' ? 'is-flagged' : ''}`}>
                        <span className="mono">{rating}</span>
                        <b className="mono">{weeklyRatingCount(reports,key,rating)}</b>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        ))}
      </Panel>

      <Panel title="Completed run forms · weekly checklist totals" className="mb-4">
        {completedRuns.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No run forms have been completed and reviewed for this week yet. Draft and unreviewed runs are excluded.</p> :
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {runChecklistGroups.filter(group=>group.runs.length>0).map(group=><section key={group.key} className="min-w-0 rounded border p-3" data-testid={`run-rollup-${group.key}`}>
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-2 border-b pb-2"><h3 className="min-w-0 font-semibold text-sm">{group.title}</h3><span className="shrink-0 rounded bg-muted px-2 py-1 text-xs font-semibold">{group.runs.length} complete</span></div>
              <div className="mt-2 divide-y">{group.items.map(item=><div key={item.key} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 py-2 text-xs"><span className="min-w-0">{item.label}</span><b className="mono min-w-8 text-right">{group.runs.reduce((total,run)=>total+(run.checklist[item.key]===true?1:0),0)}</b></div>)}</div>
            </section>)}
          </div>}
      </Panel>

      <Panel title={
        <ManualDefinitionTooltip
          label="Weekly Activity Summary · Totals"
          definition={WEEKLY_ACTIVITY_SUMMARY_DEFINITION.definition}
          reference={WEEKLY_ACTIVITY_SUMMARY_DEFINITION.reference}
          className="weekly-panel-definition-trigger"
        >
          <span className="weekly-activity-title"><span>Weekly Activity Summary</span><span className="weekly-activity-title-divider" aria-hidden="true">·</span><span>Totals</span></span>
        </ManualDefinitionTooltip>
      }>
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
          {DAILY_ACTIVITY_FIELDS.map(({ key, label }) => (
            <div key={key} className="rounded-sm border p-3">
              <ManualDefinitionTooltip
                label={label}
                definition={ACTIVITY_MANUAL_DEFINITIONS[key].definition}
                reference={ACTIVITY_MANUAL_DEFINITIONS[key].reference}
                className="weekly-activity-definition-trigger text-xs text-muted-foreground"
              >
                {label}
              </ManualDefinitionTooltip>
              <b className="mono mt-1 block text-lg">{reports.reduce((total, report) => total + activityTotals(report)[key], 0)}</b>
            </div>
          ))}
        </div>
      </Panel>

      <PrintableWeeklySummary reports={reports} ratingReports={reviewedReports} weekNumber={weekNumber} weekStart={weekStart} weekEnd={weekEnd} assignment={assignmentLabel} />
    </div>
  );
}
