import React from 'react';
import type { Category, ChecklistDeficiencyGroup } from '@/lib/model.js';
import { SEG_CATEGORIES } from '@/lib/model.js';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog.js';

export function DeficiencyDialog({ group, onNarrative, onOverride, onClose }: {
  group?: ChecklistDeficiencyGroup;
  onNarrative: (text: string) => void;
  onOverride: (category: Category) => void;
  onClose: () => void;
}) {
  return <AlertDialog open={!!group} onOpenChange={open => { if (!open) onClose(); }}>
    <AlertDialogContent className="max-h-[90vh] overflow-y-auto" data-testid="deficiency-dialog">
      <AlertDialogHeader>
        <AlertDialogTitle>Change UA category</AlertDialogTitle>
        <AlertDialogDescription className="sr-only">Category and what happened for this UA</AlertDialogDescription>
      </AlertDialogHeader>
      {group && <>
        <label className="grid gap-1 text-sm font-semibold">Category
          <select className="min-h-11 rounded border bg-card px-3 font-normal" value={group.category}
            onChange={event => {
              const category = SEG_CATEGORIES.find(item => item.key === event.target.value)?.key;
              if (category) onOverride(category);
            }} data-testid="select-deficiency-category">
            {SEG_CATEGORIES.map(category => <option key={category.key} value={category.key}>{category.label}</option>)}
          </select>
        </label>
        <div className="rounded border bg-muted/20 p-3 text-sm" data-testid="deficiency-sources">
          {group.tasks.map(task => <div key={task.id}>
            <p><b className="mono">{task.reference ?? 'Coordinate pending phase schedule'}</b> — {task.label}</p>
            {task.failureActions?.map(action=><p key={action} className="pl-4 font-bold text-destructive">{action}</p>)}
          </div>)}
        </div>
        <label className="grid gap-1 text-sm font-semibold">What happened
          <textarea rows={7} value={group.narrative} onChange={event => onNarrative(event.target.value)}
            className="w-full rounded border bg-card p-3 font-normal" data-testid="input-deficiency-narrative" />
        </label>
      </>}
      <AlertDialogFooter>
        <button type="button" onClick={onClose} className="min-h-11 rounded border bg-card px-4 text-sm font-semibold" data-testid="button-deficiency-close">Done</button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
