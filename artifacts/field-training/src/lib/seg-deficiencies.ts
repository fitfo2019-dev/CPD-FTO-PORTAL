import {
  CATEGORIES, DAILY_DUTY_CHECKLIST, RUN_CHECKLIST_SECTIONS, RUN_SUPPLEMENT_CHECKLIST_SECTIONS,
  type Category, type ChecklistDeficiencyGroup, type PrimaryRunForm, type Report, type SupplementalRunForm,
} from './model.js';
import type { OperationalPacket } from './operational-state-machine.js';

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

function buildDirectory(): Readonly<Record<string, Category>> {
  if (CATEGORIES.length !== 30 || new Set(CATEGORIES).size !== 30) throw new Error('Exactly 30 unique SEG categories are required.');
  const directory: Record<string, Category> = {};
  for (const group of DAILY_DUTY_CHECKLIST) for (const item of group.items) directory[`duty:${item.key}`] = 'dutyReadiness';
  for (const [form, sections] of Object.entries(RUN_CHECKLIST_SECTIONS)) {
    let index = 0;
    for (const section of sections) for (const item of section.items) {
      directory[`${form}:task-${index++}`] = taskCategory(form as PrimaryRunForm, section.title, item.label);
    }
  }
  for (const [form, sections] of Object.entries(RUN_SUPPLEMENT_CHECKLIST_SECTIONS)) {
    let index = 0;
    for (const section of sections) for (const item of section.items) {
      directory[`${form}:supp-${form}-${index++}`] = taskCategory(form as SupplementalRunForm, section.title, item.label);
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
    group.tasks.push({ id: exception.id, label: exception.task, reference: exception.reference });
    groups.set(id, group);
  }
  return [...groups.values()];
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
