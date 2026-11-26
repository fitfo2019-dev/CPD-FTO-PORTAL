import { RUN_CHECKLIST_ITEMS, type TrainingRun } from './model.js';

const index = RUN_CHECKLIST_ITEMS.traffic_stop.findIndex(label => label.trim().toLowerCase() === 'traffic data collection form');
if (index < 0) throw new Error('Traffic Stop is missing the Traffic Data Collection form item.');
/** Saved key of the Traffic Stop "Traffic Data Collection form" item. */
export const TRAFFIC_DATA_COLLECTION_KEY = `task-${index}`;

type RuleInput = Pick<TrainingRun, 'runKind' | 'isDispatched' | 'checklist' | 'checklistNotApplicable' | 'activityFlags'>;

/** Dispatched stops leave the box blank with no UA (FTO manual: self-initiated stops only). */
export function trafficDataCollectionNotApplicable(run: Pick<TrainingRun, 'runKind' | 'isDispatched'>, key: string): boolean {
  return run.runKind === 'traffic_stop' && run.isDispatched && key === TRAFFIC_DATA_COLLECTION_KEY;
}

/**
 * Self-initiated stops: the box is required, and marking Solve Citation/Summons completes it.
 * Returns the same objects when nothing changes.
 */
export function applyTrafficDataCollectionRule(run: RuleInput): { checklist: Record<string, boolean>; checklistNotApplicable: Record<string, true> } {
  const checklist = run.checklist;
  const notApplicable = run.checklistNotApplicable ?? {};
  if (run.runKind !== 'traffic_stop') return { checklist, checklistNotApplicable: notApplicable };
  const key = TRAFFIC_DATA_COLLECTION_KEY;
  if (run.isDispatched) {
    if (checklist[key] === false && notApplicable[key]) return { checklist, checklistNotApplicable: notApplicable };
    return { checklist: { ...checklist, [key]: false }, checklistNotApplicable: { ...notApplicable, [key]: true } };
  }
  const wasRuleBlank = notApplicable[key] === true;
  const nextNotApplicable = wasRuleBlank ? Object.fromEntries(Object.entries(notApplicable).filter(([item]) => item !== key)) as Record<string, true> : notApplicable;
  const complete = wasRuleBlank || run.activityFlags?.solveCitationSummons === true;
  if (!complete || checklist[key] === true) return { checklist, checklistNotApplicable: nextNotApplicable };
  return { checklist: { ...checklist, [key]: true }, checklistNotApplicable: nextNotApplicable };
}
