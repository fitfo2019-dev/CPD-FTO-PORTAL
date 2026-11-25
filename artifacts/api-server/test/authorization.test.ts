import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canAccess, canAssignFto, canDeleteTrainingRecord, canManageClass, type FtoAssignmentScope, type Principal, type ReportScope, type TrainingDeletionApproval } from '../src/security/authorization.ts';

const principal=(id:string,role:Principal['role'],squad='north',technicalRank?:Principal['technicalRank']):Principal=>({
  id,role,squad,technicalRank,authenticatedAt:1,lastActivityAt:1,mfaVerified:true,
});
const submittedPacket:ReportScope={
  recruitId:'po-1',
  ftoId:'fto-1',
  coordinatorId:'coordinator-1',
  squad:'north',
  completedSubmitted:true,
  classActivated:true,
  phaseActivated:true,
};

test('FTO COC can read, comment on, and export only completed submitted packets in its squad',()=>{
  const coc=principal('coc-1','FTO_COC');
  assert.equal(canAccess(coc,'read',submittedPacket),true);
  assert.equal(canAccess(coc,'comment',submittedPacket),true);
  assert.equal(canAccess(coc,'exportPacket',submittedPacket),true);
  assert.equal(canAccess(coc,'edit',submittedPacket),false);
  assert.equal(canAccess(coc,'sign',submittedPacket),false);
  assert.equal(canAccess(coc,'read',{...submittedPacket,completedSubmitted:false}),false);
  assert.equal(canAccess(coc,'read',{...submittedPacket,squad:'south'}),false);
});

test('PO access requires its own identity plus confirmed class and phase activation',()=>{
  const po=principal('po-1','PO');
  assert.equal(canAccess(po,'read',{...submittedPacket,classActivated:false}),false);
  assert.equal(canAccess(po,'read',{...submittedPacket,phaseActivated:false}),false);
  assert.equal(canAccess(po,'read',submittedPacket),true);
  assert.equal(canAccess(po,'comment',submittedPacket),true);
  assert.equal(canAccess(po,'sign',submittedPacket),true);
  assert.equal(canAccess(po,'edit',submittedPacket),false);
  assert.equal(canAccess(principal('po-2','PO'),'read',submittedPacket),false);
});

test('FTO access is limited to an active assignment and cannot use broad management permissions',()=>{
  const fto=principal('fto-1','FTO');
  assert.equal(canAccess(fto,'read',submittedPacket,true),true);
  assert.equal(canAccess(fto,'edit',submittedPacket,true),true);
  assert.equal(canAccess(fto,'sign',submittedPacket,true),true);
  assert.equal(canAccess(fto,'read',submittedPacket,false),false);
  assert.equal(canAccess(fto,'exportAudit',submittedPacket,true),false);
});

test('FTO Sgt has only class-scoped FTO assignment authority',()=>{
  const supervisor=principal('sgt-1','FTO_SGT');
  assert.equal(canAccess(supervisor,'read',submittedPacket),false);
  assert.equal(canAccess(supervisor,'exportPacket',submittedPacket),false);
  const scopedClass={
    classId:'class-135',
    coordinatorId:'coordinator-1',
    rosterComplete:true,
    initialAssignmentsConfirmed:true,
    phaseIActive:false,
  };
  assert.equal(canManageClass(supervisor,'manageAssignments',scopedClass),false);

  const target:FtoAssignmentScope={
    classId:'class-135',poClassId:'class-135',poActive:true,phase:1,
    coordinatorId:'coordinator-1',authorizedFtoSgtIds:['sgt-1'],authorizedFtoCocIds:[],
    ftoId:'fto-1',ftoRole:'FTO',ftoActive:true,ftoProvisioned:true,
  };
  assert.equal(canAssignFto(supervisor,target),true);
  assert.equal(canAssignFto(principal('sgt-2','FTO_SGT'),target),false);
  assert.equal(canAssignFto(supervisor,{...target,poClassId:'class-136'}),false);
  assert.equal(canAssignFto(supervisor,{...target,ftoActive:false}),false);
  assert.equal(canAssignFto(supervisor,{...target,ftoProvisioned:false}),false);
  assert.equal(canAssignFto(supervisor,{...target,phase:5}),false);
});

test('only authorized FTO Coordinator, FTO Sgt, or FTO COC can assign a provisioned FTO',()=>{
  const target:FtoAssignmentScope={
    classId:'class-135',poClassId:'class-135',poActive:true,phase:2,
    coordinatorId:'coordinator-1',authorizedFtoSgtIds:[],authorizedFtoCocIds:['coc-1'],
    ftoId:'fto-1',ftoRole:'FTO',ftoActive:true,ftoProvisioned:true,
  };
  assert.equal(canAssignFto(principal('coordinator-1','FTO_COORDINATOR'),target),true);
  assert.equal(canAssignFto(principal('coc-1','FTO_COC'),target),true);
  assert.equal(canAssignFto(principal('fto-1','FTO'),target),false);
  assert.equal(canAssignFto(principal('po-1','PO'),target),false);
  assert.equal(canAssignFto(principal('tech-1','POLICENET'),target),false);
  assert.equal(canAssignFto(principal('coordinator-2','FTO_COORDINATOR'),target),false);
  assert.equal(canAssignFto(principal('coordinator-1','FTO_COORDINATOR'),{...target,poActive:false}),false);
  assert.equal(canAssignFto(principal('coordinator-1','FTO_COORDINATOR'),{...target,ftoRole:'PO'}),false);
});

test('FTO Coordinator can read/export within scope and activate only a complete Phase I roster',()=>{
  const coordinator=principal('coordinator-1','FTO_COORDINATOR');
  assert.equal(canAccess(coordinator,'read',submittedPacket),true);
  assert.equal(canAccess(coordinator,'exportPacket',submittedPacket),true);
  assert.equal(canAccess(coordinator,'edit',submittedPacket),false);
  const readyClass={
    classId:'class-135',
    coordinatorId:coordinator.id,
    rosterComplete:true,
    initialAssignmentsConfirmed:true,
    phaseIActive:false,
  };
  assert.equal(canManageClass(coordinator,'manageRoster',readyClass),true);
  assert.equal(canManageClass(coordinator,'activatePhaseI',readyClass),true);
  assert.equal(canManageClass(coordinator,'exportClassWorkbook',readyClass),true);
  assert.equal(canManageClass(principal('fto-1','FTO'),'exportClassWorkbook',readyClass),false);
  assert.equal(canManageClass(principal('coc-1','FTO_COC'),'exportClassWorkbook',readyClass),false);
  assert.equal(canManageClass(coordinator,'activatePhaseI',{...readyClass,rosterComplete:false}),false);
  assert.equal(canManageClass(coordinator,'activatePhaseI',{...readyClass,initialAssignmentsConfirmed:false}),false);
  assert.equal(canManageClass(coordinator,'activatePhaseI',{...readyClass,phaseIActive:true}),false);
  assert.equal(canManageClass(principal('other','FTO_COORDINATOR'),'manageRoster',readyClass),false);
});

test('POLICENET technical roles cannot access operational records or audit exports',()=>{
  for (const role of ['POLICENET','POLICENET_ADMIN_SGT'] as const) {
    const technical=principal('tech-1',role);
    assert.equal(canAccess(technical,'read',submittedPacket),false);
    assert.equal(canAccess(technical,'edit',submittedPacket,true),false);
    assert.equal(canAccess(technical,'exportAudit',submittedPacket),false);
  }
});

test('only training-record deletion requires distinct SGT and LT POLICENET admin approvals',()=>{
  const sgt=principal('tech-sgt','POLICENET_ADMIN_SGT','north','SGT');
  const lt=principal('tech-lt','POLICENET_ADMIN_SGT','north','LT');
  const approvals:TrainingDeletionApproval[]=[
    {requestId:'delete-request-1',trainingRecordId:'record-1',approver:sgt},
    {requestId:'delete-request-1',trainingRecordId:'record-1',approver:lt},
  ];
  assert.equal(canDeleteTrainingRecord(sgt,'delete-request-1','record-1',approvals),true);
  assert.equal(canDeleteTrainingRecord(sgt,'delete-request-2','record-1',approvals),false);
  assert.equal(canDeleteTrainingRecord(sgt,'delete-request-1','record-2',approvals),false);
  assert.equal(canDeleteTrainingRecord(principal('tech','POLICENET'),'delete-request-1','record-1',approvals),false);

  const samePersonApprovals:TrainingDeletionApproval[]=[
    {requestId:'delete-request-1',trainingRecordId:'record-1',approver:sgt},
    {requestId:'delete-request-1',trainingRecordId:'record-1',approver:{...sgt,technicalRank:'LT'}},
  ];
  assert.equal(canDeleteTrainingRecord(sgt,'delete-request-1','record-1',samePersonApprovals),false);
  assert.equal(canDeleteTrainingRecord(sgt,'delete-request-1','record-1',[approvals[0]]),false);
});
