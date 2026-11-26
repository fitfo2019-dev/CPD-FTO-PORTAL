import type { PhaseCaseFolder, Role, TrainingAssignment, Workspace } from './model.js';
import { CURRENT_PACKET_INDEX_VERSION } from './operational-state-machine.js';

/** A new device workspace starts empty and never inserts invented training records. */
export function createEmptyWorkspace(): Workspace {
  return {
    version: 0,
    packetIndexVersion: CURRENT_PACKET_INDEX_VERSION,
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
    phaseExtensionRequests: [],
    week15Recommendations: [],
    nrtReviewRequests: [],
  };
}

const PREVIEW_START = '2026-11-16';
const PREVIEW_OPENED_AT = '2026-11-16T12:00:00.000Z';

function previewFolder(index: number, ftoName: string, ftoBadge: string): PhaseCaseFolder {
  const recruitName = index === 1 ? 'DEMO PO' : `DEMO PO ${index}`;
  const recruitBadge = index === 1 ? 'DEMO-PO' : `DEMO-PO-${index}`;
  const assignmentId = `ui-preview-assignment-${index}`;
  return {
    assignmentId,
    className: 'UI TEST ONLY',
    recruitName,
    recruitBadge,
    ftoName,
    ftoBadge,
    phase: index === 1 ? 3 : 2,
    shift: 'A-Co',
    zone: '1',
    precinct: '1',
    cruiserDistrict: '10',
    ftoAssignment: '10A',
    daysOff: [0, 6],
    phaseStartDate: PREVIEW_START,
    openedAt: PREVIEW_OPENED_AT,
  };
}

function assignmentFromFolder(folder: PhaseCaseFolder): TrainingAssignment {
  return {
    id: folder.assignmentId ?? `ui-preview-${folder.recruitBadge}`,
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
}

/** Role-specific fictional data used only in the disposable, memory-only UI preview. */
export function createUiPreviewWorkspace(role: Role = 'fto'): Workspace {
  const workspace = { ...createEmptyWorkspace(), role };

  if (role === 'fto') {
    const folder = previewFolder(1, 'DEMO FTO', 'DEMO-FTO');
    return {
      ...workspace,
      caseFolder: folder,
      phaseFolders: [folder],
      ftoDirectory: [{ badge: folder.ftoBadge, name: folder.ftoName }],
      assignments: [assignmentFromFolder(folder)],
    };
  }

  if (role === 'fto_coordinator') {
    const folders = [
      previewFolder(1, 'DEMO FTO', 'DEMO-FTO'),
      previewFolder(2, 'DEMO FTO 2', 'DEMO-FTO-2'),
    ];
    return {
      ...workspace,
      caseFolder: folders[0],
      phaseFolders: folders,
      ftoDirectory: folders.map(folder => ({ badge: folder.ftoBadge, name: folder.ftoName })),
      assignments: folders.map(assignmentFromFolder),
      phaseExtensionRequests: [{
        id: 'ui-preview-extension-request',
        className: 'UI TEST ONLY',
        recruitName: folders[0].recruitName,
        recruitBadge: folders[0].recruitBadge,
        phase: folders[0].phase,
        phaseStartDate: folders[0].phaseStartDate,
        requestingFtoName: folders[0].ftoName,
        requestingFtoBadge: folders[0].ftoBadge,
        extensionType: 'training_weeks',
        requestedWeeks: 1,
        justification: 'Fictional sample request for preview only.',
        createdAt: PREVIEW_OPENED_AT,
        status: 'pending',
      }],
    };
  }

  // PO, command-review, and technical roles have no FTO roster or packet data.
  return workspace;
}
