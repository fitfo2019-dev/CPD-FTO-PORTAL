import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { buildClassWorkbook } from './exportWorkbook';
import { CATEGORIES, PHASES, PHASE_LENGTH_WEEKS, PHASE_PROGRAM_WEEK_START, SEG_CATEGORIES, DEFAULT_NO_CATEGORIES, DAILY_DUTY_CHECKLIST, defaultReportingForDutyRecord, defaultRatings, emptyRatings, emptyDailyActivitySummary, evaluationProgress, canViewClass, isTechnicalRole, requiredSupplementalForms, newRunChecklist, hasRunChecklistEdits, RUN_CHECKLIST_ITEMS, RUN_CHECKLIST_SECTIONS, RUN_SUPPLEMENT_CHECKLIST_ITEMS, validateReport, type TrainingRun, type WeeklyPerformanceLogEntry } from './model';
import { createEmptyWorkspace } from './empty-workspace';
import { seedReports } from './seed';
import { BUILDING_SEARCH_DISPATCH_CODES, DEFAULT_RUN_TYPE_CODES, SITUATION_FOUND_NA, formatRadioCode, normalizeRadioCode, normalizeSituationFoundCode, isValidRadioCode, isValidSituationFoundCode, isEligibleCitationSummons, RADIO_CODES, RADIO_CODE_SOURCE_LABEL } from './radio-codes';
import { currentDateTimeMDY, formatDateEntryMDY, formatDateTimeEntryMDY, splitDateTimeEntryMDY, getNextReportDate, getPhaseScheduleInfo } from './training-calendar';
import { activityTotals, runActivityValidationError, runDerivedActivityCounts } from './run-activity';
import { cruiserDistrictForFtoAssignment, ftoAssignmentsForPrecinct, isValidAssignment } from './cpd-geography';
import { getRunDirectivePrompts } from './directive-prompts';
import { normalizePreviewRole, ROLES } from './model';
import { FTO_HELP, UPLOADED_FORM_SOURCES } from './fto-help';
import { parseRunDateTime, runDetailError } from './run-details';
import { splitExcelText } from './extended-form-rows';
import { defaultSubstationOrientationChecklist, SUBSTATION_ORIENTATION_KEYS } from './substation-orientation';
import { splitNarrativeContinuation } from './narrative-continuation';
import { ensureWeeklyUaLogs, mergeReviewedUaEntries } from './weekly-performance-log';
import { categoryNumberLabel, hasReviewedCorrectiveSource, isValidTrainingFolderReference, paginateWeeklyLogEntries } from './weekly-log-layout';
import { parseRosterRows } from './assignment-import';

test('only current portal roles are selectable; legacy roles normalize safely',()=>{
  assert.deepEqual(ROLES,['po','fto','fto_coordinator','fto_coc','policenet','policenet_admin_sgt']);
  assert.equal(normalizePreviewRole('sergeant'),'po');
  assert.equal(normalizePreviewRole('recruit'),'po');
  assert.equal(normalizePreviewRole('admin'),'fto_coordinator');
  assert.equal(normalizePreviewRole('unknown'),'po');
  assert.equal(normalizePreviewRole('coc'),'fto_coc');
  assert.equal(isTechnicalRole('policenet'),true);
  assert.equal(isTechnicalRole('policenet_admin_sgt'),true);
  assert.equal(isTechnicalRole('fto_coordinator'),false);
});

test('roster import defaults an omitted starting phase to Phase I',()=>{
  const rows=[
    ['Class','PO Name','PO Badge','FTO Name','FTO Badge','Phase Start Date'],
    ['135th','Jordan Example','4747','Taylor Example','8234','06/01/2026'],
  ];
  const parsed=parseRosterRows(rows);
  assert.deepEqual(parsed.errors,[]);
  assert.equal(parsed.assignments[0]?.phase,1);
});

test('a new workspace starts without generated training records',()=>{
  const workspace=createEmptyWorkspace();
  assert.deepEqual(workspace.reports,[]);
  assert.deepEqual(workspace.tasks,[]);
});

test('Help cites the manual/forms and inventories every uploaded PDF',()=>{
  assert.equal(UPLOADED_FORM_SOURCES.length,14);
  assert.ok(FTO_HELP.every(item=>/FTO Manual|Uploaded/.test(item.source)));
  assert.match(FTO_HELP.find(item=>item.id==='rt')!.text,/minimal FTO/);
  assert.ok(DAILY_DUTY_CHECKLIST.flatMap(group=>group.items).some(item=>item.key==='docked_bwc'));
});

test('run timestamps allow explicit overnight dates and reject reversed/invalid times',()=>{
  const start=parseRunDateTime('11/18/2026 23:50')!;
  assert.ok(start);
  assert.equal(runDetailError(start,'11/19/2026 00:30'),undefined);
  assert.match(runDetailError(start,'11/18/2026 00:30')!,/before/);
  assert.match(runDetailError(start,'11/19/2026 25:30')!,/Enter the end/);
  assert.equal(runDetailError(start,''),undefined);
  assert.equal(parseRunDateTime('02/30/2026 12:00'),undefined);
});

test('run source metadata appears in Excel without interpreting user input as a formula',()=>{
  const report=seedReports()[0];
  report.runs=[{
    id:'source-metadata',occurredAt:'2026-11-18T23:00:00Z',endedAt:'2026-11-19T00:00:00Z',
    incidentNumber:'=INCIDENT',location:'=LOCATION',runKind:'call_for_service',isDispatched:true,
    trafficMode:'none',arrestMade:false,transportedAfterArrest:false,oviProcessed:false,
    narrativeAdditionRequired:false,formStatus:'in_progress',checklist:{},narrative:'Review',
  }];
  const workbook=buildClassWorkbook([report]);
  const rows=XLSX.utils.sheet_to_json<(string|number)[]>(workbook.Sheets['Run Forms'],{header:1});
  for(const [label,value] of [['Incident number',"'=INCIDENT"],['Run location',"'=LOCATION"]]){
    assert.equal(rows[1][rows[0].indexOf(label)],value);
  }
  assert.ok(rows[1][rows[0].indexOf('Run ended')]);
});

test('orientation and weekly-log exports preserve long continuation text and use manual form items',()=>{
  const narrative='Training observation with specific detail. '.repeat(1800);
  const continuationPages=splitNarrativeContinuation(narrative);
  assert.ok(continuationPages.length>1);
  assert.equal(continuationPages.join(''),narrative);
  assert.equal(splitExcelText(narrative).join(''),narrative);
  assert.ok(splitExcelText(narrative).every(part=>part.length<=30000));
  assert.ok(SUBSTATION_ORIENTATION_KEYS.includes('locker_rooms'));
  assert.equal(SUBSTATION_ORIENTATION_KEYS.length,82);
  const [report]=seedReports();
  const weeklyLog={
    id:'weekly-log-test',weekStart:report.date,weekEnd:report.date,weekNumber:1,phase:report.phase,
    className:report.className??'',recruitName:report.recruitName,recruitBadge:report.recruitBadge,
    ftoName:report.ftoName,ftoBadge:report.ftoBadge,updatedAt:report.updatedAt,
      entries:[{id:'entry-test',kind:'corrective' as const,category:CATEGORIES[0],totalTime:'15 minutes',narrative,sourceReportIds:[report.id],sourceReferences:['W5D4P4'],sourceReferenceReviewed:true}],
  };
  const orientation={
    id:'orientation-test',className:report.className??'',recruitName:report.recruitName,recruitBadge:report.recruitBadge,
    ftoName:report.ftoName,ftoBadge:report.ftoBadge,phaseStartDate:report.date,dateTime:'2026-01-04T10:00:00.000Z',
    substation:'Test substation',checklist:{locker_rooms:true},directivesReview:'reviewed',narrative,updatedAt:report.updatedAt,
  };
  const workbook=buildClassWorkbook([report],[],[weeklyLog],[orientation]);
  assert.ok(workbook.Sheets['Weekly Log Supplement']);
  assert.ok(workbook.Sheets['Substation Orientation']);
  const exportedWeekly=XLSX.utils.sheet_to_json<(string|number)[]>(workbook.Sheets['Weekly Log Supplement'],{header:1});
    assert.equal(exportedWeekly.slice(1).map(row=>row[16]).join(''),`W5D4P4 ${narrative}`);
    assert.equal(exportedWeekly[1][13],'W5D4P4');
  const exportedOrientation=XLSX.utils.sheet_to_json<(string|number)[]>(workbook.Sheets['Substation Orientation'],{header:1});
  const orientationHeaders=exportedOrientation[0].map(String);
  assert.ok(exportedOrientation.some(row=>
    row[orientationHeaders.indexOf('Orientation item')]==='Locker rooms'
    &&row[orientationHeaders.indexOf('Checked')]==='Yes'));
  const orientationTextType=orientationHeaders.indexOf('Text type');
  const orientationText=orientationHeaders.indexOf('Text');
  assert.equal(exportedOrientation.filter(row=>row[orientationTextType]==='Narrative / continuation').map(row=>row[orientationText]).join(''),narrative);
});

test('updated worksheet has exactly the 30 requested categories and defaults require review', () => {
  assert.deepEqual(SEG_CATEGORIES.map(item=>item.label), [
    'Report/Prepared for Duty','Comprehension/Usage','Public/Police Interaction','Feedback Acceptance',
    'Precinct Orientation','Routine','EVO','Policies/Procedures','Criminal / Traffic Offenses',
    'Arrest, Search, Seizure','Information Gathering','Resource/Equipment Usage','Form Usage',
    'Grammar/Legibility','Content Accuracy','Completion Time','Response to Enforcement','Threat Assessment',
    'Initiating Arrests','Handling Prisoners','Vehicle Stops','Run Approach','Building Search','Pat Down/Searches',
    'Low Stress Situations','High Stress Situations','Arrest Situations','Problem Solving','Motivational Traits','Task Management',
  ]);
  assert.equal(CATEGORIES.length,30);
  const defaults=defaultRatings();
  assert.deepEqual(Object.keys(defaults).filter(key=>defaults[key as keyof typeof defaults].rating==='NO').sort(),[...DEFAULT_NO_CATEGORIES].sort());
  assert.ok(Object.values(defaults).filter(entry=>entry.rating==='A').length===CATEGORIES.length-DEFAULT_NO_CATEGORIES.length);
  assert.ok(SEG_CATEGORIES.every(item=>item.definition.trim()&&item.manualReference.trim()));
  const report=seedReports()[0];
  assert.equal(evaluationProgress(report),'Review required');
  report.ratingsReviewedAt=new Date().toISOString();
  assert.equal(evaluationProgress(report),'Complete');
});

test('weekly performance log gathers reviewed UA articulations once with editable 15-minute training time',()=>{
  const report=seedReports()[0];
  report.ratingsReviewedAt='2026-11-18T12:00:00.000Z';
  report.ratings[CATEGORIES[0]]={...report.ratings[CATEGORIES[0]],rating:'UA',justification:'Did not complete the required documentation; retrained on the form.'};
  const base={
    id:'weekly-auto-ua',weekStart:report.date,weekEnd:report.date,weekNumber:1,phase:report.phase,
    className:report.className??'',recruitName:report.recruitName,recruitBadge:report.recruitBadge,
    ftoName:report.ftoName,ftoBadge:report.ftoBadge,updatedAt:report.updatedAt,entries:[],
  };
  const generated=mergeReviewedUaEntries(base,[report],[]);
  const exportLogs=ensureWeeklyUaLogs([report],[],[],[]);
  assert.equal(exportLogs.length,1);
  assert.equal(exportLogs[0].entries.length,1);
  assert.equal(generated.entries.length,1);
  assert.equal(generated.entries[0].kind,'corrective');
  assert.equal(generated.entries[0].totalTime,'15 min');
  assert.equal(generated.entries[0].narrative,report.ratings[CATEGORIES[0]].justification);
  assert.deepEqual(generated.entries[0].sourceReportIds,[report.id]);
  const edited={...generated,entries:[{...generated.entries[0],totalTime:'25 min',narrative:'Updated weekly articulation.'}]};
  const merged=mergeReviewedUaEntries(edited,[report],[]);
  assert.equal(merged.entries.length,1);
  assert.equal(merged.entries[0].totalTime,'25 min');
  assert.equal(merged.entries[0].narrative,'Updated weekly articulation.');
  report.ratingsReviewedAt=undefined;
  assert.equal(mergeReviewedUaEntries({...base,entries:[]},[report],[]).entries.length,0);
});

test('weekly log exports numbered categories, requires verified W#D#P# references, and paginates without losing narrative',()=>{
  assert.equal(categoryNumberLabel('dutyReadiness'),'1, 2');
  assert.equal(categoryNumberLabel('criminalTrafficCodes'),'13');
  assert.equal(categoryNumberLabel('informationGathering'),'—');
  assert.equal(isValidTrainingFolderReference('W5D4P4'),true);
  assert.equal(isValidTrainingFolderReference('W5D4P?'),false);
  const longNarrative='Observed details and corrective actions. '.repeat(240);
  const entry:WeeklyPerformanceLogEntry={
    id:'long-corrective',kind:'corrective',category:'criminalTrafficCodes',totalTime:'15 min',
    narrative:longNarrative,sourceReportIds:['daily-source'],sourceReferences:['W5D4P4'],sourceReferenceReviewed:true,
  };
  const pages=paginateWeeklyLogEntries([entry]);
  const fragments=pages.flatMap(page=>page.corrective).map(row=>row.narrativePart);
  assert.ok(pages.length>1);
  assert.equal(fragments.join(''),longNarrative);
  assert.ok(pages.flatMap(page=>page.corrective).every(row=>row.entry.category==='criminalTrafficCodes'));
  assert.equal(hasReviewedCorrectiveSource(entry),true);
  assert.equal(hasReviewedCorrectiveSource({...entry,sourceReferenceReviewed:false}),false);
  assert.equal(hasReviewedCorrectiveSource({...entry,sourceReportIds:[]}),false);
});

test('date inputs auto-format and question-mark shortcut uses local date and time', () => {
  assert.equal(formatDateEntryMDY('03092027'),'03/09/2027');
  assert.equal(formatDateEntryMDY('?'),'?');
  assert.equal(formatDateTimeEntryMDY('030920271405'),'03/09/2027 14:05');
  assert.equal(formatDateTimeEntryMDY('03/09/2027 14:05'),'03/09/2027 14:05');
  assert.deepEqual(splitDateTimeEntryMDY('030920271405'),{date:'03/09/2027',time:'14:05'});
  assert.deepEqual(splitDateTimeEntryMDY('?'),{date:'?',time:'?'});
  assert.deepEqual(currentDateTimeMDY(new Date(2027,2,9,8,5)),{date:'03/09/2027',time:'08:05'});
});

test('class visibility permits FTO and FTO Coordinator only', () => {
  assert.equal(canViewClass('fto'),true);
  assert.equal(canViewClass('fto_coordinator'),true);
  assert.equal(canViewClass('fto_coc'),false);
  assert.equal(canViewClass('po'),false);
  assert.equal(canViewClass('policenet'),false);
  assert.equal(canViewClass('policenet_admin_sgt'),false);
});

test('phase schedule has four phases, 15 program weeks, and first-week Limbo in Phase I',()=>{
  assert.deepEqual(PHASES,[1,2,3,4]);
  assert.deepEqual(PHASE_LENGTH_WEEKS,{1:4,2:4,3:4,4:3});
  assert.deepEqual(PHASE_PROGRAM_WEEK_START,{1:1,2:5,3:9,4:13});
  const workdays=[0,6] as (0|1|2|3|4|5|6)[];
  assert.deepEqual(getPhaseScheduleInfo(1,'2025-01-06','2025-01-05',workdays),{phaseWeek:1,programWeek:1,scheduledDay:1,limboDay:true});
  assert.equal(getPhaseScheduleInfo(1,'2025-01-07','2025-01-05',workdays).limboDay,true);
  assert.equal(getPhaseScheduleInfo(1,'2025-01-10','2025-01-05',workdays).limboDay,true);
  assert.equal(getPhaseScheduleInfo(1,'2025-01-13','2025-01-05',workdays).limboDay,false);
  const midwatchDaysOff=[0,1,6] as (0|1|2|3|4|5|6)[];
  for(const date of ['2025-01-07','2025-01-08','2025-01-09','2025-01-10']) {
    assert.equal(getPhaseScheduleInfo(1,date,'2025-01-07',midwatchDaysOff).limboDay,true);
  }
  assert.equal(getPhaseScheduleInfo(1,'2025-01-14','2025-01-07',midwatchDaysOff).limboDay,false);
  assert.equal(getPhaseScheduleInfo(2,'2025-02-03','2025-02-02',workdays).limboDay,true);
  assert.equal(getPhaseScheduleInfo(2,'2025-02-04','2025-02-02',workdays).programWeek,5);
  assert.equal(getPhaseScheduleInfo(3,'2025-03-02','2025-03-02',workdays).limboDay,false);
  assert.equal(getPhaseScheduleInfo(3,'2025-03-03','2025-03-02',workdays).limboDay,true);
  assert.equal(getPhaseScheduleInfo(3,'2025-03-04','2025-03-02',workdays).limboDay,false);
  assert.equal(getPhaseScheduleInfo(4,'2025-03-31','2025-03-30',workdays).limboDay,true);
});

test('phase assignments include two-officer day units and precinct-number PTV wagons but no midwatch wagons',()=>{
  const dayAssignments=ftoAssignmentsForPrecinct('3','15','C-Co');
  assert.ok(dayAssignments.includes('150C'));
  assert.ok(dayAssignments.includes('150C1'));
  assert.ok(dayAssignments.includes('150C2'));
  assert.ok(dayAssignments.includes('158C1'));
  assert.ok(dayAssignments.includes('158C2'));
  assert.equal(cruiserDistrictForFtoAssignment('3','15','158C1','C-Co'),'158');
  assert.equal(cruiserDistrictForFtoAssignment('3','8','88C2','C-Co'),'88');
  assert.equal(cruiserDistrictForFtoAssignment('3','19','198B1','B-Co'),'198');
  assert.equal(isValidAssignment('3','15','158','C-Co'),true);
  assert.equal(isValidAssignment('3','15','158','DMW'),false);
  const dmwAssignments=ftoAssignmentsForPrecinct('3','15','DMW');
  assert.ok(dmwAssignments.includes('9150D1'));
  assert.ok(dmwAssignments.includes('9150D2'));
  assert.ok(dmwAssignments.every(value=>!value.startsWith('158')));
});

test('Limbo logs have no default SEG ratings and do not require rating validation',()=>{
  const report=seedReports()[0];
  report.limboDay=true;
  report.ratings=emptyRatings();
  assert.ok(Object.values(report.ratings).every(entry=>entry.rating===''));
  assert.equal(evaluationProgress(report),'Limbo day');
  assert.equal(validateReport(report).some(error=>error.includes('select a manual rating')),false);
});

test('manual run segments expose described actions for every form',()=>{
  for(const form of Object.values(RUN_CHECKLIST_SECTIONS)){
    assert.ok(form.length>1);
    for(const segment of form){
      if(segment.title) assert.ok(segment.title.trim());
      else assert.deepEqual(segment.items.map(item=>item.label),['Review of Division Directives, SOP, etc. (list)']);
      for(const item of segment.items){
        assert.ok(item.label.trim());
        assert.ok(item.help.trim());
      }
    }
  }
});

test('new run checklists precheck items while requiring an explicit review attestation', () => {
  const checklist=newRunChecklist('traffic_stop');
  assert.equal(Object.keys(checklist).length,RUN_CHECKLIST_ITEMS.traffic_stop.length+1);
  assert.ok(RUN_CHECKLIST_ITEMS.traffic_stop.every((_,index)=>checklist[`task-${index}`]===true));
  assert.equal(checklist['na-task'],false);
  assert.equal('checklistReviewedAt' in checklist,false);
  assert.equal(hasRunChecklistEdits(checklist),false);
  assert.equal(hasRunChecklistEdits({...checklist,'task-0':false}),true);
  assert.equal(hasRunChecklistEdits({...checklist,'na-task':true}),true);
});

test('new daily reports preselect duty checks but never preselect not-applicable',()=>{
  const defaults=defaultReportingForDutyRecord();
  const checkCount=DAILY_DUTY_CHECKLIST.reduce((count,group)=>count+group.items.length,0);
  assert.equal(Object.keys(defaults.checklist).length,checkCount);
  assert.ok(Object.values(defaults.checklist).every(value=>value===true));
  assert.ok(Object.values(defaults.notApplicable??{}).every(value=>value===false));
  assert.equal(defaults.reviewedAt,undefined);
  for (const report of seedReports()) {
    assert.equal(Object.keys(report.reportingForDuty.checklist).length,checkCount);
    assert.ok(Object.values(report.reportingForDuty.checklist).every(value=>value===true));
    assert.ok(Object.values(report.reportingForDuty.notApplicable??{}).every(value=>value===false));
  }
});

test('all form checklists start checked while not-applicable options stay unchecked',()=>{
  for(const form of Object.keys(RUN_CHECKLIST_ITEMS) as Array<keyof typeof RUN_CHECKLIST_ITEMS>){
    const checklist=newRunChecklist(form);
    assert.ok(RUN_CHECKLIST_ITEMS[form].every((_,index)=>checklist[`task-${index}`]===true),`${form} primary checklist`);
    assert.equal(checklist['na-task'],false);
  }
  for(const form of Object.keys(RUN_SUPPLEMENT_CHECKLIST_ITEMS) as Array<keyof typeof RUN_SUPPLEMENT_CHECKLIST_ITEMS>){
    const checklist=newRunChecklist('call_for_service',[form]);
    assert.ok(RUN_SUPPLEMENT_CHECKLIST_ITEMS[form].every((_,index)=>checklist[`supp-${form}-${index}`]===true),`${form} supplemental checklist`);
    assert.equal(checklist[`na-supp-${form}`],false);
  }
  const orientation=defaultSubstationOrientationChecklist();
  assert.equal(Object.keys(orientation).length,SUBSTATION_ORIENTATION_KEYS.length);
  assert.ok(Object.values(orientation).every(Boolean));
});

test('next log date advances to the next assigned workday for the same PO and phase', () => {
  const folder={recruitBadge:'123',recruitName:'Fictional PO',phase:1,shift:'A-Co' as const,className:'Class X',phaseStartDate:'2025-01-05',daysOff:[0,6] as (0|1|2|3|4|5|6)[]};
  assert.equal(getNextReportDate(folder,[]),'2025-01-06');
  assert.equal(getNextReportDate(folder,[{...folder,date:'2025-01-07'}]),'2025-01-08');
  assert.equal(getNextReportDate(folder,[{...folder,date:'2025-01-07'},{...folder,recruitBadge:'other',date:'2025-01-10'}]),'2025-01-08');
});

test('code suffixes and eligible traffic citation/summons runs are classified', () => {
  assert.equal(normalizeRadioCode('10-17a'),'17A');
  assert.equal(normalizeRadioCode('43s'),'43S');
  assert.equal(isValidRadioCode('43S'),true);
  assert.equal(isValidRadioCode('XYZ'),false);
  assert.equal(normalizeSituationFoundCode('N/A'),SITUATION_FOUND_NA);
  assert.equal(isValidSituationFoundCode(SITUATION_FOUND_NA),true);
  assert.equal(isValidSituationFoundCode(''),false);
  assert.equal(formatRadioCode(SITUATION_FOUND_NA),'N/A');
  assert.equal(isEligibleCitationSummons({runKind:'traffic_stop',clearanceCode:'1V'}),true);
  assert.equal(isEligibleCitationSummons({runKind:'traffic_stop',clearanceCode:'3V'}),true);
  assert.equal(isEligibleCitationSummons({runKind:'traffic_stop',clearanceCode:'2V'}),false);
  assert.equal(isEligibleCitationSummons({runKind:'call_for_service',clearanceCode:'3V'}),false);
});

test('official 2026 Patrol SOP code labels replace outdated scanner descriptions', () => {
  assert.equal(RADIO_CODE_SOURCE_LABEL, 'Columbus Division of Police Patrol SOP 2.02 · revised 04/15/2026');
  assert.equal(RADIO_CODES['6S'], 'Selective Traffic Enforcement');
  assert.equal(RADIO_CODES['23B'], 'Emergency Entry into Motor Vehicle');
  assert.equal(RADIO_CODES['30'], 'Theft in Progress');
  assert.equal(RADIO_CODES['34O'], 'Overdose');
  assert.equal(RADIO_CODES['37C'], 'Cadet/Public Safety Corps (PSC) Ride-Along');
  assert.equal(RADIO_CODES['40E'], 'Recovered Property - Evidence Technician');
  assert.equal(RADIO_CODES['42E'], 'Electronic Satellite Robbery Alert');
  assert.equal(RADIO_CODES['43S'], 'Shots Fired/ShotSpotter®');
});

test('run type and incident flags surface matching official directive references',()=>{
  const prompts=getRunDirectivePrompts({runKind:'domestic_incident',arrestMade:true,transportedAfterArrest:true,oviProcessed:true,activityFlags:{impoundSlips:true,propertySlips:true}});
  assert.deepEqual(prompts.map(item=>item.number),['11.07','2.01','4.05','3.01','3.03','5.06','6.01','6.02']);
  assert.ok(prompts.some(item=>item.reminder.includes('U-10.100')));
  assert.ok(getRunDirectivePrompts({runKind:'traffic_crash',arrestMade:false,transportedAfterArrest:false,oviProcessed:false}).some(item=>item.number==='5.05'));
  const trafficPrompts=getRunDirectivePrompts({runKind:'traffic_stop',arrestMade:false,transportedAfterArrest:false,oviProcessed:false});
  assert.ok(trafficPrompts.some(item=>item.number==='5.07'));
  assert.ok(trafficPrompts.some(item=>item.number==='5.03'&&item.reminder.includes('U-10.194')));
});

test('run type codes default only to a verified matching SOP code',()=>{
  assert.equal(DEFAULT_RUN_TYPE_CODES.traffic_stop,'6');
  assert.equal(DEFAULT_RUN_TYPE_CODES.domestic_incident,'17');
  assert.equal(DEFAULT_RUN_TYPE_CODES.traffic_crash,'4');
  assert.equal(DEFAULT_RUN_TYPE_CODES.high_risk_stop,'6');
  assert.equal(DEFAULT_RUN_TYPE_CODES.call_for_service,undefined);
  assert.equal(DEFAULT_RUN_TYPE_CODES.self_initiated,undefined);
  assert.equal(DEFAULT_RUN_TYPE_CODES.building_search,undefined);
  assert.deepEqual(BUILDING_SEARCH_DISPATCH_CODES,['7A','7','8A','8','8B']);
});

function run(id: string, clearanceCode: NonNullable<TrainingRun['clearanceCode']>='1V'): TrainingRun {
  return {id,occurredAt:'2025-01-06T13:00:00Z',runKind:'traffic_stop',isDispatched:false,
    trafficMode:'motor_vehicle',dispatchedCode:'6',situationFoundCode:'6',
    clearanceCode,arrestMade:false,transportedAfterArrest:false,oviProcessed:false,
    narrativeAdditionRequired:false,formStatus:'complete',checklist:newRunChecklist('traffic_stop'),checklistReviewedAt:'2025-01-06T16:00:00Z',narrative:'Fictional training'};
}

test('traffic data collection stays on its primary form instead of generating an unsubmitted supplement', () => {
  const sample={...run('run','S'),arrestMade:true,transportedAfterArrest:true,oviProcessed:true};
  assert.deepEqual(requiredSupplementalForms(sample),['arrest_process','ovi_process']);
  assert.deepEqual(requiredSupplementalForms({...sample,trafficMode:'pedestrian'}),['arrest_process','ovi_process']);
  assert.deepEqual(requiredSupplementalForms({...sample,trafficMode:'other'}),['arrest_process','ovi_process']);
  assert.ok(requiredSupplementalForms({...sample,transportedAfterArrest:false,arrestProcessRequired:true}).includes('arrest_process'));
  assert.ok(!requiredSupplementalForms({...sample,transportedAfterArrest:false,arrestProcessRequired:false}).includes('arrest_process'));
});

test('only explicitly selected related activity counts on completed and reviewed runs',()=>{
  const traffic={...run('traffic','1V'),activityFlags:{solveCitationSummons:true}};
  assert.equal(traffic.dispatchedCode,'6');
  assert.equal(runActivityValidationError(traffic),undefined);
  assert.match(runActivityValidationError({...traffic,clearanceCode:'3V',activityFlags:{premierOneReports:true}})??'',/1V or 3V/);
  const trafficOnlyCounts=runDerivedActivityCounts([traffic]);
  assert.equal(trafficOnlyCounts.solveCitationSummons,1);
  assert.equal(trafficOnlyCounts.premierOneReports,0);
  assert.match(runActivityValidationError({...traffic,activityFlags:{solveCitationSummons:true,premierOneReports:true}})??'',/must not count as a PremierOne\/Axon report/);
  const premier={...run('premier','1V'),runKind:'call_for_service' as const,activityFlags:{premierOneReports:true}};
  const arrested={...run('arrest','2V'),runKind:'call_for_service' as const,arrestMade:true,transportedAfterArrest:false,oviProcessed:true,activityFlags:{prisonerSearches:true,prisonersSlated:true,u10100Reports:true,arrestProcessForms:true,oviPackets:true}};
  const crash={...run('crash','1V'),runKind:'traffic_crash' as const,activityFlags:{accidentReports:true}};
  const pending={...run('pending','1V'),runKind:'call_for_service' as const,formStatus:'in_progress' as const,checklistReviewedAt:undefined,activityFlags:{prisonerSearches:true,prisonersSlated:true,solveCitationSummons:true}};
  const counts=runDerivedActivityCounts([traffic,premier,arrested,crash,pending]);
  assert.equal(counts.trafficStops,0);
  assert.equal(counts.trafficCitations,0);
  assert.equal(counts.solveCitationSummons,1);
  assert.equal(counts.prisonerSearches,1);
  assert.equal(counts.prisonersSlated,1);
  assert.equal(counts.premierOneReports,1);
  assert.equal(counts.accidentReports,1);
  assert.equal(counts.u10100Reports,1);
  assert.equal(counts.arrestProcessForms,1);
  assert.equal(counts.oviPackets,1);
  assert.equal(runDerivedActivityCounts([{...run('traffic-no-stats','1V'),activityFlags:{}}]).solveCitationSummons,0);
  const totals=activityTotals({activity:{...emptyDailyActivitySummary(),trafficCitations:2},runs:[traffic]});
  assert.equal(totals.trafficCitations,2);
  assert.equal(totals.solveCitationSummons,0);
  const legacyTotals=activityTotals({activity:{...emptyDailyActivitySummary(),trafficCitations:1},runs:[traffic],activityCountsIncludeRuns:true});
  assert.equal(legacyTotals.trafficCitations,1);
  assert.equal(legacyTotals.solveCitationSummons,0);
});

test('clearance 3V and arrest facts do not automatically add activity statistics',()=>{
  const noArrest={...run('3v-no-arrest','3V'),runKind:'call_for_service' as const,arrestMade:false};
  const arrested={...noArrest,id:'3v-arrest',arrestMade:true};
  assert.equal(runDerivedActivityCounts([noArrest]).u10100Reports,0);
  assert.equal(runDerivedActivityCounts([arrested]).u10100Reports,0);
  assert.equal(runDerivedActivityCounts([{...arrested,activityFlags:{u10100Reports:true}}]).u10100Reports,1);
});

test('Excel round trip includes all current SEGs, weekly forms, phase totals, codes and citation/summons metrics', () => {
  const report=seedReports()[0];
  const pending=run('pending','3V'); pending.formStatus='in_progress'; pending.checklistReviewedAt=undefined;
  report.runs=[
    {...run('one','1V'),activityFlags:{solveCitationSummons:true}},
    {...run('two','3V'),activityFlags:{solveCitationSummons:true}},
    run('three','2V'),
    {...pending,activityFlags:{solveCitationSummons:true}},
  ];
  report.ratingsReviewedAt='2025-01-06T17:00:00Z';
  report.activity.trafficStops=3;
  report.activity.vehicleExtractions=2;
  report.activity.evo=1;
  const another={...structuredClone(report),id:'other-class',className:'Another Class',runs:[]};
  const workbook=buildClassWorkbook([report,another]);
  const bytes=XLSX.write(workbook,{type:'buffer',bookType:'xlsx'});
  const reopened=XLSX.read(bytes,{type:'buffer'});
  const rows=(name:string)=>XLSX.utils.sheet_to_json<(string|number)[]>(reopened.Sheets[name],{header:1});
  assert.equal(rows('SEG Ratings').length,61);
  assert.equal(rows('Weekly Totals').length,3); // Same PO in different classes stays separate.
  assert.equal(rows('Phase Totals').length,3);
  assert.ok(reopened.SheetNames.some(name=>name.startsWith('Weekly Summary')));
  assert.ok(reopened.SheetNames.includes('Weekly Run Checklist'));
  assert.ok(reopened.SheetNames.includes('Form Index'));
  assert.ok(reopened.SheetNames.includes('Weekly Acknowledgements'));
  assert.ok(reopened.SheetNames.includes('Weekly Log Supplement'));
  assert.ok(rows('Reporting for Duty')[0].includes('Not applicable'));
  assert.ok(rows('Run Checklist')[0].includes('Not applicable to category'));
  assert.ok(rows('Weekly Run Checklist')[0].includes('Not applicable forms'));
  assert.equal(rows('Form Index').some(row=>String(row[1]).includes('U-10.18')),false);
  const formIndex=rows('Form Index');
  const formReference=(name:string)=>formIndex.find(row=>row[0]===name)?.[1];
  assert.equal(formReference('Daily Performance Log'),'U-10.174');
  assert.equal(formReference('Weekly Performance Summary'),'U-10.173');
  assert.equal(formReference('Weekly Performance Log Supplement'),'U-10.174S');
  assert.ok(formIndex.some(row=>String(row[1]).includes('U-10.173')));
  assert.ok(formIndex.some(row=>String(row[1]).includes('U-10.174S')));
  const weeklySheet=reopened.SheetNames.find(name=>name.startsWith('Weekly Summary'));
  assert.ok(weeklySheet);
  assert.ok(rows(weeklySheet!).flat().includes('Task Management'));
  assert.ok(rows(weeklySheet!).flat().includes('Vehicle Extractions'));
  assert.ok(rows(weeklySheet!).flat().includes('Probationary Officer Weekly Performance Summary · U-10.173'));
  const runRows=rows('Run Forms');
  const headers=runRows[0];
  assert.equal(runRows.length,5);
  assert.deepEqual(runRows.slice(1).map(row=>row[headers.indexOf('Solve Citation/Summons*')]),['Yes','Yes','','Yes']);
  assert.ok(runRows.slice(1).every(row=>row[headers.indexOf('Run type 10-code')]==='10-6'));
  assert.deepEqual(runRows.slice(1).map(row=>row[headers.indexOf('Clearance code')]),['1V','3V','2V','3V']);
  const weekly=rows('Weekly Totals');
  assert.ok(weekly[0].includes('Solve Citation/Summons*'));
  const citationCount=weekly[0].indexOf('Traffic Citations');
  assert.equal(weekly.slice(1).reduce((sum,row)=>sum+Number(row[citationCount]),0),0);
  const checklist=rows('Weekly Run Checklist');
  const checkedIndex=checklist[0].indexOf('Checked count');
  const trafficRows=checklist.slice(1).filter(row=>row[checklist[0].indexOf('Form')]==='Traffic Stop');
  assert.equal(trafficRows.length,RUN_CHECKLIST_ITEMS.traffic_stop.length);
  assert.ok(trafficRows.every(row=>row[checkedIndex]===3));
});

test('weekly rating totals exclude default Acceptable values until the daily summary is reviewed', () => {
  const report=seedReports()[0];
  const workbook=buildClassWorkbook([report]);
  const weekly=XLSX.utils.sheet_to_json<(string|number)[]>(workbook.Sheets['Weekly Totals'],{header:1});
  const acceptableIndex=weekly[0].indexOf('A');
  assert.equal(weekly[1][acceptableIndex],0);
  const dailyRatings=XLSX.utils.sheet_to_json<(string|number)[]>(workbook.Sheets['SEG Ratings'],{header:1});
  assert.ok(dailyRatings.slice(1).every(row=>row[row.length-1]==='Unreviewed default or draft'));
});
