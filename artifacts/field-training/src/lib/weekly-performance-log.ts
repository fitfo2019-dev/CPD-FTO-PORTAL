import { CATEGORIES, PHASE_PROGRAM_WEEK_START, type Category, type ChecklistDeficiencyGroup, type PhaseCaseFolder, type Report, type TrainingAssignment, type UaNotCountedReason, type WeeklyPerformanceLog, type WeeklyPerformanceLogEntry } from './model.js';
import { categoryNumberLabel } from './weekly-log-layout.js';
import { runUaParagraph } from './run-ua-box.js';
import { nrtReference } from './nrt-reference.js';
import { getSundaySaturdayWeek, getTrainingWeekNumber } from './training-calendar.js';
import { effectiveCategoryRating } from './weekly-rating-counts.js';
import { applyUaCounting } from './seg-deficiencies.js';

type RunUnit = { at: string; reportId: string; reference?: string; categories: Category[]; minutes?: number; text: string };

const NOT_COUNTED_SHORT: Readonly<Record<UaNotCountedReason, string>> = { same_run: 'Same run, counted once', officer_safety_day: 'Officer Safety, counted once per day' };
const categoryOrder = (left: Category, right: Category) => CATEGORIES.indexOf(left) - CATEGORIES.indexOf(right);

/** One paragraph per run: "W#D#P#- (Not counted: ...) PO failed to ... corrective training." */
function runUnits(report: Report): RunUnit[] {
  const groups = applyUaCounting(report.checklistDeficiencies ?? [], report);
  const byRun = new Map<string, ChecklistDeficiencyGroup[]>();
  for (const group of groups) byRun.set(group.runId ?? 'duty', [...(byRun.get(group.runId ?? 'duty') ?? []), group]);
  const units: RunUnit[] = [];
  // Limbo Days: UA's are documented and listed on the weekly but never counted against the PO (owner, Nov 28, 2026).
  const limbo = report.limboDay === true;
  for (const [runId, mine] of byRun) {
    const run = report.runs.find(item => item.id === runId);
    const reference = mine.flatMap(group => group.tasks.map(task => task.reference)).find((value): value is string => !!value);
    const categories = [...new Set(mine.map(group => group.category))].sort(categoryOrder);
    const notCounted = mine.filter(group => group.notCounted).map(group => `${categoryNumberLabel(group.category)} · ${NOT_COUNTED_SHORT[group.notCounted!]}`);
    const body = run ? runUaParagraph(run) : [...new Set(mine.map(group => group.narrative.trim()).filter(Boolean))].join(' ');
    const note = limbo ? '(Not counted: Limbo Day)' : notCounted.length ? `(Not counted: ${notCounted.join('; ')})` : '';
    const lead = reference ? `${reference}- ` : '';
    units.push({ at: run?.occurredAt ?? `${report.date}T00:00:00`, reportId: report.id, ...(reference ? { reference } : {}), categories,
      ...(run?.uaBox?.minutes ? { minutes: run.uaBox.minutes } : {}), text: `${lead}${[note, body].filter(Boolean).join(' ')}`.trim() });
  }
  return units;
}

/**
 * Page 42 grouping (owner, Nov 27, 2026): one corrective entry per category set for the week. Each run is its own
 * paragraph in day and page order, and the total time is the sum of the runs' corrective-training minutes. Saved FTO
 * edits are kept; an edited entry whose source is gone is flagged instead of removed.
 */
export function mergeReviewedUaEntries(
  log: WeeklyPerformanceLog,
  reports: Report[],
  assignments: TrainingAssignment[],
  folder?: PhaseCaseFolder,
): WeeklyPerformanceLog {
  const reviewed = reports.filter(report => report.ratingsReviewedAt && !report.limboDay).sort((left, right) => left.date.localeCompare(right.date));
  const limboDays = reports.filter(report => report.limboDay && (report.checklistDeficiencies?.length ?? 0) > 0);
  const units = [...reviewed, ...limboDays].flatMap(report => runUnits(report).map(unit => ({ ...unit, date: report.date })))
    .sort((left, right) => left.date.localeCompare(right.date) || left.at.localeCompare(right.at));
  const sets = new Map<string, typeof units>();
  for (const unit of units) sets.set(unit.categories.join('/'), [...(sets.get(unit.categories.join('/')) ?? []), unit]);
  const reportIds = new Set(reports.map(report => report.id));
  const entries: WeeklyPerformanceLogEntry[] = [];
  const existingById = new Map(log.entries.map(entry => [entry.id, entry]));
  for (const [key, members] of sets) {
    const id = `auto-ua-set-${log.id}-${key}`;
    const categories = members[0]!.categories;
    const minutes = members.reduce((sum, unit) => sum + (unit.minutes ?? 0), 0);
    const time = members.every(unit => unit.minutes) ? `${minutes} min` : '';
    const narrative = members.map(unit => unit.text).join('\n\n');
    const references = [...new Set(members.flatMap(unit => unit.reference ? [unit.reference] : []))];
    const sourceReportIds = [...new Set(members.map(unit => unit.reportId))];
    const existing = existingById.get(id);
    const editedNarrative = existing && existing.narrative !== existing.autoSourceNarrative;
    const editedTime = existing && existing.totalTime !== existing.autoSourceTime;
    const unchanged = existing && existing.autoSourceNarrative === narrative && existing.autoSourceTime === time && JSON.stringify(existing.sourceReferences) === JSON.stringify(references);
    const next: WeeklyPerformanceLogEntry = {
      id, kind: 'corrective', category: categories[0]!, ...(categories.length > 1 ? { categories } : {}),
      totalTime: editedTime ? existing!.totalTime : time, narrative: editedNarrative ? existing!.narrative : narrative,
      sourceReportIds, sourceReferences: references, sourceReferenceReviewed: unchanged ? existing!.sourceReferenceReviewed === true : false,
      autoGeneratedFromUa: true, autoSourceNarrative: narrative, autoSourceGroup: key, autoSourceTime: time, sourceEvidenceActive: true, inlineReferences: true,
    };
    entries.push(existing && JSON.stringify(existing) === JSON.stringify(next) ? existing : next);
  }
  entries.push(...respondingToTrainingEntries(log, reviewed, existingById, assignments, folder));
  const nextById = new Map(entries.map(entry => [entry.id, entry]));
  const merged: WeeklyPerformanceLogEntry[] = [];
  for (const entry of log.entries) {
    const replacement = nextById.get(entry.id);
    if (replacement) { merged.push(replacement); nextById.delete(entry.id); continue; }
    const fromThisWeek = entry.autoSourceGroup && entry.sourceReportIds.length > 0 && entry.sourceReportIds.every(id => reportIds.has(id));
    if (!fromThisWeek) { merged.push(entry); continue; }
    if (entry.narrative === entry.autoSourceNarrative) continue;
    merged.push(entry.sourceEvidenceActive === false ? entry : { ...entry, sourceEvidenceActive: false, sourceReferenceReviewed: false });
  }
  merged.push(...nextById.values());
  for (const report of reviewed) {
    for (const category of CATEGORIES) {
      const rating = report.ratings[category];
      if (effectiveCategoryRating(report,category) !== 'UA') continue;
      const exists = merged.some(entry => entry.kind === 'corrective' && (entry.category === category || entry.categories?.includes(category)) && entry.sourceReportIds.includes(report.id));
      if (exists) continue;
      merged.push({
        id: `auto-ua-${report.id}-${category}`, kind: 'corrective', category, totalTime: '',
        narrative: rating.justification ?? '', sourceReportIds: [report.id],
        sourceReferences: [nrtReference(report, assignments, folder)], sourceReferenceReviewed: false, autoGeneratedFromUa: true,
      });
    }
  }
  return JSON.stringify(merged) === JSON.stringify(log.entries) ? log : { ...log, entries: merged };
}

/** Manual: several Responding to Training ratings in a category also need a log entry (owner: 3 or more in the week). */
export const RT_ENTRY_THRESHOLD = 3;

function respondingToTrainingEntries(
  log: WeeklyPerformanceLog,
  reviewed: readonly Report[],
  existingById: ReadonlyMap<string, WeeklyPerformanceLogEntry>,
  assignments: TrainingAssignment[],
  folder?: PhaseCaseFolder,
): WeeklyPerformanceLogEntry[] {
  const entries: WeeklyPerformanceLogEntry[] = [];
  for (const category of CATEGORIES) {
    const days = reviewed.filter(report => effectiveCategoryRating(report, category) === 'RT');
    if (days.length < RT_ENTRY_THRESHOLD) continue;
    const id = `auto-rt-${log.id}-${category}`;
    const references = days.map(report => nrtReference(report, assignments, folder));
    const narrative = days.map((report, index) => [`${references[index]}-`, report.ratings[category]?.justification?.trim()].filter(Boolean).join(' ')).join('\n\n');
    const existing = existingById.get(id);
    const editedNarrative = existing && existing.narrative !== existing.autoSourceNarrative;
    // Minutes are never filled in; the FTO enters the corrective-training time.
    entries.push({
      id, kind: 'corrective', category, totalTime: existing?.totalTime ?? '',
      narrative: editedNarrative ? existing!.narrative : narrative,
      sourceReportIds: days.map(report => report.id), sourceReferences: references,
      sourceReferenceReviewed: existing && existing.autoSourceNarrative === narrative ? existing.sourceReferenceReviewed === true : false,
      autoGeneratedFromUa: true, autoSourceNarrative: narrative, autoSourceGroup: `rt:${category}`, autoSourceTime: '', sourceEvidenceActive: true, inlineReferences: true,
    });
  }
  return entries;
}

/** Prepare any missing weekly UA log rows before class-wide exports. */
export function ensureWeeklyUaLogs(
  reports: Report[],
  existingLogs: WeeklyPerformanceLog[],
  assignments: TrainingAssignment[],
  folders: PhaseCaseFolder[],
  fallbackFolder?: PhaseCaseFolder,
): WeeklyPerformanceLog[] {
  const output=[...existingLogs];
  const groups=new Map<string,Report[]>();
  for(const report of reports) {
    const week=getSundaySaturdayWeek(report.date);
    if(!week)continue;
    const key=[report.className??'',report.recruitBadge,report.phase,week.start].join(':');
    groups.set(key,[...(groups.get(key)??[]),report]);
  }
  for(const group of groups.values()) {
    if(!group.some(report=>!!report.ratingsReviewedAt&&!report.limboDay&&(
      CATEGORIES.some(category=>report.ratings[category]?.rating==='UA')||
      CATEGORIES.some(category=>group.filter(item=>!!item.ratingsReviewedAt&&!item.limboDay&&effectiveCategoryRating(item,category)==='RT').length>=RT_ENTRY_THRESHOLD)||
      existingLogs.some(log=>log.entries.some(entry=>entry.autoSourceGroup&&entry.sourceReportIds.includes(report.id)))
    )))continue;
    const first=group[0];
    const week=getSundaySaturdayWeek(first.date);
    if(!week)continue;
    const className=first.className??'';
    const existingIndex=output.findIndex(log=>log.weekStart===week.start&&log.recruitBadge===first.recruitBadge&&log.className===className&&log.phase===first.phase);
    const existing=existingIndex>=0?output[existingIndex]:undefined;
    const folder=folders.find(item=>item.recruitBadge===first.recruitBadge&&item.className===className&&item.phase===first.phase);
    const assignment=assignments.find(item=>item.recruitBadge===first.recruitBadge&&item.className===className&&item.phase===first.phase);
    const start=folder?.phaseStartDate??assignment?.phaseStartDate;
    const phaseWeek=start?getTrainingWeekNumber(week.start,start)??(first.phaseWeek??1):first.phaseWeek??1;
    const base=existing??{
      id:`weekly-ua-${className}-${first.recruitBadge}-${first.phase}-${week.start}`,
      weekStart:week.start,weekEnd:week.end,weekNumber:PHASE_PROGRAM_WEEK_START[first.phase]+phaseWeek-1,
      phase:first.phase,phaseWeek:first.phaseWeek,ftoWeek:first.ftoWeek,className,
      recruitName:first.recruitName,recruitBadge:first.recruitBadge,ftoName:first.ftoName,ftoBadge:first.ftoBadge,
      entries:[],updatedAt:new Date().toISOString(),
    };
    const merged=mergeReviewedUaEntries(base,group,assignments,folder??fallbackFolder);
    if(merged!==base) {
      const updated={...merged,updatedAt:new Date().toISOString()};
      if(existingIndex>=0)output[existingIndex]=updated;
      else output.unshift(updated);
    }
  }
  return output;
}
