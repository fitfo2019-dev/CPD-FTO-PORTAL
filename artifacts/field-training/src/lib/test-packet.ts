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
    className: FTO_TEST_PACKET_CLASS,
    recruitName: FTO_TEST_PACKET_RECRUIT,
    recruitBadge: FTO_TEST_PACKET_BADGE,
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
    !['dutyReadiness', 'routineDriving', 'emergencyPursuit', 'initiatingArrests', 'handlingPrisoners', 'vehicleStops', 'buildingSearch', 'patDownSearches'].includes(category),
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
      id: `fto-test-orientation-${folder.phase}`,
      className: FTO_TEST_PACKET_CLASS,
      recruitName: FTO_TEST_PACKET_RECRUIT,
      recruitBadge: FTO_TEST_PACKET_BADGE,
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
    if (week) uniqueWeeks.set(`${report.phase}:${week.start}`, report);
  }
  return [...uniqueWeeks.values()].map((report, index) => {
    const week = getSundaySaturdayWeek(report.date)!;
    const long = report.phase === 3;
    const narrative = long
      ? longNarrative('Weekly corrective-practice narrative', 115, 'FICTIONAL WEEKLY LOG END MARKER — all workbook and print continuation parts should remain available.')
      : `${PACKET_NOTICE} Weekly reflection ${index + 1}: repeat the exercise, note one observed strength, and state a practical next step.`;
    return {
      id: `fto-test-weekly-${report.phase}-${week.start}`,
      weekStart: week.start,
      weekEnd: week.end,
      weekNumber: PHASE_PROGRAM_WEEK_START[report.phase] + (report.phaseWeek ?? 1) - 1,
      phase: report.phase,
      phaseWeek: report.phaseWeek,
      ftoWeek: report.ftoWeek,
      className: FTO_TEST_PACKET_CLASS,
      recruitName: FTO_TEST_PACKET_RECRUIT,
      recruitBadge: FTO_TEST_PACKET_BADGE,
      ftoName: FTO_NAME,
      ftoBadge: FTO_BADGE,
      entries: [{
        id: `fto-test-weekly-entry-${report.phase}-${week.start}`,
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
