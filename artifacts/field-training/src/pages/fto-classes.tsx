import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { CalendarDays, Check, ClipboardList, Plus, UsersRound } from 'lucide-react';
import { PageHead, Panel } from '@/components/bits';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/state/workspace';
import { PHASES, PHASE_LENGTH_WEEKS, ROLE_LABEL, phaseLabel, uid, type FtoPhasePosting, type FtoPhaseSignup, type Phase } from '@/lib/model';
import { formatDateDMY, formatDateEntryMDY, getPhaseEndDate, localISODate, parseDateDMY } from '@/lib/training-calendar';

const inputClass='h-11 w-full rounded border bg-card px-3 text-sm';

export default function FtoClassesPage() {
  const {ws,upsertFtoPhasePosting,upsertFtoPhaseSignup}=useWorkspace();
  const {toast}=useToast();
  const isCoordinator=ws.role==='fto_coordinator';
  const classes=[...new Set(ws.assignments.map(item=>item.className).filter(Boolean))].sort();
  const [className,setClassName]=useState('');
  const [phase,setPhase]=useState<Phase>(1);
  const [startDateText,setStartDateText]=useState('');
  const [selectedFtoBadge,setSelectedFtoBadge]=useState(ws.caseFolder?.ftoBadge??'');
  const [error,setError]=useState('');
  const startDate=parseDateDMY(startDateText);
  const endDate=startDate?getPhaseEndDate(phase,startDate):undefined;
  const postings=useMemo(()=>[...(ws.ftoPhasePostings??[])].sort((a,b)=>a.phaseStartDate.localeCompare(b.phaseStartDate)),[ws.ftoPhasePostings]);
  const signupFor=(postingId:string)=>ws.ftoPhaseSignups.filter(item=>item.postingId===postingId&&item.status!=='withdrawn');
  const assignmentsFor=(posting:FtoPhasePosting)=>ws.assignments.filter(item=>item.className===posting.className&&item.phase===posting.phase);
  const selectedFto=ws.ftoDirectory.find(item=>item.badge===selectedFtoBadge)
    ??(ws.caseFolder?.ftoBadge===selectedFtoBadge?{badge:ws.caseFolder.ftoBadge,name:ws.caseFolder.ftoName}:undefined);
  const suggestedStartDate=ws.assignments.find(item=>item.className===className&&item.phase===phase)?.phaseStartDate;

  if(ws.role!=='fto'&&!isCoordinator) {
    return <Panel title="Class and phase sign-up"><p className="p-4 text-sm">This page is for FTOs and the FTO Coordinator.</p></Panel>;
  }

  function postPhase() {
    setError('');
    if(!className.trim()||!startDate) {
      setError('Enter a class name and a valid phase start date in MM/DD/YYYY.');
      return;
    }
    const duplicate=postings.find(item=>item.status==='open'&&item.className.toLowerCase()===className.trim().toLowerCase()&&item.phase===phase);
    if(duplicate) {
      setError('This class and phase already has an open local posting.');
      return;
    }
    const now=new Date().toISOString();
    const posting:FtoPhasePosting={id:uid(),className:className.trim(),phase,phaseStartDate:startDate,status:'open',createdAt:now,updatedAt:now};
    upsertFtoPhasePosting(posting);
    toast({title:'Phase posting saved on this device',description:'Other FTOs have not been notified.'});
    setStartDateText('');
  }

  function closePosting(posting:FtoPhasePosting) {
    upsertFtoPhasePosting({...posting,status:'closed',updatedAt:new Date().toISOString()});
  }

  function signUp(posting:FtoPhasePosting) {
    if(!selectedFto) {
      setError('Choose your name from the FTO list first.');
      return;
    }
    const existing=ws.ftoPhaseSignups.find(item=>item.postingId===posting.id&&item.ftoBadge===selectedFto.badge&&item.status!=='withdrawn');
    if(existing) {
      setError('You already have a sign-up saved for this phase.');
      return;
    }
    const now=new Date().toISOString();
    const signup:FtoPhaseSignup={id:uid(),postingId:posting.id,ftoBadge:selectedFto.badge,ftoName:selectedFto.name,status:'local_unsent',createdAt:now,updatedAt:now};
    upsertFtoPhaseSignup(signup);
    setError('');
    toast({title:'Sign-up saved on this device',description:'The FTO Coordinator has not been notified.'});
  }

  function chooseCandidateForPo(signup:FtoPhaseSignup,assignmentId:string) {
    const now=new Date().toISOString();
    upsertFtoPhaseSignup({
      ...signup,
      status:assignmentId?'selected_locally':'local_unsent',
      selectedAssignmentId:assignmentId||undefined,
      updatedAt:now,
    });
  }

  function withdraw(signup:FtoPhaseSignup) {
    upsertFtoPhaseSignup({...signup,status:'withdrawn',selectedAssignmentId:undefined,updatedAt:new Date().toISOString()});
  }

  return <div className="mx-auto max-w-6xl">
    <PageHead kicker={`FTO assignments · ${ROLE_LABEL[ws.role]}`} title={isCoordinator?'Post class phases':'Class and phase sign-up'}>
      <span className="inline-flex min-h-9 items-center gap-2 rounded border bg-muted/40 px-3 text-xs font-semibold"><CalendarDays className="h-4 w-4"/>Dates first</span>
    </PageHead>
    <div role="note" className="mb-4 rounded border-l-4 border-accent bg-accent/5 p-4 text-sm">
      <b>Saved on this device only.</b> Posts and sign-ups are not shared with other accounts or official assignments.
    </div>

    {isCoordinator&&<Panel title="Post a class and phase" className="mb-5">
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1 text-sm font-semibold">Class
          <input className={inputClass} list="fto-class-options" value={className} onChange={event=>setClassName(event.target.value)} placeholder="Example: 135th" data-testid="input-fto-post-class"/>
          <datalist id="fto-class-options">{classes.map(item=><option key={item} value={item}/>)}</datalist>
        </label>
        <label className="grid gap-1 text-sm font-semibold">Phase
          <select className={inputClass} value={phase} onChange={event=>setPhase(Number(event.target.value) as Phase)} data-testid="select-fto-post-phase">
            {PHASES.map(item=><option key={item} value={item}>{phaseLabel(item)}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">Phase start date · MM/DD/YYYY
          <input className={inputClass} inputMode="text" placeholder="MM/DD/YYYY" value={startDateText} onChange={event=>setStartDateText(formatDateEntryMDY(event.target.value))} onKeyDown={event=>{if(event.key==='Enter'&&event.currentTarget.value.trim()==='?'){event.preventDefault();setStartDateText(formatDateDMY(localISODate()));}}} data-testid="input-fto-post-start-date"/>
        </label>
        <div className="flex flex-col justify-end gap-1">
          <div className="min-h-11 rounded border bg-muted/30 px-3 py-2 text-sm" data-testid="text-fto-phase-date-range">
            <b>Expected end</b><br/>{endDate?formatDateDMY(endDate):'Enter a start date'}
          </div>
          {suggestedStartDate&&<button type="button" onClick={()=>setStartDateText(formatDateDMY(suggestedStartDate))} className="text-left text-xs font-semibold underline">Use roster date: {formatDateDMY(suggestedStartDate)}</button>}
        </div>
        {error&&<p role="alert" className="text-sm font-semibold text-destructive sm:col-span-2 lg:col-span-4">{error}</p>}
        <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-4">
          <button type="button" onClick={postPhase} className="inline-flex min-h-11 items-center gap-2 rounded bg-primary px-4 text-sm font-bold text-primary-foreground" data-testid="button-post-fto-phase"><Plus className="h-4 w-4"/>Save phase posting locally</button>
          <p className="self-center text-xs text-muted-foreground">Expected phase length: {PHASE_LENGTH_WEEKS[phase]} Sunday–Saturday weeks.</p>
        </div>
      </div>
    </Panel>}

    {!isCoordinator&&<Panel title="Choose your FTO name" className="mb-5">
      <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_2fr] sm:items-end">
        <label className="grid gap-1 text-sm font-semibold">FTO
          <select className={inputClass} value={selectedFtoBadge} onChange={event=>{setSelectedFtoBadge(event.target.value);setError('');}} data-testid="select-fto-signup-identity">
            <option value="">Choose your name</option>
            {ws.ftoDirectory.map(item=><option key={item.badge} value={item.badge}>{item.name} · #{item.badge}</option>)}
            {ws.caseFolder?.ftoBadge&&!ws.ftoDirectory.some(item=>item.badge===ws.caseFolder?.ftoBadge)&&<option value={ws.caseFolder.ftoBadge}>{ws.caseFolder.ftoName} · #{ws.caseFolder.ftoBadge}</option>}
          </select>
        </label>
        <p className="rounded border bg-muted/30 p-3 text-sm text-muted-foreground">A sign-up is a request only; it does not assign you to a PO.</p>
      </div>
    </Panel>}

    <section className="grid gap-4">
      {postings.length===0?<Panel title={isCoordinator?'Your phase postings':'Available class phases'}><p className="p-4 text-sm text-muted-foreground">{isCoordinator?'No class phases have been posted on this device. Add a class, phase, and start date above.':'No FTO Coordinator postings are available.'}</p></Panel>:
        postings.map(posting=>{
          const end=getPhaseEndDate(posting.phase,posting.phaseStartDate);
          const assignments=assignmentsFor(posting);
          const unfilledAssignments=assignments.filter(item=>!item.ftoBadge);
          const signups=signupFor(posting.id);
          const openSlots=unfilledAssignments.length;
          const alreadySigned=signups.some(item=>item.ftoBadge===selectedFto?.badge);
          const mySignup=signups.find(item=>item.ftoBadge===selectedFto?.badge);
          return <Panel key={posting.id} title={`${posting.className} · ${phaseLabel(posting.phase)}`} className="min-w-0">
            <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
              <div className="space-y-3">
                <div className={`grid gap-2 ${isCoordinator?'grid-cols-2':'grid-cols-1'}`}>
                  <DateTile label="Phase starts" date={posting.phaseStartDate}/>
                  <DateTile label="Expected phase end" date={end}/>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {isCoordinator
                    ?<><CountTile label="POs in roster" value={assignments.length}/><CountTile label="No FTO assigned" value={openSlots}/></>
                    :<CountTile label="POs who need an FTO" value={openSlots}/>}
                </div>
                {isCoordinator?<button type="button" onClick={()=>closePosting(posting)} disabled={posting.status==='closed'} className="min-h-10 rounded border px-3 text-sm font-semibold disabled:opacity-50" data-testid={`button-close-posting-${posting.id}`}>{posting.status==='closed'?'Posting closed':'Close local posting'}</button>:
                  posting.status==='open'?<button type="button" onClick={()=>signUp(posting)} disabled={!selectedFto||alreadySigned} className="inline-flex min-h-11 items-center gap-2 rounded bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50" data-testid={`button-signup-${posting.id}`}><Check className="h-4 w-4"/>{alreadySigned?'Sign-up saved':'Sign up for this phase'}</button>:<span className="text-sm font-semibold text-muted-foreground">This posting is closed.</span>}
              </div>
              <div className="min-w-0">
                {isCoordinator
                  ?<CoordinatorNeeds assignments={unfilledAssignments} signups={signups} onChoose={chooseCandidateForPo}/>
                  :<div className="rounded border bg-muted/20 p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold"><UsersRound className="h-4 w-4"/>Your sign-up</div>
                    <p className="mt-2 text-sm text-muted-foreground">The FTO Coordinator sees the PO details and assigns FTOs. This page only shows how many POs need an FTO.</p>
                    {mySignup&&<div className="mt-3 rounded border bg-card p-3 text-sm" role="status" data-testid={`fto-signup-status-${posting.id}`}>
                      <b>{mySignup.status==='selected_locally'?'Locally matched to a PO':'Saved on this device'}</b>
                      <p className="mt-1 text-xs text-muted-foreground">{mySignup.status==='selected_locally'?'This recommendation is not an official assignment.':'This sign-up has not been sent to the FTO Coordinator.'}</p>
                      {mySignup.status!=='selected_locally'&&<button type="button" onClick={()=>withdraw(mySignup)} className="mt-2 text-sm font-semibold underline">Remove my local sign-up</button>}
                    </div>}
                  </div>}
              </div>
            </div>
          </Panel>;
        })}
    </section>
    {error&&!isCoordinator&&<p role="alert" className="mt-3 text-sm font-semibold text-destructive">{error}</p>}
  </div>;
}

function DateTile({label,date}:{label:string;date?:string}) {
  return <div className="rounded border bg-muted/20 p-3"><p className="label-caps">{label}</p><p className="mt-1 break-words font-mono text-sm font-bold">{date?formatDateDMY(date):'—'}</p></div>;
}

function CountTile({label,value}:{label:string;value:number}) {
  return <div className="rounded border bg-muted/20 p-3"><p className="label-caps">{label}</p><p className="mt-1 font-mono text-2xl font-bold tabular-nums">{value}</p></div>;
}

function CoordinatorNeeds({assignments,signups,onChoose}:{assignments:ReturnType<typeof useWorkspace>['ws']['assignments'];signups:FtoPhaseSignup[];onChoose:(signup:FtoPhaseSignup,assignmentId:string)=>void}) {
  const usedAssignments=new Set(signups.filter(item=>item.selectedAssignmentId).map(item=>item.selectedAssignmentId));
  const assignedSignup=(assignmentId:string)=>signups.find(item=>item.selectedAssignmentId===assignmentId);
  if(assignments.length===0) return <div className="rounded border bg-muted/20 p-3 text-sm"><b>Unfilled PO assignments</b><p className="mt-1 text-muted-foreground">There are no unfilled PO assignments for this phase. Add or update the roster if an FTO is still needed.</p></div>;
  return <div className="rounded border bg-muted/20 p-3">
    <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><ClipboardList className="h-4 w-4"/>Unfilled PO assignments</div>
    <p className="mb-2 text-xs text-muted-foreground">Review the PO’s existing records and training needs, then use your judgment to recommend an FTO. The portal does not score or automatically match FTOs.</p>
    <ul className="divide-y">{assignments.map(assignment=>{
      const selected=assignedSignup(assignment.id);
      const options=signups.filter(signup=>signup.status!=='withdrawn'&&(!signup.selectedAssignmentId||signup.selectedAssignmentId===assignment.id)&&(!usedAssignments.has(assignment.id)||signup.id===selected?.id));
      const officerKey=encodeURIComponent(`${assignment.recruitBadge}:${assignment.recruitName}`);
      const classKey=encodeURIComponent(assignment.className);
      return <li key={assignment.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center" data-testid={`fto-po-need-${assignment.id}`}>
        <div className="min-w-0 text-sm">
          <b className="block break-words">PO {assignment.recruitName} · #{assignment.recruitBadge}</b>
          <span className="text-xs text-muted-foreground">No FTO assigned yet</span>
          <Link href={`/class-overview?class=${classKey}&officer=${officerKey}`} className="mt-1 block text-xs font-semibold underline" data-testid={`link-review-po-${assignment.id}`}>Review PO’s existing records</Link>
        </div>
        <div className="grid gap-1">
          <label className="text-xs font-semibold">Local FTO recommendation
            <select className="mt-1 h-10 w-full rounded border bg-card px-2 text-sm" value={selected?.id??''} onChange={event=>{const signup=signups.find(item=>item.id===event.target.value);if(signup)onChoose(signup,assignment.id);else if(selected)onChoose(selected,'');}} data-testid={`select-fto-po-${assignment.id}`}>
              <option value="">No recommendation</option>
              {options.map(item=><option key={item.id} value={item.id}>{item.ftoName} · #{item.ftoBadge}</option>)}
            </select>
          </label>
          {selected&&<span className="text-xs font-semibold text-muted-foreground">Suggested: {selected.ftoName} · #{selected.ftoBadge} (local only)</span>}
        </div>
      </li>;
    })}</ul>
    {signups.length===0&&<p className="mt-2 text-sm text-muted-foreground">No FTO sign-ups yet. FTOs can choose this class and phase from their portal.</p>}
  </div>;
}
