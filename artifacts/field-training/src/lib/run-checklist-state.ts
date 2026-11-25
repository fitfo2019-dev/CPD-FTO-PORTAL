import { newRunChecklist, requiredSupplementalForms } from './model.js';

export type RunChecklistMetadata = Parameters<typeof requiredSupplementalForms>[0];

/** Primary indices are form-specific; supplemental answers belong to the run. */
export function resetPrimaryChecklist(metadata: RunChecklistMetadata, previous: Record<string, boolean>) {
  return checklistForMetadata(metadata, Object.fromEntries(
    Object.entries(previous).filter(([key]) => !key.startsWith('task-') && key !== 'na-task'),
  ));
}

export function checklistForMetadata(
  metadata: RunChecklistMetadata,
  previous: Record<string, boolean> = {},
): Record<string, boolean> {
  const defaults = newRunChecklist(
    metadata.runKind,
    requiredSupplementalForms(metadata),
  );

  return {...previous, ...Object.fromEntries(
    Object.entries(defaults).map(([key, defaultValue]) => [
      key,
      previous[key] ?? defaultValue,
    ]),
  )};
}

export function toggleChecklistSection(
  checklist: Record<string, boolean>,
  prefix: string,
  start: number,
  itemCount: number,
  notApplicableKey: string,
): { checklist: Record<string, boolean>; checked: boolean } {
  const keys = Array.from({ length: itemCount }, (_, index) => `${prefix}${start + index}`);
  const checked = !keys.every(key => checklist[key] !== false);
  const updated = Object.fromEntries(keys.map(key => [key, checked]));

  return {
    checklist: {
      ...checklist,
      [notApplicableKey]: false,
      ...updated,
    },
    checked,
  };
}
