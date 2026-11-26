import React from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog.js';

export type UncheckedChoice = 'fail' | 'na';
export type UncheckedItem = { key: string; keys: readonly string[]; label: string };

export function RunChecklistUncheckedDialog({
  open, rowLabel, items, choices, onChoicesChange, onCancel, onConfirm,
}: {
  open: boolean;
  rowLabel: string;
  items: readonly UncheckedItem[];
  choices: Readonly<Record<string, UncheckedChoice | undefined>>;
  onChoicesChange: (next: Record<string, UncheckedChoice | undefined>) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const allFailed = items.length > 0 && items.every(item => choices[item.key] === 'fail');
  const anyChosen = items.some(item => choices[item.key]);
  const set = (key: string, value: UncheckedChoice) =>
    onChoicesChange({ ...choices, [key]: choices[key] === value ? undefined : value });
  const toggleAll = (checked: boolean) =>
    onChoicesChange(Object.fromEntries(items.map(item => [item.key, checked ? 'fail' : undefined])));
  const btn = (active: boolean, tone: 'fail' | 'na') =>
    `min-h-9 px-3 text-xs font-bold uppercase tracking-wide ${active
      ? tone === 'fail' ? 'bg-destructive text-destructive-foreground' : 'bg-muted-foreground text-background'
      : 'bg-card text-muted-foreground'}`;
  return <Dialog open={open} onOpenChange={next => { if (!next) onCancel(); }}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" data-testid="dialog-run-checklist-unchecked">
      <DialogHeader>
        <DialogTitle className="uppercase tracking-wide">Not Completed or Not Satisfactory</DialogTitle>
        <DialogDescription className="sr-only">{rowLabel}</DialogDescription>
      </DialogHeader>
      <p className="rounded border bg-muted/30 p-3 text-sm font-semibold leading-5" data-testid="text-unchecked-row">{rowLabel}</p>
      {items.length > 1 && <label className="flex min-h-10 items-center gap-2 text-sm font-bold uppercase tracking-wide">
        <input type="checkbox" checked={allFailed} onChange={event => toggleAll(event.target.checked)} data-testid="checkbox-unchecked-all" />
        All of these
      </label>}
      <div className="divide-y rounded border" role="group" aria-label={rowLabel}>
        {items.map((item, index) => {
          const choice = choices[item.key];
          return <div key={item.key} className={`flex flex-wrap items-center justify-between gap-3 p-3 ${choice === 'fail' ? 'bg-destructive/5' : ''}`}>
            <span className={`min-w-0 flex-1 text-sm leading-5 ${choice === 'fail' ? 'font-semibold text-destructive' : ''} ${choice === 'na' ? 'font-bold line-through decoration-2' : ''}`}
              data-testid={`text-unchecked-item-${index}`}>{item.label}</span>
            <span className="inline-flex overflow-hidden rounded border">
              <button type="button" aria-pressed={choice === 'fail'} className={btn(choice === 'fail', 'fail')}
                onClick={() => set(item.key, 'fail')} data-testid={`button-unchecked-fail-${index}`}>Not satisfactory</button>
              <button type="button" aria-pressed={choice === 'na'} className={`${btn(choice === 'na', 'na')} border-l`}
                onClick={() => set(item.key, 'na')} data-testid={`button-unchecked-na-${index}`}>Did not apply</button>
            </span>
          </div>;
        })}
      </div>
      <DialogFooter>
        <button type="button" onClick={onCancel} className="min-h-10 rounded border bg-card px-4 text-sm font-semibold uppercase tracking-wide" data-testid="button-cancel-unchecked">Cancel</button>
        <button type="button" disabled={!anyChosen} onClick={onConfirm} className="min-h-10 rounded bg-primary px-4 text-sm font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-50" data-testid="button-confirm-unchecked">Confirm</button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
