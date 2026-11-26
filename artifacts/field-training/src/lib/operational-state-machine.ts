import {
  DAILY_DUTY_CHECKLIST,
  PRIMARY_RUN_FORMS,
  RUN_CHECKLIST_SECTIONS,
  RUN_SUPPLEMENT_CHECKLIST_SECTIONS,
  SUPPLEMENTAL_RUN_FORMS,
  requiredSupplementalForms,
  type PhaseCaseFolder,
  type Report,
  type SubstationOrientationRecord,
  type SupplementalRunForm,
  type WeeklyPerformanceLog,
  type Workspace,
} from './model.js';
import {
  formatTrainingFolderPageReference,
  getNextReportDate,
  getTrainingFolderDayReference,
  type TrainingFolderDayReference,
} from './training-calendar.js';
import { dailyLogContinuations, needsRunNarrativeContinuation, splitNarrativeContinuation } from './narrative-continuation.js';
import { orientationPrintLayout } from './orientation-print-layout.js';
import { runFailureActionChoices } from './run-checklist-failures.js';

export const CURRENT_PACKET_INDEX_VERSION = 2;

export type OperationalPageKind =
  | 'duty'
  | 'orientation'
  | 'orientation_continuation'
  | 'run'
  | 'supplement'
  | 'run_continuation'
  | 'daily_summary'
  | 'daily_continuation';

export interface OperationalPage {
  readonly id: string;
  readonly page: number;
  readonly kind: OperationalPageKind;
  readonly title: string;
  readonly reference?: string;
  readonly runId?: string;
  readonly supplement?: SupplementalRunForm;
  readonly part?: number;
}

export interface OperationalException {
  readonly id: string;
  readonly reportId: string;
  readonly runId?: string;
  readonly taskKey: string;
  readonly task: string;
  readonly failureActions?: readonly string[];
  readonly section: string;
  readonly page: number;
  readonly reference?: string;
  readonly reviewed: boolean;
}

export interface OperationalPacket {
  readonly reportId: string;
  readonly date: string;
  readonly pages: readonly OperationalPage[];
  readonly exceptions: readonly OperationalException[];
  readonly orientation?: SubstationOrientationRecord;
  readonly dayReference?: TrainingFolderDayReference;
  readonly blockingIssues: readonly string[];
}

interface PacketContext {
  readonly orientation?: SubstationOrientationRecord;
  readonly dayReference?: TrainingFolderDayReference;
  readonly orientationRequired?: boolean;
}

/** Rebuild a shift-local projection; there is no shared mutable page counter or page cap. */
export function buildOperationalPacket(report: Report, context: PacketContext = {}): OperationalPacket {
  const pages: OperationalPage[] = [];
  const exceptions: OperationalException[] = [];
  const blockingIssues = context.orientationRequired && !context.orientation?.checklistReviewedAt
    ? ['Complete and review Substation Orientation for the first scheduled shift of this phase.']
    : [];
  const append = (entry: Omit<OperationalPage, 'page' | 'reference'>): OperationalPage => {
    const page = pages.length + 1;
    const result = Object.freeze({
      ...entry,
      page,
      reference: formatTrainingFolderPageReference(context.dayReference, page),
    });
    pages.push(result);
    return result;
  };
  const captureException = (page: OperationalPage, taskKey: string, task: string, section: string, reviewed: boolean, failureActions?: readonly string[]) => {
    exceptions.push(Object.freeze({
      id: `${report.id}:${page.id}:${taskKey}`,
      reportId: report.id,
      runId: page.runId,
      taskKey,
      task,
      ...(failureActions?.length ? { failureActions:Object.freeze([...failureActions]) } : {}),
      section,
      page: page.page,
      reference: page.reference,
      reviewed,
    }));
  };

  const phaseIngress = !!context.orientation || context.orientationRequired === true;
  if (phaseIngress) {
    append({ id: 'orientation', kind: 'orientation', title: 'Substation Orientation', part: 1 });
  }
  const duty = append({ id: 'duty', kind: 'duty', title: 'Reporting for Duty' });
  for (const group of DAILY_DUTY_CHECKLIST) {
    if (report.reportingForDuty.notApplicable?.[group.section]) continue;
    for (const item of group.items) {
      if (report.reportingForDuty.checklist[item.key] === false) {
        captureException(duty, item.key, item.label, group.section, !!report.reportingForDuty.reviewedAt);
      }
    }
  }

  const runIds = new Set<string>();
  for (const run of [...report.runs].sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt))) {
    if (runIds.has(run.id)) throw new Error('Duplicate run identifiers prevent a reliable daily page index.');
    runIds.add(run.id);
    const primary = append({
      id: `run:${run.id}`,
      kind: 'run',
      title: PRIMARY_RUN_FORMS.find(form => form.key === run.runKind)?.label ?? run.runKind,
      runId: run.id,
    });
    const captureRunTasks = (page: OperationalPage, sections: typeof RUN_CHECKLIST_SECTIONS[typeof run.runKind], prefix: string, notApplicable: boolean) => {
      if (notApplicable) return;
      let index = 0;
      for (const section of sections) {
        for (const item of section.items) {
          const key = `${prefix}${index++}`;
          if (run.checklist[key] === false && run.checklistNotApplicable?.[key] !== true) {
            const failureActions=run.checklistFailures?.[key];
            if(failureActions) {
              const form=page.kind==='supplement'?(page.supplement??run.runKind):run.runKind;
              const choices=runFailureActionChoices(form,key,item.label);
              if(!choices||failureActions.length===0||new Set(failureActions).size!==failureActions.length||failureActions.some(action=>!choices.includes(action))) {
                throw new Error(`Run ${run.id} has invalid specific failure details for ${key}.`);
              }
            }
            captureException(page, key, item.label, section.title, !!run.checklistReviewedAt && run.formStatus === 'complete',failureActions);
          }
        }
      }
    };
    captureRunTasks(primary, RUN_CHECKLIST_SECTIONS[run.runKind], 'task-', run.checklist['na-task'] === true);
    for (const form of requiredSupplementalForms(run).filter(form => form !== 'narrative_addition')) {
      const supplement = append({
        id: `run:${run.id}:supplement:${form}`,
        kind: 'supplement',
        title: SUPPLEMENTAL_RUN_FORMS.find(item => item.key === form)?.label ?? form,
        runId: run.id,
        supplement: form,
      });
      captureRunTasks(supplement, RUN_SUPPLEMENT_CHECKLIST_SECTIONS[form], `supp-${form}-`, run.checklist[`na-supp-${form}`] === true);
    }
    if (needsRunNarrativeContinuation(run.narrative, run.narrativeAdditionRequired)) {
      splitNarrativeContinuation(run.narrative).forEach((_, index) => append({
        id: `run:${run.id}:continuation:${index + 1}`,
        kind: 'run_continuation',
        title: 'Narrative Addition / Continuation',
        runId: run.id,
        part: index + 1,
      }));
    }
  }

  // Overflow is separate U-10.192 material, not an extra orientation checklist
  // sheet. Place it after runs so it never displaces duty or the first incident.
  if (context.orientation) {
    orientationPrintLayout(context.orientation).continuations.forEach((_, index) => append({
      id: `orientation-continuation:${index + 1}`,
      kind: 'orientation_continuation',
      title: 'Substation Orientation · Narrative Addition / Continuation',
      part: index + 1,
    }));
  }
  append({ id: 'daily-summary', kind: 'daily_summary', title: 'Daily Performance Summary' });
  dailyLogContinuations(report).forEach((continuation, index) => append({
    id: `daily-continuation:${index + 1}`,
    kind: 'daily_continuation',
    title: continuation.label,
    part: index + 1,
  }));
  return Object.freeze({
    reportId: report.id,
    date: report.date,
    pages: Object.freeze(pages),
    exceptions: Object.freeze(exceptions),
    orientation: context.orientation,
    dayReference: context.dayReference,
    blockingIssues: Object.freeze(blockingIssues),
  });
}

/** Match by class, officer and phase; an orientation belongs only to the phase's first scheduled shift. */
export function resolveOperationalPacket(
  report: Report,
  folders: readonly PhaseCaseFolder[],
  orientations: readonly SubstationOrientationRecord[],
): OperationalPacket {
  const folder = folders.find(item =>
    item.phase === report.phase &&
    item.recruitBadge === report.recruitBadge &&
    (item.className ?? '') === (report.className ?? ''),
  );
  const firstShiftDate = folder ? getNextReportDate(folder, []) : undefined;
  const orientationRequired = !!folder && report.date === firstShiftDate;
  const orientation = orientationRequired
    ? orientations.find(item =>
      (item.phase ?? 1) === report.phase &&
      item.recruitBadge === report.recruitBadge &&
      item.className === (report.className ?? '') &&
      (item.phaseStartDate === firstShiftDate || item.phaseStartDate === folder?.phaseStartDate),
    )
    : undefined;
  return buildOperationalPacket(report, {
    orientation,
    orientationRequired,
    dayReference: folder
      ? getTrainingFolderDayReference(report.phase, report.date, folder.phaseStartDate, folder.daysOff)
      : undefined,
  });
}

/** Preserve historical reference text but never leave its review valid after its source changes. */
export function invalidateOperationalReferences(
  logs: WeeklyPerformanceLog[],
  changedReportIds?: ReadonlySet<string>,
): WeeklyPerformanceLog[] {
  let changed = false;
  const result = logs.map(log => {
    let logChanged = false;
    const entries = log.entries.map(entry => {
      if (!entry.sourceReferenceReviewed || (changedReportIds && !entry.sourceReportIds.some(id => changedReportIds.has(id)))) return entry;
      changed = true;
      logChanged = true;
      return { ...entry, sourceReferenceReviewed: false };
    });
    return logChanged ? { ...log, entries } : log;
  });
  return changed ? result : logs;
}

/** Preserve historical citation text while requiring review after layout changes. */
export function migrateOperationalReferenceReviews(version:number|undefined, logs:WeeklyPerformanceLog[]):WeeklyPerformanceLog[] {
  return version === CURRENT_PACKET_INDEX_VERSION ? logs : invalidateOperationalReferences(logs);
}

export function reconcileOperationalReferences(previous: Workspace, next: Workspace): Workspace {
  const scheduleChanged = previous.phaseFolders !== next.phaseFolders ||
    previous.caseFolder !== next.caseFolder ||
    previous.substationOrientations !== next.substationOrientations;
  if (!scheduleChanged && previous.reports === next.reports) return next;
  const nextReports = new Map(next.reports.map(report => [report.id, report]));
  const changedIds = new Set(previous.reports.filter(report => nextReports.get(report.id) !== report).map(report => report.id));
  const logs = invalidateOperationalReferences(next.weeklyPerformanceLogs, scheduleChanged ? undefined : changedIds);
  return logs === next.weeklyPerformanceLogs ? next : { ...next, weeklyPerformanceLogs: logs };
}
