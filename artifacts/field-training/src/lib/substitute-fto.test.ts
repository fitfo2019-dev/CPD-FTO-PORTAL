import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSubstituteDay } from './substitute-fto.js';
import { nrtReference } from './nrt-reference.js';
import { isEligibleCitationSummons } from './radio-codes.js';
import { CATEGORIES, canViewClass, validateReport, type TrainingAssignment } from './model.js';
import { CPD_GEOGRAPHY } from './cpd-geography.js';

const zone=CPD_GEOGRAPHY[0];
const precinct=zone.precincts[0];
const assignment: TrainingAssignment = {
  id:'demo-assignment',className:'Fictional class',recruitName:'Sample PO',recruitBadge:'0001',ftoBadge:'0002',
  phase:2,phaseStartDate:'2026-11-15',shift:'A-Co',daysOff:[0,6],
  zone:zone.zone,precinct:precinct.precinct,cruiserDistrict:precinct.cruiserDistricts[0],
};
const input={
  assignment,regularFto:{name:'Sample Regular FTO',badge:'0002'},substitute:{name:'Sample Substitute FTO',badge:'0003'},
  date:'2026-11-16',shift:'A-Co' as const,zone:assignment.zone!,precinct:assignment.precinct!,cruiserDistrict:assignment.cruiserDistrict!,
};
const build=()=>createSubstituteDay(input,[],'demo-coverage','2026-11-16T12:00:00Z');

test('all FTOs can view the class; substitute draft does not replace the regular assignment',()=>{
  assert.equal(canViewClass('fto'),true);
  const before=structuredClone(input);
  const report=build();
  assert.deepEqual(input,before);
  assert.equal(report.ftoBadge,'0003');
  assert.equal(report.substituteCoverage?.regularFtoBadge,'0002');
  assert.equal(report.phase,2);
  assert.equal(report.phaseWeek,1);
  assert.equal(report.zone,assignment.zone);
  assert.equal(report.status,'draft');
  assert.equal(report.limboDay,true);
  assert.equal(report.ratingsReviewedAt,undefined);
  assert.equal(report.reportingForDuty.reviewedAt,undefined);
  assert.match(report.reportingForDuty.notes,/substituting for/);
  assert.ok(Object.values(report.ratings).every(entry=>entry.rating===''));
});

test('a shift-coded FTO assignment is preserved on a substitute-day record',()=>{
  const codedInput={...input,ftoAssignment:`${input.cruiserDistrict}A`};
  const report=createSubstituteDay(codedInput,[],'coded-coverage','2026-11-16T12:00:00Z');
  assert.equal(report.ftoAssignment,codedInput.ftoAssignment);
  assert.equal(report.cruiserDistrict,input.cruiserDistrict);
});

test('coverage blocks duplicates, wrong FTO, and invalid dates without changing existing work',()=>{
  const report=build();
  const original=structuredClone(report);
  assert.throws(()=>createSubstituteDay(input,[report],'other','now'),/already exists/);
  assert.deepEqual(report,original);
  assert.throws(()=>createSubstituteDay({...input,substitute:input.regularFto},[],'other','now'),/other than/);
  assert.throws(()=>createSubstituteDay({...input,date:'2026-11-01'},[],'other','now'),/phase start/);
  assert.throws(()=>createSubstituteDay({...input,date:'2026-02-30'},[],'other','now'),/valid coverage date/);
});

test('NRT references scheduled training day, not Sunday-based calendar day',()=>{
  const report=build();
  assert.equal(nrtReference(report,[assignment]),'W5D1P?');
  assert.equal(nrtReference({...report,date:'2026-11-18'},[assignment]),'W5D3P?');
  assert.equal(nrtReference(report,[assignment],undefined,4),'W5D1P4');
  const phaseOne={...assignment,phase:1 as const};
  assert.equal(nrtReference({...report,phase:1},[phaseOne]),'W1D1P?');
});

test('NRT is one exclusive rating with a prior-UA link, never a simultaneous UA selection',()=>{
  const report=build();
  report.limboDay=false;
  const category=CATEGORIES[0];
  report.ratings[category]={...report.ratings[category],rating:'NRT',justification:'Fictional explanation',
    nrtWithUnacceptable:false,nrtPriorUnacceptableIds:['earlier-demo'],nrtPriorDocumentationReviewed:true,
    nrtTrainingReviewed:true,nrtCoordinatorsNotified:true,nrtFtoSergeantNotified:true,nrtCorrectiveActions:'Fictional corrective training'};
  assert.ok(!validateReport(report).some(error=>error.includes('NRT')||error.includes('Unacceptable')||error.includes('corrective actions')));
  report.ratings[category].nrtPriorUnacceptableIds=[];
  assert.ok(validateReport(report).some(error=>error.includes('earlier Unacceptable')));
});

test('citation and summons counting is restricted to Traffic Stop with 1V or 3V',()=>{
  for(const code of ['1V','3V']) assert.equal(isEligibleCitationSummons({runKind:'traffic_stop',clearanceCode:code}),true);
  for(const code of ['','2V','4V']) assert.equal(isEligibleCitationSummons({runKind:'traffic_stop',clearanceCode:code}),false);
  assert.equal(isEligibleCitationSummons({runKind:'high_risk_stop',clearanceCode:'1V'}),false);
  assert.equal(isEligibleCitationSummons({runKind:'call_for_service',clearanceCode:'3V'}),false);
});
