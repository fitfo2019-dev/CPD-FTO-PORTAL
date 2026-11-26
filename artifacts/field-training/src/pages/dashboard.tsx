import { Link } from 'wouter';
import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { ArrowRight, ClipboardList, FolderOpen, UsersRound, CalendarClock, CalendarDays, FileCheck2, BookOpen } from 'lucide-react';
import { useWorkspace } from '@/state/workspace.js';
import { CATEGORIES, CATEGORY_LABEL, canViewClass, evaluationProgress, needsJustification, phaseAssignmentLabel, ROLE_LABEL } from '@/lib/model.js';
import { formatDateDMY, localISODate } from '@/lib/training-calendar.js';
import { PageHead, Panel, RatingChip, Stat, StatusPill, caseSafe } from '@/components/bits.js';
import { NrtAdminReviewPanel } from '@/components/nrt-admin-review-panel.js';
import { PhaseExtensionPanel } from '@/components/phase-extension-panel.js';
import { activityTotals } from '@/lib/run-activity.js';

export default function Dashboard() {
  const {ws}=useWorkspace();
  const isCoordinator=ws.role==='fto_coordinator';
  const reports=ws.reports;
  const sorted=[...reports].sort((a,b)=>b.date.localeCompare(a.date));
  const folder=ws.caseFolder;
  const currentDraft=folder&&sorted.find(report=>report.status==='draft'&&report.recruitBadge===folder.recruitBadge&&report.phase===folder.phase);
  const todayReport=folder&&sorted.find(report=>report.date===localISODate()&&report.recruitBadge===folder.recruitBadge&&report.phase===folder.phase);
  const shiftHref=folder?(currentDraft?`/reports/${currentDraft.id}`:'/reports/new'):'/phase-setup';
  const shiftLabel=folder?(currentDraft?'Continue shift':todayReport?'Start next shift':'Start shift'):'Complete phase setup first';
  const acknowledgementsInProgress=ws.weeklyAcknowledgements.filter(item=>item.status!=='office_signed').length;
  const locked=reports.filter(report=>report.status==='locked').length;
  const activityCounts=reports.reduce((total,report)=>total+Object.values(activityTotals(report)).reduce((sum,count)=>sum+count,0),0);
  const evaluationsComplete=reports.filter(report=>evaluationProgress(report)==='Complete').length;
  const flags=reports.flatMap(report=>CATEGORIES.filter(category=>{
    const rating=report.ratings[category].rating;
    return rating==='UA'||rating==='NRT';
  }).map(category=>({report,category})));
  const phaseLabel=folder?`Phase ${folder.phase}`:'Not set';

  return <div className="mx-auto max-w-7xl">
    <PageHead kicker={`Field training · ${ROLE_LABEL[ws.role]}`} title={isCoordinator?'Training office':'My work'}>
      {folder&&ws.role==='fto'
        ?<Link href={shiftHref} data-testid="link-start-shift" className="inline-flex min-h-11 items-center gap-2 rounded bg-primary px-4 text-sm font-bold text-primary-foreground"><ClipboardList className="h-4 w-4"/>{shiftLabel}</Link>
        :<Link href="/phase-setup" data-testid="link-phase-setup" className="inline-flex min-h-11 items-center gap-2 rounded bg-primary px-4 text-sm font-bold text-primary-foreground"><FolderOpen className="h-4 w-4"/>{folder?'Review phase setup':'Set up phase folder'}</Link>}
      {canViewClass(ws.role)&&<Link href="/class-overview" data-testid="link-class-overview" className="inline-flex min-h-11 items-center gap-2 rounded border bg-card px-4 text-sm font-bold"><UsersRound className="h-4 w-4"/>{isCoordinator?'Open classes and rosters':'Open class records'}</Link>}
      {(ws.role==='fto'||ws.role==='fto_coordinator')&&<Link href="/substitute-fto" data-testid="link-substitute-fto" className="inline-flex min-h-11 items-center gap-2 rounded border bg-card px-4 text-sm font-bold"><CalendarClock className="h-4 w-4"/>{isCoordinator?'Manage coverage':'Request or provide coverage'}</Link>}
    </PageHead>

    <PhaseExtensionPanel/>

    <section aria-label="Your next steps" className="mb-5 rounded border border-primary/20 bg-primary/[0.035] p-4 sm:p-5">
      <p className="label-caps">{isCoordinator?'FTO Coordinator starting point':'FTO starting point'}</p>
      <h2 className="mt-1 text-xl font-bold">{isCoordinator?'Choose what you need to manage':'Start with your next shift'}</h2>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{isCoordinator?'Open a class to manage its roster and assignments, arrange coverage, or check the weekly packet queue. These links open the existing local workspace screens.':'Set up the phase folder if it is missing. Then start your shift and finish the daily paperwork in that shift record.'}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        {isCoordinator?<>
          <ActionLink href="/class-overview" icon={<UsersRound className="h-4 w-4"/>} title="Manage classes and rosters" detail={`${ws.assignments.length} saved roster assignments`} testId="action-manage-classes"/>
          <ActionLink href="/fto-classes" icon={<CalendarDays className="h-4 w-4"/>} title="Post class phases" detail="Set phase dates and review FTO interest" testId="action-post-class-phases"/>
          <ActionLink href="/substitute-fto" icon={<CalendarClock className="h-4 w-4"/>} title="Manage coverage" detail="Open the coverage workspace" testId="action-manage-coverage"/>
          <ActionLink href="/reports/weekly-summary" icon={<FileCheck2 className="h-4 w-4"/>} title="Review weekly packets" detail={acknowledgementsInProgress?`${acknowledgementsInProgress} need attention`:'Open weekly packet summary'} testId="action-review-packets"/>
          <ActionLink href="/reports" icon={<ClipboardList className="h-4 w-4"/>} title="Find daily paperwork" detail="Open saved shift records" testId="action-find-paperwork"/>
          <ActionLink href="/resources" icon={<BookOpen className="h-4 w-4"/>} title="Training resources" detail="Open law library and reference files" testId="action-training-resources"/>
        </>:<>
          <ActionLink href={shiftHref} icon={<ClipboardList className="h-4 w-4"/>} title={shiftLabel} detail={folder?currentDraft?'Continue the draft record':'Open today’s shift paperwork':'Set up the phase folder first'} primary testId="action-start-shift"/>
          <ActionLink href="/phase-setup" icon={<FolderOpen className="h-4 w-4"/>} title={folder?'Check phase setup':'Set up the phase folder'} detail="Confirm the PO, class, and phase" testId="action-phase-setup"/>
          <ActionLink href="/substitute-fto" icon={<CalendarClock className="h-4 w-4"/>} title="Request or provide coverage" detail="Other FTO’s are not notified" testId="action-fto-coverage"/>
          <ActionLink href="/fto-classes" icon={<CalendarDays className="h-4 w-4"/>} title="Sign up for a class phase" detail="See Coordinator-posted phase dates" testId="action-fto-class-signup"/>
          <ActionLink href="/class-overview" icon={<UsersRound className="h-4 w-4"/>} title="Open class records" detail="View class and roster information" testId="action-fto-class" disabled={!canViewClass(ws.role)}/>
          <ActionLink href="/resources" icon={<BookOpen className="h-4 w-4"/>} title="Training resources" detail="Open law library and reference files" testId="action-training-resources"/>
        </>}
      </div>
    </section>

    <div className="mb-4 rounded border-l-4 border-primary bg-card p-4">
      <p className="font-semibold">Daily paperwork, in one place</p>
      <p className="mt-1 text-sm text-muted-foreground">For each training day, the Daily Performance Log holds activity totals and reviewed SEG ratings. Reporting for Duty, run forms, and the narrative are in the same shift workspace. The Weekly Performance Log Supplement gathers the week’s UA articulations and corrective-training time.</p>
    </div>

    {!isCoordinator&&<section aria-label="Shift paperwork steps" className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <WorkflowCard step="1" title="Phase setup" status={folder?`${folder.recruitName} · ${phaseLabel}`:'Needs PO and phase details'} href="/phase-setup" action={folder?'Review or correct':'Enter case folder'}/>
      <WorkflowCard step="2" title="Shift and run forms" status={!folder?'Finish phase setup before starting a shift':currentDraft?'Draft ready to continue':todayReport?'Today’s record is saved; the next scheduled shift is ready':'One daily record for duty, runs, and evaluation'} href={shiftHref} action={shiftLabel} primary/>
      <WorkflowCard step="3" title="Weekly packet" status="Builds from completed, reviewed daily records" href="/reports/weekly-summary" action="Open weekly summary"/>
      <WorkflowCard step="4" title="Class reports" status={`${ws.assignments.length} roster assignments · FTO and Coordinator access`} href="/class-overview" action="View class" disabled={!canViewClass(ws.role)}/>
      <WorkflowCard step="5" title="Class and phase sign-up" status="Review Coordinator-posted dates" href="/fto-classes" action="See phase dates"/>
    </section>}

    {isCoordinator&&<section aria-label="Coordinator work areas" className={`mb-4 grid gap-3 sm:grid-cols-2 ${import.meta.env.DEV?'lg:grid-cols-3 xl:grid-cols-5':'lg:grid-cols-4'}`}>
      {import.meta.env.DEV&&<PoReviewCard/>}
      <WorkflowCard step="1" title="Classes and rosters" status={`${ws.assignments.length} saved roster assignments`} href="/class-overview" action="Open classes"/>
      <WorkflowCard step="2" title="Post class phases" status="Set dates and review FTO interest" href="/fto-classes" action="Open phase posts"/>
      <WorkflowCard step="3" title="Coverage" status="Requests are saved on this device only" href="/substitute-fto" action="Open coverage"/>
      <WorkflowCard step="4" title="Packet queue" status={`${acknowledgementsInProgress} weekly packet${acknowledgementsInProgress===1?'':'s'} need completion or review`} href="/reports/weekly-ack" action="Open acknowledgements"/>
    </section>}

    {folder&&<Panel title="Current phase folder" action={<Link href="/phase-setup" className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold underline">Edit setup <ArrowRight className="h-3.5 w-3.5"/></Link>} className="mb-4">
      <div className="grid gap-3 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><span className="label-caps">Probationary Officer</span><b className="mt-1 block break-words">{folder.recruitName} · #{folder.recruitBadge}</b></div>
        <div><span className="label-caps">Class and phase</span><b className="mt-1 block break-words">{folder.className} · {phaseLabel}</b></div>
        <div><span className="label-caps">Assigned FTO</span><b className="mt-1 block break-words">{folder.ftoName} · #{folder.ftoBadge}</b></div>
        <div><span className="label-caps">FTO assignment</span><b className="mt-1 block break-words">{phaseAssignmentLabel(folder.ftoAssignment,folder.shift,folder.cruiserDistrict)}</b></div>
      </div>
    </Panel>}

    {acknowledgementsInProgress>0&&<div className="mb-4 flex flex-wrap items-center gap-2 rounded border-l-4 border-accent bg-card p-3 text-sm" data-testid="text-weekly-ack-queue"><b>{acknowledgementsInProgress} weekly packet{acknowledgementsInProgress===1?'':'s'}</b> awaiting completion or review.<Link href="/reports/weekly-ack" className="ml-auto font-semibold underline">Open acknowledgements</Link></div>}

    <Panel className="mb-4 grid grid-cols-2 divide-x divide-y sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
      <Stat label="Daily records" value={reports.length} sub={`${locked} finalized`}/>
      <Stat label="Current phase" value={folder?.phase??'—'} sub={folder?`PO ${folder.recruitBadge}`:'Set up a phase folder'}/>
      <Stat label="Activity counts" value={activityCounts} sub="entered across saved shifts"/>
      <Stat label="Evaluations complete" value={evaluationsComplete} sub={`${reports.length} daily records`}/>
      <Stat label="Weekly packets" value={ws.weeklyAcknowledgements.length} sub={`${acknowledgementsInProgress} need action`} tone="warn"/>
    </Panel>

    <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
      <Panel title="Recent shift records" action={<Link href="/reports" className="inline-flex items-center gap-1 text-sm font-semibold hover:underline" data-testid="link-all-reports">Saved records <ArrowRight className="h-3.5 w-3.5"/></Link>}>
        {sorted.length===0?<div className="p-6 text-sm text-muted-foreground">No daily records yet. Set up the phase folder, then start the shift workspace.</div>:
          <ul className="divide-y">{sorted.slice(0,6).map(report=><li key={report.id}><Link href={`/reports/${report.id}`} data-testid={`row-recent-${report.id}`} className="flex min-w-0 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60">
            <div className="min-w-0 flex-1 text-sm"><b className="block truncate">{report.recruitName} · #{report.recruitBadge}</b><span className="text-xs text-muted-foreground">{formatDateDMY(report.date)} · {phaseAssignmentLabel(report.ftoAssignment,report.shift,report.cruiserDistrict)}</span></div>
            <span className="hidden text-xs text-muted-foreground md:block">{evaluationProgress(report)}</span><StatusPill s={report.status}/><ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground"/>
          </Link></li>)}</ul>}
      </Panel>
      <div className="space-y-4">
        <Panel title="Unacceptable / NRT follow-up">
          {flags.length===0?<p className="p-4 text-sm text-muted-foreground">No Unacceptable or NRT selections in saved records.</p>:
            <ul className="divide-y text-sm">{flags.map(({report,category})=><li key={report.id+category} className="flex items-start gap-3 px-4 py-3"><RatingChip r={report.ratings[category].rating}/><div className="min-w-0"><b className="block">{CATEGORY_LABEL[category]}</b><Link href={`/reports/${report.id}`} className="underline">{report.recruitName} · {formatDateDMY(report.date)}</Link>{needsJustification(report.ratings[category].rating)&&<p className="mt-1 line-clamp-2 text-muted-foreground">{report.ratings[category].justification||'Justification missing'}</p>}</div></li>)}</ul>}
        </Panel>
        <NrtAdminReviewPanel/>
      </div>
    </div>
  </div>;
}

/** Preview count from the PO Progress sample; loads only in development builds, like the PO Progress route. */
function PoReviewCard() {
  const [count,setCount]=useState<number|null>(null);
  useEffect(()=>{let live=true;import('@/features/rebuild/lib/po-progress/data').then(m=>{if(live)setCount(m.PROGRESS.pos.filter(p=>m.inSampleGroup(p)&&p.status==='BELOW STANDARD').length);});return()=>{live=false;};},[]);
  return <Link href="/po-progress?show=below-standard" className={`flex min-h-36 flex-col rounded border bg-card p-4 transition-colors hover:border-primary ${count?'border-l-4 border-l-destructive':''}`} data-testid="workflow-po-review">
    <span className="label-caps">{caseSafe('PO’s Below Standard')}</span>
    <b className={`mt-2 text-3xl font-extrabold tabular-nums ${count?'text-destructive':''}`}>{count??'–'}</b>
    <span className="mt-auto inline-flex items-center gap-1 pt-3 text-sm font-semibold">Open PO Progress<ArrowRight className="h-4 w-4"/></span>
  </Link>;
}

function WorkflowCard({step,title,status,href,action,primary,disabled}:{step:string;title:string;status:string;href:string;action:string;primary?:boolean;disabled?:boolean}) {
  return <Link href={disabled?'#':href} aria-disabled={disabled} onClick={(event:MouseEvent<HTMLAnchorElement>)=>{if(disabled)event.preventDefault();}} className={`flex min-h-36 flex-col rounded border bg-card p-4 transition-colors ${disabled?'cursor-not-allowed opacity-50':'hover:border-primary'} ${primary?'border-primary/60':''}`} data-testid={`workflow-${title.toLowerCase().replaceAll(' ','-')}`}>
    <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-muted text-sm font-bold">{step}</span><b>{title}</b></div>
    <p className="mt-3 flex-1 text-sm text-muted-foreground">{status}</p>
    <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold">{action}<ArrowRight className="h-4 w-4"/></span>
  </Link>;
}

function ActionLink({href,icon,title,detail,primary,disabled,testId}:{href:string;icon:ReactNode;title:string;detail:string;primary?:boolean;disabled?:boolean;testId:string}) {
  return <Link href={disabled?'#':href} aria-disabled={disabled} onClick={(event:MouseEvent<HTMLAnchorElement>)=>{if(disabled)event.preventDefault();}} data-testid={testId} className={`flex min-h-[6.5rem] items-start gap-3 rounded border p-3 transition-colors ${disabled?'cursor-not-allowed opacity-50':'hover:border-primary'} ${primary?'border-primary bg-card':'border-border bg-card'}`}>
    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded bg-primary/10 text-primary">{icon}</span>
    <span className="min-w-0"><b className="block text-sm leading-snug">{title}</b><span className="mt-1 block text-xs text-muted-foreground">{detail}</span></span>
  </Link>;
}
