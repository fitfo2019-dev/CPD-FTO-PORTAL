import { SUBMITTED_PRIMARY_CHECKLISTS, SUBMITTED_SUPPLEMENTAL_CHECKLISTS } from './manual-form-checklists.js';
import type { PrimaryRunForm, SupplementalRunForm } from './model.js';
import { resolveApprovedMerges } from './approved-checklist-merges.js';

export type RevisedChecklistRow = {
  id: string;
  label: string;
  help: string;
  /** Original, persisted task offsets, in the revised document's display order. */
  indices: readonly number[];
  /** One entry per box: a single offset, or every offset of an approved merge. */
  units: readonly (readonly number[])[];
  unitLabels: readonly string[];
  /** Approved "PO failed to" sentence for merged boxes. */
  unitSentences: readonly (string | undefined)[];
};
export type RevisedChecklistSection = { title: string; items: readonly RevisedChecklistRow[] };
/** Header choices retain their original saved offsets, but are not task panels. */
export function partitionRevisedChecklist(sections: readonly RevisedChecklistSection[]) {
  return {
    headerOptions: sections.filter(section=>section.title==='Header Option').flatMap(section=>section.items),
    sections: sections.filter(section=>section.title!=='Header Option'),
  };
}
type RowSpec = { id: string; indices: readonly number[]; label?: string };
type SectionSpec = { title: string; items: readonly RowSpec[] };
type ChecklistForm = PrimaryRunForm | Exclude<SupplementalRunForm, 'narrative_addition'>;
const row = (id: string, indices: number[], label?: string): RowSpec => ({ id, indices, label });
const group = (title: string, ...items: RowSpec[]): SectionSpec => ({ title, items });

// Presentation from the user's revised Word checklist. The saved atomic arrays
// remain unchanged: regrouping or reordering must never reinterpret task-N.
// Traffic Stop uses the later "Finalized" list (Matrix is under Re-Approach).
const definitions: Record<ChecklistForm, readonly SectionSpec[]> = {
  call_for_service: [
    group('Pre Contact Actions',
      row('cfs_pca_1', [0, 1, 3, 9]),
      row('cfs_pca_2', [2, 4]),
      row('cfs_pca_3', [5, 6, 7]),
      row('cfs_pca_4', [8, 10, 11])),
    group('Contact/Investigation',
      row('cfs_ci_1', [12, 13, 14, 15]),
      row('cfs_ci_2', [17, 18]),
      row('cfs_ci_3', [19, 20]),
      row('cfs_ci_4', [16, 24, 25]),
      row('cfs_ci_5', [21, 22]),
      row('cfs_ci_6', [23]),
      row('cfs_ci_7', [26])),
    group('Action/Enforcement',
      row('cfs_ae_1', [27]),
      row('cfs_ae_2', [30, 31]),
      row('cfs_ae_3', [28, 32, 29]),
      row('cfs_ae_4', [33, 34, 36])),
    group('Officer Safety',
      row('cfs_os_1', [37, 38, 40, 41]),
      row('cfs_os_2', [39, 45]),
      row('cfs_os_3', [43, 44, 42])),
    group('Clearance',
      row('cfs_cl_1', [35, 50]),
      row('cfs_cl_2', [48]),
      row('cfs_cl_3', [46, 49, 47])),
    group('General', row('cfs_gen_1', [51])),
  ],
  self_initiated: [
    group('Header Option', row('sir_ho_1', [0])),
    group('Pre Contact Actions',
      row('sir_pca_1', [1, 2, 6]),
      row('sir_pca_2', [3, 4, 5])),
    group('Contact/Investigation',
      row('sir_ci_1', [7, 8, 9, 10, 11, 12], 'Type of contact: Consensual encounter / Terry stop / Arrest situation / Parking violation / Pedestrian violation / Suspicious vehicle'),
      row('sir_ci_2', [13, 14, 15]),
      row('sir_ci_3', [17, 18]),
      row('sir_ci_4', [19, 20, 16]),
      row('sir_ci_5', [21])),
    group('Action/Enforcement',
      row('sir_ae_1', [22, 23, 24, 25], 'Contact with person: Consent search / Terry pat down / Search incident to arrest / Complete F.I.'),
      row('sir_ae_2', [26, 27, 28, 29], 'Vehicle options: Released at scene / Inventoried/impound vehicle / Protective sweep of vehicle / Searched vehicle'),
      row('sir_ae_3', [32, 33, 34, 35]),
      row('sir_ae_4', [38]),
      row('sir_ae_5', [30, 36, 31, 39, 37])),
    group('Officer Safety',
      row('sir_os_1', [41, 42, 44, 45]),
      row('sir_os_2', [43, 48]),
      row('sir_os_3', [47, 46])),
    group('Clearance', row('sir_cl_1', [40, 50, 49])),
    group('General', row('sir_gen_1', [51])),
  ],
  domestic_incident: [
    group('Pre Contact Actions',
      row('dom_pca_1', [0, 1, 3, 9]),
      row('dom_pca_2', [2, 4]),
      row('dom_pca_3', [5, 6, 7]),
      row('dom_pca_4', [8, 10, 11])),
    group('Contact/Investigation',
      row('dom_ci_1', [12, 13, 16]),
      row('dom_ci_2', [15, 14, 27]),
      row('dom_ci_3', [17, 18, 19, 20]),
      row('dom_ci_4', [21, 22]),
      row('dom_ci_5', [23, 24, 25, 28]),
      row('dom_ci_6', [26])),
    group('Action/Enforcement',
      row('dom_ae_1', [29, 30, 31]),
      row('dom_ae_2', [32, 33, 35, 34]),
      row('dom_ae_3', [37, 38, 39]),
      row('dom_ae_4', [50, 41, 42]),
      row('dom_ae_5', [45, 36, 43, 44, 40, 46])),
    group('Officer Safety',
      row('dom_os_1', [51, 52, 54, 55]),
      row('dom_os_2', [53, 59]),
      row('dom_os_3', [57, 58, 56])),
    group('Clearance', row('dom_cl_1', [48, 47, 49, 61, 60])),
    group('General', row('dom_gen_1', [62])),
  ],
  traffic_crash: [
    group('Pre Contact Actions',
      row('crash_pca_1', [0, 1, 3, 13]),
      row('crash_pca_2', [2, 4]),
      row('crash_pca_3', [11, 6, 5]),
      row('crash_pca_4', [7, 12, 8, 9, 10])),
    group('Contact/Investigation',
      row('crash_ci_1', [16, 17, 18, 20]),
      row('crash_ci_2', [21, 14, 19]),
      row('crash_ci_3', [15, 22]),
      row('crash_ci_4', [23, 24, 26]),
      row('crash_ci_5', [25, 27])),
    group('Action/Enforcement',
      row('crash_ae_1', [28, 29, 30]),
      row('crash_ae_2', [31, 32]),
      row('crash_ae_3', [34, 33, 35, 37])),
    group('Officer Safety',
      row('crash_os_1', [38, 39, 41, 42]),
      row('crash_os_2', [40, 46]),
      row('crash_os_3', [44, 45, 43])),
    group('Clearance',
      row('crash_cl_1', [36, 47]),
      row('crash_cl_2', [48, 49, 50])),
    group('General', row('crash_gen_1', [51])),
  ],
  traffic_stop: [
    group('Identify/Preplan the Stop',
      row('ts_ip_1', [0, 2]),
      row('ts_ip_2', [1, 3, 4])),
    group('Initiating a Traffic Stop',
      row('ts_init_1', [5, 6, 7]),
      row('ts_init_2', [8, 9, 10], "Cruiser positioned 1 to 1.5 car lengths away with 3' offset (L or R) / Used PA system / Used spotlight"),
      row('ts_init_3', [11, 12])),
    group('Approach',
      row('ts_app_1', [13, 14]),
      row('ts_app_2', [16, 15]),
      row('ts_app_3', [18, 19, 20, 17], 'Body Positioning: Stayed close to violator’s vehicle / Stood at rear edge “trailing edge” of doorpost / Weapon side away / Gave verbal orders to control hands, movement, actions, etc.')),
    group('Contact',
      row('ts_con_1', [21, 22, 23, 24, 25], 'Violator Contact: Greeting / Identification / Reason for stop / Justification / Weapons'),
      row('ts_con_2', [26, 27, 28, 29, 30])),
    group('Decision',
      row('ts_dec_1', [31]),
      row('ts_dec_2', [32, 34, 35]),
      row('ts_dec_3', [36, 37, 33]),
      row('ts_dec_4', [39, 41, 42, 40])),
    group('Re-Approach',
      row('ts_re_1', [43, 44, 46, 45, 47]),
      row('ts_re_2', [48, 49, 50], 'Body Positioning: Stayed close to violator’s vehicle / Stood at rear edge “trailing edge” of doorpost / Weapon side away'),
      row('ts_re_3', [51, 52, 53]),
      row('ts_re_4', [56, 38, 54, 55])),
    group('Control of Arrestee', row('ts_ca_1', [57, 58, 59, 60, 61, 62])),
    group('Vehicle Options', row('ts_vo_1', [63, 64, 65, 66])),
    group('General', row('ts_gen_1', [67])),
  ],
  high_risk_stop: [
    group('High Risk Stop Type',
      row('hr_type_1', [0, 2, 4, 1, 3, 5, 6], 'Known or suspected violent felony / Known or suspected weapons related violation / Known or suspected violent misdemeanor / Followed conclusion of a pursuit / Violent misdemeanor/felony warrants / Stolen vehicle / Other')),
    group('Identified/Preplanned the Stop',
      row('hr_ip_1', [7, 10, 8], 'Recognized reason for stop / Assessed threat level / Enter license plate into LEADS if possible'),
      row('hr_ip_2', [9, 11, 12, 14]),
      row('hr_ip_3', [16, 13, 15])),
    group('Initiated a High Risk Traffic Stop',
      row('hr_init_1', [17, 18]),
      row('hr_init_2', [19, 20]),
      row('hr_init_3', [26, 25, 24, 27]),
      row('hr_init_4', [22, 23, 21])),
    group('Contact with Occupants of Vehicle',
      row('hr_con_1', [30, 28, 29]),
      row('hr_con_2', [31, 32]),
      row('hr_con_3', [33, 34, 35, 36])),
    group('Prisoner Control', row('hr_pc_1', [37, 38, 39, 40, 41])),
    group('Actions',
      row('hr_act_1', [42, 43]),
      row('hr_act_2', [44, 48, 49]),
      row('hr_act_3', [45, 50, 46, 47])),
    group('Vehicle Options', row('hr_vo_1', [52, 53, 54, 55])),
    group('Clearance', row('hr_cl_1', [51, 57, 56, 58])),
    group('General', row('hr_gen_1', [59], 'Review of Division Directives, SOP, Etc. (List)')),
  ],
  arrest_process: [
    group('Arrest at Scene',
      row('arr_sc_1', [0, 1, 2, 3]),
      row('arr_sc_2', [7, 5, 4, 11]),
      row('arr_sc_3', [12]),
      row('arr_sc_4', [6, 8, 13]),
      row('arr_sc_5', [14]),
      row('arr_sc_6', [9, 10])),
    group('Transported to Headquarters',
      row('arr_hq_1', [24, 20, 15, 16, 18]),
      row('arr_hq_2', [17, 19]),
      row('arr_hq_3', [21, 22, 23])),
    group('Processed through ID Unit/Investigative Subdivision (if applicable)',
      row('arr_id_1', [25, 26, 27]),
      row('arr_id_2', [29, 28]),
      row('arr_id_3', [30, 31, 32]),
      row('arr_id_4', [33])),
    group('Transported to Clerks',
      row('arr_clk_1', [40, 34, 35]),
      row('arr_clk_2', [36, 37, 38, 39])),
    group('Transported to Jail',
      row('arr_jail_1', [53, 41, 42, 43, 50, 44]),
      row('arr_jail_2', [45, 47, 46]),
      row('arr_jail_3', [48, 49]),
      row('arr_jail_4', [51, 52], 'If prisoner refused due to medical reasons then officers shall transport prisoner to hospital. When at hospital release on summons or / Contact Supervisor/Clerks / Transfer to another Jurisdiction (Completed Case Report)')),
    group('Transported to Hospital',
      row('arr_hosp_1', [58]),
      row('arr_hosp_2', [54, 57]),
      row('arr_hosp_3', [55, 56])),
    group('Property Room', row('arr_prop_1', [59, 60])),
    group('General', row('arr_gen_1', [61])),
  ],
  ovi_process: [
    group('Contact at Scene',
      row('ovi_cs_1', [0, 5]),
      row('ovi_cs_2', [2, 3, 4, 1])),
    group('Field Sobriety Tests',
      row('ovi_fst_1', [11, 12]),
      row('ovi_fst_2', [6, 7]),
      row('ovi_fst_3', [8, 9, 10])),
    group('Arrest at Scene',
      row('ovi_arr_1', [13, 14, 15, 16, 17], 'Advised operator/occupant of arrest / Gapped/Double locked handcuffs / Hobble Strap/leg restraints / Conduct thorough search (same sex) / Retrieved/secured property and evidence'),
      row('ovi_arr_2', [21, 19, 18, 22]),
      row('ovi_arr_3', [23, 20]),
      row('ovi_arr_4', [26, 27, 24, 25, 43])),
    group('Paperwork',
      row('ovi_pw_1', [28, 29]),
      row('ovi_pw_2', [30, 32, 33]),
      row('ovi_pw_3', [34, 35]),
      row('ovi_pw_4', [36, 37]),
      row('ovi_pw_5', [31, 45, 38, 39, 40, 46, 44, 41]),
      row('ovi_pw_6', [42, 47])),
    group('Vehicle Options', row('ovi_vo_1', [48, 49, 50, 51, 52])),
    group('Officer Safety Issues',
      row('ovi_os_1', [53, 54, 56, 57]),
      row('ovi_os_2', [55, 61]),
      row('ovi_os_3', [59, 60, 58], 'Conducted pat down/searches / Proper prisoner control / Used appropriate Use of Force')),
    group('General', row('ovi_gen_1', [62])),
  ],
  building_search: [
    group('Pre Contact Actions',
      row('bs_pca_1', [0, 1, 3, 8], 'Acknowledged/notified radio / Provided call number & location / Enroute button / Activate BWC upon dispatch'),
      row('bs_pca_2', [2, 4]),
      row('bs_pca_3', [7, 6, 5])),
    group('Cruiser Approach',
      row('bs_ca_1', [9, 11, 12, 10]),
      row('bs_ca_2', [13, 14, 15]),
      row('bs_ca_3', [16, 17])),
    group('Entry/Search/Tactics Officer Safety Issues',
      row('bs_est_1', [20, 18]),
      row('bs_est_2', [19, 28, 30, 31]),
      row('bs_est_3', [21, 22, 23, 24]),
      row('bs_est_4', [29, 26, 27]),
      row('bs_est_5', [25])),
    group('Room Entry Techniques / Hallway Movements',
      row('bs_ret_1', [32, 33, 34, 35, 36, 37, 38, 39])),
    group('Contact/Investigation',
      row('bs_ci_1', [40, 41, 42, 43]),
      row('bs_ci_2', [45, 46]),
      row('bs_ci_3', [47, 49, 48]),
      row('bs_ci_4', [44, 50, 51]),
      row('bs_ci_5', [52]),
      row('bs_ci_6', [53])),
    group('Apprehension (If Applicable)',
      row('bs_app_1', [54, 56, 55], "Ordered suspect to PO's location / Pat Down/Search / Prisoner Control"),
      row('bs_app_2', [57]),
      row('bs_app_3', [60, 58, 59])),
    group('Clearance (Building Search Specific)',
      row('bs_cl_1', [65, 64]),
      row('bs_cl_2', [61, 62]),
      row('bs_cl_3', [66, 68]),
      row('bs_cl_4', [69, 67, 63])),
    group('General', row('bs_gen_1', [70])),
  ],
};

function expand(form: ChecklistForm, applyMerges = true): readonly RevisedChecklistSection[] {
  const original = form in SUBMITTED_PRIMARY_CHECKLISTS
    ? SUBMITTED_PRIMARY_CHECKLISTS[form as PrimaryRunForm]
    : SUBMITTED_SUPPLEMENTAL_CHECKLISTS[form as SupplementalRunForm];
  const labels = original.flatMap(section => section.items.map(item => item.label));
  const indices = definitions[form].flatMap(section => section.items.flatMap(item => item.indices));
  if (indices.length !== labels.length || new Set(indices).size !== labels.length
    || indices.some(index => !Number.isInteger(index) || index < 0 || index >= labels.length)) {
    throw new Error(`Revised ${form} checklist must cover every original task exactly once.`);
  }
  const segmentText = new Map<number, string>();
  for (const section of definitions[form]) for (const item of section.items) {
    const parts = item.label?.split(' / ');
    item.indices.forEach((index, position) => segmentText.set(index, parts?.length === item.indices.length ? parts[position]! : labels[index]!));
  }
  const rows = definitions[form].map(section => section.items.map(item => ({ id: item.id, units: item.indices.map(index => [index] as number[]) })));
  const resolved = applyMerges ? resolveApprovedMerges(form, labels) : [];
  for (const merged of resolved) {
    const [first, ...rest] = merged.indices;
    for (const sectionRows of rows) for (const item of sectionRows) item.units = item.units.filter(unit => !rest.includes(unit[0]!));
    const host = rows.flat().find(item => item.units.some(unit => unit[0] === first));
    if (!host) throw new Error(`Approved merge in ${form} could not be placed.`);
    host.units = host.units.map(unit => unit[0] === first ? [...merged.indices] : unit);
  }
  const mergedLabels = new Map(resolved.map(merged => [merged.indices[0]!, merged.label ?? merged.indices.map(index => segmentText.get(index)).join(' and/or ')]));
  const mergedSentences = new Map(resolved.map(merged => [merged.indices[0]!, merged.sentence]));
  return definitions[form].map((section, sectionIndex) => ({
    title: section.title,
    items: rows[sectionIndex]!.filter(item => item.units.length > 0).map(item => {
      const authored = section.items.find(entry => entry.id === item.id)!;
      const unitLabels = item.units.map(unit => unit.length > 1 ? mergedLabels.get(unit[0]!)! : segmentText.get(unit[0]!)!);
      const unchanged = item.units.every(unit => unit.length === 1) && item.units.length === authored.indices.length;
      const label = unchanged ? authored.label ?? unitLabels.join(' / ') : unitLabels.join(' / ');
      const unitSentences = item.units.map(unit => unit.length > 1 ? mergedSentences.get(unit[0]!) : undefined);
      return { id: item.id, indices: item.units.flat(), units: item.units, unitLabels, unitSentences, label, help: label };
    }),
  })).filter(section => section.items.length > 0);
}

/** The revised document layout before the user-approved merges; kept to verify document fidelity. */
export function documentRunChecklist(form: ChecklistForm): readonly RevisedChecklistSection[] {
  return expand(form, false);
}

export const REVISED_PRIMARY_CHECKLISTS = Object.fromEntries(
  Object.keys(SUBMITTED_PRIMARY_CHECKLISTS).map(form => [form, expand(form as PrimaryRunForm)]),
) as Record<PrimaryRunForm, readonly RevisedChecklistSection[]>;

export const REVISED_SUPPLEMENT_CHECKLISTS: Record<SupplementalRunForm, readonly RevisedChecklistSection[]> = {
  arrest_process: expand('arrest_process'),
  ovi_process: expand('ovi_process'),
  building_search: REVISED_PRIMARY_CHECKLISTS.building_search,
  narrative_addition: [],
};

export function revisedRowState(state: Record<string, boolean>, prefix: string, indices: readonly number[]) {
  const checkedCount = indices.filter(index => state[`${prefix}${index}`] !== false).length;
  return { checked: checkedCount === indices.length, mixed: checkedCount > 0 && checkedCount < indices.length };
}

export function setRevisedRow(
  state: Record<string, boolean>, prefix: string, indices: readonly number[], checked: boolean,
): Record<string, boolean> {
  return { ...state, ...Object.fromEntries(indices.map(index => [`${prefix}${index}`, checked])) };
}

/** Display state of one box: failed when any of its items is unchecked and applied; not applicable when all were marked so. */
export function unitState(state: Record<string, boolean>, prefix: string, unit: readonly number[], notApplicable?: Readonly<Record<string, true>>) {
  const keys = unit.map(index => `${prefix}${index}`);
  const unchecked = keys.filter(key => state[key] === false);
  const na = unchecked.length > 0 && unchecked.every(key => notApplicable?.[key] === true);
  return { failed: unchecked.length > 0 && !na, notApplicable: na };
}
