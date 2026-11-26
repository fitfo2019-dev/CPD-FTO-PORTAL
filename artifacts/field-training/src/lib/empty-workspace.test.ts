import assert from 'node:assert/strict';
import test from 'node:test';
import { ROLES } from './model.js';
import { createUiPreviewWorkspace } from './empty-workspace.js';

test('each fictional role gets only the starter data intended for that role', () => {
  const workspaces = new Map(ROLES.map(role => [role, createUiPreviewWorkspace(role)]));

  for (const role of ROLES) {
    const workspace = workspaces.get(role)!;
    assert.equal(workspace.role, role);
    assert.deepEqual(workspace.reports, []);
    assert.deepEqual(workspace.tasks, []);
    assert.deepEqual(workspace.weeklyAcknowledgements, []);
    assert.deepEqual(workspace.substationOrientations, []);
    assert.ok(
      workspace.phaseFolders.every(folder => folder.className === 'UI TEST ONLY'
        && folder.recruitBadge.startsWith('DEMO-PO')),
    );
    assert.ok(workspace.assignments.every(assignment => assignment.className === 'UI TEST ONLY'
      && assignment.recruitBadge.startsWith('DEMO-PO')
      && assignment.ftoBadge.startsWith('DEMO-FTO')));
  }

  assert.equal(workspaces.get('fto')?.caseFolder?.recruitBadge, 'DEMO-PO');
  assert.equal(workspaces.get('fto')?.assignments.length, 1);

  const coordinator = workspaces.get('fto_coordinator')!;
  assert.equal(coordinator.assignments.length, 2);
  assert.equal(coordinator.phaseExtensionRequests.length, 1);
  assert.equal(coordinator.phaseExtensionRequests[0].status, 'pending');
  assert.match(coordinator.phaseExtensionRequests[0].justification, /Fictional sample/);

  const sergeant = workspaces.get('fto_sgt')!;
  assert.equal(sergeant.caseFolder, undefined);
  assert.deepEqual(sergeant.assignments, []);
  assert.equal(sergeant.phaseFolders.length, 2);
  assert.equal(sergeant.nrtReviewRequests.length, 1);
  assert.match(sergeant.nrtReviewRequests[0].summary, /Fictional sample/);

  for (const role of ['po', 'fto_coc', 'policenet', 'policenet_admin_sgt'] as const) {
    const workspace = workspaces.get(role)!;
    assert.equal(workspace.caseFolder, undefined, `${role} must not inherit an FTO phase folder`);
    assert.deepEqual(workspace.assignments, [], `${role} must not inherit FTO roster assignments`);
    assert.deepEqual(workspace.phaseExtensionRequests, [], `${role} must not inherit extension requests`);
  }
});
