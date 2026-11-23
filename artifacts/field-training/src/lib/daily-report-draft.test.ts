import assert from 'node:assert/strict';
import test from 'node:test';
import type { PhaseCaseFolder } from './model.js';
import { createDailyReportDraft } from './daily-report-draft.js';

const folder:PhaseCaseFolder={
  assignmentId:'phase-2-assignment',className:'Test Class',recruitName:'Test PO',recruitBadge:'PO-1',
  ftoName:'Test FTO',ftoBadge:'FTO-1',phase:2,shift:'B-Co',zone:'3',precinct:'15',
  cruiserDistrict:'158',ftoAssignment:'158C1',daysOff:[0,6],phaseStartDate:'2026-11-22',
  openedAt:'2026-11-22T12:00:00.000Z',
};

test('new daily drafts inherit current folder context and prior editable cruiser ID',()=>{
  const previous=createDailyReportDraft(folder,'2026-11-23');
  previous.reportingForDuty.cruiserId='Cruiser 12';
  const next=createDailyReportDraft(folder,'2026-11-24',previous);
  assert.equal(next.date,'2026-11-24');
  assert.equal(next.phase,folder.phase);
  assert.equal(next.phaseWeek,1);
  assert.equal(next.shift,folder.shift);
  assert.equal(next.zone,folder.zone);
  assert.equal(next.precinct,folder.precinct);
  assert.equal(next.cruiserDistrict,folder.cruiserDistrict);
  assert.equal(next.ftoAssignment,folder.ftoAssignment);
  assert.equal(next.recruitName,folder.recruitName);
  assert.equal(next.recruitBadge,folder.recruitBadge);
  assert.equal(next.ftoName,folder.ftoName);
  assert.equal(next.ftoBadge,folder.ftoBadge);
  assert.equal(next.reportingForDuty.cruiserId,'Cruiser 12');
  assert.equal(next.limboDay,true);
  assert.ok(Object.values(next.ratings).every(entry=>entry.rating===''), 'Limbo drafts carry no ratings');
});

test('new drafts leave the Limbo window with standard categorical defaults',()=>{
  const next=createDailyReportDraft(folder,'2026-11-25');
  assert.equal(next.limboDay,false);
  assert.equal(next.ratings.dutyReadiness.rating,'A');
  assert.equal(next.date,'2026-11-25');
});
