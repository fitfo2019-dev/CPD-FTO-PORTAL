import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPhaseWeekRanges, getCaseFolderWeekRanges, getPhaseEndDate, getPhaseScheduleInfo, getPhaseWeekNumber } from './training-calendar.js';
import { PHASE_LENGTH_WEEKS } from './model.js';

test('phase end dates use complete Sunday–Saturday training weeks',()=>{
  assert.equal(getPhaseEndDate(1,'2026-01-04'),'2026-01-31');
  assert.equal(getPhaseEndDate(4,'2026-01-07'),'2026-01-24');
});

test('invalid phase dates do not produce a date range',()=>{
  assert.equal(getPhaseEndDate(2,'not-a-date'),undefined);
});

test('phase week boundaries support approved training-week extensions',()=>{
  const ranges=createPhaseWeekRanges(1,'2027-01-03',2);
  assert.equal(ranges.length,6);
  assert.deepEqual(ranges[0],{startDate:'2027-01-03',endDate:'2027-01-09'});
  assert.deepEqual(ranges[5],{startDate:'2027-02-07',endDate:'2027-02-13'});
  assert.equal(getPhaseWeekNumber('2027-02-10','2027-01-03',ranges),6);
  assert.equal(getPhaseWeekNumber('2027-02-14','2027-01-03',ranges),undefined);
});

test('existing folders keep their saved schedule while new folders use the current standard',()=>{
  const start='2027-01-03';
  const existingRanges=createPhaseWeekRanges(4,start,0,2);
  const existingFolder={phase:4 as const,phaseStartDate:start,scheduledWeeks:2,phaseWeekRanges:existingRanges};
  const retainedRanges=getCaseFolderWeekRanges(existingFolder);
  const newRecruitRanges=createPhaseWeekRanges(4,start);

  assert.equal(PHASE_LENGTH_WEEKS[4],3);
  assert.equal(retainedRanges.length,2);
  assert.deepEqual(retainedRanges,existingRanges);
  assert.equal(newRecruitRanges.length,PHASE_LENGTH_WEEKS[4]);
  assert.equal(getPhaseWeekNumber('2027-01-16',start,retainedRanges),2);
  assert.equal(getPhaseWeekNumber('2027-01-17',start,retainedRanges),undefined);
});

test('limbo extensions keep the first configured phase range in limbo',()=>{
  const ranges=createPhaseWeekRanges(2,'2027-01-03');
  ranges[0].endDate='2027-01-23';
  for(let index=1;index<ranges.length;index++) {
    const start=new Date(`${ranges[index].startDate}T12:00:00Z`);
    const end=new Date(`${ranges[index].endDate}T12:00:00Z`);
    start.setUTCDate(start.getUTCDate()+14);
    end.setUTCDate(end.getUTCDate()+14);
    ranges[index]={startDate:start.toISOString().slice(0,10),endDate:end.toISOString().slice(0,10)};
  }
  const schedule=getPhaseScheduleInfo(2,'2027-01-14','2027-01-03',[0,6],ranges,2);
  assert.equal(schedule.phaseWeek,1);
  assert.equal(schedule.limboDay,true);
});
