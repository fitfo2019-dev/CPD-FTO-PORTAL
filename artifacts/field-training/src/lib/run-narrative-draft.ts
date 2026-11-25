import {
  PRIMARY_RUN_FORMS,
  RUN_CHECKLIST_SECTIONS,
  RUN_SUPPLEMENT_CHECKLIST_SECTIONS,
  SUPPLEMENTAL_RUN_FORMS,
  type PrimaryRunForm,
  type SupplementalRunForm,
} from './model.js';

function selectedChecklistLines(
  title: string,
  sections: readonly { title: string; items: readonly { label: string }[] }[],
  checklist: Record<string, boolean>,
  prefix: string,
  notApplicableKey: string,
): string[] {
  if (checklist[notApplicableKey] === true) return [];

  let offset = 0;
  const lines: string[] = [];
  for (const section of sections) {
    const selected: string[] = [];
    for (const item of section.items) {
      const key = `${prefix}${offset}`;
      offset += 1;
      if (checklist[key] !== false) selected.push(item.label);
    }
    if (selected.length) {
      lines.push(`${title} — ${section.title || 'Checklist'}: ${selected.join(', ')}`);
    }
  }
  return lines;
}

export function buildRunNarrativeDraft(
  runKind: PrimaryRunForm,
  checklist: Record<string, boolean>,
  activeSupplements: readonly SupplementalRunForm[],
): string {
  const primaryTitle = PRIMARY_RUN_FORMS.find(form => form.key === runKind)?.label ?? 'Primary run';
  const sections = selectedChecklistLines(
    primaryTitle,
    RUN_CHECKLIST_SECTIONS[runKind],
    checklist,
    'task-',
    'na-task',
  );

  for (const formKey of activeSupplements) {
    const formTitle = SUPPLEMENTAL_RUN_FORMS.find(form => form.key === formKey)?.label ?? formKey;
    sections.push(...selectedChecklistLines(
      formTitle,
      RUN_SUPPLEMENT_CHECKLIST_SECTIONS[formKey],
      checklist,
      `supp-${formKey}-`,
      `na-supp-${formKey}`,
    ));
  }

  if (!sections.length) {
    return 'System-generated checklist outline — verify and edit before saving. No active checklist items are marked complete.';
  }

  return `System-generated checklist outline — verify and edit before saving. The reviewed checklist records these selected items: ${sections.join('; ')}.`;
}
