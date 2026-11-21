import type { Workspace } from './model';

/** A new device workspace starts empty and never inserts invented training records. */
export function createEmptyWorkspace(): Workspace {
  return {
    version: 0,
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
