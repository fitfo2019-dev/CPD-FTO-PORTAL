import assert from 'node:assert/strict';
import test from 'node:test';
import { CATEGORIES, defaultRatings, defaultReportingForDutyRecord, emptyDailyActivitySummary, newRunChecklist, RUN_CHECKLIST_ITEMS, type Category, type Report, type TrainingRun } from './model.js';
import { seedReports } from './seed.js';
import { buildOperationalPacket } from './operational-state-machine.js';
import { collectDeficiencies, collectSelectedFailureActions, overrideDeficiency, reconcileDeficiencyRatings, SEG_TASK_DIRECTORY } from './seg-deficiencies.js';
import { weeklyRatingCount } from './weekly-rating-counts.js';
import { buildClearanceDocuments, clearanceDerivedActivityCounts, activityTotals } from './run-activity.js';
import { mergeReviewedUaEntries } from './weekly-performance-log.js';
import { spreadsheetText } from './spreadsheet-text.js';
import { validateReportsForExport } from './export-validation.js';

const run=(id='run-one'):TrainingRun=>({
  id,occurredAt:'2026-11-09T13:00:00Z',runKind:'building_search',isDispatched:true,trafficMode:'none',
  arrestMade:false,transportedAfterArrest:false,oviProcessed:false,narrativeAdditionRequired:false,
  formStatus:'complete',checklistReviewedAt:'2026-11-09T15:00:00Z',narrative:'Reviewed fictional run.',
  checklist:newRunChecklist('building_search'),
});
const base=():Report=>({...structuredClone(seedReports()[0]),id:'fictional',date:'2026-11-09',limboDay:false,
  deficiencyAutomationEnabled:true,ratings:defaultRatings(),runs:[],reportingForDuty:defaultReportingForDutyRecord(),activity:emptyDailyActivitySummary(),
});
const packet=(report:Report)=>buildOperationalPacket(report,{dayReference:{week:1,day:1}});
function failingRun(id='run-one'){
  const value=run(id);
  const keys=Object.entries(SEG_TASK_DIRECTORY).filter(([key,category])=>key.startsWith('building_search:')&&category==='buildingSearch').map(([key])=>key.slice('building_search:'.length));
  assert.ok(keys.length>=2);
  value.checklist[keys[0]]=false;value.checklist[keys[1]]=false;
  return value;
}

test('every source task has one named mapping within exactly 30 worksheet categories',()=>{
  assert.equal(CATEGORIES.length,30);
  assert.ok(Object.keys(SEG_TASK_DIRECTORY).length>200);
  assert.ok(Object.values(SEG_TASK_DIRECTORY).every(category=>CATEGORIES.includes(category)));
  const safety=RUN_CHECKLIST_ITEMS.call_for_service.indexOf('Scanned for weapons/threats');
  assert.equal(SEG_TASK_DIRECTORY[`call_for_service:task-${safety}`],'threatAssessment');
  assert.equal(Object.entries(SEG_TASK_DIRECTORY).find(([key])=>key.startsWith('duty:'))?.[1],'dutyReadiness');
});

test('same-incident failures consolidate, keep source coordinates, and cap weekly A without numerical scores',()=>{
  const report={...base(),runs:[failingRun()]};
  const next=reconcileDeficiencyRatings(report,packet(report));
  assert.equal(next.checklistDeficiencies?.length,1);
  assert.equal(next.checklistDeficiencies?.[0].tasks.length,2);
  assert.equal(next.checklistDeficiencies?.[0].tasks[0].reference,'W1D1P2');
  assert.equal(next.ratings.buildingSearch.rating,'UA');
  const reviewed={...next,ratingsReviewedAt:'2026-11-09T17:00:00Z'};
  assert.equal(weeklyRatingCount([reviewed], 'buildingSearch','UA'),1);
  assert.equal(weeklyRatingCount([reviewed,{...base(),ratingsReviewedAt:reviewed.ratingsReviewedAt}], 'buildingSearch','A'),0);
  const cleanReviewed=base();
  cleanReviewed.ratings={...cleanReviewed.ratings,buildingSearch:{...cleanReviewed.ratings.buildingSearch,rating:'A'}};
  assert.equal(weeklyRatingCount([{
    ...cleanReviewed,ratingsReviewedAt:reviewed.ratingsReviewedAt,
  },{
    ...base(),runs:[{...failingRun(),formStatus:'in_progress',checklistReviewedAt:undefined}],
  }],'buildingSearch','A'),1,'unreviewed deficiencies must not affect the weekly A ceiling');
  const separateRt=base();
  separateRt.ratings={...separateRt.ratings,buildingSearch:{...separateRt.ratings.buildingSearch,rating:'RT'}};
  assert.equal(weeklyRatingCount([
    {...cleanReviewed,ratingsReviewedAt:reviewed.ratingsReviewedAt},
    {...separateRt,ratingsReviewedAt:reviewed.ratingsReviewedAt},
  ],'buildingSearch','A'),1,'RT does not become an unchecked-task A ceiling');
  assert.equal(reconcileDeficiencyRatings(next,packet(next)),next);
});

test('unchecked tasks project UA immediately but articulation is reviewable only after checklist confirmation',()=>{
  const unreviewedRun={...failingRun(),formStatus:'in_progress' as const,checklistReviewedAt:undefined};
  const draft={...base(),runs:[unreviewedRun]};
  const draftGroup=collectDeficiencies(draft,packet(draft))[0];
  assert.ok(draftGroup);
  assert.equal(draftGroup.reviewed,false);
  const draftProjection=reconcileDeficiencyRatings(draft,packet(draft));
  assert.equal(draftProjection.ratings.buildingSearch.rating,'UA');
  assert.equal(weeklyRatingCount([draftProjection],'buildingSearch','UA'),0);

  const reviewedRun={...unreviewedRun,formStatus:'complete' as const,checklistReviewedAt:'2026-11-09T15:00:00Z'};
  const reviewedReport={...draft,runs:[reviewedRun]};
  const reviewedGroup=collectDeficiencies(reviewedReport,packet(reviewedReport))[0];
  assert.equal(reviewedGroup?.reviewed,true);
  assert.equal(reviewedGroup?.tasks[0]?.reference,'W1D1P2');
});

test('specific primary and supplemental actions remain evidence under their source run and SEG mappings',()=>{
  const sourceRun={
    ...run('specific-actions'),
    arrestMade:true,
    checklist:{
      ...newRunChecklist('building_search',['arrest_process']),
      'task-67':false,
      'supp-arrest_process-0':false,
    },
    checklistFailures:{
      'task-67':['Documented entry in CAD'],
      'supp-arrest_process-0':['Gapped the handcuffs'],
    },
  };
  const report={...base(),runs:[sourceRun]};
  const operational=packet(report);
  assert.deepEqual(operational.exceptions.map(exception=>exception.failureActions),[
    ['Documented entry in CAD'],
    ['Gapped the handcuffs'],
  ]);
  const groups=collectDeficiencies(report,operational);
  const selectedActions=collectSelectedFailureActions(report,operational);
  assert.deepEqual(selectedActions.map(item=>item.action),['Documented entry in CAD','Gapped the handcuffs']);
  assert.deepEqual(selectedActions.map(item=>item.form),['building_search','arrest_process']);
  assert.ok(selectedActions.every(item=>item.reportId===report.id&&item.runId===sourceRun.id&&item.reference));
  assert.equal(groups.length,2);
  for(const exception of operational.exceptions){
    const page=operational.pages.find(item=>item.page===exception.page);
    const form=page?.supplement??sourceRun.runKind;
    const group=groups.find(item=>item.category===SEG_TASK_DIRECTORY[`${form}:${exception.taskKey}`]);
    assert.ok(group);
    assert.equal(group.runId,sourceRun.id);
    assert.ok(group.tasks.some(task=>task.id===exception.id&&task.failureActions?.[0]===exception.failureActions?.[0]));
  }
  const reconciled=reconcileDeficiencyRatings(report,operational);
  assert.ok(!reconciled.ratings.contentAccuracy.justification.includes('Documented entry in CAD'),'selected actions are evidence, not generated narrative');
  assert.ok(groups.some(group=>group.tasks.some(task=>task.failureActions?.includes('Gapped the handcuffs'))));
  assert.ok(!reconciled.ratings.initiatingArrests.justification.includes('provided additional training'));
  const uncheckedWithoutSelection={...run('unchecked-no-action'),checklist:{...newRunChecklist('building_search'),'task-67':false}};
  const noSelectionReport={...base(),runs:[uncheckedWithoutSelection]};
  assert.deepEqual(collectSelectedFailureActions(noSelectionReport,packet(noSelectionReport)),[]);
});

test('manual overrides restore the old category and preserve long narratives; rechecking restores the baseline',()=>{
  const nonSafetyRun={...run(),runKind:'call_for_service' as const,checklist:newRunChecklist('call_for_service')};
  nonSafetyRun.checklist['task-0']=false;
  let report=reconcileDeficiencyRatings({...base(),runs:[nonSafetyRun]},packet({...base(),runs:[nonSafetyRun]}));
  const group=report.checklistDeficiencies![0];
  const text='Observed facts. '.repeat(9000);
  report={...report,deficiencyNarratives:{[group.id]:text}};
  report=overrideDeficiency(report,group,'formUsage');
  report=reconcileDeficiencyRatings(report,packet(report));
  assert.equal(report.ratings.communicationsUsage.rating,defaultRatings().communicationsUsage.rating);
  assert.equal(report.ratings.formUsage.rating,'UA');
  assert.equal(report.checklistDeficiencies?.[0].narrative,text);
  const cleared={...report,runs:[{...run(),runKind:'call_for_service' as const,checklist:newRunChecklist('call_for_service')}]};
  const restored=reconcileDeficiencyRatings(cleared,packet(cleared));
  assert.equal(restored.ratings.formUsage.rating,defaultRatings().formUsage.rating);
  assert.equal(restored.deficiencyNarratives?.['run-one:formUsage'],text);
  assert.throws(()=>overrideDeficiency(report,group,'invented' as Category));
});

test('NA and Limbo do not create automatic UA ratings; legacy work is not silently migrated',()=>{
  const original={...base(),runs:[failingRun()]};
  const legacy={...original,deficiencyAutomationEnabled:undefined};
  assert.equal(reconcileDeficiencyRatings(legacy,packet(legacy)),legacy);
  const notApplicable={...original,runs:[{...failingRun(),checklist:{...failingRun().checklist,'na-task':true}}]};
  assert.equal(collectDeficiencies(notApplicable,packet(notApplicable)).length,0);
  const limbo={...original,limboDay:true};
  assert.notEqual(reconcileDeficiencyRatings(limbo,packet(limbo)).ratings.buildingSearch.rating,'UA');
});

test('Officer Safety UA remains locked for the day after its checklist task is rechecked',()=>{
  const source={...base(),runs:[failingRun()]};
  const first=reconcileDeficiencyRatings(source,packet(source));
  assert.ok(first.deficiencySafetyLocks?.includes('buildingSearch'));
  assert.equal(first.ratings.buildingSearch.rating,'UA');
  const corrected={...first,runs:[run()]};
  const final=reconcileDeficiencyRatings(corrected,packet(corrected));
  assert.ok(final.deficiencySafetyLocks?.includes('buildingSearch'));
  assert.equal(final.ratings.buildingSearch.rating,'UA');
  const reviewed={...final,ratingsReviewedAt:'2026-11-09T17:00:00Z'};
  assert.equal(weeklyRatingCount([reviewed],'buildingSearch','UA'),1);
  assert.equal(weeklyRatingCount([reviewed],'buildingSearch','A'),0);
  const limbo=reconcileDeficiencyRatings({...final,limboDay:true,ratings:structuredClone(base().ratings)},packet({...final,limboDay:true}));
  assert.deepEqual(limbo.deficiencySafetyLocks,[]);
});

test('Shotgun Training N/A excludes Resource Equipment from ratings unless a real deficiency exists',()=>{
  const notApplicable={...base(),ratingsReviewedAt:'2026-11-09T17:00:00Z',
    notApplicableCategories:['resourceEquipmentUsage' as const],
    ratings:{...defaultRatings(),resourceEquipmentUsage:{...defaultRatings().resourceEquipmentUsage,rating:'A' as const}},
  };
  assert.equal(weeklyRatingCount([notApplicable],'resourceEquipmentUsage','A'),0);
  assert.equal(weeklyRatingCount([notApplicable],'resourceEquipmentUsage','UA'),0);
  const deficiency={...notApplicable,ratings:{...notApplicable.ratings,
    resourceEquipmentUsage:{...notApplicable.ratings.resourceEquipmentUsage,rating:'UA' as const}},
    checklistDeficiencies:[{id:'equipment-failure',category:'resourceEquipmentUsage' as const,
      tasks:[{id:'task',label:'Use required equipment'}],narrative:'Observed equipment task failure.'}],
  };
  assert.equal(weeklyRatingCount([deficiency],'resourceEquipmentUsage','UA'),1);
  assert.equal(weeklyRatingCount([deficiency],'resourceEquipmentUsage','A'),0);
});

test('Officer Safety counts one UA per category per day; the later run is documented only (owner, Nov 26, 2026)',()=>{
  const first=failingRun('safety-first');
  const second=failingRun('safety-second');
  const source={...base(),runs:[first,second]};
  const next=reconcileDeficiencyRatings(source,packet(source));
  assert.equal(next.checklistDeficiencies?.filter(group=>group.category==='buildingSearch').length,2);
  assert.deepEqual(next.checklistDeficiencies?.filter(group=>group.category==='buildingSearch').map(group=>group.notCounted),[undefined,'officer_safety_day']);
  const reviewed={...next,ratingsReviewedAt:'2026-11-09T17:00:00Z'};
  assert.equal(weeklyRatingCount([reviewed],'buildingSearch','UA'),1);
});

test('distinct incidents remain distinct weekly evidence; a later Officer Safety run is listed, marked not counted',()=>{
  const source={...base(),runs:[failingRun('first'),failingRun('second')]};
  const report={...reconcileDeficiencyRatings(source,packet(source)),ratingsReviewedAt:'2026-11-09T17:00:00Z'};
  const log={id:'week',weekStart:'2026-11-08',weekEnd:'2026-11-14',weekNumber:1,phase:report.phase,className:report.className??'',recruitName:report.recruitName,recruitBadge:report.recruitBadge,ftoName:report.ftoName,ftoBadge:report.ftoBadge,entries:[],updatedAt:report.updatedAt};
  const merged=mergeReviewedUaEntries(log,[report],[]);
  assert.equal(merged.entries.length,2);
  assert.deepEqual(merged.entries.map(entry=>entry.totalTime),['','']);
  assert.deepEqual(merged.entries.map(entry=>entry.sourceReferences),[['W1D1P2'],['W1D1P3']]);
  assert.deepEqual(merged.entries.map(entry=>entry.notCounted),[undefined,'officer_safety_day']);
  assert.equal(mergeReviewedUaEntries(merged,[report],[]),merged);
  assert.equal(weeklyRatingCount([report],'buildingSearch','UA'),1);
});

test('explicit arrest classifications count one event and rebuild only approved draft documents',()=>{
  const arrest={...run(),clearanceRulesVersion:1 as const,arrestClassificationVersion:1 as const,
    arrestSeverity:'Felony' as const,arrestType:'On-view' as const,clearanceCode:'3V' as const,arrestMade:true,transportedAfterArrest:true,
    transportDestination:'Fictional Jail',transportDestinationType:'Jail' as const,
    charges:[{id:'charge-1',description:'Fictional charge one'},{id:'charge-2',description:'Fictional charge two'}]};
  const counts=clearanceDerivedActivityCounts([arrest]);
  for(const key of ['u10100Reports','premierOneReports','prisonersSlated','pcAffidavits','felonyArrests'] as const)assert.equal(counts[key],1);
  assert.equal(counts.misdemeanorArrests,0);
  assert.equal(counts.attemptedWarrantsServed,0);
  assert.equal(counts.criminalComplaints,0);
  const docs=buildClearanceDocuments(arrest);
  assert.deepEqual(docs.map(doc=>doc.kind),['U-10.100','Probable Cause Affidavit']);
  assert.equal(new Set(docs.map(doc=>doc.id)).size,2);
  assert.deepEqual(buildClearanceDocuments(arrest),docs);
  const warrant={...arrest,id:'warrant-run',arrestSeverity:'Misdemeanor' as const,arrestType:'Warrant' as const};
  const warrantCounts=clearanceDerivedActivityCounts([warrant]);
  assert.equal(warrantCounts.misdemeanorArrests,1);
  assert.equal(warrantCounts.felonyArrests,0);
  assert.equal(warrantCounts.attemptedWarrantsServed,1);
  assert.equal(warrantCounts.pcAffidavits,0);
  assert.deepEqual(buildClearanceDocuments(warrant).map(doc=>doc.kind),['U-10.100']);
  assert.deepEqual(buildClearanceDocuments(warrant),buildClearanceDocuments(warrant));
  const legacy={...arrest,arrestClassificationVersion:undefined,arrestSeverity:undefined,arrestType:undefined,
    generatedDocuments:[{id:'legacy:complaint:charge-1',kind:'Criminal Complaint Form' as const,chargeId:'charge-1',description:'Fictional charge one'}]};
  const legacyCounts=clearanceDerivedActivityCounts([legacy]);
  assert.equal(legacyCounts.felonyArrests,0);
  assert.equal(legacyCounts.misdemeanorArrests,0);
  assert.equal(legacyCounts.attemptedWarrantsServed,0);
  assert.deepEqual(buildClearanceDocuments(legacy),legacy.generatedDocuments);
  assert.equal(buildClearanceDocuments({...arrest,clearanceCode:'2V'}).length,0);
  assert.equal(clearanceDerivedActivityCounts([{...arrest,clearanceRulesVersion:undefined}]).premierOneReports,0);
  assert.equal(clearanceDerivedActivityCounts([{...arrest,clearanceCode:'2V'}]).premierOneReports,0);
  assert.equal(clearanceDerivedActivityCounts([{...arrest,clearanceCode:'4V'}]).premierOneReports,0);
  const unverifiedArrest={...arrest,arrestMade:false};
  assert.equal(clearanceDerivedActivityCounts([unverifiedArrest]).premierOneReports,0);
  assert.equal(buildClearanceDocuments(unverifiedArrest).length,0);
  const errand={...arrest,runKind:'traffic_stop' as const,clearanceCode:'4V' as const};
  assert.equal(clearanceDerivedActivityCounts([errand]).trafficStops,0);
  const traffic={...arrest,runKind:'traffic_stop' as const,dispatchedCode:'6',clearanceCode:'1V' as const};
  assert.equal(clearanceDerivedActivityCounts([traffic]).solveCitationSummons,1);
  assert.equal(clearanceDerivedActivityCounts([traffic]).trafficCitations,0);
  assert.equal(activityTotals({...base(),runs:[arrest],activity:{...emptyDailyActivitySummary(),pcAffidavits:2}}).pcAffidavits,3);
});

test('spreadsheet boundaries reject invalid routing and shotgun tokens, and escape hidden formula prefixes',()=>{
  assert.equal(validateReportsForExport([base()]).length,1);
  assert.throws(()=>validateReportsForExport([{...base(),deficiencyOverrides:{task:'madeUpCategory'}}]));
  assert.throws(()=>validateReportsForExport([{...base(),reportingForDuty:{...base().reportingForDuty,shotgunTraining:'yes'}}]));
  for(const input of ['=1+1','\t=1+1','\r@SUM(A1)','  +test','-formula'])assert.equal(spreadsheetText(input),`'${input}`);
});
