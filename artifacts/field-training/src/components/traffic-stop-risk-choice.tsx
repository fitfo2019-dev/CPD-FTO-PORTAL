import * as React from 'react';
import type { PrimaryRunForm } from '@/lib/model.js';
import {AlertDialog,AlertDialogContent,AlertDialogDescription,AlertDialogTitle} from '@/components/ui/alert-dialog.js';

/** The primary form is the only saved source of truth, including legacy runs. */
export function TrafficStopRiskPrompt({ open,onOpenChange,kind,code,onChange,testId }: {
  open:boolean;
  onOpenChange:(open:boolean)=>void;
  kind: PrimaryRunForm | '';
  code?:string;
  onChange: (kind:'traffic_stop'|'high_risk_stop') => void;
  testId: string;
}) {
  const no=React.useRef<HTMLButtonElement>(null),yes=React.useRef<HTMLButtonElement>(null);
  return <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent data-testid={testId} className="max-w-lg"
      onOpenAutoFocus={event=>{event.preventDefault();(kind==='high_risk_stop'?yes:no).current?.focus();}}>
      <p className="label-caps">{code==='6'?'10-6 · Traffic Stop':'Traffic Stop'}</p>
      <AlertDialogTitle className="text-2xl">Was This a High-Risk Stop?</AlertDialogTitle>
      <AlertDialogDescription className="sr-only">Choose the primary traffic-stop form.</AlertDialogDescription>
      <div className="mt-3 flex justify-end gap-3">
        <button ref={no} type="button" aria-pressed={kind!=='high_risk_stop'} onClick={()=>onChange('traffic_stop')}
          className="min-h-11 min-w-24 rounded border bg-card px-5 text-sm font-bold"
          data-testid={`${testId}-no`}>No</button>
        <button ref={yes} type="button" aria-pressed={kind==='high_risk_stop'} onClick={()=>onChange('high_risk_stop')}
          className="min-h-11 min-w-24 rounded bg-primary px-5 text-sm font-bold text-primary-foreground"
          data-testid={`${testId}-yes`}>Yes</button>
      </div>
    </AlertDialogContent>
  </AlertDialog>;
}
