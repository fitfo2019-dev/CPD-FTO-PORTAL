import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { Printer, Save, ShieldAlert } from 'lucide-react';
import { useUser } from '@clerk/react';
import { PageHead, Panel } from '@/components/bits.js';
import { SearchableSelect } from '@/components/searchable-select.js';
import { PrintableWeeklyAcknowledgement } from '@/components/printable-weekly-ack.js';
import { useToast } from '@/hooks/use-toast.js';
import { phaseAssignmentLabel, phaseLabel, uid, type Phase, type WeeklyPacketAcknowledgement } from '@/lib/model.js';
import { formatDateDMY, getPhaseWeekNumber, getSundaySaturdayWeek, getTrainingWeekNumber } from '@/lib/training-calendar.js';
import { useTimelineInterpolation, useWorkspace } from '@/state/workspace.js';

export default function WeeklyAcknowledgementPage() {
  const { ws, upsertWeeklyAcknowledgement } = useWorkspace();
  const { user, isLoaded, isSignedIn } = useUser();
  const { toast } = useToast();
  const weekOptions = useMemo(() => {
    const dates = [
      ...ws.reports.map(report => report.date),
      ...(ws.caseFolder ? [ws.caseFolder.phaseStartDate] : []),
    ];
    const weeks = new Map<string, { start: string; end: string }>();
    dates.forEach(date => {
      const week = getSundaySaturdayWeek(date);
      if (week) weeks.set(week.start, week);
    });
    return [...weeks.values()].sort((a, b) => b.start.localeCompare(a.start));
  }, [ws.reports, ws.caseFolder]);
  const [weekStart, setWeekStart] = useState(() => weekOptions[0]?.start ?? '');
  const selectedWeek = weekOptions.find(week => week.start === weekStart) ?? weekOptions[0];
  const reportsForWeek = selectedWeek
    ? ws.reports.filter(report => {
        const week = getSundaySaturdayWeek(report.date);
        return week?.start === selectedWeek.start;
      })
    : [];
  const folderReport = ws.caseFolder
    ? reportsForWeek.find(report =>
      report.recruitBadge === ws.caseFolder?.recruitBadge
      && (report.className ?? '') === (ws.caseFolder?.className ?? '')
      && report.phase === ws.caseFolder?.phase,
    )
    : undefined;
  const baseReport = folderReport ?? reportsForWeek[0];
  const recruitBadge = baseReport?.recruitBadge ?? ws.caseFolder?.recruitBadge ?? '';
  const matchingReport = reportsForWeek.find(report =>
    report.recruitBadge === recruitBadge
    && (baseReport?.className === undefined || (report.className ?? '') === (baseReport.className ?? '')),
  );
  const activeFolder = ws.caseFolder
    && ws.caseFolder.recruitBadge === recruitBadge
    && (!baseReport || (
      (ws.caseFolder.className ?? '') === (baseReport.className ?? '')
      && ws.caseFolder.phase === baseReport.phase
    ))
    ? ws.caseFolder
    : undefined;
  const assignmentSource = matchingReport ?? (activeFolder ? undefined : baseReport);
  const assignment = phaseAssignmentLabel(
    assignmentSource?.ftoAssignment ?? activeFolder?.ftoAssignment,
    assignmentSource?.shift ?? activeFolder?.shift,
    assignmentSource?.cruiserDistrict ?? activeFolder?.cruiserDistrict,
  );
  const stored = selectedWeek
    ? ws.weeklyAcknowledgements.find(ack => ack.weekStart === selectedWeek.start && ack.recruitBadge === recruitBadge)
    : undefined;
  const timeline = useTimelineInterpolation(
    selectedWeek?.start,
    recruitBadge,
    matchingReport?.className ?? activeFolder?.className,
  );

  const makeDraft = useCallback((): WeeklyPacketAcknowledgement | null => {
    if (!selectedWeek) return null;
    const now = new Date().toISOString();
    const folder = activeFolder;
    return {
      id: uid(),
      weekStart: selectedWeek.start,
      weekEnd: selectedWeek.end,
      weekNumber: folder
        ?getPhaseWeekNumber(selectedWeek.start,folder.phaseStartDate,folder.phaseWeekRanges)??getTrainingWeekNumber(selectedWeek.start,folder.phaseStartDate)??1
        :getTrainingWeekNumber(selectedWeek.start,selectedWeek?.start??'')??1,
      phase: (matchingReport?.phase ?? folder?.phase ?? baseReport?.phase ?? 1) as Phase,
      recruitName: matchingReport?.recruitName ?? folder?.recruitName ?? baseReport?.recruitName ?? '',
      recruitBadge,
      recruitAssignment: assignment,
      ftoName: matchingReport?.ftoName ?? folder?.ftoName ?? baseReport?.ftoName ?? '',
      ftoBadge: matchingReport?.ftoBadge ?? folder?.ftoBadge ?? baseReport?.ftoBadge ?? '',
      ftoAssignment: assignment,
      recruitComments: '',
      ftoComments: timeline.text,
      officeComments: '',
      signatures: {},
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
  }, [selectedWeek, activeFolder, matchingReport, baseReport, recruitBadge, assignment, timeline.text]);

  const [ack, setAck] = useState<WeeklyPacketAcknowledgement | null>(() => stored ?? makeDraft());
  const generatedCommentsRef = useRef<{ ackId: string; text: string } | null>(null);
  useEffect(() => {
    if (!ack || stored || generatedCommentsRef.current) return;
    if (ack.weekStart === selectedWeek?.start && ack.recruitBadge === recruitBadge) {
      generatedCommentsRef.current = { ackId: ack.id, text: ack.ftoComments };
    }
  }, [ack, stored, selectedWeek?.start, recruitBadge]);

  useEffect(() => {
    if (!selectedWeek || !recruitBadge) {
      generatedCommentsRef.current = null;
      if (ack) setAck(null);
      return;
    }
    if (stored) {
      if (ack?.id !== stored.id) {
        generatedCommentsRef.current = null;
        setAck(stored);
      }
      return;
    }
    if (!ack || ack.weekStart !== selectedWeek.start || ack.recruitBadge !== recruitBadge) {
      const next = makeDraft();
      generatedCommentsRef.current = next
        ? { ackId: next.id, text: next.ftoComments }
        : null;
      setAck(next);
      return;
    }
    const generated = generatedCommentsRef.current;
    if (
      generated?.ackId === ack.id
      && ack.ftoComments === generated.text
      && ack.ftoComments !== timeline.text
    ) {
      const next = { ...ack, ftoComments: timeline.text, updatedAt: new Date().toISOString() };
      generatedCommentsRef.current = { ackId: next.id, text: next.ftoComments };
      setAck(next);
    }
  }, [
    selectedWeek,
    recruitBadge,
    stored,
    ack,
    makeDraft,
    timeline.key,
    timeline.text,
  ]);

  function update<K extends keyof WeeklyPacketAcknowledgement>(key: K, value: WeeklyPacketAcknowledgement[K]) {
    setAck(current => current ? { ...current, [key]: value, updatedAt: new Date().toISOString() } : current);
  }

  function save() {
    if (!ack) return;
    upsertWeeklyAcknowledgement({ ...ack, recruitAssignment: assignment, ftoAssignment: assignment, updatedAt: new Date().toISOString() });
    toast({ title: 'Weekly acknowledgement saved locally', description: 'Use “Save locally” to encrypt it on this device.' });
  }

  if (!selectedWeek || !ack) {
    return (
      <div className="py-20 text-center">
        <p className="font-semibold">Open a phase case folder or create a daily log before starting a weekly acknowledgement.</p>
        <Link href="/" className="mt-3 inline-block font-semibold underline">Return to the case folder</Link>
      </div>
    );
  }

  const fieldClass = 'h-10 w-full rounded-sm border border-input bg-card px-3 text-sm';
  return (
    <div className="max-w-5xl">
      <PageHead kicker="Weekly Packet Acknowledgement · manual example page 48" title={ack.recruitName || 'Weekly packet'}>
        <button type="button" onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded-sm border px-4 text-sm font-bold">
          <Printer className="h-4 w-4" />Print / save PDF
        </button>
        <button type="button" onClick={save} className="inline-flex h-10 items-center gap-2 rounded-sm bg-primary px-4 text-sm font-bold text-primary-foreground">
          <Save className="h-4 w-4" />Save acknowledgement
        </button>
      </PageHead>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-sm border bg-card p-3 text-sm">
        <label className="flex items-center gap-2 font-semibold">
          Select training week
          <SearchableSelect className={fieldClass} value={selectedWeek.start} onChange={event => setWeekStart(event.target.value)}>
            {weekOptions.map(week => <option key={week.start} value={week.start}>Week of {formatDateDMY(week.start)}–{formatDateDMY(week.end)}</option>)}
          </SearchableSelect>
        </label>
        <span className="text-muted-foreground">{phaseLabel(ack.phase)} · Sunday through Saturday</span>
        <label className="flex items-center gap-2 font-semibold">Week number
          <input type="number" min={1} className={fieldClass + ' w-24'} value={ack.weekNumber} onChange={event => update('weekNumber', Math.max(1, Number(event.target.value) || 1))} />
        </label>
      </div>

      <div role="note" className="mb-4 flex gap-2 rounded-sm border border-accent bg-accent/10 p-3 text-sm">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p>The manual’s signature order is Probationary Officer → FTO → Field Training Office. This draft has no verified signatures and is not an approved packet.</p>
      </div>

      <Panel title="Weekly Packet Acknowledgement">
        <div className="grid gap-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
              <PersonField title="Probationary Officer" name={ack.recruitName} badge={ack.recruitBadge} assignment={assignment} fieldClass={fieldClass} />
              <PersonField title="Field Training Officer" name={ack.ftoName} badge={ack.ftoBadge} assignment={assignment} fieldClass={fieldClass} />
          </div>
          <CommentField label="Probationary Officer Comments" value={ack.recruitComments} onChange={value => update('recruitComments', value)} />
          <SignatureStatus label="Probationary Officer signature" signed={ack.signatures.recruit} />
          <CommentField label="FTO Comments" value={ack.ftoComments} onChange={value => update('ftoComments', value)} />
          <SignatureStatus label="FTO signature" signed={ack.signatures.fto} />
          <CommentField label="Field Training Office Comments" value={ack.officeComments} onChange={value => update('officeComments', value)} />
          <SignatureStatus label="Field Training Office signature" signed={ack.signatures.ftoOffice} />
        </div>
      </Panel>

      <Panel title="Signing status" className="mt-4">
        <div className="grid gap-3 p-4 text-sm md:grid-cols-2">
          <div className="rounded-sm border p-3">
            <b>In-site account signature</b>
            <p className="mt-1 text-muted-foreground">
              {isLoaded && isSignedIn
                ? `Signed in as ${user?.fullName || user?.primaryEmailAddress?.emailAddress}; no approved staff role is attached to this account yet.`
                : 'Sign-in is available, but no approved staff role is attached to an account yet.'}
            </p>
            {!isSignedIn && <Link href="/sign-in" className="mt-2 inline-block font-semibold underline">Sign in</Link>}
            <p className="mt-2 font-semibold text-destructive">Signature recording is disabled until server-side role, report-version, and audit checks are connected.</p>
          </div>
          <div className="rounded-sm border p-3">
            <b>Adobe certificate signature</b>
            <p className="mt-1 text-muted-foreground">Print or save the PDF, then use Adobe Acrobat’s certificate-based Digital ID process from manual pages 49–53. Validate the saved file in Acrobat.</p>
            <p className="mt-2 font-semibold text-destructive">This draft has no verified signatures and has not been submitted.</p>
          </div>
        </div>
      </Panel>

       <PrintableWeeklyAcknowledgement acknowledgement={{...ack,recruitAssignment:assignment,ftoAssignment:assignment}} />
    </div>
  );
}

function PersonField({ title, name, badge, assignment, fieldClass }: {
  title: string;
  name: string;
  badge: string;
  assignment: string;
  fieldClass: string;
}) {
  return (
    <fieldset className="grid gap-2 rounded-sm border p-3">
      <legend className="px-1 font-bold">{title}</legend>
      <Field label="Name"><input className={fieldClass + ' bg-muted'} value={name} readOnly /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Badge"><input className={fieldClass + ' bg-muted'} value={badge} readOnly /></Field>
        <Field label="FTO assignment"><input className={fieldClass + ' bg-muted'} value={assignment} readOnly /></Field>
      </div>
    </fieldset>
  );
}

function CommentField({ label, value, onChange }: { label: string; value: string; onChange(value: string): void }) {
  return (
    <label className="block space-y-1">
      <span className="label-caps">{label}</span>
      <textarea rows={4} className="w-full rounded-sm border bg-card p-3 text-sm" value={value} onChange={event => onChange(event.target.value)} />
    </label>
  );
}

function SignatureStatus({ label, signed }: { label: string; signed?: { name: string; badge: string; at: string } }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-dashed pb-3 text-sm">
      <b className="min-w-52">{label}</b>
      <span className="flex-1 border-b border-slate-500 pb-1">{signed ? `${signed.name} #${signed.badge}` : 'Awaiting verified signature'}</span>
      <span>Date</span>
      <span className="min-w-28 border-b border-slate-500 pb-1">{signed ? formatDateDMY(signed.at.slice(0, 10)) : ''}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="label-caps">{label}</span>{children}</label>;
}
