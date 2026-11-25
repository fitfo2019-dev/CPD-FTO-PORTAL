import {
  CATEGORIES,
  DAILY_ACTIVITY_FIELDS,
  PHASE_LENGTH_WEEKS,
  PHASE_PROGRAM_WEEK_START,
  defaultRatings,
  defaultReportingForDutyRecord,
  emptyRatings,
  emptyDailyActivitySummary,
  newRunChecklist,
  type Phase,
  type PhaseCaseFolder,
  type Report,
  type SubstationOrientationRecord,
  type Task,
  type TrainingAssignment,
  type TrainingRun,
  type WeeklyPerformanceLog,
  type Workspace,
} from './model.js';
import { createEmptyWorkspace } from './empty-workspace.js';
import { createPhaseWeekRanges, getPhaseScheduleInfo, getSundaySaturdayWeek } from './training-calendar.js';
import { defaultSubstationOrientationChecklist } from './substation-orientation.js';

export const FTO_TEST_PACKET_CLASS = 'FICTIONAL TEST ONLY · FTO TRAINING PACKET';
export const FTO_TEST_PACKET_RECRUIT = 'Jordan Sample';
export const FTO_TEST_PACKET_BADGE = 'TEST-042';
export const FTO_PACKET_STRESS_CLASS = 'FICTIONAL TEST ONLY · 205 PACKET STRESS CLASS';
export const FTO_PACKET_STRESS_COUNT = 205;
export const FTO_FOUR_PHASE_STRESS_CLASS = 'FICTIONAL TEST ONLY · FOUR-PHASE STRESS CLASS';
export const FTO_FOUR_PHASE_STRESS_COUNT = 100;

const FTO_NAME = 'Casey Training Example';
const FTO_BADGE = 'TEST-FTO';
const PACKET_NOTICE = 'FICTIONAL TEST ONLY — no real people, incidents, signatures, agency approval, release, or synchronization.';
const PHASE_STARTS: Record<Phase, string> = {
  1: '2025-01-06',
  2: '2025-02-10',
  3: '2025-03-12',
  4: '2025-04-10',
};
const REPORT_DATES: Record<Phase, string[]> = {
  1: ['2025-01-06', '2025-01-07', '2025-01-20'],
  2: ['2025-02-10', '2025-02-11', '2025-02-24'],
  3: ['2025-03-12', '2025-03-13', '2025-03-26'],
  4: ['2025-04-10', '2025-04-14', '2025-04-21'],
};
const SHIFTS = ['A-Co', 'B-Co', 'C-Co', 'DMW', 'EMW'] as const;
const SHIFT_FOR_PHASE = { 1: SHIFTS[0], 2: SHIFTS[1], 3: SHIFTS[3], 4: SHIFTS[4] } as const;
const AREA_FOR_PHASE = {
  1: { zone: '1', precinct: '1', cruiserDistrict: '10', ftoAssignment: '10A', daysOff: [0, 6] as (0 | 6)[] },
  2: { zone: '1', precinct: '6', cruiserDistrict: '60', ftoAssignment: '60B', daysOff: [0, 6] as (0 | 6)[] },
  3: { zone: '6', precinct: '2', cruiserDistrict: '9020', ftoAssignment: '9020D1', daysOff: [0, 5, 6] as (0 | 5 | 6)[] },
  4: { zone: '4', precinct: '3', cruiserDistrict: '9030', ftoAssignment: '9030E1', daysOff: [0, 5, 6] as (0 | 5 | 6)[] },
} as const;
const PHASE_NARRATIVES = [
  'Orientation and guided observation focused on equipment familiarity, clear radio communication, and a steady shift routine.',
  'The sample recruit practiced organizing call details, identifying the next appropriate report step, and explaining decisions clearly.',
  'The sample recruit took a more active role in simulated contacts and documented observations in a structured sequence.',
  'Independent-practice examples emphasize planning, communication, and a final review of previously introduced skills.',
];
const RUN_KINDS: TrainingRun['runKind'][] = [
  'call_for_service',
  'self_initiated',
  'traffic_crash',
  'traffic_stop',
  'domestic_incident',
  'building_search',
  'high_risk_stop',
  'call_for_service',
  'high_risk_stop',
  'traffic_stop',
  'self_initiated',
];

function timeAt(date: string, hour: number, minute: number): string {
  return `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;
}

function longNarrative(label: string, paragraphs: number, ending: string): string {
  const sections = Array.from({ length: paragraphs }, (_, index) =>
    `${PACKET_NOTICE}\n${label} · sample paragraph ${String(index + 1).padStart(3, '0')}. ` +
    'The fictional trainee summarized the practice scenario, the sequence of observations, the communication choices, and the next documentation step. '.repeat(2),
  );
  return `${sections.join('\n\n')}\n\n${ending}`;
}

function phaseFolders(): PhaseCaseFolder[] {
  return ([1, 2, 3, 4] as Phase[]).map((phase) => ({
    ...AREA_FOR_PHASE[phase],
    assignmentId: `fto-test-phase-${phase}`,
    className: FTO_TEST_PACKET_CLASS,
    recruitName: FTO_TEST_PACKET_RECRUIT,
    recruitBadge: FTO_TEST_PACKET_BADGE,
    ftoName: FTO_NAME,
    ftoBadge: FTO_BADGE,
    phase,
    shift: SHIFT_FOR_PHASE[phase],
    phaseStartDate: PHASE_STARTS[phase],
    scheduledWeeks: PHASE_LENGTH_WEEKS[phase],
    phaseWeekRanges: createPhaseWeekRanges(phase, PHASE_STARTS[phase]),
    limboExtensionWeeks: 0,
    openedAt: timeAt(PHASE_STARTS[phase], 12, 0),
  }));
}

function assignmentsFor(folders: PhaseCaseFolder[]): TrainingAssignment[] {
  return folders.map((folder) => ({
    id: folder.assignmentId!,
    className: folder.className ?? FTO_TEST_PACKET_CLASS,
    recruitName: folder.recruitName,
    recruitBadge: folder.recruitBadge,
    ftoBadge: FTO_BADGE,
    phase: folder.phase,
    phaseStartDate: folder.phaseStartDate,
    shift: folder.shift,
    daysOff: folder.daysOff,
    zone: folder.zone,
    precinct: folder.precinct,
    cruiserDistrict: folder.cruiserDistrict,
    ftoAssignment: folder.ftoAssignment,
  }));
}

function sampleRatings(phase: Phase, dayIndex: number): Report['ratings'] {
  const ratings = defaultRatings();
  const eligibleForRt = CATEGORIES.filter((category) =>
    !['dutyReadiness', 'routineDriving', 'emergencyPursuit', 'initiatingArrests', 'handlingPrisoners', 'vehicleStops', 'buildingSearch', 'patDownSearches', 'threatAssessment', 'runApproach'].includes(category),
  );
  if (eligibleForRt.length) {
    const category = eligibleForRt[(phase + dayIndex) % eligibleForRt.length];
    ratings[category] = {
      ...ratings[category],
      rating: 'RT',
      justification: `${PACKET_NOTICE} Sample coaching note: the next practice repetition showed improvement in the selected skill.`,
    };
  }
  const noObserved = CATEGORIES[(phase * 3 + dayIndex) % CATEGORIES.length];
  if (ratings[noObserved].rating === 'A') ratings[noObserved] = { ...ratings[noObserved], rating: 'NO' };
  return ratings;
}

function sampleRun(phase: Phase, dayIndex: number, date: string, index: number): TrainingRun {
  const runKind = RUN_KINDS[(phase - 1) * 3 + dayIndex] ?? 'call_for_service';
  const narrative = phase === 4 && dayIndex === 1
    ? longNarrative('Run narrative', 110, 'FICTIONAL RUN NARRATIVE END MARKER — all continuation text should be visible above this line.')
    : `${PACKET_NOTICE}\nPractice scenario: ${runKind.replaceAll('_', ' ')}.\nThe recruit described the initial information, checked the fictional location, communicated a plan, and documented the exercise outcome.\nEnd of short sample run narrative.`;
  const checklist = newRunChecklist(runKind);
  const hasContinuation = narrative.length > 220 || narrative.split('\n').length > 3;
  return {
    id: `fto-test-run-${phase}-${dayIndex}`,
    incidentNumber: `TEST-SCENARIO-${String(index + 1).padStart(2, '0')}`,
    unitNumber: `TEST-UNIT-${phase}`,
    occurredAt: timeAt(date, 9 + (index % 5), 12 + (index % 4) * 7),
    dispatchedAt: timeAt(date, 9 + (index % 5), 14 + (index % 4) * 7),
    endedAt: timeAt(date, 10 + (index % 5), 2 + (index % 4) * 7),
    runKind,
    isDispatched: runKind !== 'self_initiated',
    trafficMode: runKind === 'traffic_stop' || runKind === 'high_risk_stop' ? 'motor_vehicle' : 'none',
    dispatchedCode: runKind === 'traffic_stop' || runKind === 'high_risk_stop' ? '6' : '10',
    situationFoundCode: runKind === 'traffic_stop' || runKind === 'high_risk_stop' ? '6' : '10',
    clearanceCode: '1V',
    arrestMade: false,
    transportedAfterArrest: false,
    arrestProcessRequired: false,
    buildingSearchRequired: runKind === 'building_search',
    oviProcessRequired: false,
    activityFlags: {},
    oviProcessed: false,
    narrativeAdditionRequired: hasContinuation,
    formStatus: 'complete',
    checklist,
    checklistReviewedAt: timeAt(date, 16, 40),
    narrative,
  };
}

function dailyReports(): Report[] {
  const reports: Report[] = [];
  let runIndex = 0;
  for (const phase of [1, 2, 3, 4] as Phase[]) {
    REPORT_DATES[phase].forEach((date, dayIndex) => {
      const id = `fto-test-report-${phase}-${dayIndex + 1}`;
      const area = AREA_FOR_PHASE[phase];
      const schedule = getPhaseScheduleInfo(phase, date, PHASE_STARTS[phase], area.daysOff);
      const phaseWeek = schedule.phaseWeek ?? 1;
      const narrative = phase === 3 && dayIndex === 1
        ? longNarrative('Daily narrative', 115, 'FICTIONAL DAILY NARRATIVE END MARKER — preserved in the editor, print/PDF pages, and workbook.')
        : `${PACKET_NOTICE}\n${PHASE_NARRATIVES[phase - 1]}\n\nSample detail: the recruit reviewed a fictional situation, described the observed facts without personal identifiers, and explained the follow-up documentation choice.\n\nEnd of this phase ${phase} day ${dayIndex + 1} example.`;
      const remedial = phase === 3 && dayIndex === 1
        ? longNarrative('Corrective practice note', 35, 'FICTIONAL REMEDIAL TEXT END MARKER — no real coaching or official training is represented.')
        : `${PACKET_NOTICE}\nPractice reflection: repeat the written scenario with a clear beginning, middle, and end.`;
      const report: Report = {
        id,
        date,
        shift: SHIFT_FOR_PHASE[phase],
        phase,
        zone: area.zone,
        precinct: area.precinct,
        cruiserDistrict: area.cruiserDistrict,
        ftoAssignment: area.ftoAssignment,
        className: FTO_TEST_PACKET_CLASS,
        phaseWeek,
        ftoWeek: PHASE_PROGRAM_WEEK_START[phase] + phaseWeek - 1,
        limboDay: schedule.limboDay,
        recruitName: FTO_TEST_PACKET_RECRUIT,
        recruitBadge: FTO_TEST_PACKET_BADGE,
        ftoName: FTO_NAME,
        ftoBadge: FTO_BADGE,
        activity: emptyDailyActivitySummary(),
        activityCountsIncludeRuns: true,
        runs: [],
        reportingForDuty: {
          ...defaultReportingForDutyRecord(),
          cruiserId: `TEST-CRUISER-${phase}`,
          shotgunTraining: 'N',
          reviewedAt: timeAt(date, 8, 5),
          notes: `${PACKET_NOTICE} Sample roll-call and equipment checklist.`,
        },
        ratings: schedule.limboDay ? emptyRatings() : sampleRatings(phase, dayIndex),
        ratingsReviewedAt: schedule.limboDay ? undefined : timeAt(date, 17, 0),
        narrative,
        remedial,
        recruitComments: `${PACKET_NOTICE} Recruit comments are sample text, not an attestation.`,
        status: 'draft',
        signatures: {},
        createdAt: timeAt(date, 17, 5),
        updatedAt: timeAt(date, 17, 5),
      };
      report.activity[DAILY_ACTIVITY_FIELDS[(phase + dayIndex) % DAILY_ACTIVITY_FIELDS.length].key] = 1 + (dayIndex % 3);
      if (dayIndex === 0 || phase === 4 && dayIndex === 1) {
        report.runs.push(sampleRun(phase, dayIndex, date, runIndex));
        runIndex += 1;
      }
      reports.push(report);
    });
  }
  return reports;
}

function orientations(folders: PhaseCaseFolder[]): SubstationOrientationRecord[] {
  return folders.map((folder, index) => {
    const checklist = defaultSubstationOrientationChecklist();
    const keys = Object.keys(checklist);
    checklist[keys[(index * 7) % keys.length] as keyof typeof checklist] = false;
    const narrative = index === 0
      ? longNarrative('Orientation walkthrough', 40, 'FICTIONAL ORIENTATION END MARKER — this is sample checklist text, not an official acknowledgment.')
      : `${PACKET_NOTICE}\nPhase ${folder.phase} fictional orientation example. Review the equipment and workspace checklist with the sample recruit; no official approval is recorded.`;
    return {
      id: `fto-test-orientation-${folder.phase}-${folder.recruitBadge}`,
      className: folder.className ?? FTO_TEST_PACKET_CLASS,
      recruitName: folder.recruitName,
      recruitBadge: folder.recruitBadge,
      ftoName: FTO_NAME,
      ftoBadge: FTO_BADGE,
      phase: folder.phase,
      phaseStartDate: folder.phaseStartDate,
      dateTime: timeAt(folder.phaseStartDate, 8, 0),
      substation: 'TEST ONLY · fictional location',
      checklist,
      checklistReviewedAt: timeAt(folder.phaseStartDate, 8, 45),
      directivesReview: `${PACKET_NOTICE} Example reference list for interface testing only.`,
      narrative,
      updatedAt: timeAt(folder.phaseStartDate, 8, 45),
    };
  });
}

function weeklyLogs(reports: Report[]): WeeklyPerformanceLog[] {
  const uniqueWeeks = new Map<string, Report>();
  for (const report of reports) {
    const week = getSundaySaturdayWeek(report.date);
    if (week) uniqueWeeks.set(`${report.className}:${report.recruitBadge}:${report.phase}:${week.start}`, report);
  }
  return [...uniqueWeeks.values()].map((report, index) => {
    const week = getSundaySaturdayWeek(report.date)!;
    const long = report.phase === 3;
    const narrative = long
      ? longNarrative('Weekly corrective-practice narrative', 115, 'FICTIONAL WEEKLY LOG END MARKER — all workbook and print continuation parts should remain available.')
      : `${PACKET_NOTICE} Weekly reflection ${index + 1}: repeat the exercise, note one observed strength, and state a practical next step.`;
    return {
      id: `fto-test-weekly-${report.phase}-${week.start}-${report.recruitBadge}`,
      weekStart: week.start,
      weekEnd: week.end,
      weekNumber: PHASE_PROGRAM_WEEK_START[report.phase] + (report.phaseWeek ?? 1) - 1,
      phase: report.phase,
      phaseWeek: report.phaseWeek,
      ftoWeek: report.ftoWeek,
      className: report.className ?? FTO_TEST_PACKET_CLASS,
      recruitName: report.recruitName,
      recruitBadge: report.recruitBadge,
      ftoName: FTO_NAME,
      ftoBadge: FTO_BADGE,
      entries: [{
        id: `fto-test-weekly-entry-${report.phase}-${week.start}-${report.recruitBadge}`,
        kind: 'strength',
        category: 'publicPoliceInteraction',
        totalTime: '',
        narrative,
        sourceReportIds: [report.id],
        sourceReferences: [`W${PHASE_PROGRAM_WEEK_START[report.phase]}D1P1`],
        sourceReferenceReviewed: false,
      }],
      updatedAt: timeAt(report.date, 17, 30),
    };
  });
}

function phaseTasks(): Task[] {
  const labels: Record<Phase, string[]> = {
    1: ['Phase I orientation walkthrough · sample', 'Phase I geography practice · sample', 'Phase I communication practice · sample'],
    2: ['Phase II traffic-form practice · sample', 'Phase II report-writing exercise · sample', 'Phase II checklist review · sample'],
    3: ['Phase III call-management exercise · sample', 'Phase III interview documentation · sample', 'Phase III weekly review · sample'],
    4: ['Phase IV independent-practice scenario · sample', 'Phase IV final skills review · sample'],
  };
  return ([1, 2, 3, 4] as Phase[]).flatMap((phase) =>
    labels[phase].map((title, index) => ({
      id: `fto-test-task-${phase}-${index + 1}`,
      phase,
      group: 'Fictional test checklist',
      title: `${PACKET_NOTICE} ${title}`,
      done: index !== labels[phase].length - 1,
      ...(index !== labels[phase].length - 1 ? {
        by: 'Fictional test entry · no official approval',
        at: timeAt(PHASE_STARTS[phase], 17, 0),
      } : {}),
    })),
  );
}

/** Stable, fictional workspace built fresh for each explicit test-packet opening/reset. */
export function createFtoTestPacketWorkspace(): Workspace {
  const folders = phaseFolders();
  const reports = dailyReports();
  const workspace = createEmptyWorkspace();
  const firstReport = reports[0];
  const firstWeek = getSundaySaturdayWeek(firstReport.date)!;
  return {
    ...workspace,
    role: 'fto',
    reports,
    tasks: phaseTasks(),
    caseFolder: folders[3],
    phaseFolders: folders,
    ftoDirectory: [{ badge: FTO_BADGE, name: FTO_NAME }],
    assignments: assignmentsFor(folders),
    weeklyAcknowledgements: [{
      id: 'fto-test-weekly-ack-draft',
      weekStart: firstWeek.start,
      weekEnd: firstWeek.end,
      weekNumber: 1,
      phase: 1,
      recruitName: FTO_TEST_PACKET_RECRUIT,
      recruitBadge: FTO_TEST_PACKET_BADGE,
      recruitAssignment: '10A · A-Co',
      ftoName: FTO_NAME,
      ftoBadge: FTO_BADGE,
      ftoAssignment: '10A · A-Co',
      recruitComments: `${PACKET_NOTICE} Draft acknowledgement example; not signed.`,
      ftoComments: `${PACKET_NOTICE} Draft FTO note; not signed.`,
      officeComments: '',
      signatures: {},
      status: 'draft',
      createdAt: timeAt(firstReport.date, 17, 0),
      updatedAt: timeAt(firstReport.date, 17, 0),
    }],
    weeklyPerformanceLogs: weeklyLogs(reports),
    substationOrientations: orientations(folders),
    ftoPhasePostings: [],
    ftoPhaseSignups: [],
    coverageRequests: [],
    lawReviewRecords: [],
    phaseExtensionRequests: [],
  };
}

/** Deterministic, device-only class fixture for queue-scale tests. */
export function createFtoPacketStressWorkspace(count = FTO_PACKET_STRESS_COUNT): Workspace {
  if (!Number.isInteger(count) || count < FTO_PACKET_STRESS_COUNT)
    throw new RangeError(`The synthetic stress class requires at least ${FTO_PACKET_STRESS_COUNT} POs.`);
  const base = createFtoTestPacketWorkspace();
  const sourceFolder = base.phaseFolders[0]!;
  const sourceReport = base.reports[0]!;
  const folders = Array.from({ length: count }, (_, index) => {
    const suffix = String(index + 1).padStart(3, '0');
    const recruitName = `Jordan Sample ${suffix}`;
    const recruitBadge = `TEST-PO-${suffix}`;
    return {
      ...sourceFolder,
      assignmentId: `fto-stress-assignment-${suffix}`,
      className: FTO_PACKET_STRESS_CLASS,
      recruitName,
      recruitBadge,
      openedAt: timeAt(sourceFolder.phaseStartDate, 12, 0),
    };
  });
  const assignments = folders.map((folder) => ({
    id: folder.assignmentId!,
    className: FTO_PACKET_STRESS_CLASS,
    recruitName: folder.recruitName,
    recruitBadge: folder.recruitBadge,
    ftoBadge: FTO_BADGE,
    phase: folder.phase,
    phaseStartDate: folder.phaseStartDate,
    shift: folder.shift,
    daysOff: folder.daysOff,
    zone: folder.zone,
    precinct: folder.precinct,
    cruiserDistrict: folder.cruiserDistrict,
    ftoAssignment: folder.ftoAssignment,
  }));
  const reports: Report[] = folders.map((folder, index) => {
    const suffix = String(index + 1).padStart(3, '0');
    const long = index % 17 === 0;
    return {
      ...sourceReport,
      id: `fto-stress-packet-${suffix}`,
      className: FTO_PACKET_STRESS_CLASS,
      recruitName: folder.recruitName,
      recruitBadge: folder.recruitBadge,
      ftoName: FTO_NAME,
      ftoBadge: FTO_BADGE,
      narrative: long
        ? `${PACKET_NOTICE}\n${`Fictional long narrative section ${suffix}. `.repeat(1400)}FICTIONAL END MARKER ${suffix}.`
        : `${PACKET_NOTICE}\nFictional packet narrative ${suffix}.`,
      remedial: index % 9 === 0
        ? `${PACKET_NOTICE}\n${`Fictional coaching example ${suffix}. `.repeat(120)}`
        : `${PACKET_NOTICE} No corrective example for this synthetic entry.`,
      runs: sourceReport.runs.map((run, runIndex) => ({
        ...run,
        id: `fto-stress-run-${suffix}-${runIndex + 1}`,
        incidentNumber: `TEST-SCENARIO-${suffix}-${runIndex + 1}`,
      })),
      syncStatus: 'local_draft_pending',
      serverVersion: 0,
      syncAttemptPending: undefined,
    };
  });
  return {
    ...base,
    reports,
    tasks: [],
    caseFolder: folders[0],
    phaseFolders: folders,
    ftoDirectory: [{ badge: FTO_BADGE, name: FTO_NAME }],
    assignments,
    weeklyAcknowledgements: [],
    weeklyPerformanceLogs: [],
    substationOrientations: [],
    ftoPhasePostings: [],
    ftoPhaseSignups: [],
    coverageRequests: [],
    lawReviewRecords: [],
    phaseExtensionRequests: [],
  };
}

/**
 * Deterministic, test-only cohort spanning the complete configured program.
 * Each fictional recruit has every scheduled workday, one weekly log per
 * phase-week, and one phase folder/assignment/orientation for each phase.
 */
export function createFtoFourPhasePacketStressWorkspace(
  count = FTO_FOUR_PHASE_STRESS_COUNT,
): Workspace {
  if (!Number.isInteger(count) || count < FTO_FOUR_PHASE_STRESS_COUNT) {
    throw new RangeError(`The four-phase synthetic cohort requires at least ${FTO_FOUR_PHASE_STRESS_COUNT} recruits.`);
  }
  const base = createFtoTestPacketWorkspace();
  const phases = [1, 2, 3, 4] as Phase[];
  const phaseStarts = {} as Record<Phase, string>;
  let nextPhaseStart = '2025-01-05';
  for (const phase of phases) {
    phaseStarts[phase] = nextPhaseStart;
    const next = new Date(`${nextPhaseStart}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + PHASE_LENGTH_WEEKS[phase] * 7);
    nextPhaseStart = next.toISOString().slice(0, 10);
  }

  const folders = Array.from({ length: count }, (_, recruitIndex) => {
    const suffix = String(recruitIndex + 1).padStart(3, '0');
    const recruitName = `Jordan Sample ${suffix}`;
    const recruitBadge = `TEST-4P-${suffix}`;
    return phases.map(phase => {
      const source = base.phaseFolders.find(folder => folder.phase === phase)!;
      return {
        ...source,
        assignmentId: `fto-stress4-assignment-${suffix}-p${phase}`,
        className: FTO_FOUR_PHASE_STRESS_CLASS,
        recruitName,
        recruitBadge,
        phaseStartDate: phaseStarts[phase],
        scheduledWeeks: PHASE_LENGTH_WEEKS[phase],
        phaseWeekRanges: createPhaseWeekRanges(phase, phaseStarts[phase]),
        openedAt: timeAt(phaseStarts[phase], 12, 0),
      };
    });
  }).flat();

  const reports: Report[] = [];
  let runIndex = 0;
  for (let folderIndex = 0; folderIndex < folders.length; folderIndex++) {
    const folder = folders[folderIndex]!;
    const phase = folder.phase;
    const recruitIndex = Math.floor(folderIndex / phases.length);
    for (const range of folder.phaseWeekRanges) {
      for (let offset = 0; offset < 7; offset++) {
        const dateValue = new Date(`${range.startDate}T00:00:00.000Z`);
        dateValue.setUTCDate(dateValue.getUTCDate() + offset);
        const date = dateValue.toISOString().slice(0, 10);
        const weekday = dateValue.getUTCDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
        if (date < folder.phaseStartDate || folder.daysOff.includes(weekday)) continue;

        const schedule = getPhaseScheduleInfo(
          phase, date, folder.phaseStartDate, folder.daysOff, folder.phaseWeekRanges,
        );
        if (!schedule.phaseWeek || !schedule.scheduledDay) continue;
        const suffix = String(recruitIndex + 1).padStart(3, '0');
        const template = base.reports.find(report => report.phase === phase)!;
        const isLongBoundary = recruitIndex === 0 && (
          (phase === 1 && schedule.phaseWeek === PHASE_LENGTH_WEEKS[phase] && schedule.scheduledDay === 5) ||
          (phase === 4 && schedule.phaseWeek === PHASE_LENGTH_WEEKS[phase] && schedule.scheduledDay === 4)
        );
        const reportId = `fto-stress4-report-${suffix}-p${phase}-${date}`;
        const report: Report = {
          ...structuredClone(template),
          id: reportId,
          date,
          phase,
          phaseWeek: schedule.phaseWeek,
          ftoWeek: schedule.programWeek,
          limboDay: schedule.limboDay,
          shift: folder.shift,
          zone: folder.zone,
          precinct: folder.precinct,
          cruiserDistrict: folder.cruiserDistrict,
          ftoAssignment: folder.ftoAssignment,
          className: FTO_FOUR_PHASE_STRESS_CLASS,
          recruitName: folder.recruitName,
          recruitBadge: folder.recruitBadge,
          ftoName: FTO_NAME,
          ftoBadge: FTO_BADGE,
          activity: emptyDailyActivitySummary(),
          ratings: schedule.limboDay
            ? emptyRatings()
            : sampleRatings(phase, recruitIndex + schedule.scheduledDay),
          ratingsReviewedAt: schedule.limboDay ? undefined : timeAt(date, 17, 0),
          narrative: isLongBoundary
            ? longNarrative(
              `Four-phase cohort ${suffix} · Phase ${phase} · ${date}`,
              100,
              `FICTIONAL END MARKER ${suffix} · PHASE ${phase} · ${date} · complete narrative retained.`,
            )
            : `${PACKET_NOTICE}\nCohort ${suffix}, Phase ${phase}, program week ${schedule.programWeek}, phase week ${schedule.phaseWeek}, scheduled day ${schedule.scheduledDay}. ` +
              `Fictional practice focused on ${PHASE_NARRATIVES[phase - 1].toLowerCase()} End of sample entry ${suffix}-${date}.`,
          remedial: `${PACKET_NOTICE} Fictional coaching reflection for recruit ${suffix}, phase ${phase}, ${date}.`,
          recruitComments: `${PACKET_NOTICE} Fictional recruit reflection ${suffix}-${date}; no attestation or signature.`,
          reportingForDuty: {
            ...structuredClone(template.reportingForDuty),
            cruiserId: `TEST-CRUISER-${phase}`,
            reviewedAt: timeAt(date, 8, 5),
            notes: `${PACKET_NOTICE} Sample duty checklist ${suffix}-${date}.`,
          },
          runs: schedule.scheduledDay === 1
            ? [{
              ...sampleRun(phase, schedule.phaseWeek, date, runIndex++),
              id: `fto-stress4-run-${suffix}-p${phase}-${date}`,
              incidentNumber: `TEST-SCENARIO-${suffix}-P${phase}-${date}`,
            }]
            : [],
          status: 'draft',
          signatures: {},
          createdAt: timeAt(date, 17, 5),
          updatedAt: timeAt(date, 17, 5),
          syncStatus: 'local_draft_pending',
          serverVersion: 0,
          serverContentHash: undefined,
          draftSyncPending: true,
          syncAttemptPending: undefined,
        };
        report.activity[DAILY_ACTIVITY_FIELDS[(phase + schedule.scheduledDay) % DAILY_ACTIVITY_FIELDS.length]!.key] =
          1 + (schedule.scheduledDay % 3);
        reports.push(report);
      }
    }
  }

  return {
    ...base,
    reports,
    tasks: [],
    caseFolder: folders[0],
    phaseFolders: folders,
    ftoDirectory: [{ badge: FTO_BADGE, name: FTO_NAME }],
    assignments: assignmentsFor(folders),
    weeklyAcknowledgements: [],
    weeklyPerformanceLogs: weeklyLogs(reports),
    substationOrientations: orientations(folders),
    ftoPhasePostings: [],
    ftoPhaseSignups: [],
    coverageRequests: [],
    lawReviewRecords: [],
    phaseExtensionRequests: [],
  };
}
