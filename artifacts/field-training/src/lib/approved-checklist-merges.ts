import type { Category, PrimaryRunForm, SupplementalRunForm } from './model.js';

export type MergeForm = PrimaryRunForm | Exclude<SupplementalRunForm, 'narrative_addition'>;

/**
 * Owner-approved checklist merges (Rebuild Decisions Log, Nov 25, 2026).
 * Items listed together become one box with one UA category and one
 * "PO failed to" sentence. Saved task offsets never change; only the display
 * groups them. Items are matched by the start of their submitted form label.
 */
export type ApprovedMerge = {
  form: MergeForm;
  items: readonly string[];
  label?: string;
  category: Category;
  sentence?: string;
};

const ENROUTE = 'PO failed to hit the enroute/arrive button.';
const APPROACH = 'PO failed to park in a safe location and/or make a safe approach to the person/location.';
const DECISION = 'PO failed to exercise proper decision making and/or identify the need for additional investigation.';
const CLEAR = 'PO failed to properly reclassify the ten code, make radio notifications and/or clear with radio and MPS using the correct disposition code.';
const LICENSE = "PO failed to obtain the operator's license and/or registration/insurance.";
const SWEEP = 'PO failed to properly conduct a protective sweep and/or search of the vehicle.';

const merge = (form: MergeForm, items: string[], category: Category, sentence?: string, label?: string): ApprovedMerge =>
  ({ form, items, category, sentence, label });

export const APPROVED_CHECKLIST_MERGES: readonly ApprovedMerge[] = [
  ...(['call_for_service', 'domestic_incident', 'traffic_crash', 'building_search'] as const)
    .map(form => merge(form, ['Enroute button', 'Arrival button'], 'communicationsUsage', ENROUTE, 'Enroute/Arrival button')),
  merge('call_for_service', ['Activate BWC upon dispatch', 'Deactivate CVS/BWC'], 'resourceEquipmentUsage'),
  merge('traffic_crash', ['Activate BWC upon dispatch', 'Deactivate CVS/BWC'], 'resourceEquipmentUsage'),
  merge('traffic_stop', ['Activate BWC Prior', 'Deactivate CVS/BWC'], 'resourceEquipmentUsage'),
  merge('call_for_service', ['Parked in a safe location', 'Made a safe approach'], 'runApproach', APPROACH),
  merge('domestic_incident', ['Parked in a safe location', 'Made a safe approach'], 'runApproach', APPROACH),
  merge('traffic_crash', ['Parked in safe location', 'Cruiser placement', 'Made a safe approach'], 'runApproach'),
  merge('call_for_service', ['Exercised decision making', 'Identified if additional'], 'problemSolving', DECISION),
  merge('self_initiated', ['Exercised decision making', 'Identified if additional'], 'problemSolving', DECISION),
  merge('building_search', ['Exercised decisions making', 'Identified if additional'], 'problemSolving', DECISION),
  merge('call_for_service', ['Reclassified Ten code', 'Proper notifications to radio', 'Properly clear with radio'], 'communicationsUsage', CLEAR),
  merge('domestic_incident', ['Reclassify', 'Properly notified radio', 'Properly cleared with radio'], 'communicationsUsage', CLEAR),
  merge('traffic_crash', ['Reclassified Ten code', 'Properly made radio notifications', 'Properly cleared with radio'], 'communicationsUsage', CLEAR),
  merge('building_search', ['Reclassify Ten Code', 'CAD Documentation', 'Properly cleared with radio'], 'communicationsUsage'),
  merge('traffic_stop', ['Operators License', 'Registration/insurance'], 'vehicleStops', LICENSE),
  ...(['self_initiated', 'traffic_stop', 'high_risk_stop', 'ovi_process'] as const)
    .map(form => merge(form, ['Protective sweep', 'Searched vehicle'], 'arrestSearchSeizure', SWEEP)),
];

/** Single items whose UA category the owner set directly. */
export const APPROVED_ITEM_CATEGORIES: readonly { item: string; category: Category }[] = [
  { item: 'Upload to Matrix', category: 'policiesProcedures' },
];

const starts = (label: string, prefix: string) => label.trim().toLowerCase().startsWith(prefix.toLowerCase());

/** Resolves each approved merge to saved offsets for a form's submitted labels. */
export function resolveApprovedMerges(form: MergeForm, labels: readonly string[]) {
  return APPROVED_CHECKLIST_MERGES.filter(spec => spec.form === form).map(spec => {
    const indices = spec.items.map(prefix => {
      const index = labels.findIndex(label => starts(label, prefix));
      if (index < 0) throw new Error(`Approved merge item "${prefix}" is missing from ${form}.`);
      return index;
    });
    return { ...spec, indices };
  });
}

export function approvedItemCategory(form: MergeForm, labels: readonly string[], index: number): Category | undefined {
  const merged = resolveApprovedMerges(form, labels).find(spec => spec.indices.includes(index));
  if (merged) return merged.category;
  return APPROVED_ITEM_CATEGORIES.find(entry => starts(labels[index] ?? '', entry.item))?.category;
}
