import type { PhaseCaseFolder, TrainingAssignment, Workspace } from './model.js';

/** A new device workspace starts empty and never inserts invented training records. */
export function createEmptyWorkspace(): Workspace {
  return {
    version: 0,
    packetIndexVersion: 1,
    role: 'fto',
    reports: [],
    tasks: [],
    caseFolder: undefined,
    phaseFolders: [],
    ftoDirectory: [],
    assignments: [],
    weeklyAcknowledgements: [],
    weeklyPerformanceLogs: [],
    substationOrientations: [],
    ftoPhasePostings: [],
    ftoPhaseSignups: [],
    coverageRequests: [],
    lawReviewRecords: [],
  };
}

/** Fictional starting data used only by the disposable development UI preview. */
export function createUiPreviewWorkspace(): Workspace {
  const folder: PhaseCaseFolder = {
    assignmentId: 'ui-preview-assignment',
    className: 'UI TEST ONLY',
    recruitName: 'DEMO PO',
    recruitBadge: 'DEMO-PO',
    ftoName: 'DEMO FTO',
    ftoBadge: 'DEMO-FTO',
    phase: 3,
    shift: 'A-Co',
    zone: '1',
    precinct: '1',
    cruiserDistrict: '10',
    ftoAssignment: '10A',
    daysOff: [0, 6],
    phaseStartDate: '2026-11-16',
    openedAt: '2026-11-16T12:00:00.000Z',
  };
  const assignment: TrainingAssignment = {
    id: 'ui-preview-assignment',
    className: folder.className ?? 'UI TEST ONLY',
    recruitName: folder.recruitName,
    recruitBadge: folder.recruitBadge,
    ftoBadge: folder.ftoBadge,
    phase: folder.phase,
    phaseStartDate: folder.phaseStartDate,
    shift: folder.shift,
    daysOff: folder.daysOff,
    zone: folder.zone,
    precinct: folder.precinct,
    cruiserDistrict: folder.cruiserDistrict,
    ftoAssignment: folder.ftoAssignment,
  };

  return {
    ...createEmptyWorkspace(),
    role: 'fto',
    caseFolder: folder,
    phaseFolders: [folder],
    ftoDirectory: [{ badge: folder.ftoBadge, name: folder.ftoName }],
    assignments: [assignment],
  };
}
