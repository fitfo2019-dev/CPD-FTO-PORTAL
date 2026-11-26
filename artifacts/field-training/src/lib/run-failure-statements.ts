import {
  RUN_CHECKLIST_SECTIONS,
  RUN_SUPPLEMENT_CHECKLIST_SECTIONS,
  requiredSupplementalForms,
  type TrainingRun,
} from './model.js';

/**
 * Owner-approved "PO failed to" sentences, keyed by the exact checklist label
 * (case-insensitive). Labels that are not listed fall back to a neutral
 * sentence the FTO can edit. Source: Rebuild Decisions Log, Nov 25, 2026.
 */
const APPROVED_STATEMENTS: Readonly<Record<string, string>> = {
  'enroute button': 'PO failed to hit the enroute/arrive button.',
  'arrival button': 'PO failed to hit the enroute/arrive button.',
  'backseat cvs': 'PO failed to activate the backseat camera.',
  'backseat camera activated': 'PO failed to activate the backseat camera.',
  'upload to matrix': 'PO failed to upload the completed case folder to Matrix.',
  'command presence': 'PO failed to maintain command presence and/or control over the scene, suspect(s) and/or detainee(s).',
  'reactionary gap': 'PO failed to maintain a reactionary gap and stood too close to the suspect(s), detainee(s) or involved person(s), which left PO without the time and distance needed to recognize and react to a threat.',
  'interview stance': "PO failed to use the interview stance (bladed, gun side away, hands above the waist), which exposed PO's firearm and limited PO's ability to react to an attack.",
  'victims rights': "PO failed to advise the victim of his/her rights by explaining them, completing a Victim's Rights Form, or directing the victim to the QR code or website on the Incident Card.",
  'probable cause affidavit form': 'PO failed to properly complete the Probable Cause Affidavit and required FTO assistance.',
  'probable cause affidavit': 'PO failed to properly complete the Probable Cause Affidavit and required FTO assistance.',
  'lethality assessment form': 'PO failed to conduct a Lethality Assessment with the victim, or did not conduct it properly.',
  'use of flashlight': 'PO failed to properly use his/her flashlight.',
  'proper use of flashlight': 'PO failed to properly use his/her flashlight.',
  'flashlight use': 'PO failed to properly use his/her flashlight.',
  'proper prisoner control': 'PO failed to maintain proper prisoner control.',
  'prisoner control': 'PO failed to maintain proper prisoner control.',
  'parked in a safe location from the run': 'PO failed to park in a safe location.',
  'parked in safe location': 'PO failed to park in a safe location.',
  'greeting': 'PO failed to properly greet the violator.',
  'identification': 'PO failed to identify himself/herself and the Columbus Division of Police.',
  'reason for stop': 'PO failed to advise the violator of the reason for the stop.',
  'justification': 'PO failed to ask the violator if there was a reason for the violation.',
  'weapons': 'PO failed to ask the occupants if they had any weapons on them or in the vehicle.',
  'weapon side away': 'PO failed to keep his/her weapon side away from the violator.',
  'proper closing': 'PO failed to properly close the contact with the violator.',
  'traffic data collection form': 'PO failed to complete the Traffic Data Collection form on a self-initiated traffic stop.',
};

const normalize = (label: string) => label.trim().replace(/\s+/g, ' ').toLowerCase();

export function defaultFailureStatement(label: string): string {
  return APPROVED_STATEMENTS[normalize(label)] ?? `PO failed to satisfactorily complete: ${label.trim()}.`;
}

/** One editable sentence; `keys` lists every failed item that shares it. */
export type RunFailureStatement = { key: string; keys: string[]; labels: string[]; text: string; edited: boolean };

/** Unchecked items that are not marked "did not apply", in form order. */
export function runFailedItems(run: Pick<TrainingRun, 'runKind' | 'checklist' | 'checklistNotApplicable'> & Parameters<typeof requiredSupplementalForms>[0]) {
  const items: { key: string; label: string }[] = [];
  const collect = (sections: readonly { items: readonly { label: string }[] }[], prefix: string) => {
    let index = 0;
    for (const section of sections) for (const item of section.items) {
      const key = `${prefix}${index++}`;
      if (run.checklist[key] === false && run.checklistNotApplicable?.[key] !== true) items.push({ key, label: item.label });
    }
  };
  if (!run.checklist['na-task']) collect(RUN_CHECKLIST_SECTIONS[run.runKind], 'task-');
  for (const form of requiredSupplementalForms(run).filter(item => item !== 'narrative_addition')) {
    if (run.checklist[`na-supp-${form}`]) continue;
    collect(RUN_SUPPLEMENT_CHECKLIST_SECTIONS[form], `supp-${form}-`);
  }
  return items;
}

/** Failed items that share a default sentence (e.g. Enroute and Arrival) are listed once. */
export function runFailureStatements(
  run: Pick<TrainingRun, 'runKind' | 'checklist' | 'checklistNotApplicable' | 'failureStatements'> & Parameters<typeof requiredSupplementalForms>[0],
): RunFailureStatement[] {
  const byDefault = new Map<string, RunFailureStatement>();
  const out: RunFailureStatement[] = [];
  for (const item of runFailedItems(run)) {
    const fallback = defaultFailureStatement(item.label);
    const group = byDefault.get(fallback);
    if (group) { group.keys.push(item.key); group.labels.push(item.label); continue; }
    const edited = run.failureStatements?.[item.key];
    const statement: RunFailureStatement = { key: item.key, keys: [item.key], labels: [item.label], text: edited ?? fallback, edited: edited !== undefined };
    byDefault.set(fallback, statement);
    out.push(statement);
  }
  return out;
}

/** Saved sentences only for items still failed; edits for re-checked items are dropped. */
export function activeFailureStatementEdits(
  run: Parameters<typeof runFailureStatements>[0],
): Record<string, string> | undefined {
  const failed = new Set(runFailedItems(run).map(item => item.key));
  const kept = Object.entries(run.failureStatements ?? {}).filter(([key]) => failed.has(key));
  return kept.length ? Object.fromEntries(kept) : undefined;
}

export function activeNotApplicable(run: Pick<TrainingRun, 'checklist' | 'checklistNotApplicable'>): Record<string, true> | undefined {
  const kept = Object.keys(run.checklistNotApplicable ?? {}).filter(key => run.checklist[key] === false);
  return kept.length ? Object.fromEntries(kept.map(key => [key, true as const])) : undefined;
}
