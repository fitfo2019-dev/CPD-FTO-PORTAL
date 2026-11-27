import {
  CATEGORIES, DAILY_DUTY_CHECKLIST, PRIMARY_RUN_FORMS, RUN_CHECKLIST_SECTIONS, RUN_SUPPLEMENT_CHECKLIST_SECTIONS, SUPPLEMENTAL_RUN_FORMS,
  type AddedDeficiency, type Category, type ChecklistDeficiencyGroup, type UaNotCountedReason, type PrimaryRunForm, type Report, type SupplementalRunForm,
} from './model.js';
import type { OperationalPacket } from './operational-state-machine.js';
import { approvedItemCategory } from './approved-checklist-merges.js';

type SourceForm = 'duty' | PrimaryRunForm | SupplementalRunForm;

/** Named meanings approved by the FTO; historical manual numbers are NOT worksheet ordinals. */
function sectionCategory(form: SourceForm, section: string): Category {
  if (form === 'duty') return 'dutyReadiness';
  if (form === 'arrest_process') {
    if (/transport|slat|jail|custody|prisoner/i.test(section)) return 'handlingPrisoners';
    return 'initiatingArrests';
  }
  if (form === 'ovi_process') return 'arrestSearchSeizure';
  if (form === 'building_search') {
    if (/Entry|Room|Search\/Tactics/i.test(section)) return 'buildingSearch';
    if (/Cruiser Approach/i.test(section)) return 'runApproach';
  }
  if (/Officer Safety/i.test(section)) return 'threatAssessment';
  if (/Contact\/Investigation/i.test(section)) return 'publicPoliceInteraction';
  if (/Pre Contact|Clearance/i.test(section)) return 'communicationsUsage';
  if (/Action|Enforcement|Apprehension/i.test(section)) return 'criminalTrafficCodes';
  if (/Training/i.test(section)) return 'resourceEquipmentUsage';
  return 'policiesProcedures';
}

function taskCategory(form: SourceForm, section: string, label: string): Category {
  if (form === 'duty') return 'dutyReadiness';
  // The specifically requested safety/tactics blocks remain one consolidated target.
  if (/Officer Safety/i.test(section) && form !== 'building_search') return 'threatAssessment';
  if (form === 'building_search' && /Entry|Room|Search\/Tactics/i.test(section)) return 'buildingSearch';
  if (/pat.?down|thorough search|search.*sex/i.test(label)) return 'patDownSearches';
  if (/prisoner|seat.?belt|slat|jail|custody transfer|transport/i.test(label)) return 'handlingPrisoners';
  if (/probable cause|criminal code|legal|rights|consent|warrant/i.test(label)) return 'arrestSearchSeizure';
  if (/handcuff|restraint|hobble|effected arrest|arrested/i.test(label)) return 'initiatingArrests';
  if (/map|found location|direct route|area knowledge/i.test(label)) return 'precinctOrientation';
  if (/driving/i.test(label)) return 'routineDriving';
  if (/safe approach|positioned cruiser|planned safe|location.*front/i.test(label)) return 'runApproach';
  if (/accurate.*report|detailed report|CAD documentation/i.test(label)) return 'contentAccuracy';
  if (/completion time/i.test(label)) return 'completionTime';
  if (/form|report|complaint|affidavit/i.test(label)) return 'formUsage';
  return sectionCategory(form, section);
}

const labelsOf = (sections: readonly { items: readonly { label: string }[] }[]) => sections.flatMap(section => section.items.map(item => item.label));

function buildDirectory(): Readonly<Record<string, Category>> {
  if (CATEGORIES.length !== 30 || new Set(CATEGORIES).size !== 30) throw new Error('Exactly 30 unique SEG categories are required.');
  const directory: Record<string, Category> = {};
  for (const group of DAILY_DUTY_CHECKLIST) for (const item of group.items) directory[`duty:${item.key}`] = 'dutyReadiness';
  for (const [form, sections] of Object.entries(RUN_CHECKLIST_SECTIONS)) {
    let index = 0;
    for (const section of sections) for (const item of section.items) {
      directory[`${form}:task-${index}`] = approvedItemCategory(form as PrimaryRunForm, labelsOf(sections), index) ?? taskCategory(form as PrimaryRunForm, section.title, item.label);
      index++;
    }
  }
  for (const [form, sections] of Object.entries(RUN_SUPPLEMENT_CHECKLIST_SECTIONS)) {
    let index = 0;
    for (const section of sections) for (const item of section.items) {
      directory[`${form}:supp-${form}-${index}`] = (form === 'narrative_addition' ? undefined : approvedItemCategory(form as Exclude<SupplementalRunForm, 'narrative_addition'>, labelsOf(sections), index)) ?? taskCategory(form as SupplementalRunForm, section.title, item.label);
      index++;
    }
  }
  return Object.freeze(directory);
}
export const SEG_TASK_DIRECTORY = buildDirectory();
export const deficiencyGroupId = (runId: string | undefined, category: Category) => `${runId ?? 'duty'}:${category}`;
export const OFFICER_SAFETY_LOCK_CATEGORIES:readonly Category[]=[
  'threatAssessment','initiatingArrests','handlingPrisoners','vehicleStops',
  'runApproach','buildingSearch','patDownSearches',
];

export interface SelectedFailureActionOccurrence {
  id: string;
  action: string;
  reportId: string;
  reportDate: string;
  recruitName: string;
  recruitBadge: string;
  className: string;
  phase: Report['phase'];
  runId: string;
  form: PrimaryRunForm | SupplementalRunForm;
  formLabel: string;
  formNumber: string;
  taskKey: string;
  taskLabel: string;
  page: number;
  reference?: string;
  runComplete: boolean;
  checklistReviewed: boolean;
}

/** Return only explicitly saved action choices; this does not create narratives or SEG ratings. */
export function collectSelectedFailureActions(
  report: Report,
  packet: OperationalPacket,
): SelectedFailureActionOccurrence[] {
  const pages = new Map(packet.pages.map(page => [page.page, page]));
  const runs = new Map(report.runs.map(run => [run.id, run]));
  const occurrences: SelectedFailureActionOccurrence[] = [];
  for (const exception of packet.exceptions) {
    if (!exception.runId || !exception.failureActions?.length) continue;
    const run = runs.get(exception.runId);
    const page = pages.get(exception.page);
    if (!run || !page) throw new Error('A selected failure action is missing its source run or form page.');
    const form = page.supplement ?? run.runKind;
    const formDefinition = page.supplement
      ? SUPPLEMENTAL_RUN_FORMS.find(item => item.key === page.supplement)
      : PRIMARY_RUN_FORMS.find(item => item.key === run.runKind);
    if (!formDefinition) throw new Error(`A selected failure action has an unknown source form: ${form}.`);
    for (const [actionIndex, action] of exception.failureActions.entries()) {
      occurrences.push({
        id: `${exception.id}:${actionIndex}`,
        action,
        reportId: report.id,
        reportDate: report.date,
        recruitName: report.recruitName,
        recruitBadge: report.recruitBadge,
        className: report.className ?? '',
        phase: report.phase,
        runId: run.id,
        form,
        formLabel: formDefinition.label,
        formNumber: formDefinition.formNumber ?? '',
        taskKey: exception.taskKey,
        taskLabel: exception.task,
        page: exception.page,
        ...(exception.reference ? { reference: exception.reference } : {}),
        runComplete: run.formStatus === 'complete',
        checklistReviewed: !!run.checklistReviewedAt,
      });
    }
  }
  return occurrences;
}

export function collectDeficiencies(report: Report, packet: OperationalPacket): ChecklistDeficiencyGroup[] {
  if (!report.deficiencyAutomationEnabled) return [];
  const groups = new Map<string, ChecklistDeficiencyGroup>();
  const runs = new Map(report.runs.map(run => [run.id, run]));
  const pages = new Map(packet.pages.map(page => [page.page, page]));
  for (const exception of packet.exceptions) {
    const page = pages.get(exception.page);
    const form = page?.supplement ?? (exception.runId ? runs.get(exception.runId)?.runKind : 'duty');
    if (!form) throw new Error('A deficiency has no source form.');
    const defaultCategory = SEG_TASK_DIRECTORY[`${form}:${exception.taskKey}`];
    if (!defaultCategory) throw new Error(`A source task is missing its named SEG mapping: ${form}:${exception.taskKey}`);
    const override = report.deficiencyOverrides?.[exception.id];
    if (override && !CATEGORIES.includes(override)) throw new Error('Invalid SEG override category.');
    const category = override ?? defaultCategory;
    const id = deficiencyGroupId(exception.runId, category);
    const group = groups.get(id) ?? {
      id, runId: exception.runId, category, tasks: [], narrative: report.deficiencyNarratives?.[id] ?? '', reviewed:true,
    };
    group.reviewed=group.reviewed&&exception.reviewed;
    group.tasks.push({
      id: exception.id,
      label: exception.task,
      reference: exception.reference,
      ...(exception.failureActions?.length?{failureActions:[...exception.failureActions]}:{}),
    });
    groups.set(id, group);
  }
  const pageOfRun = new Map(packet.pages.filter(page => page.kind === 'run' && page.runId).map(page => [page.runId!, page]));
  for (const added of report.addedDeficiencies ?? []) {
    const page = pageOfRun.get(added.runId);
    if (!page || !runs.has(added.runId)) continue;
    const id = addedDeficiencyGroupId(added);
    groups.set(id, {
      id, runId: added.runId, category: added.category, addedId: added.id,
      tasks: [{ id: added.id, label: added.whatHappened, ...(page.reference ? { reference: page.reference } : {}) }],
      narrative: added.whatHappened, correctiveTraining: added.correctiveTraining, minutes: added.minutes, reviewed: true,
    });
  }
  return applyUaCounting([...groups.values()], report);
}

export const addedDeficiencyGroupId = (added: Pick<AddedDeficiency, 'id' | 'runId' | 'category'>) => `${added.runId}:${added.category}:added:${added.id}`;

/**
 * Owner rules, Nov 26, 2026. One UA per category per run counts; the checklist UA counts before an added UA,
 * and added UA's count in the order they were entered. Officer Safety categories count one UA per category per day,
 * on the first run by page. Every other UA is kept, listed and documented, and marked not counted.
 */
export function applyUaCounting(groups: readonly ChecklistDeficiencyGroup[], report: Pick<Report, 'runs' | 'addedDeficiencies'>): ChecklistDeficiencyGroup[] {
  const runOrder = new Map([...report.runs].sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt)).map((run, index) => [run.id, index]));
  const entered = new Map((report.addedDeficiencies ?? []).map(added => [added.id, added.createdAt]));
  const position = (group: ChecklistDeficiencyGroup) => group.runId ? runOrder.get(group.runId) ?? Number.MAX_SAFE_INTEGER : -1;
  const ordered = groups.map((group, index) => ({ group, index })).sort((left, right) =>
    position(left.group) - position(right.group)
    || Number(!!left.group.addedId) - Number(!!right.group.addedId)
    || (entered.get(left.group.addedId ?? '') ?? '').localeCompare(entered.get(right.group.addedId ?? '') ?? '')
    || left.index - right.index);
  const countedRuns = new Set<string>();
  const countedDays = new Set<Category>();
  const reasons = new Map<string, UaNotCountedReason>();
  for (const { group } of ordered) {
    const runKey = `${group.runId ?? 'duty'}:${group.category}`;
    if (countedRuns.has(runKey)) { reasons.set(group.id, 'same_run'); continue; }
    if (OFFICER_SAFETY_LOCK_CATEGORIES.includes(group.category) && countedDays.has(group.category)) { reasons.set(group.id, 'officer_safety_day'); continue; }
    countedRuns.add(runKey);
    if (OFFICER_SAFETY_LOCK_CATEGORIES.includes(group.category)) countedDays.add(group.category);
  }
  return groups.map(group => {
    const reason = reasons.get(group.id);
    if (reason === group.notCounted) return group;
    const { notCounted: _previous, ...rest } = group;
    return reason ? { ...rest, notCounted: reason } : rest;
  });
}

export const UA_NOT_COUNTED_LABEL: Readonly<Record<UaNotCountedReason, string>> = Object.freeze({
  same_run: 'Not counted · Same run, counted once',
  officer_safety_day: 'Not counted · Officer Safety, counted once per day',
});

/** Counted UA's for a saved report, recalculated from its stored groups so earlier records follow the current rules. */
export function countedUaGroups(report: Report): ChecklistDeficiencyGroup[] {
  return applyUaCounting(report.checklistDeficiencies ?? [], report).filter(group => !group.notCounted);
}

/** Reversible UA projection: authored ratings/text are not destroyed by rerouting or rechecking a task. */
export function reconcileDeficiencyRatings(report: Report, packet: OperationalPacket): Report {
  if (!report.deficiencyAutomationEnabled) return report;
  const groups = collectDeficiencies(report, packet);
  const ratings = { ...report.ratings };
  const prior = { ...report.deficiencyPriorRatings };
  const generated = { ...report.deficiencyGeneratedText };
  const safetyLocks=new Set(report.limboDay?[]:report.deficiencySafetyLocks??[]);
  if(!report.limboDay)for(const group of groups)if(OFFICER_SAFETY_LOCK_CATEGORIES.includes(group.category))safetyLocks.add(group.category);
  for (const category of CATEGORIES) {
    const active = report.limboDay ? [] : groups.filter(group => group.category === category);
    const safetyLocked=safetyLocks.has(category);
    const current = report.ratings[category];
    if (active.length||safetyLocked) {
      prior[category] ??= { ...current };
      const text = active.map(group => {
        const refs = [...new Set(group.tasks.map(task => task.reference).filter(Boolean))].join(', ') || 'Source coordinate awaiting phase schedule';
        return `${refs} — ${group.narrative.trim() || `Unchecked tasks pending FTO articulation: ${group.tasks.map(task => task.label).join('; ')}`}`;
      }).join('\n\n');
      const lockedText=active.length?text:generated[category]??`Officer Safety checklist failure recorded. UA remains locked for this daily report.`;
      const managedText = !current.justification || current.justification === generated[category] || current.justification === prior[category]?.justification;
      ratings[category] = { ...current, rating: safetyLocked?'UA':current.rating === 'NRT' ? 'NRT' : 'UA', justification: managedText ? [prior[category]?.justification, lockedText].filter(Boolean).join('\n\n') : current.justification };
      if (managedText) generated[category] = ratings[category].justification;
    } else if (prior[category]) {
      ratings[category] = { ...current, rating: report.limboDay ? '' : prior[category].rating,
        justification: current.justification === generated[category] ? prior[category].justification : current.justification };
      delete prior[category];
      delete generated[category];
    }
  }
  const lockList=[...safetyLocks];
  const result = { ...report, ratings, deficiencyPriorRatings: prior, deficiencyGeneratedText: generated, checklistDeficiencies: groups,deficiencySafetyLocks:lockList };
  return JSON.stringify([report.ratings, report.deficiencyPriorRatings ?? {}, report.deficiencyGeneratedText ?? {}, report.checklistDeficiencies ?? [],report.deficiencySafetyLocks??[]]) ===
    JSON.stringify([ratings, prior, generated, groups,lockList]) ? report : result;
}

export function overrideDeficiency(report: Report, group: ChecklistDeficiencyGroup, category: Category): Report {
  if (!CATEGORIES.includes(category)) throw new Error('Override must select one of the 30 named SEG categories.');
  const id = deficiencyGroupId(group.runId, category);
  const target = report.deficiencyNarratives?.[id] ?? '';
  const source = report.deficiencyNarratives?.[group.id] ?? '';
  return { ...report, ratingsReviewedAt: undefined,
    deficiencyOverrides: { ...report.deficiencyOverrides, ...Object.fromEntries(group.tasks.map(task => [task.id, category])) },
    deficiencyNarratives: { ...report.deficiencyNarratives, [id]: [...new Set([target, source].filter(Boolean))].join('\n\n') },
  };
}
