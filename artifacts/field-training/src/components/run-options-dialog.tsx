import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog.js';
import { cn } from '@/lib/utils.js';
import type { ActivityKey, SupplementalRunForm, TrainingRun } from '@/lib/model.js';

const foregroundStyle={color:'hsl(var(--foreground))'};

export interface RunOptionsDialogProps {
  open: boolean;
  onOpenChange: (open:boolean)=>void;
  disabled?: boolean;
  className?: string;
  showTraffic: boolean;
  trafficMode: TrainingRun['trafficMode'];
  onTrafficChange: (mode:TrainingRun['trafficMode'])=>void;
  forms: readonly { key:SupplementalRunForm; label:string; selected:boolean; lockedReason?:string }[];
  onFormChange: (form:SupplementalRunForm,selected:boolean)=>void;
  activities: readonly { key:ActivityKey; label:string; selected:boolean; disabled?:boolean }[];
  onActivityChange: (key:ActivityKey,selected:boolean)=>void;
  onClearActivities: ()=>void;
  activityHint: string;
}

function Choice({ selected,disabled,label,detail,onClick,id }:{
  selected:boolean;disabled?:boolean;label:string;detail?:string;onClick:()=>void;id:string;
}) {
  return <button type="button" aria-pressed={selected} disabled={disabled} onClick={onClick}
    data-testid={id} className={cn('min-h-11 rounded border px-3 py-2 text-left text-sm font-semibold disabled:opacity-50',
      selected?'border-primary bg-primary/10 text-foreground':'bg-card text-foreground')}>
    <span>{selected?'✓ ':''}{label}</span>{detail&&<small className="mt-1 block text-xs font-normal text-muted-foreground">{detail}</small>}
  </button>;
}

/** Controlled choices update the open run, not saved records or statistics. */
export function RunOptionsChoices(props:RunOptionsDialogProps) {
  const solve=props.activities.find(item=>item.key==='solveCitationSummons');
  const trafficChoices:readonly [TrainingRun['trafficMode'],string][]=[
    ['none','Not Selected'],['motor_vehicle','Motor Vehicle'],['pedestrian','Pedestrian'],['bicycle','Bicycle'],['other','Other'],
  ];
  return <>
      {props.showTraffic&&<section aria-labelledby="run-options-traffic"><h3 id="run-options-traffic" style={foregroundStyle} className="mb-2 text-sm font-bold">Traffic Violator</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{trafficChoices.map(([mode,label])=><Choice key={mode}
          label={label} selected={props.trafficMode===mode} disabled={props.disabled}
          onClick={()=>props.onTrafficChange(props.trafficMode===mode?'none':mode)} id={`button-traffic-option-${mode}`}/>)}</div>
      </section>}
      {solve&&<section aria-labelledby="run-options-solve"><h3 id="run-options-solve" style={foregroundStyle} className="mb-2 text-sm font-bold">Solve Citation/Summons</h3>
        <Choice label={solve.label} selected={solve.selected} disabled={props.disabled||solve.disabled}
          onClick={()=>props.onActivityChange(solve.key,!solve.selected)} id="button-run-option-solveCitationSummons"/>
      </section>}
      <section aria-labelledby="run-options-forms"><h3 id="run-options-forms" style={foregroundStyle} className="mb-2 text-sm font-bold">Additional Forms</h3>
        <p className="mb-2 text-xs text-muted-foreground">Each selected form is a separate sheet and inherits this run’s details. Attaching it does not record an arrest, transport, clearance, or statistic. Required forms cannot be detached here.</p>
        <div className="grid gap-2 sm:grid-cols-2">{props.forms.map(form=><Choice key={form.key} label={form.label}
          selected={form.selected} disabled={props.disabled||!!form.lockedReason}
          detail={form.lockedReason??(form.selected?'Attached as a separate sheet':'Not attached')}
          onClick={()=>props.onFormChange(form.key,!form.selected)} id={`button-run-form-${form.key}`}/>)}</div>
      </section>
      <details className="rounded border p-3"><summary className="cursor-pointer text-sm font-bold">Related Activity · {props.activities.filter(item=>item.key!=='solveCitationSummons'&&item.selected).length} Selected</summary><div className="mt-3">
        <p className="mb-2 text-xs text-muted-foreground">{props.activityHint}</p>
        <p className="mb-2 text-xs text-muted-foreground">Supporting records only. These choices never change daily, weekly, phase, class, or monthly statistics. Enter official totals manually in Daily Activity Summary.</p>
        <div className="grid gap-2 sm:grid-cols-2">{props.activities.filter(item=>item.key!=='solveCitationSummons').map(item=><Choice key={item.key}
          label={item.label} selected={item.selected} disabled={props.disabled||item.disabled}
          onClick={()=>props.onActivityChange(item.key,!item.selected)} id={`button-run-activity-${item.key}`}/>)}</div>
        <button type="button" disabled={props.disabled} onClick={props.onClearActivities} className="mt-3 min-h-11 rounded border px-3 text-sm disabled:opacity-50">Clear Activity Selections</button>
      </div></details>
  </>;
}

export function RunOptionsDialog(props:RunOptionsDialogProps) {
  return <Dialog open={props.open} onOpenChange={props.onOpenChange}>
    <DialogContent style={foregroundStyle} className={cn('max-h-[90dvh] overflow-y-auto sm:max-w-3xl',props.className)} data-testid="dialog-run-options">
      <DialogHeader><DialogTitle style={foregroundStyle}>Optional Items and Additional Forms</DialogTitle>
        <DialogDescription>{props.disabled?'Read-only. You can view this run’s selections but cannot change them here.':'Select only what applies. Selected buttons are marked. These choices update the open run; use Add or Update Run to save it. Unselected optional items do not print.'}</DialogDescription>
      </DialogHeader>
      <RunOptionsChoices {...props}/>
      <DialogFooter><button type="button" onClick={()=>props.onOpenChange(false)} className="min-h-11 rounded bg-primary px-5 text-sm font-bold text-primary-foreground">Done</button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
