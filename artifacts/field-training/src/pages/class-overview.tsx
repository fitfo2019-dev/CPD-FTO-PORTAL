import { useMemo, useState } from 'react';
import { useUser } from '@clerk/react';
import { Link } from 'wouter';
import { ArrowLeft, Download, Filter, Users } from 'lucide-react';
import { useWorkspace } from '@/state/workspace';
import { CATEGORIES, CATEGORY_LABEL, DAILY_ACTIVITY_FIELDS, RATING_LEGEND, evaluationProgress, canViewClass, type Report } from '@/lib/model';
import { PageHead, Panel, StatusPill, RatingChip } from '@/components/bits';
import { SearchableSelect } from '@/components/searchable-select';
import { formatDateDMY } from '@/lib/training-calendar';
import { activityTotals } from '@/lib/run-activity';
import { ensureWeeklyUaLogs } from '@/lib/weekly-performance-log';

type RatingCode = 'UA' | 'NRT';
const officerKey = (report: Pick<Report, 'recruitBadge'|'recruitName'>) => `${report.recruitBadge}:${report.recruitName}`;
const classOfficerKey = (className: string | undefined, badge: string) => `${className?.trim().toLocaleLowerCase() ?? ''}:${badge.trim().toLocaleLowerCase()}`;
const activityLabel = Object.fromEntries(DAILY_ACTIVITY_FIELDS.map(field=>[field.key,field.label])) as Record<string,string>;

export default function ClassOverview() {
  const { ws } = useWorkspace();
  const { user } = useUser();
  const [selectedClass, setSelectedClass] = useState(()=>new URLSearchParams(window.location.search).get('class')??'');
  const [selectedOfficer, setSelectedOfficer] = useState(()=>new URLSearchParams(window.location.search).get('officer')??'');
  const [followUpOnly, setFollowUpOnly] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const canExportClassWorkbook = ws.role === 'fto_coordinator';
  const signedInEmail = user?.primaryEmailAddress?.emailAddress.trim().toLocaleLowerCase();
  const signedInFto = signedInEmail
    ? ws.ftoDirectory.find(entry => entry.email?.trim().toLocaleLowerCase() === signedInEmail)
    : undefined;
  const visibleAssignments = useMemo(() => ws.role === 'fto'
    ? signedInFto
      ? ws.assignments.filter(item => item.ftoBadge.trim().toLocaleLowerCase() === signedInFto.badge.trim().toLocaleLowerCase())
      : []
    : ws.assignments, [ws.role, ws.assignments, signedInFto]);
  const allowedOfficerKeys = useMemo(() => new Set(visibleAssignments.map(item => classOfficerKey(item.className, item.recruitBadge))), [visibleAssignments]);
  const visibleReports = useMemo(() => ws.role === 'fto'
    ? ws.reports.filter(report => allowedOfficerKeys.has(classOfficerKey(report.className, report.recruitBadge)))
    : ws.reports, [ws.role, ws.reports, allowedOfficerKeys]);
  const allowedOfficerBadges = useMemo(() => new Set(visibleAssignments.map(item => item.recruitBadge.trim().toLocaleLowerCase())), [visibleAssignments]);
  const classes = useMemo(() => [...new Set([...visibleReports,...visibleAssignments].map(report => report.className?.trim()).filter((name): name is string => !!name))].sort(), [visibleReports,visibleAssignments]);
  const roster = visibleAssignments.filter(item=>!selectedClass||item.className===selectedClass);
  const selectedReports = useMemo(() => visibleReports.filter(report => {
    if (selectedClass && (report.className?.trim() ?? '') !== selectedClass) return false;
     if (selectedOfficer && officerKey(report) !== selectedOfficer) return false;
    if (followUpOnly && !CATEGORIES.some(category => ['UA','NRT'].includes(report.ratings?.[category]?.rating ?? ''))) return false;
    return true;
  }).sort((a,b) => b.date.localeCompare(a.date)), [visibleReports, selectedClass, selectedOfficer, followUpOnly]);
  const officers = useMemo(() => [...new Map(selectedReports.map(report => [
    officerKey(report),
    { key: officerKey(report), name: report.recruitName, badge: report.recruitBadge },
  ])).values()].sort((a,b)=>a.name.localeCompare(b.name)||a.badge.localeCompare(b.badge)), [selectedReports]);
  const buckets = useMemo(() => {
    const map = new Map<string, Map<string, { name:string; badge:string; reports:Report[] }>>();
    selectedReports.forEach(report => {
      const className = report.className?.trim() || 'Class not assigned';
      if (!map.has(className)) map.set(className, new Map());
      const classBucket = map.get(className)!;
      const key = officerKey(report);
      if (!classBucket.has(key)) classBucket.set(key, { name:report.recruitName, badge:report.recruitBadge, reports:[] });
      classBucket.get(key)!.reports.push(report);
    });
    return [...map.entries()].map(([className, probationers]) => ({ className, probationers: [...probationers.values()].map(person => ({...person,reports:person.reports.sort((a,b)=>b.date.localeCompare(a.date))})) }));
  }, [selectedReports]);
  const followUps = selectedReports.filter(report=>!!report.ratingsReviewedAt).flatMap(report => CATEGORIES.flatMap(category => {
    const rating = report.ratings?.[category];
    if (rating?.rating !== 'UA' && rating?.rating !== 'NRT') return [];
    const missing = rating.rating === 'NRT'
      ? [
          !rating.nrtPriorUnacceptableIds?.length && 'earlier UA links',
          !rating.nrtCorrectiveActions?.trim() && 'corrective actions',
          !rating.nrtPriorDocumentationReviewed && 'prior documentation review',
          !rating.nrtTrainingReviewed && 'training implementation review',
          !rating.nrtCoordinatorsNotified && 'FTO Coordinator notification',
          !rating.nrtFtoSergeantNotified && 'FTO Sergeant notification',
        ].filter(Boolean)
      : [];
    return [{report, category, rating: rating.rating as RatingCode, missing, justification: rating.justification}];
  }));
  const clearFilters = () => { setSelectedClass(''); setSelectedOfficer(''); setFollowUpOnly(false); };
  const exportWorkbook = async () => {
    if (!canExportClassWorkbook || !selectedReports.length || exporting) return;
    if (!window.confirm(`Export the ${selectedReports.length} filtered daily logs for ${officers.length} PO(s)? Review the class and PO filters, all rating selections, and activity totals first. Unreviewed default ratings are excluded from rating totals. This export contains only records saved on this device; it will not submit them.`)) return;
    setExporting(true);
    setExportError('');
    try {
      const { exportClassWorkbook } = await import('@/lib/exportWorkbook');
      const included=(item:{className:string;recruitBadge:string;recruitName?:string})=>
        allowedOfficerKeys.has(classOfficerKey(item.className,item.recruitBadge))
        &&(!selectedClass||item.className===selectedClass)
        &&(!selectedOfficer||`${item.recruitBadge}:${item.recruitName??''}`===selectedOfficer);
      const existingWeeklyLogs=ws.weeklyPerformanceLogs.filter(log=>included({className:log.className,recruitBadge:log.recruitBadge,recruitName:log.recruitName}));
      const weeklyLogs=ensureWeeklyUaLogs(selectedReports,existingWeeklyLogs,ws.assignments,ws.phaseFolders,ws.caseFolder);
      const orientations=ws.substationOrientations.filter(record=>included({className:record.className,recruitBadge:record.recruitBadge,recruitName:record.recruitName}));
      const acknowledgements=ws.weeklyAcknowledgements.filter(item=>
        (ws.role!=='fto'||allowedOfficerBadges.has(item.recruitBadge.trim().toLocaleLowerCase()))
        &&(!selectedOfficer||officerKey(item)===selectedOfficer));
      exportClassWorkbook(selectedReports,acknowledgements,weeklyLogs,orientations);
    } catch {
      setExportError('The workbook could not be created. Your saved reports were not changed.');
    } finally {
      setExporting(false);
    }
  };

  if (!canViewClass(ws.role)) return <Panel title="Class access restricted"><p role="alert" className="p-6">Class records and aggregate exports are available only to FTOs and the FTO Coordinator.</p></Panel>;
  return <div>
    <Link href="/" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold hover:underline" data-testid="link-class-back"><ArrowLeft className="h-4 w-4" />Workspace</Link>
    <PageHead kicker="Training class" title="Class overview">
      {(ws.role==='fto'||ws.role==='fto_coordinator')&&<Link href="/substitute-fto" className="inline-flex min-h-11 items-center gap-2 rounded border bg-card px-4 text-sm font-bold">{ws.role==='fto_coordinator'?'Manage substitute coverage':'Sub in for an FTO'}</Link>}
      {canExportClassWorkbook&&<button type="button" disabled={selectedReports.length === 0 || exporting} onClick={exportWorkbook} className="inline-flex h-10 items-center gap-2 rounded bg-primary px-4 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-export-class"><Download className="h-4 w-4" />{exporting ? 'Creating workbook…' : 'Export filtered class workbook'}</button>}
    </PageHead>
    <div className="mb-4 grid gap-3 rounded border bg-card p-4 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
      <label className="block space-y-1"><span className="label-caps">Training class</span><SearchableSelect className="h-10 w-full rounded border bg-card px-3 text-sm" value={selectedClass} onChange={event=>{setSelectedClass(event.target.value);setSelectedOfficer('');}} data-testid="select-class-filter"><option value="">All {ws.role==='fto'?'assigned classes':'classes'}</option>{classes.map(name=><option key={name} value={name}>{name}</option>)}</SearchableSelect></label>
       <label className="block space-y-1"><span className="label-caps">Probationary Officer</span><SearchableSelect className="h-10 w-full rounded border bg-card px-3 text-sm" value={selectedOfficer} onChange={event=>setSelectedOfficer(event.target.value)} data-testid="select-officer-filter"><option value="">All officers</option>{officers.map(person=><option key={person.key} value={person.key}>{person.name} · {person.badge}</option>)}</SearchableSelect></label>
      <label className="flex h-10 items-center gap-2 rounded border bg-card px-3 text-sm"><input type="checkbox" checked={followUpOnly} onChange={event=>setFollowUpOnly(event.target.checked)} data-testid="checkbox-follow-up-filter" />UA / NRT follow-up</label>
      <button type="button" onClick={clearFilters} className="h-10 rounded border bg-card px-3 text-sm font-semibold" data-testid="button-clear-class-filters"><Filter className="mr-1 inline h-4 w-4" />Clear</button>
    </div>
    <Panel title={ws.role==='fto'?'My assigned POs':'Class roster · FTO and Coordinator coverage'} className="mb-4">
       <p className="border-b p-3 text-sm text-muted-foreground">{ws.role==='fto'?'Only POs assigned to the signed-in department email appear. Substitute access is unavailable until a shared coverage service confirms it.':'The roster lists POs even when they have no daily logs yet. Substitute coverage creates a new day without changing the regular FTO assignment.'}</p>
      {ws.role==='fto'&&!signedInFto&&<p className="border-b bg-accent/10 p-3 text-sm" role="status" data-testid="status-fto-roster-unavailable">No FTO directory entry matches the signed-in department email. No class or PO records are shown.</p>}
      {roster.length ? <ul className="divide-y">{roster.map(assignment=>{
        const fto=ws.ftoDirectory.find(item=>item.badge.toLowerCase()===assignment.ftoBadge.toLowerCase());
        return <li key={assignment.id} className="flex flex-wrap items-center justify-between gap-3 p-4" data-testid={`row-class-assignment-${assignment.id}`}>
          <div><p className="font-bold">PO {assignment.recruitName} #{assignment.recruitBadge}</p><p className="text-sm text-muted-foreground">{assignment.className} · Phase {assignment.phase} · FTO {fto?.name??'Not found in directory'} #{assignment.ftoBadge}</p></div>
          {(ws.role==='fto'||ws.role==='fto_coordinator')&&<Link href={`/substitute-fto?assignment=${encodeURIComponent(assignment.id)}`} className="inline-flex min-h-11 items-center rounded border bg-card px-4 text-sm font-bold" data-testid={`link-sub-for-${assignment.id}`}>{ws.role==='fto_coordinator'?'Manage coverage':'Sub in for this FTO'}</Link>}
        </li>;
      })}</ul> : <p className="p-4 text-sm text-muted-foreground">No imported class roster matches this filter. The FTO Coordinator must import the roster first.</p>}
    </Panel>
    <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div className="rounded border bg-card p-4"><div className="label-caps">Saved reports</div><div className="mono mt-1 text-2xl font-bold" data-testid="status-class-report-count">{selectedReports.length}</div></div>
      <div className="rounded border bg-card p-4"><div className="label-caps">Probationary officers</div><div className="mono mt-1 text-2xl font-bold" data-testid="status-class-officer-count">{officers.length}</div></div>
      <div className="rounded border bg-card p-4"><div className="label-caps">Training runs recorded</div><div className="mono mt-1 text-2xl font-bold" data-testid="status-class-run-count">{selectedReports.reduce((sum,report)=>sum+(report.runs?.length ?? 0),0)}</div></div>
      <div className="rounded border bg-card p-4"><div className="label-caps">UA / NRT entries</div><div className="mono mt-1 text-2xl font-bold text-warn" data-testid="status-class-follow-up-count">{followUps.length}</div></div>
    </div>
    {selectedReports.length === 0 ? <Panel><div className="flex flex-col items-center p-10 text-center" data-testid="text-class-empty"><Users className="mb-3 h-7 w-7 text-muted-foreground" /><h2 className="font-bold">{ws.reports.length ? 'No saved records match these filters' : 'No daily logs yet'}</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">Open a phase case folder, set its training class, and save daily logs to populate this local overview.</p><Link href="/" className="mt-4 font-semibold underline" data-testid="link-open-case-folder">Open phase case folder</Link></div></Panel> :
      <div className="space-y-4">
        {buckets.map(group=><Panel key={group.className} title={group.className} action={<span className="mono text-xs text-muted-foreground">{group.probationers.reduce((sum,person)=>sum+person.reports.length,0)} saved reports</span>}>
          <div className="divide-y">{group.probationers.map(person=>{
            const reports=person.reports;
            const reviewed=reports.filter(report=>!!report.ratingsReviewedAt&&!report.limboDay);
            const entries=reviewed.flatMap(report=>CATEGORIES.flatMap(category=>{
              const rating=report.ratings?.[category]?.rating;
              return rating ? [{rating,category}] : [];
            }));
            const ratingCounts=Object.fromEntries(RATING_LEGEND.map(({code})=>[code,entries.filter(item=>item.rating===code).length])) as Record<string,number>;
            const runs=reports.flatMap(report=>report.runs ?? []);
            const activity=reports.reduce((totals,report)=>{Object.entries(activityTotals(report)).forEach(([key,count])=>totals[key]=(totals[key] ?? 0)+count);return totals;},{} as Record<string,number>);
            const activityHighlights=Object.entries(activity).filter(([,count])=>count>0).slice(0,6);
             return <section key={`${person.badge}:${person.name}`} className="p-4" data-testid={`section-class-officer-${person.badge}-${person.name.replace(/\W+/g,'-').toLowerCase()}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                 <div><h3 className="text-lg font-bold">{person.name} <span className="mono text-xs text-muted-foreground">· {person.badge}</span></h3><p className="text-xs text-muted-foreground">{reports.length} daily {reports.length===1?'report':'reports'} · {runs.length} training {runs.length===1?'run':'runs'} · latest {formatDateDMY(reports[0].date)}</p></div>
                <div className="flex flex-wrap gap-1.5">{reports.slice(0,4).map(report=><StatusPill key={report.id} s={report.status} />)}</div>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-[1.2fr_1fr]">
                <div className="rounded border bg-muted/25 p-3">
                  <div className="label-caps">Descriptive SEG selections · no average or score</div>
                  <div className="mt-2 flex flex-wrap gap-2">{RATING_LEGEND.map(({code,label})=><span key={code} className="rounded border bg-card px-2 py-1 text-xs" data-testid={`status-rating-count-${code}-${person.name.replace(/\W+/g,'-').toLowerCase()}`}><b className="mono">{code}</b> {label} · {ratingCounts[code] ?? 0}</span>)}</div>
                   <div className="mt-3"><div className="label-caps">Activity categories with recorded counts</div>{activityHighlights.length ? <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">{activityHighlights.map(([key,count])=><li key={key}><span className="text-muted-foreground">{activityLabel[key] ?? key}</span>: <b className="mono">{count}</b></li>)}</ul> : <p className="mt-1 text-xs text-muted-foreground">No activity counts recorded.</p>}</div>
                </div>
                <div className="rounded border bg-card p-3">
                  <div className="label-caps">Daily report activity</div>
                  <ul className="mt-2 space-y-1">{reports.slice(0,5).map(report=><li key={report.id} className="flex items-center justify-between gap-2 text-xs"><Link href={`/reports/${report.id}`} className="font-semibold underline" data-testid={`link-class-report-${report.id}`}>{formatDateDMY(report.date)} · {evaluationProgress(report)}</Link><span className="text-muted-foreground">{report.runs?.length ?? 0} runs</span></li>)}</ul>
                </div>
              </div>
            </section>;
          })}</div>
        </Panel>)}
      </div>}
    <Panel className="mt-4" title="UA / NRT follow-up">
      {followUps.length === 0 ? <p className="p-4 text-sm text-muted-foreground" data-testid="text-no-class-follow-up">No Unacceptable or Not Responding to Training selections in the filtered reports.</p> : <ul className="divide-y" data-testid="list-class-follow-up">{followUps.map(({report,category,rating,missing,justification})=><li key={`${report.id}-${category}`} className="flex flex-wrap items-start gap-3 p-3" data-testid={`row-class-follow-up-${report.id}-${category}`}>
        <RatingChip r={rating} /><div className="min-w-0 flex-1"><div className="font-semibold">{report.recruitName} · {CATEGORY_LABEL[category]} <span className="text-xs font-normal text-muted-foreground">· {formatDateDMY(report.date)}</span></div><p className="mt-1 text-sm text-muted-foreground">{justification || 'Performance and training documentation still needed.'}</p>{missing.length>0 && <p className="mt-1 text-xs font-semibold text-warn">NRT follow-up not confirmed: {missing.join('; ')}.</p>}</div><Link href={`/reports/${report.id}`} className="text-sm font-semibold underline" data-testid={`link-follow-up-report-${report.id}-${category}`}>Review report</Link>
      </li>)}</ul>}
    </Panel>
    {exportError && <p role="alert" className="mt-3 text-sm font-semibold text-destructive" data-testid="text-export-error">{exportError}</p>}
    <p className="mt-4 text-xs text-muted-foreground" data-testid="text-export-note">Workbook export uses only the currently filtered local reports. Export does not transmit records to a server.</p>
  </div>;
}
