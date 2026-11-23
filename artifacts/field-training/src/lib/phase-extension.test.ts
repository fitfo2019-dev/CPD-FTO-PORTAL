import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PhaseExtensionReviewView } from '../components/phase-extension-panel.js';
import { createEmptyWorkspace } from './empty-workspace.js';
import { approvePhaseExtension, denyPhaseExtension, normalizePhaseExtensionRequests, phaseExtensionRequestInputSchema } from './phase-extension.js';
import { OfflineStorage } from './offlineStorage.js';
import type { PhaseCaseFolder, PhaseExtensionRequest, Workspace } from './model.js';
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

function findByTestId(node:ReactNode,testId:string):ReactElement<Record<string,unknown>>|undefined {
  if(Array.isArray(node)) {
    for(const child of node) {
      const found=findByTestId(child,testId);
      if(found)return found;
    }
    return undefined;
  }
  if(!isValidElement(node))return undefined;
  const element=node as ReactElement<Record<string,unknown>>;
  if(element.props['data-testid']===testId)return element;
  return findByTestId(element.props.children as ReactNode,testId);
}

function addDays(isoDate:string,days:number):string {
  const value=new Date(`${isoDate}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate()+days);
  return value.toISOString().slice(0,10);
}

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

test('phase extension requests and approved ranges survive locking and restoring the vault',async()=>{
  const namespace=`phase-extension-${crypto.randomUUID()}`;
  const passphrase=new TextEncoder().encode('phase-extension-test-passphrase');
  const initial=createEmptyWorkspace();
  initial.caseFolder=folder;
  initial.phaseFolders=[folder];
  initial.phaseExtensionRequests=[request];

  const vault=new OfflineStorage(namespace);
  await vault.unlock(passphrase);
  await vault.save('workspace',initial);
  vault.lock();

  const reopened=new OfflineStorage(namespace);
  await reopened.unlock(passphrase);
  const pendingWorkspace=await reopened.get<Workspace>('workspace');
  assert.ok(pendingWorkspace);
  assert.deepEqual(pendingWorkspace.phaseExtensionRequests,[request]);

  const approved=approvePhaseExtension(pendingWorkspace,request.id);
  await reopened.save('workspace',approved);
  reopened.lock();

  const afterApproval=new OfflineStorage(namespace);
  await afterApproval.unlock(passphrase);
  const approvedWorkspace=await afterApproval.get<Workspace>('workspace');
  assert.ok(approvedWorkspace);
  const expectedRanges=approved.phaseFolders[0].phaseWeekRanges;
  assert.deepEqual(approvedWorkspace.phaseFolders[0].phaseWeekRanges,expectedRanges);
  assert.equal(approvedWorkspace.phaseFolders[0].phaseWeekRanges?.length,folder.phaseWeekRanges!.length+1);
  assert.deepEqual(approvedWorkspace.caseFolder?.phaseWeekRanges,expectedRanges);
  assert.deepEqual(approvedWorkspace.phaseExtensionRequests,[]);

  const deniedRequest={...request,id:'extension-denied'};
  const withDeniedRequest={
    ...approvedWorkspace,
    phaseExtensionRequests:[deniedRequest],
  };
  const denied=denyPhaseExtension(withDeniedRequest,deniedRequest.id);
  await afterApproval.save('workspace',denied);
  afterApproval.lock();

  const afterDenial=new OfflineStorage(namespace);
  await afterDenial.unlock(passphrase);
  const deniedWorkspace=await afterDenial.get<Workspace>('workspace');
  assert.ok(deniedWorkspace);
  assert.deepEqual(deniedWorkspace.phaseExtensionRequests,[]);
  assert.deepEqual(deniedWorkspace.phaseFolders[0].phaseWeekRanges,expectedRanges);
  assert.deepEqual(deniedWorkspace.caseFolder?.phaseWeekRanges,expectedRanges);
  afterDenial.lock();
});

test('approved Limbo extensions preserve shifted ranges and extension count after vault reopening',async()=>{
  const namespace=`limbo-extension-${crypto.randomUUID()}`;
  const passphrase=new TextEncoder().encode('limbo-extension-test-passphrase');
  const limboRequest:PhaseExtensionRequest={
    ...request,id:'extension-limbo-1',extensionType:'limbo_period',requestedWeeks:1,
    justification:'Add one Limbo week.',
  };
  const initial=createEmptyWorkspace();
  initial.caseFolder=folder;
  initial.phaseFolders=[folder];
  initial.phaseExtensionRequests=[limboRequest];

  const firstVault=new OfflineStorage(namespace);
  await firstVault.unlock(passphrase);
  await firstVault.save('workspace',initial);
  firstVault.lock();

  const reviewVault=new OfflineStorage(namespace);
  await reviewVault.unlock(passphrase);
  const restoredPending=await reviewVault.get<Workspace>('workspace');
  assert.ok(restoredPending);
  const restoredRequests=normalizePhaseExtensionRequests(restoredPending.phaseExtensionRequests);
  assert.deepEqual(restoredRequests,[limboRequest]);
  const pendingWorkspace={...restoredPending,phaseExtensionRequests:restoredRequests};
  const approved=approvePhaseExtension(pendingWorkspace,limboRequest.id);
  const initialRanges=folder.phaseWeekRanges!;
  const expectedRanges=initialRanges.map((range,index)=>({
    startDate:index===0?range.startDate:addDays(range.startDate,7),
    endDate:addDays(range.endDate,7),
  }));
  assert.deepEqual(approved.phaseFolders[0].phaseWeekRanges,expectedRanges);
  assert.deepEqual(approved.caseFolder?.phaseWeekRanges,expectedRanges);
  assert.equal(approved.phaseFolders[0].limboExtensionWeeks,1);
  assert.equal(approved.caseFolder?.limboExtensionWeeks,1);
  assert.deepEqual(approved.phaseExtensionRequests,[]);
  await reviewVault.save('workspace',approved);
  reviewVault.lock();

  const reopenedVault=new OfflineStorage(namespace);
  await reopenedVault.unlock(passphrase);
  const reopened=await reopenedVault.get<Workspace>('workspace');
  assert.ok(reopened);
  assert.deepEqual(reopened.phaseFolders[0].phaseWeekRanges,expectedRanges);
  assert.deepEqual(reopened.caseFolder?.phaseWeekRanges,expectedRanges);
  assert.equal(reopened.phaseFolders[0].limboExtensionWeeks,1);
  assert.equal(reopened.caseFolder?.limboExtensionWeeks,1);
  assert.deepEqual(reopened.phaseExtensionRequests,[]);
  assert.deepEqual(
    approvePhaseExtension(reopened,limboRequest.id).phaseFolders[0].phaseWeekRanges,
    expectedRanges,
    'a request removed by approval must not shift the restored dates again',
  );
  reopenedVault.lock();
});

test('vault-restored requests render in coordinator review and approve or deny actions resolve them',async()=>{
  const namespace=`phase-extension-review-${crypto.randomUUID()}`;
  const passphrase=new TextEncoder().encode('phase-extension-review-test-passphrase');
  const initial=createEmptyWorkspace();
  initial.caseFolder=folder;
  initial.phaseFolders=[folder];
  initial.phaseExtensionRequests=[request];

  const writer=new OfflineStorage(namespace);
  await writer.unlock(passphrase);
  await writer.save('workspace',initial);
  writer.lock();

  const coordinatorVault=new OfflineStorage(namespace);
  await coordinatorVault.unlock(passphrase);
  const reopened=await coordinatorVault.get<Workspace>('workspace');
  assert.ok(reopened);
  const restoredRequests=normalizePhaseExtensionRequests(reopened.phaseExtensionRequests);
  assert.deepEqual(restoredRequests,[request]);
  let coordinatorWorkspace:Workspace={...reopened,phaseExtensionRequests:restoredRequests};
  const review=(onReview:(id:string,approve:boolean)=>Promise<void>)=>PhaseExtensionReviewView({
    requests:coordinatorWorkspace.phaseExtensionRequests,
    vaultUnlocked:true,
    onReview,
  });

  const approveMarkup=renderToStaticMarkup(review(async(id,approve)=>{
    coordinatorWorkspace=approve
      ?approvePhaseExtension(coordinatorWorkspace,id)
      :denyPhaseExtension(coordinatorWorkspace,id);
  }));
  assert.match(approveMarkup,/Pending phase extension requests · 1/);
  assert.match(approveMarkup,/Example PO/);
  assert.match(approveMarkup,/Need one additional training week\./);
  const approveButton=findByTestId(review(async(id,approve)=>{
    coordinatorWorkspace=approve
      ?approvePhaseExtension(coordinatorWorkspace,id)
      :denyPhaseExtension(coordinatorWorkspace,id);
  }),'button-approve-extension-extension-1');
  assert.ok(approveButton);
  assert.equal(approveButton.props.disabled,false);
  const approve=approveButton.props.onClick;
  assert.equal(typeof approve,'function');
  await (approve as () => void)();
  assert.deepEqual(coordinatorWorkspace.phaseExtensionRequests,[]);
  assert.equal(coordinatorWorkspace.phaseFolders[0].phaseWeekRanges?.length,5);

  const deniedRequest={...request,id:'extension-denied'};
  coordinatorWorkspace={...coordinatorWorkspace,phaseExtensionRequests:[deniedRequest]};
  const rangesBeforeDenial=coordinatorWorkspace.phaseFolders[0].phaseWeekRanges;
  const denyView=review(async(id,approve)=>{
    coordinatorWorkspace=approve
      ?approvePhaseExtension(coordinatorWorkspace,id)
      :denyPhaseExtension(coordinatorWorkspace,id);
  });
  assert.ok(denyView);
  const denyMarkup=renderToStaticMarkup(denyView);
  assert.match(denyMarkup,/extension-denied/);
  const denyButton=findByTestId(denyView,'button-deny-extension-extension-denied');
  assert.ok(denyButton);
  assert.equal(denyButton.props.disabled,false);
  const deny=denyButton.props.onClick;
  assert.equal(typeof deny,'function');
  await (deny as () => void)();
  assert.deepEqual(coordinatorWorkspace.phaseExtensionRequests,[]);
  assert.deepEqual(coordinatorWorkspace.phaseFolders[0].phaseWeekRanges,rangesBeforeDenial);
  coordinatorVault.lock();
});
