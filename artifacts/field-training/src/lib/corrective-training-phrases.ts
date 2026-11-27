/**
 * Corrective training phrases inserted only when the FTO taps one (owner, Nov 27, 2026: "I draft, you approve").
 * FTO manual, Weekly Performance Log instructions: the FTO articulates the corrective training provided; the text stays fully editable.
 * {items} is the exact checklist wording of the unchecked boxes, or the category name for an added UA.
 */
export const CORRECTIVE_TRAINING_TEMPLATES = [
  { id: 'discussed', text: 'Discussed with the PO the correct procedure for {items}.' },
  { id: 'demonstrated', text: 'FTO demonstrated {items}, and the PO then performed it correctly.' },
  { id: 'directive', text: 'Reviewed the Division directive and SOP covering {items} with the PO.' },
  { id: 'role-play', text: 'Conducted a role-play of {items} with the PO.' },
  { id: 'explained-back', text: 'PO explained the correct procedure for {items} back to the FTO.' },
] as const;

export type CorrectiveTrainingPhrase = { id: string; text: string };

const joinItems = (items: readonly string[]) => {
  const list = [...new Set(items.map(item => item.trim()).filter(Boolean))];
  if (list.length <= 1) return list[0] ?? '';
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
};

/** Phrases for the current run UA box; empty when nothing is in the box. */
export function correctiveTrainingPhrases(items: readonly string[]): CorrectiveTrainingPhrase[] {
  const named = joinItems(items);
  if (!named) return [];
  return CORRECTIVE_TRAINING_TEMPLATES.map(template => ({ id: template.id, text: template.text.replace('{items}', named) }));
}

/** Appends a tapped phrase to the existing corrective training text with one space between sentences. */
export function insertCorrectiveTrainingPhrase(current: string | undefined, phrase: string): string {
  const base = (current ?? '').replace(/\s+$/, '');
  return base ? `${base} ${phrase}` : phrase;
}
