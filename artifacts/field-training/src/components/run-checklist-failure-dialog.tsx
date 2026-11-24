import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.js';

export function RunChecklistFailureDialog({
  open,
  parentLabel,
  choices,
  selected,
  mode,
  onSelectedChange,
  onCancel,
  onConfirm,
}: {
  open:boolean;
  parentLabel:string;
  choices:readonly string[];
  selected:readonly string[];
  mode:'clear'|'edit';
  onSelectedChange:(next:string[])=>void;
  onCancel:()=>void;
  onConfirm:()=>void;
}) {
  return <Dialog open={open} onOpenChange={nextOpen=>{if(!nextOpen)onCancel();}}>
    <DialogContent className="max-h-[90vh] overflow-y-auto" data-testid="dialog-run-checklist-failure">
      <DialogHeader>
        <DialogTitle>{mode==='edit'?'Edit Specific Failure Actions':'Identify Specific Actions Not Completed'}</DialogTitle>
        <DialogDescription>Select every action the PO did not complete acceptably. The original checklist label stays unchanged.</DialogDescription>
      </DialogHeader>
      <p className="rounded border bg-muted/30 p-3 text-sm font-semibold leading-5" data-testid="text-run-failure-parent">{parentLabel}</p>
      <fieldset className="grid gap-2" aria-label="Specific actions not completed">
        {choices.map((action,index)=><label key={action} className="flex min-h-11 items-start gap-3 rounded border bg-card p-3 text-sm leading-5">
          <input type="checkbox" checked={selected.includes(action)} onChange={event=>onSelectedChange(event.target.checked?[...selected,action]:selected.filter(item=>item!==action))} data-testid={`checkbox-run-failure-action-${index}`}/>
          <span>{action}</span>
        </label>)}
      </fieldset>
      <p className="min-h-5 text-xs text-muted-foreground" aria-live="polite" data-testid="status-run-failure-selection">
        {selected.length?`${selected.length} action${selected.length===1?'':'s'} selected`:'Select at least one action to confirm.'}
      </p>
      <DialogFooter>
        <button type="button" onClick={onCancel} className="min-h-10 rounded border bg-card px-4 text-sm font-semibold" data-testid="button-cancel-run-failure">Cancel</button>
        <button type="button" disabled={!selected.length} onClick={onConfirm} className="min-h-10 rounded bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50" data-testid="button-confirm-run-failure">{mode==='edit'?'Save Failure Details':'Confirm Failure'}</button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
