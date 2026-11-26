import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Printer, Save } from 'lucide-react';
import { PageHead, Panel, caseSafe } from '@/components/bits.js';
import { SearchableSelect } from '@/components/searchable-select.js';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog.js';
import { PrintableWeeklyAcknowledgement } from '@/components/printable-weekly-ack.js';
import { PrintableWeeklySummary } from '@/components/printable-weekly-summary.js';
import { PrintableWeeklyPerformanceLog } from '@/components/printable-extended-forms.js';
import { PrintableDailyForms } from '@/components/printable-daily-forms.js';
import { PrintableDailyLog } from '@/components/printable-daily-log.js';
import { useToast } from '@/hooks/use-toast.js';
import {
  CATEGORIES, CATEGORY_LABEL, PHASE_PROGRAM_WEEK_START, WEEKDAYS, phaseAssignmentLabel, uid,
  type PhaseCaseFolder, type RecordActor, type Report, type WeeklyPacketAcknowledgement, type WeeklyPerformanceLog,
} from '@/lib/model.js';
import { formatDateDMY, getPhaseWeekNumber, getSundaySaturdayWeek, localISODate } from '@/lib/training-calendar.js';
import { mergeReviewedUaEntries } from '@/lib/weekly-performance-log.js';
import { hasReviewedCorrectiveSource } from '@/lib/weekly-log-layout.js';
import { resolveOperationalPacket } from '@/lib/operational-state-machine.js';
import { week15Statement, week15StartDate, week15Window, weeklyPacketDueDate, weeklyPacketDueState, type DueState, type Week15Choice } from '@/lib/weekly-packet.js';
import { buildTimelineInterpolation } from '@/lib/timeline-interpolation.js';
import { useWorkspace } from '@/state/workspace.js';

type Tone = 'ok' | 'warn' | 'bad' | 'mut';
const TONE: Record<Tone, string> = {
  ok: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  warn: 'border-amber-300 bg-amber-50 text-amber-900',
  bad: 'border-red-300 bg-red-50 text-red-800',
  mut: 'border-border bg-muted text-muted-foreground',
};
function Chip({ tone, children, testId }: { tone: Tone; children: string; testId?: string }) {
  return <span data-testid={testId} className={`inline-flex h-6 items-center whitespace-nowrap rounded-full border px-2.5 text-[11px] font-extrabold uppercase tracking-wider ${TONE[tone]}`}>{caseSafe(children)}</span>;
}
const BTN = 'inline-flex h-10 items-center gap-2 rounded-sm border bg-card px-4 text-xs font-bold uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-50';
const BTN_PRIMARY = 'inline-flex h-10 items-center gap-2 rounded-sm bg-primary px-4 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50';
const BTN_ALERT = 'inline-flex h-10 items-center gap-2 rounded-sm border border-destructive bg-card px-4 text-xs font-bold uppercase tracking-wider text-destructive';

const ownerKey = (item: { className?: string; recruitBadge: string }) => `${item.className ?? ''}::${item.recruitBadge}`;
const isFinalized = (report: Report) => report.syncStatus === 'submitted_complete' || report.syncStatus === 'synchronized_complete';
const dayName = (iso: string) => WEEKDAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()]?.label.slice(0, 3) ?? '';
const shortDate = (iso: string) => `${dayName(iso)} ${formatDateDMY(iso)}`;

function dueChip(state: DueState): { tone: Tone; label: string } {
  switch (state.kind) {
    case 'complete': return state.daysLate ? { tone: 'warn', label: `Completed · ${state.daysLate} day${state.daysLate === 1 ? '' : 's'} late` } : { tone: 'ok', label: 'Completed on time' };
    case 'due_today': return { tone: 'warn', label: 'Due today' };
    case 'late': return { tone: 'bad', label: `Late · ${state.daysLate} day${state.daysLate === 1 ? '' : 's'}` };
    default: return { tone: 'mut', label: `Due in ${state.daysUntilDue} day${state.daysUntilDue === 1 ? '' : 's'}` };
  }
}

function ackStep(ack: WeeklyPacketAcknowledgement | undefined): { fto: Tone; po: Tone; office: Tone; ftoLabel: string; poLabel: string; officeLabel: string } {
  const s = ack?.signatures ?? {};
  return {
    fto: s.fto ? 'ok' : ack ? 'warn' : 'mut', ftoLabel: s.fto ? 'Signed' : ack ? 'Draft' : 'Not started',
    po: s.recruit ? 'ok' : 'mut', poLabel: s.recruit ? 'Signed' : 'Waiting',
    office: s.ftoOffice ? 'ok' : 'mut', officeLabel: s.ftoOffice ? `Signed · ${s.ftoOffice.name}` : 'Waiting',
  };
}

function weekRatingCounts(report: Report) {
  let ua = 0; let nrt = 0; const cats = new Set<string>();
  for (const category of CATEGORIES) {
    const rating = report.ratings[category]?.rating;
    if (rating === 'UA') { ua += 1; cats.add(CATEGORY_LABEL[category]); }
    if (rating === 'NRT') { nrt += 1; cats.add(CATEGORY_LABEL[category]); }
  }
  return { ua, nrt, categories: [...cats] };
}

interface WeekContext {
  folder?: PhaseCaseFolder;
  start: string;
  end: string;
  reports: Report[];
  programWeek?: number;
}

function useWeekContexts(ownerReports: Report[], folders: PhaseCaseFolder[]): WeekContext[] {
  return useMemo(() => {
    const weeks = new Map<string, WeekContext>();
    for (const report of ownerReports) {
      const week = getSundaySaturdayWeek(report.date);
      if (!week) continue;
      const entry = weeks.get(week.start) ?? { start: week.start, end: week.end, reports: [] };
      entry.reports.push(report);
      weeks.set(week.start, entry);
    }
    for (const entry of weeks.values()) {
      const phase = entry.reports[0]?.phase;
      entry.folder = folders.find(folder => folder.phase === phase && ownerKey(folder) === ownerKey(entry.reports[0]!));
      const phaseWeek = entry.reports.find(report => report.phaseWeek)?.phaseWeek
        ?? (entry.folder ? getPhaseWeekNumber(entry.reports[0]!.date, entry.folder.phaseStartDate, entry.folder.phaseWeekRanges) : undefined);
      if (phase && phaseWeek) entry.programWeek = PHASE_PROGRAM_WEEK_START[phase] + phaseWeek - 1;
      entry.reports.sort((a, b) => a.date.localeCompare(b.date));
    }
    return [...weeks.values()].sort((a, b) => b.start.localeCompare(a.start));
  }, [ownerReports, folders]);
}

export default function WeeklyPacketPage() {
  const { ws } = useWorkspace();
  return ws.role === 'fto_coordinator' || ws.role === 'fto_sgt' ? <OfficeWeeklyPackets /> : <FtoWeeklyPacket />;
}

function FtoWeeklyPacket() {
  const { ws, upsertWeeklyAcknowledgement, upsertWeek15Recommendation, addNrtReviewRequest } = useWorkspace();
  const { toast } = useToast();
  const today = localISODate();
  const owners = useMemo(() => [...new Map(
    [...ws.phaseFolders, ...ws.reports].map(item => [ownerKey(item), { key: ownerKey(item), name: item.recruitName, badge: item.recruitBadge, className: item.className ?? '' }]),
  ).values()].sort((a, b) => a.name.localeCompare(b.name)), [ws.phaseFolders, ws.reports]);
  const [ownerChoice, setOwnerChoice] = useState('');
  const owner = owners.find(item => item.key === ownerChoice) ?? owners.find(item => ws.caseFolder && item.key === ownerKey(ws.caseFolder)) ?? owners[0];
  const ownerReports = useMemo(() => owner ? ws.reports.filter(report => ownerKey(report) === owner.key) : [], [ws.reports, owner?.key]);
  const weeks = useWeekContexts(ownerReports, ws.phaseFolders);
  const defaultWeek = weeks.find(week => week.end < today) ?? weeks[0];
  const [weekChoice, setWeekChoice] = useState('');
  const week = weeks.find(item => item.start === weekChoice) ?? defaultWeek;
  const folder = week?.folder ?? ws.phaseFolders.find(item => owner && ownerKey(item) === owner.key);

  useEffect(() => {
    document.body.classList.add('print-weekly-packet-route');
    return () => document.body.classList.remove('print-weekly-packet-route');
  }, []);

  const storedAck = week && owner ? ws.weeklyAcknowledgements.find(ack => ack.weekStart === week.start && ack.recruitBadge === owner.badge) : undefined;
  const timeline = useMemo(() => buildTimelineInterpolation(ws.reports, week?.start, owner?.badge, owner?.className), [ws.reports, week?.start, owner?.badge, owner?.className]);
  const recommendation = owner ? ws.week15Recommendations.find(item => ownerKey(item) === owner.key) : undefined;
  const isWeek15 = week?.programWeek === 15;
  const draftComment = isWeek15 && recommendation ? `${timeline.text}${timeline.text ? '\n\n' : ''}${recommendation.statement}` : timeline.text;
  const [ftoComments, setFtoComments] = useState<string | null>(null);
  useEffect(() => setFtoComments(null), [week?.start, owner?.key]);
  const comments = ftoComments ?? storedAck?.ftoComments ?? draftComment;

  const [nrtOpen, setNrtOpen] = useState(false);

  if (!owner || !week) {
    return <div className="py-20 text-center text-sm" data-testid="weekly-packet-empty">{caseSafe('No daily records yet.')}</div>;
  }

  const actor: RecordActor = { name: folder?.ftoName ?? week.reports[0]?.ftoName ?? '', badge: folder?.ftoBadge ?? week.reports[0]?.ftoBadge ?? '', role: 'fto' };
  const due = weeklyPacketDueDate(week.end, folder?.daysOff);
  const dueState = weeklyPacketDueState(due.dueDate, today, storedAck?.signatures.fto?.at.slice(0, 10));
  const dueBadge = dueChip(dueState);
  const offDays = (folder?.daysOff ?? []).map(day => WEEKDAYS[day]?.label.slice(0, 3)).join(' · ');

  const workingDays: string[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(Date.parse(`${week.start}T12:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
    if (folder && date < folder.phaseStartDate) continue;
    if (!(folder?.daysOff ?? []).includes(new Date(`${date}T12:00:00Z`).getUTCDay() as never)) workingDays.push(date);
  }
  const finalized = week.reports.filter(isFinalized);
  const missingDays = workingDays.filter(date => !week.reports.some(report => report.date === date));
  const reviewed = week.reports.filter(report => !!report.ratingsReviewedAt && !report.limboDay);
  const unreviewed = week.reports.filter(report => !report.ratingsReviewedAt && !report.limboDay).length;

  const storedLog = ws.weeklyPerformanceLogs.find(log => log.weekStart === week.start && log.recruitBadge === owner.badge && (log.className ?? '') === owner.className);
  const first = week.reports[0]!;
  const baseLog: WeeklyPerformanceLog = storedLog ?? {
    id: uid(), weekStart: week.start, weekEnd: week.end, weekNumber: week.programWeek ?? 1, phase: first.phase, phaseWeek: first.phaseWeek, ftoWeek: first.ftoWeek,
    className: first.className ?? '', recruitName: first.recruitName, recruitBadge: first.recruitBadge, ftoName: first.ftoName, ftoBadge: first.ftoBadge, entries: [], updatedAt: new Date().toISOString(),
  };
  const log = mergeReviewedUaEntries(baseLog, week.reports, ws.assignments, folder);
  const logNeedsReview = log.entries.filter(entry => entry.kind === 'corrective' && !hasReviewedCorrectiveSource(entry)).length;
  const runs = week.reports.flatMap(report => report.runs);
  const completedRuns = runs.filter(run => run.formStatus === 'complete');
  const assignment = phaseAssignmentLabel(first.ftoAssignment ?? folder?.ftoAssignment, first.shift ?? folder?.shift, first.cruiserDistrict ?? folder?.cruiserDistrict);

  const ack: WeeklyPacketAcknowledgement = storedAck ? { ...storedAck, ftoComments: comments } : {
    id: uid(), weekStart: week.start, weekEnd: week.end, weekNumber: week.programWeek ?? 1, phase: first.phase,
    recruitName: first.recruitName, recruitBadge: first.recruitBadge, recruitAssignment: assignment,
    ftoName: actor.name, ftoBadge: actor.badge, ftoAssignment: assignment,
    recruitComments: '', ftoComments: comments, officeComments: '', signatures: {}, status: 'draft',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  const steps = ackStep(storedAck);

  const saveDraft = () => {
    upsertWeeklyAcknowledgement({ ...ack, ftoComments: comments, updatedAt: new Date().toISOString() });
    toast({ title: 'Weekly packet draft saved' });
  };

  const choose = (choice: Week15Choice) => {
    if (!folder) return;
    const at = new Date().toISOString();
    const statement = week15Statement(choice, owner.name);
    const next = recommendation
      ? { ...recommendation, choice, statement, history: [{ choice, at, by: actor }, ...recommendation.history], alertStatus: (choice === 'not_release' || recommendation.choice === 'not_release') ? 'queued' as const : recommendation.alertStatus, updatedAt: at }
      : { id: uid(), className: owner.className, recruitName: owner.name, recruitBadge: owner.badge, choice, statement, history: [{ choice, at, by: actor }], alertStatus: choice === 'not_release' ? 'queued' as const : 'none' as const, updatedAt: at };
    upsertWeek15Recommendation(next);
  };

  const phaseFourFolder = ws.phaseFolders.find(item => item.phase === 4 && ownerKey(item) === owner.key);
  const window15 = phaseFourFolder ? week15Window(phaseFourFolder, today, !!recommendation) : 'not_phase_four';
  const week15Start = phaseFourFolder ? week15StartDate(phaseFourFolder) : undefined;
  const showWeek15 = !!phaseFourFolder && first.phase === 4;
  const locked = !!recommendation?.finalizedAt;

  const parts: { n: number; name: string; source: string; chip: { tone: Tone; label: string }; href: string; action: string }[] = [
    { n: 1, name: 'Weekly Comment/Signature', source: storedAck ? `Last saved ${formatDateDMY(storedAck.updatedAt.slice(0, 10))}` : "FTO comment drafted from this week's DOR's",
      chip: storedAck?.signatures.ftoOffice ? { tone: 'ok', label: 'Complete' } : storedAck?.signatures.recruit ? { tone: 'warn', label: 'Awaiting FTO Office' } : storedAck?.signatures.fto ? { tone: 'warn', label: 'Awaiting PO' } : { tone: 'warn', label: 'FTO comment needed' },
      href: '#weekly-comment', action: 'Open' },
    { n: 2, name: 'Weekly Performance Summary', source: `Rating counts from ${reviewed.length} reviewed DOR's`,
      chip: unreviewed ? { tone: 'warn', label: `Needs review · ${unreviewed}` } : { tone: 'ok', label: 'Ready' }, href: '/reports/weekly-summary', action: 'Review' },
    { n: 3, name: 'Weekly Performance Log', source: `${log.entries.length} entr${log.entries.length === 1 ? 'y' : 'ies'} merged from DOR's`,
      chip: logNeedsReview ? { tone: 'warn', label: `Needs review · ${logNeedsReview}` } : { tone: 'ok', label: 'Ready' }, href: '/reports/weekly-log', action: 'Edit' },
    { n: 4, name: 'Daily Performance Summaries', source: week.reports.map(report => shortDate(report.date)).join(' · '),
      chip: missingDays.length ? { tone: 'bad', label: `Missing · ${missingDays.length}` } : finalized.length === week.reports.length ? { tone: 'ok', label: `${finalized.length} of ${week.reports.length} finalized` } : { tone: 'warn', label: `${finalized.length} of ${week.reports.length} finalized` },
      href: '/reports', action: 'View' },
    { n: 5, name: 'Daily Checklist Forms', source: `${completedRuns.length} completed run checklist${completedRuns.length === 1 ? '' : 's'}`,
      chip: completedRuns.length === runs.length ? { tone: 'ok', label: 'Ready' } : { tone: 'warn', label: `Incomplete · ${runs.length - completedRuns.length}` }, href: '/reports', action: 'View' },
  ];

  return (
    <div className="weekly-packet-page min-w-0 max-w-6xl" data-testid="weekly-packet-page">
      <PageHead kicker={`Weekly Packet · Phase ${['', 'I', 'II', 'III', 'IV'][first.phase]}${week.programWeek ? ` · Week ${week.programWeek}` : ''}`} title={`PO ${owner.name} #${owner.badge}`}>
        <button type="button" className={BTN_PRIMARY} onClick={() => window.print()} data-testid="button-print-full-packet"><Printer className="h-4 w-4" />Print full packet</button>
        <button type="button" className={BTN_ALERT} onClick={() => setNrtOpen(true)} data-testid="button-nrt-review-request">NRT review request</button>
      </PageHead>

      <div className="mb-4 flex flex-wrap items-stretch gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 rounded-sm border bg-card p-3 text-sm">
          {owners.length > 1 && <SearchableSelect aria-label="Probationary Officer" className="h-10 rounded-sm border bg-card px-3 text-sm" value={owner.key} onChange={event => { setOwnerChoice(event.target.value); setWeekChoice(''); }} data-testid="select-packet-po">
            {owners.map(item => <option key={item.key} value={item.key}>{item.name} · {item.badge}</option>)}
          </SearchableSelect>}
          <SearchableSelect aria-label="Training week" className="h-10 rounded-sm border bg-card px-3 text-sm" value={week.start} onChange={event => setWeekChoice(event.target.value)} data-testid="select-packet-week">
            {weeks.map(item => <option key={item.start} value={item.start}>{item.programWeek ? `Week ${item.programWeek} · ` : ''}{formatDateDMY(item.start)}–{formatDateDMY(item.end)}</option>)}
          </SearchableSelect>
          <span className="text-muted-foreground">Sunday {formatDateDMY(week.start)} through Saturday {formatDateDMY(week.end)}</span>
        </div>
        <div className="min-w-64 rounded-sm border bg-card p-3" data-testid="weekly-packet-due">
          <div className="label-caps">Due</div>
          <div className="text-lg font-extrabold">{shortDate(due.dueDate)} · 23:59</div>
          <div className="mt-1 flex flex-wrap items-center gap-2"><Chip tone={dueBadge.tone} testId="chip-due-state">{dueBadge.label}</Chip>{offDays && <span className="text-xs text-muted-foreground">Off days {offDays}</span>}</div>
        </div>
      </div>

      <Panel title="Packet contents">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-packet-contents">
            <thead><tr className="border-b text-left"><th className="label-caps p-3">#</th><th className="label-caps p-3">Form</th><th className="label-caps p-3">Built from</th><th className="label-caps p-3">Status</th><th className="p-3" /></tr></thead>
            <tbody>{parts.map(part => <tr key={part.n} className="border-b last:border-0">
              <td className="p-3">{part.n}</td>
              <td className="p-3 font-bold">{part.name}</td>
              <td className="p-3 text-xs text-muted-foreground">{caseSafe(part.source)}</td>
              <td className="p-3"><Chip tone={part.chip.tone}>{part.chip.label}</Chip></td>
              <td className="p-3 text-right">{part.href.startsWith('#') ? <a className={BTN + ' h-8'} href={part.href}>{part.action}</a> : <Link className={BTN + ' h-8'} href={part.href}>{part.action}</Link>}</td>
            </tr>)}</tbody>
          </table>
        </div>
        {missingDays.length > 0 && <div className="border-t px-4 py-2 text-xs text-destructive" data-testid="missing-dor-days">{missingDays.map(shortDate).join(' · ')}</div>}
      </Panel>

      {showWeek15 && <Panel title="Week 15 recommendation" className="mt-4">
        <div className="grid gap-3 p-4" data-testid="week15-panel">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">{week15Start ? `Pre-selection before ${shortDate(week15Start)}` : ''}</span>
            {recommendation ? <Chip tone={recommendation.choice === 'release' ? 'ok' : 'bad'} testId="chip-week15">{recommendation.choice === 'release' ? 'Release' : 'Not release'}</Chip>
              : <Chip tone={window15 === 'overdue' ? 'bad' : 'mut'} testId="chip-week15">{window15 === 'overdue' ? 'Overdue' : 'Not selected'}</Chip>}
          </div>
          {(['release', 'not_release'] as Week15Choice[]).map(choice => {
            const selected = recommendation?.choice === choice;
            return <label key={choice} className={`flex cursor-pointer gap-3 rounded-sm border p-3 ${selected ? (choice === 'release' ? 'border-primary ring-2 ring-primary/20' : 'border-destructive ring-2 ring-destructive/15') : ''}`}>
              <input type="radio" name="week15" className="mt-1" checked={selected} disabled={locked} onChange={() => choose(choice)} data-testid={`radio-week15-${choice}`} />
              <span><span className="block text-xs font-extrabold uppercase tracking-wider">{choice === 'release' ? 'Release' : 'Not release'}</span><span className="text-sm">“{week15Statement(choice, owner.name)}”</span></span>
            </label>;
          })}
          {recommendation?.alertStatus === 'queued' && <div className="flex items-center gap-2 rounded-sm border border-destructive bg-red-50 p-3 text-sm" data-testid="week15-alert"><Chip tone="bad">Queued</Chip>FTO Coordinators and FTO Sergeant · {formatDateDMY(recommendation.updatedAt.slice(0, 10))} {recommendation.updatedAt.slice(11, 16)}</div>}
          {recommendation && <ol className="border-t pt-2 text-xs text-muted-foreground" data-testid="week15-history">{recommendation.history.map(change => <li key={change.at}>{change.choice === 'release' ? 'RELEASE' : 'NOT RELEASE'} · {change.by.name} #{change.by.badge} · {formatDateDMY(change.at.slice(0, 10))} {change.at.slice(11, 16)}</li>)}</ol>}
        </div>
      </Panel>}

      <Panel title="Weekly Comment/Signature" className="mt-4" id="weekly-comment">
        <div className="grid gap-3 p-4">
          <div className="grid overflow-hidden rounded-sm border sm:grid-cols-3" data-testid="ack-steps">
            {[['1 · FTO comment', steps.ftoLabel, steps.fto], ['2 · PO comment', steps.poLabel, steps.po], ['3 · FTO Office', steps.officeLabel, steps.office]].map(([title, label, tone]) =>
              <div key={title} className={`border-b p-3 sm:border-b-0 sm:border-r last:border-0 ${tone === 'ok' ? 'bg-emerald-50' : tone === 'warn' ? 'bg-sky-50' : 'bg-muted'}`}><div className="text-[11px] font-extrabold uppercase tracking-wider">{title}</div><div className="text-xs text-muted-foreground">{label}</div></div>)}
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div><div className="label-caps">Probationary Officer</div>{first.recruitName} · #{first.recruitBadge} · {assignment}</div>
            <div><div className="label-caps">Field Training Officer</div>{actor.name} · #{actor.badge} · {assignment}</div>
          </div>
          <label className="block"><span className="label-caps">FTO Comments</span>
            <textarea rows={6} className="mt-1 w-full rounded-sm border bg-card p-3 text-sm" value={comments} onChange={event => setFtoComments(event.target.value)} disabled={!!storedAck?.signatures.fto} data-testid="textarea-fto-comments" /></label>
          <label className="block"><span className="label-caps">Probationary Officer Comments</span>
            <textarea rows={3} className="mt-1 w-full rounded-sm border bg-muted p-3 text-sm" value={storedAck?.recruitComments ?? ''} readOnly /></label>
          <label className="block"><span className="label-caps">Field Training Office Comments</span>
            <textarea rows={3} className="mt-1 w-full rounded-sm border bg-muted p-3 text-sm" value={storedAck?.officeComments ?? ''} readOnly /></label>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={BTN} onClick={saveDraft} data-testid="button-save-packet-draft"><Save className="h-4 w-4" />Save local draft</button>
            <button type="button" className={BTN_PRIMARY} disabled data-testid="button-sign-send-po">Sign and send to PO</button>
          </div>
        </div>
      </Panel>

      <NrtReviewDialog open={nrtOpen} onOpenChange={setNrtOpen} reports={ownerReports} onSubmit={(reportIds, summary) => {
        addNrtReviewRequest({ id: uid(), className: owner.className, recruitName: owner.name, recruitBadge: owner.badge, phase: first.phase, reportIds, summary, requestedBy: actor, createdAt: new Date().toISOString(), alertStatus: 'queued' });
        setNrtOpen(false);
        toast({ title: 'NRT review request queued' });
      }} />

      <PrintableWeeklyAcknowledgement acknowledgement={ack} />
      <PrintableWeeklySummary reports={week.reports} ratingReports={reviewed} weekNumber={week.programWeek ?? 0} weekStart={week.start} weekEnd={week.end} assignment={assignment} />
      <PrintableWeeklyPerformanceLog log={log} />
      {week.reports.map(report => {
        const packet = resolveOperationalPacket(report, ws.phaseFolders, ws.substationOrientations);
        return <div key={report.id} className="weekly-packet-daily">
          <PrintableDailyForms report={report} orientation={packet.orientation} dayReference={packet.dayReference} packet={packet} />
          <PrintableDailyLog report={report} dayReference={packet.dayReference} packet={packet} />
        </div>;
      })}
    </div>
  );
}

function NrtReviewDialog({ open, onOpenChange, reports, onSubmit }: { open: boolean; onOpenChange(open: boolean): void; reports: Report[]; onSubmit(reportIds: string[], summary: string): void }) {
  const candidates = useMemo(() => reports.filter(report => !report.limboDay).map(report => ({ report, ...weekRatingCounts(report) })).filter(item => item.ua || item.nrt).sort((a, b) => b.report.date.localeCompare(a.report.date)), [reports]);
  const [selected, setSelected] = useState<string[]>([]);
  const [summary, setSummary] = useState('');
  useEffect(() => { if (open) { setSelected(candidates.filter(item => item.nrt).map(item => item.report.id)); setSummary(''); } }, [open, candidates]);
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-xl" data-testid="dialog-nrt-review">
      <DialogTitle className="text-xs font-extrabold uppercase tracking-wider">NRT review request</DialogTitle>
      <div className="label-caps">{caseSafe("Supporting DOR's")}</div>
      <div className="max-h-64 overflow-y-auto rounded-sm border">
        {candidates.map(item => <label key={item.report.id} className="flex items-center gap-2 border-b p-2 text-sm last:border-0">
          <input type="checkbox" checked={selected.includes(item.report.id)} onChange={event => setSelected(current => event.target.checked ? [...current, item.report.id] : current.filter(id => id !== item.report.id))} />
          <span>{shortDate(item.report.date)} · {item.nrt ? `${item.nrt} NRT · ` : ''}{item.ua ? `${item.ua} UA · ` : ''}{item.categories.join(', ')}</span>
        </label>)}
      </div>
      <label className="block"><span className="label-caps">Summary</span><textarea rows={4} className="mt-1 w-full rounded-sm border bg-card p-3 text-sm" value={summary} onChange={event => setSummary(event.target.value)} data-testid="textarea-nrt-review-summary" /></label>
      <div className="flex justify-end gap-2">
        <button type="button" className={BTN} onClick={() => onOpenChange(false)}>Cancel</button>
        <button type="button" className={BTN_ALERT} disabled={!selected.length || !summary.trim()} onClick={() => onSubmit(selected, summary.trim())} data-testid="button-send-nrt-review">Send to Coordinators and Sergeant</button>
      </div>
    </DialogContent>
  </Dialog>;
}

function OfficeWeeklyPackets() {
  const { ws } = useWorkspace();
  const today = localISODate();
  const alerts = [
    ...ws.week15Recommendations.filter(item => item.choice === 'not_release').map(item => ({ key: item.id, tone: 'bad' as Tone, label: 'Not release', who: `PO ${item.recruitName} #${item.recruitBadge}`, detail: item.history[0] ? `${item.history[0].by.name} #${item.history[0].by.badge} · Phase IV` : 'Phase IV', at: item.updatedAt })),
    ...ws.nrtReviewRequests.map(item => ({ key: item.id, tone: 'bad' as Tone, label: 'NRT review request', who: `PO ${item.recruitName} #${item.recruitBadge}`, detail: `${item.reportIds.length} DOR's linked · Phase ${['', 'I', 'II', 'III', 'IV'][item.phase]}`, at: item.createdAt })),
    ...ws.reports.filter(report => isFinalized(report) && !report.limboDay).flatMap(report => CATEGORIES.filter(category => report.ratings[category]?.rating === 'NRT').map(category => ({ key: `${report.id}-${category}`, tone: 'bad' as Tone, label: 'NRT', who: `PO ${report.recruitName} #${report.recruitBadge}`, detail: `${CATEGORY_LABEL[category]} · DOR ${formatDateDMY(report.date)}`, at: report.updatedAt ?? report.date }))),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const rows = ws.phaseFolders.map(folder => {
    const folderReports = ws.reports.filter(report => report.phase === folder.phase && ownerKey(report) === ownerKey(folder));
    const weekEnds = [...new Set(folderReports.map(report => getSundaySaturdayWeek(report.date)?.end).filter((end): end is string => !!end && end < today))].sort();
    const lastEnd = weekEnds.at(-1);
    const lastStart = lastEnd ? getSundaySaturdayWeek(lastEnd)?.start : undefined;
    const ack = lastStart ? ws.weeklyAcknowledgements.find(item => item.weekStart === lastStart && item.recruitBadge === folder.recruitBadge) : undefined;
    const due = lastEnd ? weeklyPacketDueDate(lastEnd, folder.daysOff) : undefined;
    const state = due ? weeklyPacketDueState(due.dueDate, today, ack?.signatures.fto?.at.slice(0, 10)) : undefined;
    return { folder, due, state, steps: ackStep(ack), ack };
  });

  return <div className="min-w-0 max-w-6xl" data-testid="weekly-packet-office">
    <PageHead kicker="Weekly Packets" title="Packet status" />
    <Panel title="Alerts">
      {alerts.length === 0 ? <div className="p-4 text-sm text-muted-foreground">None</div> :
        <table className="w-full text-sm" data-testid="table-packet-alerts"><tbody>{alerts.map(alert => <tr key={alert.key} className="border-b last:border-0">
          <td className="p-3"><Chip tone={alert.tone}>{alert.label}</Chip></td><td className="p-3"><b>{alert.who}</b> · {caseSafe(alert.detail)}</td><td className="p-3 text-xs text-muted-foreground">{formatDateDMY(alert.at.slice(0, 10))}</td>
        </tr>)}</tbody></table>}
    </Panel>
    <Panel title="Weekly packets" className="mt-4">
      <div className="overflow-x-auto"><table className="w-full text-sm" data-testid="table-office-packets">
        <thead><tr className="border-b text-left">{['PO', 'FTO', 'Phase', 'Due', 'FTO', 'PO', 'FTO Office'].map((head, index) => <th key={index} className="label-caps p-3">{head}</th>)}</tr></thead>
        <tbody>{rows.map(row => {
          const lateChip = row.state ? dueChip(row.state) : undefined;
          return <tr key={`${ownerKey(row.folder)}-${row.folder.phase}`} className="border-b last:border-0">
            <td className="p-3">{row.folder.recruitName} #{row.folder.recruitBadge}</td>
            <td className="p-3">{row.folder.ftoName} #{row.folder.ftoBadge}</td>
            <td className="p-3">{['', 'I', 'II', 'III', 'IV'][row.folder.phase]}</td>
            <td className="p-3">{row.due ? shortDate(row.due.dueDate) : '—'}</td>
            <td className="p-3">{row.steps.fto !== 'ok' && lateChip && row.state?.kind !== 'not_due' ? <Chip tone={lateChip.tone}>{lateChip.label}</Chip> : <Chip tone={row.steps.fto}>{row.steps.ftoLabel}</Chip>}</td>
            <td className="p-3"><Chip tone={row.steps.po}>{row.steps.poLabel}</Chip></td>
            <td className="p-3"><Chip tone={row.steps.office}>{row.steps.officeLabel}</Chip></td>
          </tr>;
        })}</tbody>
      </table></div>
    </Panel>
  </div>;
}
