import type { Workspace } from './model.js';

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
