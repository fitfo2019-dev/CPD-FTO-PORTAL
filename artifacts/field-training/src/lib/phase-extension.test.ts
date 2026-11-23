import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyWorkspace } from './empty-workspace.js';
import { approvePhaseExtension, denyPhaseExtension, phaseExtensionRequestInputSchema } from './phase-extension.js';
import type { PhaseCaseFolder, PhaseExtensionRequest } from './model.js';
import { createPhaseWeekRanges } from './training-calendar.js';

const folder:PhaseCaseFolder={
  className:'Training Class',recruitName:'Example PO',recruitBadge:'4747',
  ftoName:'Example FTO',ftoBadge:'1222',phase:1,shift:'A-Co',zone:'1',precinct:'1',
  cruiserDistrict:'18A',ftoAssignment:'18A',daysOff:[0,6],phaseStartDate:'2027-01-03',
  phaseWeekRanges:createPhaseWeekRanges(1,'2027-01-03'),openedAt:'2027-01-03T00:00:00.000Z',
};
const request:PhaseExtensionRequest={
  id:'extension-1',className:'Training Class',recruitName:'Example PO',recruitBadge:'4747',
  phase:1,phaseStartDate:'2027-01-03',requestingFtoName:'Example FTO',requestingFtoBadge:'1222',
  extensionType:'training_weeks',requestedWeeks:1,justification:'Need one additional training week.',
  createdAt:'2027-01-30T12:00:00.000Z',
};

test('request validation keeps written justification unlimited in length',()=>{
  const parsed=phaseExtensionRequestInputSchema.safeParse({
    extensionType:'training_weeks',requestedWeeks:1,justification:'x'.repeat(150_000),
  });
  assert.equal(parsed.success,true);
});

test('coordinator approval appends phase dates and clears the pending request',()=>{
  const workspace=createEmptyWorkspace();
  workspace.caseFolder=folder;
  workspace.phaseFolders=[folder];
  workspace.phaseExtensionRequests=[request];
  const approved=approvePhaseExtension(workspace,request.id);
  assert.equal(approved.phaseFolders[0].phaseWeekRanges?.length,5);
  assert.deepEqual(approved.phaseFolders[0].phaseWeekRanges?.at(-1),{
    startDate:'2027-01-31',endDate:'2027-02-06',
  });
  assert.deepEqual(approved.caseFolder?.phaseWeekRanges,approved.phaseFolders[0].phaseWeekRanges);
  assert.equal(approved.phaseExtensionRequests.length,0);
});

test('unknown requests do not change the phase timeline',()=>{
  const workspace=createEmptyWorkspace();
  workspace.caseFolder=folder;
  workspace.phaseFolders=[folder];
  const unchanged=approvePhaseExtension(workspace,'missing');
  assert.equal(unchanged,workspace);
});

test('denial removes the pending request without changing phase dates',()=>{
  const workspace=createEmptyWorkspace();
  workspace.caseFolder=folder;
  workspace.phaseFolders=[folder];
  workspace.phaseExtensionRequests=[request];
  const denied=denyPhaseExtension(workspace,request.id);
  assert.deepEqual(denied.caseFolder?.phaseWeekRanges,folder.phaseWeekRanges);
  assert.equal(denied.phaseExtensionRequests.length,0);
});
