import { useEffect, useMemo } from 'react';
import { Link } from 'wouter';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { ArrowRight, FolderOpen } from 'lucide-react';
import { PageHead, Panel } from '@/components/bits.js';
import { Form } from '@/components/ui/form.js';
import { SearchableSelect } from '@/components/searchable-select.js';
import { useWorkspace } from '@/state/workspace.js';
import { CPD_GEOGRAPHY, cruiserDistrictForFtoAssignment, ftoAssignmentsForPrecinct, cpdPrecinctsForZone } from '@/lib/cpd-geography.js';
import { assignmentToCaseFolder, TrainingAssignmentsPanel } from '@/components/training-assignments-panel.js';
import { PHASES, SHIFTS, SHIFT_LABEL, WEEKDAYS, phaseLabel, type Phase, type PhaseCaseFolder, type Shift, type TrainingAssignment, type Weekday } from '@/lib/model.js';
import { currentDateTimeMDY, formatDateDMY, formatDateEntryMDY, formatDateTimeMDY, parseDateDMY, requiredDaysOff } from '@/lib/training-calendar.js';
import { useToast } from '@/hooks/use-toast.js';

const DAY_VALUES=[0,1,2,3,4,5,6] as const;
const SHIFT_ORDER:Shift[]=['A-Co','DMW','B-Co','EMW','C-Co'];
const daySchema=z.union([z.literal(0),z.literal(1),z.literal(2),z.literal(3),z.literal(4),z.literal(5),z.literal(6)]);
const setupSchema=z.object({
  assignmentId:z.string(),
  className:z.string().trim().min(1,'Enter the training class.'),
  recruitName:z.string().trim().min(1,'Enter the PO’s name.'),
  recruitBadge:z.string().trim().min(1,'Enter the PO badge number.'),
  ftoName:z.string().trim().min(1,'Enter the regularly assigned FTO.'),
  ftoBadge:z.string().trim().min(1,'Enter the regularly assigned FTO badge.'),
  phase:z.enum(['1','2','3','4']),
  phaseStartDate:z.string().refine(value=>!!parseDateDMY(value),'Enter a valid date as MM/DD/YYYY.'),
  shift:z.string().refine(value=>SHIFTS.includes(value as Shift),'Select a Columbus shift.'),
  zone:z.string().min(1,'Select a zone.'),
  precinct:z.string().min(1,'Select a precinct.'),
  ftoAssignment:z.string().min(1,'Select an FTO assignment.'),
  daysOff:z.array(daySchema),
}).superRefine((value,context)=>{
  if(!cruiserDistrictForFtoAssignment(value.zone,value.precinct,value.ftoAssignment,value.shift)) {
    context.addIssue({code:'custom',path:['ftoAssignment'],message:'Choose an FTO assignment that matches the selected shift and patrol area.'});
  }
  const shift=value.shift as Shift;
  if(SHIFTS.includes(shift)&&value.daysOff.length!==requiredDaysOff(shift)) {
    context.addIssue({code:'custom',path:['daysOff'],message:`Select exactly ${requiredDaysOff(shift)} days off for ${shift}.`});
  }
});
type SetupValues=z.infer<typeof setupSchema>;
const textInput='h-11 w-full rounded border bg-card px-3 text-sm';
const selectInput='h-11 w-full rounded border bg-card px-3 text-sm';
function valuesFromFolder(folder:PhaseCaseFolder,ftos:{badge:string;name:string}[]=[]):SetupValues {
  const assignedFto=ftos.find(item=>item.badge.toLowerCase()===folder.ftoBadge.toLowerCase());
  return {
    assignmentId:folder.assignmentId??'',className:folder.className??'',recruitName:folder.recruitName,recruitBadge:folder.recruitBadge,
    ftoName:assignedFto?.name??folder.ftoName,ftoBadge:assignedFto?.badge??folder.ftoBadge,phase:String(folder.phase) as SetupValues['phase'],
    phaseStartDate:formatDateDMY(folder.phaseStartDate),shift:folder.shift,zone:folder.zone,precinct:folder.precinct,
    ftoAssignment:folder.ftoAssignment??'',daysOff:folder.daysOff,
  };
}
function valuesFromAssignment(assignment:TrainingAssignment,ftos:{badge:string;name:string}[],savedFolder?:PhaseCaseFolder):SetupValues {
  const linked=assignmentToCaseFolder(assignment,ftos);
  const saved=savedFolder?valuesFromFolder(savedFolder,ftos):undefined;
  return {
    assignmentId:assignment.id,className:assignment.className,recruitName:assignment.recruitName,recruitBadge:assignment.recruitBadge,
    ftoName:linked.ftoName,ftoBadge:linked.ftoBadge,phase:String(assignment.phase) as SetupValues['phase'],
    phaseStartDate:formatDateDMY(assignment.phaseStartDate),shift:assignment.shift??saved?.shift??'',
    zone:assignment.zone??saved?.zone??'',precinct:assignment.precinct??saved?.precinct??'',
    ftoAssignment:assignment.ftoAssignment??saved?.ftoAssignment??'',
    daysOff:assignment.daysOff?.length?assignment.daysOff:saved?.daysOff??[],
  };
}

export default function PhaseSetupPage() {
  const {ws,vault,setCaseFolder}=useWorkspace();
  const {toast}=useToast();
  const canEdit=ws.role==='fto'||ws.role==='fto_coordinator';
  const canManageAssignment=ws.role==='fto_coordinator';
  const defaults=useMemo<SetupValues>(()=> {
    const activeFolder=ws.caseFolder??ws.phaseFolders.at(-1);
    if(activeFolder?.assignmentId) {
      const assignment=ws.assignments.find(item=>item.id===activeFolder.assignmentId);
      if(assignment) return valuesFromAssignment(assignment,ws.ftoDirectory,activeFolder);
    }
    if(activeFolder) return valuesFromFolder(activeFolder,ws.ftoDirectory);
    return {assignmentId:'',className:'',recruitName:'',recruitBadge:'',ftoName:'',ftoBadge:'',
      phase:'1',
      phaseStartDate:'',shift:'',zone:'',precinct:'',ftoAssignment:'',daysOff:[]};
  },[ws.caseFolder,ws.phaseFolders,ws.assignments,ws.ftoDirectory]);
  const form=useForm<SetupValues>({resolver:zodResolver(setupSchema),defaultValues:defaults,mode:'onChange'});
  useEffect(()=>{if(!form.formState.isDirty)form.reset(defaults);},[defaults,form.formState.isDirty,form.reset]);
  const assignmentId=form.watch('assignmentId');
  const ftoBadge=form.watch('ftoBadge');
  const assignedFtoProfile=ws.ftoDirectory.find(item=>item.badge.toLowerCase()===ftoBadge.toLowerCase());
  const phaseValue=form.watch('phase');
  const shift=form.watch('shift');
  const zone=form.watch('zone');
  const precinct=form.watch('precinct');
  const daysOff=form.watch('daysOff') as Weekday[];
  const fieldError=(name:keyof SetupValues)=>form.formState.errors[name]?.message?.toString();

  function loadAssignment(id:string) {
    const assignment=ws.assignments.find(item=>item.id===id);
    if(!assignment) { form.setValue('assignmentId','');return; }
    const savedFolder=ws.phaseFolders.find(folder=>folder.assignmentId===assignment.id)
      ??ws.phaseFolders.find(folder=>folder.className?.toLowerCase()===assignment.className.toLowerCase()&&folder.recruitBadge.toLowerCase()===assignment.recruitBadge.toLowerCase()&&folder.phase===assignment.phase);
    form.reset(valuesFromAssignment(assignment,ws.ftoDirectory,savedFolder));
  }

  function loadSavedFolder(index:string) {
    const folder=ws.phaseFolders[Number(index)];
    if(!folder) return;
    if(folder.assignmentId&&ws.assignments.some(item=>item.id===folder.assignmentId)) {
      loadAssignment(folder.assignmentId);
      return;
    }
    form.reset(valuesFromFolder(folder,ws.ftoDirectory));
  }

  function save(values:SetupValues) {
    if(!ws.ftoDirectory.some(item=>item.badge.toLowerCase()===values.ftoBadge.toLowerCase())) {
      toast({title:'Assigned FTO could not be verified',description:'Ask the FTO Coordinator to confirm the assignment before saving this phase folder.'});
      return;
    }
    const phaseStartDate=parseDateDMY(values.phaseStartDate);
    if(!phaseStartDate) return;
    const folder:PhaseCaseFolder={
      assignmentId:values.assignmentId||undefined,className:values.className.trim(),recruitName:values.recruitName.trim(),
      recruitBadge:values.recruitBadge.trim(),ftoName:values.ftoName.trim(),ftoBadge:values.ftoBadge.trim(),
      phase:Number(values.phase) as Phase,phaseStartDate,shift:values.shift as Shift,
      zone:values.zone,precinct:values.precinct,
      cruiserDistrict:cruiserDistrictForFtoAssignment(values.zone,values.precinct,values.ftoAssignment,values.shift)??'',
      ftoAssignment:values.ftoAssignment,daysOff:values.daysOff,
      openedAt:new Date().toISOString(),
    };
    setCaseFolder(folder);
    toast({title:'Phase setup added to workspace',description:vault==='unlocked'?'Encrypted local autosave is in progress. New shifts will use these values; existing records keep their saved snapshots.':'It is only in memory until you open the local vault and save this device workspace.'});
  }

  if(!canEdit) return <Panel title="Phase setup access"><p className="p-4 text-sm">Phase setup is available to FTOs and the FTO Coordinator.</p></Panel>;

  return <div className="mx-auto max-w-none">
    <PageHead kicker="Step 1 · Class and phase details" title="Phase setup">
      {ws.caseFolder&&<Link href="/reports/new" className="inline-flex min-h-11 items-center gap-2 rounded bg-primary px-4 text-sm font-bold text-primary-foreground" data-testid="link-start-shift"><FolderOpen className="h-4 w-4"/>Start shift</Link>}
    </PageHead>
    <div className="mb-3 flex flex-wrap items-center justify-end gap-4 text-sm"><Link href="/help" className="font-semibold underline" data-testid="link-phase-help">Forms & Help</Link>{phaseValue==='1'&&<Link href="/substation-orientation" className="font-semibold underline" data-testid="link-phase-orientation">Substation Orientation · first day</Link>}</div>
    <Form {...form}>
      <form onSubmit={form.handleSubmit(save)} noValidate>
        <Panel title="PO, class, phase, and assigned FTO">
          <div className="grid gap-4 p-4">
            {(ws.assignments.length>0||ws.phaseFolders.length>0)&&<div className="grid gap-3">
              {ws.assignments.length>0&&<label className="grid gap-1 text-sm font-semibold">Load an assigned PO phase
                <SearchableSelect className={selectInput} value={assignmentId} onChange={event=>loadAssignment(event.target.value)} data-testid="select-roster-assignment"><option value="">Choose a PO phase</option>{ws.assignments.map(item=><option key={item.id} value={item.id}>{item.className} · PO {item.recruitName} #{item.recruitBadge} · Phase {item.phase}</option>)}</SearchableSelect>
              </label>}
              {ws.phaseFolders.length>0&&<label className="grid gap-1 text-sm font-semibold">Switch to a saved phase folder
                <SearchableSelect className={selectInput} defaultValue="" onChange={event=>loadSavedFolder(event.target.value)} data-testid="select-saved-phase-folder"><option value="">Choose a saved folder</option>{ws.phaseFolders.map((item,index)=><option key={`${item.assignmentId??item.recruitBadge}-${item.phase}-${index}`} value={index}>{item.className||'Class not set'} · PO {item.recruitName} #{item.recruitBadge} · Phase {item.phase}</option>)}</SearchableSelect>
              </label>}
            </div>}
            <Field label="Training class" error={fieldError('className')}><input {...form.register('className')} className={textInput} autoComplete="off" readOnly={!canManageAssignment} placeholder={'Ex. "135th"'} data-testid="input-training-class"/></Field>
            <fieldset className="grid gap-3 rounded-sm border bg-muted/20 p-4">
              <legend className="px-2 text-sm font-bold">Probationary Officer (PO)</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                 <Field label="PO name" error={fieldError('recruitName')}><input {...form.register('recruitName')} className={textInput} autoComplete="off" readOnly={!canManageAssignment} data-testid="input-po-name"/></Field>
                 <Field label="PO badge number" error={fieldError('recruitBadge')}><input {...form.register('recruitBadge')} className={textInput} autoComplete="off" readOnly={!canManageAssignment} data-testid="input-po-badge"/></Field>
              </div>
            </fieldset>
            <fieldset className="grid gap-3 rounded-sm border bg-muted/20 p-4">
              <legend className="px-2 text-sm font-bold">Assigned Field Training Officer (FTO)</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="FTO name" error={fieldError('ftoName')}><input {...form.register('ftoName')} className={textInput} autoComplete="off" readOnly data-testid="input-fto-name"/></Field>
                  <Field label="FTO badge number" error={fieldError('ftoBadge')}><input {...form.register('ftoBadge')} className={textInput} autoComplete="off" readOnly data-testid="input-fto-badge"/></Field>
              </div>
                {(!ftoBadge||!assignedFtoProfile)&&<p role="alert" className="text-sm font-semibold text-destructive">The assigned FTO is unavailable. Ask the FTO Coordinator to confirm the roster assignment before saving.</p>}
            </fieldset>
            <Field label="Shift / company" error={fieldError('shift')}>{canManageAssignment?<SearchableSelect {...form.register('shift')} value={shift} className={selectInput} onChange={event=>{form.setValue('shift',event.target.value,{shouldDirty:true,shouldValidate:true});form.setValue('ftoAssignment','',{shouldDirty:true,shouldValidate:true});}} data-testid="select-shift"><option value="">Select shift / company</option>{SHIFT_ORDER.map(value=><option key={value} value={value}>{SHIFT_LABEL[value]}</option>)}</SearchableSelect>:<input {...form.register('shift')} className={textInput} readOnly data-testid="select-shift"/>}</Field>
            <Field label="Phase" error={fieldError('phase')}>{canManageAssignment?<SearchableSelect {...form.register('phase')} value={phaseValue} className={selectInput} data-testid="select-phase">{PHASES.map(value=><option key={value} value={String(value)}>{phaseLabel(value)}</option>)}</SearchableSelect>:<input {...form.register('phase')} className={textInput} readOnly data-testid="select-phase"/>}</Field>
            <Field label="Phase start date · MM/DD/YYYY" error={fieldError('phaseStartDate')}><input {...form.register('phaseStartDate')} className={textInput} inputMode="text" placeholder="MM/DD/YYYY" readOnly={!canManageAssignment} onChange={event=>form.setValue('phaseStartDate',formatDateEntryMDY(event.target.value),{shouldDirty:true,shouldValidate:true})} onKeyDown={event=>{if(event.key==='Enter'&&event.currentTarget.value.trim()==='?'){event.preventDefault();form.setValue('phaseStartDate',currentDateTimeMDY().date,{shouldDirty:true,shouldValidate:true});}}} data-testid="input-phase-start"/>{canManageAssignment&&<span className="text-xs font-normal text-muted-foreground">Type digits for automatic MM/DD/YYYY formatting. Enter ? then press Enter for today.</span>}</Field>
            <Field label="Patrol zone" error={fieldError('zone')}>{canManageAssignment?<SearchableSelect {...form.register('zone')} value={zone} className={selectInput} onChange={event=>{form.setValue('zone',event.target.value,{shouldDirty:true,shouldValidate:true});form.setValue('precinct','',{shouldDirty:true});form.setValue('ftoAssignment','',{shouldDirty:true,shouldValidate:true});}} data-testid="select-zone"><option value="">Select zone</option>{CPD_GEOGRAPHY.map(item=><option key={item.zone} value={item.zone}>Zone {item.zone}</option>)}</SearchableSelect>:<input {...form.register('zone')} className={textInput} readOnly data-testid="select-zone"/>}</Field>
            <Field label="Precinct" error={fieldError('precinct')}>{canManageAssignment?<SearchableSelect {...form.register('precinct')} value={precinct} className={selectInput} disabled={!zone} onChange={event=>{form.setValue('precinct',event.target.value,{shouldDirty:true,shouldValidate:true});form.setValue('ftoAssignment','',{shouldDirty:true,shouldValidate:true});}} data-testid="select-precinct"><option value="">Select precinct</option>{cpdPrecinctsForZone(zone).map(item=><option key={item.precinct} value={item.precinct}>Precinct {item.precinct}</option>)}</SearchableSelect>:<input {...form.register('precinct')} className={textInput} readOnly data-testid="select-precinct"/>}</Field>
            <Field label="FTO assignment" error={fieldError('ftoAssignment')}><input {...form.register('ftoAssignment')} className={textInput} list={canManageAssignment?'fto-assignment-options':undefined} autoComplete="off" readOnly={!canManageAssignment} disabled={canManageAssignment&&(!precinct||!shift)} placeholder={canManageAssignment?(shift?'Type or select assignment code':'Select shift first'):undefined} onChange={event=>form.setValue('ftoAssignment',event.target.value.toUpperCase(),{shouldDirty:true,shouldValidate:true})} data-testid="input-fto-assignment"/>{canManageAssignment&&<datalist id="fto-assignment-options">{ftoAssignmentsForPrecinct(zone,precinct,shift).map(value=><option key={value} value={value}/>)}</datalist>}</Field>
            {shift&&<fieldset>
              <legend className="label-caps mb-2">Days off · select exactly {requiredDaysOff(shift as Shift)}</legend>
              <div className="grid gap-2">{WEEKDAYS.map(({value,label})=><label key={value} className="flex min-h-11 items-center gap-2 rounded border bg-card px-3 text-sm"><input type="checkbox" checked={daysOff.includes(value)} onChange={event=>form.setValue('daysOff',event.target.checked?[...daysOff,value].sort((a,b)=>a-b) as Weekday[]:daysOff.filter(day=>day!==value),{shouldDirty:true,shouldValidate:true})} data-testid={`checkbox-day-off-${label.toLowerCase()}`}/>{label}</label>)}</div>
              <p className="mt-2 text-xs text-muted-foreground">{daysOff.length} of {requiredDaysOff(shift as Shift)} selected. Weeks run Sunday through Saturday.</p>
              {fieldError('daysOff')&&<p className="mt-1 text-sm text-destructive" role="alert">{fieldError('daysOff')}</p>}
            </fieldset>}
          </div>
        </Panel>
         {ws.caseFolder&&<p className="mt-4 text-xs text-muted-foreground">Saved phase setup opened {formatDateTimeMDY(ws.caseFolder.openedAt)}. Editing this form updates the current case-folder values; saved reports remain unchanged.</p>}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={form.formState.isSubmitting} className="inline-flex min-h-11 items-center gap-2 rounded bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50" data-testid="button-save-phase-setup">{ws.caseFolder?'Save phase setup changes':'Save and open phase folder'}</button>
          {ws.caseFolder&&<Link href="/reports/new" className="inline-flex min-h-11 items-center gap-2 rounded border bg-card px-4 text-sm font-bold" data-testid="link-start-shift-after-setup"><ArrowRight className="h-4 w-4"/>Start shift</Link>}
        </div>
      </form>
    </Form>
    {ws.role==='fto_coordinator'&&<div className="mt-6"><TrainingAssignmentsPanel onLoadAssignment={assignment=>loadAssignment(assignment.id)}/></div>}
  </div>;
}

function Field({label,error,children}:{label:string;error?:string;children:React.ReactNode}) {
  return <label className="grid min-w-0 gap-1 text-sm font-semibold"><span>{label}</span>{children}{error&&<span className="text-xs font-normal text-destructive" role="alert">{error}</span>}</label>;
}
