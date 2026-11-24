import React from 'react';
import { Check, CircleDot, PenLine } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import type { RunWorkflowStep } from '@/lib/run-workflow.js';
import {RUN_CHECKLIST_ITEMS,RUN_SUPPLEMENT_CHECKLIST_ITEMS,type PrimaryRunForm,type SupplementalRunForm} from '@/lib/model.js';

export type SheetState = 'reviewed' | 'needs_review';

/** True when a sheet holds anything other than its untouched defaults. */
export function sheetHasEdits(sheet: string, runKind: string, checklist: Record<string, boolean>, directiveReviews: Record<string, unknown>): boolean {
  const prefix = sheet === 'primary' ? 'task-' : `supp-${sheet}-`;
  const naKey = sheet === 'primary' ? 'na-task' : `na-supp-${sheet}`;
  const form:PrimaryRunForm|SupplementalRunForm=sheet === 'primary' ? runKind as PrimaryRunForm : sheet as SupplementalRunForm;
  const labels:readonly string[] = sheet === 'primary' ? RUN_CHECKLIST_ITEMS[runKind as PrimaryRunForm] : RUN_SUPPLEMENT_CHECKLIST_ITEMS[sheet as SupplementalRunForm];
  const changed = !!checklist[naKey]
    || Object.entries(checklist).some(([key, value]) => key.startsWith(prefix) && value === false)
    || !!directiveReviews[form];
  return changed || !labels.every((_, index) => checklist[`${prefix}${index}`] === true);
}

export function SheetStatus({ state, unsaved, testId }: { state: SheetState; unsaved?: boolean; testId?: string }) {
  return <span className="inline-flex flex-wrap items-center gap-1" data-testid={testId}>
    <span className={cn('run-sheet-pill', state === 'reviewed' ? 'is-reviewed' : 'is-pending')}>
      {state === 'reviewed' ? <Check className="h-3 w-3" aria-hidden /> : <CircleDot className="h-3 w-3" aria-hidden />}
      {state === 'reviewed' ? 'Reviewed' : 'Needs review'}
    </span>
    {unsaved && <span className="run-sheet-pill is-unsaved"><PenLine className="h-3 w-3" aria-hidden />Unsaved</span>}
  </span>;
}

export function RunStepRail({ steps, current, stateFor, onSelect }: {
  steps: RunWorkflowStep[];
  current: string;
  stateFor: (step: RunWorkflowStep) => SheetState | 'info';
  onSelect: (id: string) => void;
}) {
  return <ol className="run-step-rail" aria-label="Run packet sheets" data-testid="nav-run-steps">
    {steps.map((step, index) => {
      const state = stateFor(step);
      const active = step.id === current;
      return <li key={step.id}>
        <button
          type="button"
          onClick={() => onSelect(step.id)}
          aria-current={active ? 'step' : undefined}
          className={cn('run-step', active && 'is-active', state === 'reviewed' && 'is-reviewed', state === 'needs_review' && 'is-pending')}
          data-testid={`button-run-step-${step.id}`}
        >
          <span className="run-step-index mono">{state === 'reviewed' ? <Check className="h-3.5 w-3.5" aria-hidden /> : index + 1}</span>
          <span className="run-step-text">
            <span className="run-step-title">{step.title}</span>
            <span className="run-step-sub">{state === 'reviewed' ? 'Reviewed' : state === 'needs_review' ? 'Needs review' : step.kind === 'details' ? 'Run facts' : 'Narrative and save'}</span>
          </span>
        </button>
      </li>;
    })}
  </ol>;
}
