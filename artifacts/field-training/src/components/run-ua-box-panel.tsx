import React, { useState } from 'react';
import { CATEGORIES, CATEGORY_LABEL, type Category, type RunUaBox } from '@/lib/model.js';
import type { RunFailureStatement } from '@/lib/run-failure-statements.js';
import { parseUaMinutes, UA_MINUTE_CHOICES } from '@/lib/run-ua-box.js';
import { categoryNumberLabel } from '@/lib/weekly-log-layout.js';

type Props = {
  editable: boolean;
  statements: readonly (RunFailureStatement & { category?: Category })[];
  onStatementChange: (keys: readonly string[], value: string) => void;
  /** Categories captured by unchecked boxes on this run; locked in the box. */
  checklistCategories: readonly Category[];
  box: RunUaBox;
  onChange: (next: RunUaBox) => void;
  /** Earlier UA's in the same category this phase, newest last; nothing is linked until the FTO taps one. */
  suggestions: (category: Category) => { id: string; label: string; shortLabel: string }[];
};

const categoryName = (category: Category) => `${categoryNumberLabel(category)} · ${CATEGORY_LABEL[category]}`;

/** One UA box per run: every UA category, what happened, the corrective training and total minutes. */
export function RunUaBoxPanel({ editable, statements, onStatementChange, checklistCategories, box, onChange, suggestions }: Props) {
  const added = box.addedCategories ?? [];
  const categories = [...new Set([...checklistCategories, ...added])];
  const [open, setOpen] = useState(false);
  const [otherMinutes, setOtherMinutes] = useState(() => box.minutes && !(UA_MINUTE_CHOICES as readonly number[]).includes(box.minutes) ? String(box.minutes) : '');
  if (!categories.length && !open) {
    return <div className="my-3" data-testid="section-run-ua-box-empty">
      <button type="button" disabled={!editable} onClick={() => setOpen(true)}
        className="min-h-10 rounded border border-destructive/50 bg-card px-3 text-xs font-bold text-destructive hover:bg-destructive/5 disabled:opacity-50"
        data-testid="button-open-run-ua-box">Add UA</button>
    </div>;
  }
  const patch = (next: Partial<RunUaBox>) => onChange({ ...box, ...next });
  const available = CATEGORIES.filter(category => !categories.includes(category));
  const minutesMissing = !box.minutes;
  const trainingMissing = !box.correctiveTraining?.trim();
  const whatMissing = !box.whatHappened?.trim() && (added.length > 0 || statements.length === 0);
  const required = (missing: boolean) => missing ? <span className="ml-2 text-[11px] font-bold uppercase tracking-wide text-destructive">Required</span> : null;
  return <section className="my-3 rounded border border-destructive/40 bg-destructive/5 p-3" data-testid="section-run-ua-box">
    <h4 className="text-xs font-bold uppercase tracking-wide text-destructive">Unacceptable performance</h4>
    <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="list-run-ua-categories">
      {categories.map(category => {
        const locked = checklistCategories.includes(category);
        return <span key={category} className="inline-flex min-h-8 items-center gap-1 rounded border bg-card px-2 text-xs font-semibold" data-testid={`chip-run-ua-${category}`}>
          {categoryName(category)}
          {!locked && editable && <button type="button" aria-label={`Remove ${CATEGORY_LABEL[category]}`} className="ml-1 px-1 font-bold text-destructive"
            onClick={() => patch({ addedCategories: added.filter(item => item !== category) })} data-testid={`button-remove-run-ua-${category}`}>×</button>}
        </span>;
      })}
      {editable && available.length > 0 && <select value="" aria-label="Add category" className="h-8 rounded border bg-card px-2 text-xs font-semibold"
        onChange={event => { const value = event.target.value as Category; if (value) patch({ addedCategories: [...added, value] }); }} data-testid="select-add-run-ua-category">
        <option value="">Add category</option>
        {available.map(category => <option key={category} value={category}>{categoryName(category)}</option>)}
      </select>}
    </div>
    <div className="mt-3 grid gap-2">
      <span className="text-xs font-bold uppercase tracking-wide">What happened{required(whatMissing)}</span>
      {statements.map((statement, index) => <label key={statement.keys.join('|')} className="grid gap-1">
        {statement.category && <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground" data-testid={`text-po-failed-category-${index}`}>{categoryName(statement.category)}</span>}
        <textarea rows={Math.max(2, Math.ceil(statement.text.length / 85))} disabled={!editable} className="w-full rounded border bg-card p-2 text-sm [field-sizing:content]" value={statement.text}
          aria-label={`PO failed to statement ${index + 1}`} onChange={event => onStatementChange(statement.keys, event.target.value)} data-testid={`input-po-failed-${index}`}/>
      </label>)}
      <textarea rows={2} disabled={!editable} className="w-full rounded border bg-card p-2 text-sm [field-sizing:content]" value={box.whatHappened ?? ''}
        aria-label="What happened, FTO additions" onChange={event => patch({ whatHappened: event.target.value })} data-testid="input-run-ua-what-happened"/>
    </div>
    <label className="mt-3 grid gap-1">
      <span className="text-xs font-bold uppercase tracking-wide">Corrective training{required(trainingMissing)}</span>
      <textarea rows={2} disabled={!editable} className="w-full rounded border bg-card p-2 text-sm [field-sizing:content]" value={box.correctiveTraining ?? ''}
        onChange={event => patch({ correctiveTraining: event.target.value })} data-testid="input-run-ua-corrective-training"/>
    </label>
    <div className="mt-3 grid gap-1">
      <span className="text-xs font-bold uppercase tracking-wide">Corrective training minutes{required(minutesMissing)}</span>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Corrective training minutes">
        {UA_MINUTE_CHOICES.map(minutes => <button type="button" key={minutes} disabled={!editable} aria-pressed={box.minutes === minutes && !otherMinutes}
          onClick={() => { setOtherMinutes(''); patch({ minutes }); }}
          className={`min-h-10 min-w-12 rounded border px-3 text-sm font-bold ${box.minutes === minutes && !otherMinutes ? 'bg-primary text-primary-foreground' : 'bg-card'}`}
          data-testid={`button-run-ua-minutes-${minutes}`}>{minutes}</button>)}
        <input inputMode="numeric" maxLength={3} disabled={!editable} value={otherMinutes} placeholder="Other" aria-label="Other minutes"
          onChange={event => { const value = event.target.value.replace(/\D/g, ''); setOtherMinutes(value); patch({ minutes: parseUaMinutes(value) }); }}
          className="h-10 w-20 rounded border bg-card px-2 text-sm" data-testid="input-run-ua-minutes-other"/>
      </div>
    </div>
    {categories.map(category => {
      const options = suggestions(category);
      if (!options.length) return null;
      const linked = box.sameIssueAs?.[category];
      const latest = options.at(-1)!;
      const setLink = (value?: string) => {
        const next = { ...box.sameIssueAs };
        if (value) next[category] = value; else delete next[category];
        patch({ sameIssueAs: next });
      };
      return <div key={category} className="mt-3 grid gap-1" data-testid={`section-run-ua-same-issue-${category}`}>
        <span className="text-xs font-bold uppercase tracking-wide">Same issue as · {categoryNumberLabel(category)}</span>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={!editable} aria-pressed={linked === latest.id} onClick={() => setLink(linked === latest.id ? undefined : latest.id)}
            className={`min-h-10 max-w-full whitespace-normal break-words rounded border px-3 py-2 text-left text-xs font-semibold ${linked === latest.id ? 'bg-primary text-primary-foreground' : 'bg-card'}`}
            data-testid={`button-run-ua-same-issue-${category}`}>{latest.label}</button>
          {options.length > 1 && <select disabled={!editable} value={linked && linked !== latest.id ? linked : ''} aria-label="Earlier UA"
            onChange={event => setLink(event.target.value || undefined)} className="h-10 max-w-full rounded border bg-card px-2 text-xs" data-testid={`select-run-ua-same-issue-${category}`}>
            <option value="">Earlier UA</option>
            {options.slice(0, -1).map(option => <option key={option.id} value={option.id}>{option.shortLabel}</option>)}
          </select>}
        </div>
      </div>;
    })}
  </section>;
}
