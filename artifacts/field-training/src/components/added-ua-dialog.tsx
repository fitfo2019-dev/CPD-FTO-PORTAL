import { useEffect, useState } from 'react';
import type { AddedDeficiency, Category } from '@/lib/model.js';
import { CATEGORY_LABEL } from '@/lib/model.js';
import { parseAddedUaMinutes } from '@/lib/added-deficiencies.js';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog.js';

export interface AddedUaRunOption { runId: string; label: string }
export interface AddedUaIssueOption { id: string; label: string }

export interface AddedUaDraft {
  runId: string;
  whatHappened: string;
  correctiveTraining: string;
  minutes: string;
  sameIssueAs: string;
}

const emptyDraft = (runId = ''): AddedUaDraft => ({ runId, whatHappened: '', correctiveTraining: '', minutes: '', sameIssueAs: '' });

export function draftFromAdded(added: AddedDeficiency): AddedUaDraft {
  return { runId: added.runId, whatHappened: added.whatHappened, correctiveTraining: added.correctiveTraining, minutes: String(added.minutes), sameIssueAs: added.sameIssueAs ?? '' };
}

/** Whole minutes, at least 1. */
export function AddedUaDialog({ category, editing, runs, issues, onSave, onClose }: {
  category?: Category;
  editing?: AddedDeficiency;
  runs: readonly AddedUaRunOption[];
  issues: readonly AddedUaIssueOption[];
  onSave: (draft: AddedUaDraft) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<AddedUaDraft>(emptyDraft());
  const [showErrors, setShowErrors] = useState(false);
  useEffect(() => {
    if (!category) return;
    setDraft(editing ? draftFromAdded(editing) : emptyDraft(runs.length === 1 ? runs[0].runId : ''));
    setShowErrors(false);
  }, [category, editing, runs]);
  const minutes = parseAddedUaMinutes(draft.minutes);
  const errors = {
    runId: !runs.some(run => run.runId === draft.runId),
    whatHappened: !draft.whatHappened.trim(),
    correctiveTraining: !draft.correctiveTraining.trim(),
    minutes: minutes === undefined,
  };
  const invalid = Object.values(errors).some(Boolean);
  const set = (patch: Partial<AddedUaDraft>) => setDraft(current => ({ ...current, ...patch }));
  const field = 'min-h-11 rounded border bg-card px-3 font-normal';
  const error = (on: boolean) => on && showErrors ? 'border-destructive' : '';
  return <AlertDialog open={!!category} onOpenChange={open => { if (!open) onClose(); }}>
    <AlertDialogContent className="max-h-[90vh] overflow-y-auto" data-testid="added-ua-dialog">
      <AlertDialogHeader>
        <AlertDialogTitle>{editing ? 'Edit UA' : 'Add UA'} · {category ? CATEGORY_LABEL[category] : ''}</AlertDialogTitle>
        <AlertDialogDescription className="sr-only">Unacceptable performance observed on a run that the run checklist did not capture.</AlertDialogDescription>
      </AlertDialogHeader>
      <label className="grid gap-1 text-sm font-semibold">Run
        <select className={`${field} ${error(errors.runId)}`} value={draft.runId} onChange={event => set({ runId: event.target.value })} data-testid="select-added-ua-run">
          <option value="">Select the run</option>
          {runs.map(run => <option key={run.runId} value={run.runId}>{run.label}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-semibold">What happened
        <textarea rows={4} value={draft.whatHappened} onChange={event => set({ whatHappened: event.target.value })} className={`w-full rounded border bg-card p-3 font-normal ${error(errors.whatHappened)}`} data-testid="input-added-ua-what-happened" />
      </label>
      <label className="grid gap-1 text-sm font-semibold">Corrective training
        <textarea rows={4} value={draft.correctiveTraining} onChange={event => set({ correctiveTraining: event.target.value })} className={`w-full rounded border bg-card p-3 font-normal ${error(errors.correctiveTraining)}`} data-testid="input-added-ua-training" />
      </label>
      <label className="grid max-w-[12rem] gap-1 text-sm font-semibold">Minutes
        <input inputMode="numeric" value={draft.minutes} onChange={event => set({ minutes: event.target.value.replace(/[^\d]/g, '') })} className={`${field} ${error(errors.minutes)}`} data-testid="input-added-ua-minutes" />
      </label>
      {issues.length > 0 && <label className="grid gap-1 text-sm font-semibold">Same issue as
        <select className={field} value={draft.sameIssueAs} onChange={event => set({ sameIssueAs: event.target.value })} data-testid="select-added-ua-same-issue">
          <option value="">None</option>
          {issues.map(issue => <option key={issue.id} value={issue.id}>{issue.label}</option>)}
        </select>
      </label>}
      <AlertDialogFooter>
        <button type="button" onClick={onClose} className="min-h-11 rounded border bg-card px-4 text-sm font-semibold" data-testid="button-added-ua-cancel">Cancel</button>
        <button type="button" onClick={() => { if (invalid) { setShowErrors(true); return; } onSave(draft); }} className="min-h-11 rounded bg-primary px-4 text-sm font-bold text-primary-foreground" data-testid="button-added-ua-save">Save UA</button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
