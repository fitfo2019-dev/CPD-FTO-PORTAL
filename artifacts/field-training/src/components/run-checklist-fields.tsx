import React, { type ReactNode } from 'react';
import { partitionRevisedChecklist, revisedRowState, unitState, type RevisedChecklistRow, type RevisedChecklistSection } from '@/lib/revised-run-checklists.js';

type Props = {
  sections: readonly RevisedChecklistSection[];
  state: Record<string, boolean>;
  prefix: string;
  disabled: boolean;
  testId: string;
  onChange: (indices: readonly number[], checked: boolean) => void;
  renderItemDetails?: (indices: readonly number[]) => ReactNode;
  notApplicable?: Readonly<Record<string, true>>;
};


function RowLabel({ row, state, prefix, notApplicable }: { row: RevisedChecklistRow; state: Record<string, boolean>; prefix: string; notApplicable?: Readonly<Record<string, true>> }) {
  return <>{row.units.map((unit, position) => {
    const { failed, notApplicable: na } = unitState(state, prefix, unit, notApplicable);
    return <React.Fragment key={unit.join('-')}>
      {position > 0 && <span className="text-muted-foreground"> / </span>}
      <span className={na ? 'font-bold line-through decoration-2' : failed ? 'rounded-sm bg-destructive/10 px-0.5 font-semibold text-destructive' : undefined}
        data-state={na ? 'not-applicable' : failed ? 'failed' : 'complete'}>{row.unitLabels[position]}</span>
    </React.Fragment>;
  })}</>;
}

/** Fixed sections shared by every run form; answers never hide or move rows. */
export function RunChecklistFields({ sections, state, prefix, disabled, testId, onChange, renderItemDetails, notApplicable }: Props) {
  const display=partitionRevisedChecklist(sections);
  return <div className="mt-2 grid gap-3">
    {display.headerOptions.length>0&&<div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      {display.headerOptions.map(item=><label key={item.id} className="inline-flex items-center gap-2 text-sm font-semibold" title={item.help}>
        <input type="checkbox" checked={revisedRowState(state,prefix,item.indices).checked}
          disabled={disabled} onChange={event=>onChange(item.indices,event.target.checked)}
          data-testid={`${testId}-row-${item.id}`}/>
        {item.label}
      </label>)}
    </div>}
    {display.sections.map(section => {
      const indices = section.items.flatMap(item => item.indices);
      const sectionState = revisedRowState(state, prefix, indices);
      return <fieldset key={section.title} disabled={disabled} className="min-w-0 rounded border p-3">
        <legend className="max-w-full px-2 text-xs font-bold">
          <button type="button" disabled={disabled}
            className="whitespace-normal text-left"
            aria-label={`Toggle ${section.title} checklist`}
            aria-pressed={sectionState.mixed ? 'mixed' : sectionState.checked}
            onClick={() => onChange(indices, !sectionState.checked)}
            data-testid={`${testId}-section-${section.items[0]?.id}`}>
            {section.title}
          </button>
        </legend>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
          {section.items.map(item => {
            const value = revisedRowState(state, prefix, item.indices);
            return <div key={item.id} className="min-w-0">
              <label title={item.help} className="flex min-w-0 items-start gap-2 rounded-sm py-1 text-xs leading-5">
                <input type="checkbox" disabled={disabled} checked={value.checked}
                  aria-checked={value.mixed ? 'mixed' : value.checked}
                  ref={input => { if (input) input.indeterminate = value.mixed; }}
                  className="mt-1 shrink-0"
                  onChange={event => onChange(item.indices, event.target.checked)}
                  data-testid={`${testId}-row-${item.id}`} />
                <span className="min-w-0 break-words"><RowLabel row={item} state={state} prefix={prefix} notApplicable={notApplicable} /></span>
              </label>
              {renderItemDetails?.(item.indices)}
            </div>;
          })}
        </div>
      </fieldset>;
    })}
  </div>;
}
