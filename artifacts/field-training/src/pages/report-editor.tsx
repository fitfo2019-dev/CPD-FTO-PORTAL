import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { ArrowLeft, ShieldAlert, Lock, Trash2, Info, Printer, Plus, ClipboardList, ChevronLeft, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { exportDailyRow } from '@/lib/daily-row-export.js';
import { useOperationalStateMachine, useWorkspace } from '@/state/workspace.js';
import { CATEGORIES, CATEGORY_LABEL, DAILY_ACTIVITY_COLUMNS, DAILY_ACTIVITY_FIELDS, DAILY_DUTY_CHECKLIST, DIRECTIVE_REVIEW_LABEL, PHASE_PROGRAM_WEEK_START, defaultDirectiveReviewRecord, defaultRatings, dutyChecklistChecked, emptyRatings, emptyDailyActivitySummary, emptyReportingForDutyRecord, hasRunChecklistEdits, requiredSupplementalForms, SEG_CATEGORIES, SEG_RATING_COLUMNS, SEG_RATING_GROUP_LABELS, phaseAssignmentLabel, phaseLabel, RATINGS, RATING_LEGEND, WEEKDAYS, shiftDisplayLabel, needsJustification, ratingLabel, scanPII, uid, validateReport, PRIMARY_RUN_FORMS, RUN_FORM_GUIDANCE, SUPPLEMENTAL_FORM_GUIDANCE, SUPPLEMENTAL_RUN_FORMS, RUN_CHECKLIST_ITEMS, RUN_CHECKLIST_SECTIONS, RUN_SUPPLEMENT_CHECKLIST_ITEMS, RUN_SUPPLEMENT_CHECKLIST_SECTIONS, newRunChecklist, type ActivityKey, type Category, type DirectiveReviewField, type DirectiveReviewForm, type DirectiveReviewRecord, type PhaseCaseFolder, type Rating, type Report, type TrainingRun, type PrimaryRunForm, type SupplementalRunForm } from '@/lib/model.js';
import { PageHead, Panel, StatusPill } from '@/components/bits.js';
import { SearchableSelect } from '@/components/searchable-select.js';
import { applyCurrentDateTimeShortcut } from '@/lib/date-time-shortcut.js';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog.js';
import {
  DIVISION_DIRECTIVES, DIVISION_DIRECTIVE_SOURCE_REVISION, DIVISION_DIRECTIVE_SOURCE_URL,
} from '@/lib/division-directives.js';
import { reviewedTrainingMaterials } from '@/lib/training-materials.js';
import { useToast } from '@/hooks/use-toast.js';
import { cn } from '@/lib/utils.js';
import { formatDateDMY, formatDateEntryMDY, formatDateTimeMDY, getNextReportDate, getPhaseScheduleInfo, getSundaySaturdayWeek, getWeekdayIndex, parseDateDMY, requiredDaysOff, shiftWeekDescription, splitDateTimeEntryMDY } from '@/lib/training-calendar.js';
import { isValidAssignment } from '@/lib/cpd-geography.js';
import { PrintableDailyLog } from '@/components/printable-daily-log.js';
import { PrintableDailyForms } from '@/components/printable-daily-forms.js';
import { activityDiscrepancies, activityTotals, buildClearanceDocuments, clearanceDerivedActivityCounts, manualActivityEntryForTotal, runActivityValidationError, runDerivedActivityCounts } from '@/lib/run-activity.js';
import { checklistForMetadata, resetPrimaryChecklist } from '@/lib/run-checklist-state.js';
import { REVISED_PRIMARY_CHECKLISTS, REVISED_SUPPLEMENT_CHECKLISTS, type RevisedChecklistRow, type RevisedChecklistSection } from '@/lib/revised-run-checklists.js';
import { RunChecklistFields } from '@/components/run-checklist-fields.js';
import { buildRunNarrativeDraft } from '@/lib/run-narrative-draft.js';
import { isRtRestricted } from '@/lib/model.js';
import { DEFAULT_RUN_TYPE_CODES, RADIO_CODES, CLEARANCE_CODES, SITUATION_FOUND_NA, formatRadioCode, isEligibleCitationSummons, normalizeRadioCode, normalizeSituationFoundCode, isValidRadioCode, isValidSituationFoundCode } from '@/lib/radio-codes.js';
import { alignRunDateToShift, parseRunDateTime } from '@/lib/run-details.js';
import { useDeficiencyEditor } from '@/hooks/use-deficiency-editor.js';
import { DeficiencyDialog } from '@/components/deficiency-dialog.js';
import { createDailyReportDraft } from '@/lib/daily-report-draft.js';
import { authoredReportSnapshot } from '@/lib/protected-packets.js';
import { getRunWorkflowSteps, runSheetReviewSnapshot, type RunSheetKey, type RunWorkflowDraft } from '@/lib/run-workflow.js';
import { isDispatchedRunMissingIncidentNumber, restoreDispatchPrefillFields, serializeDispatchPrefillFields } from '@/lib/dispatch-prefill.js';
import { isArrestSeverity, isArrestType } from '@/lib/arrest-classification.js';
import { ArrestClassificationFields } from '@/components/arrest-classification-fields.js';
import { RunStepRail, SheetStatus, sheetHasEdits } from '@/components/run-sheet-workflow.js';
import { NewRunDialog, type NewRunSeed } from '@/components/new-run-dialog.js';
import { TrafficStopRiskPrompt } from '@/components/traffic-stop-risk-choice.js';
import { RunChecklistFailureDialog } from '@/components/run-checklist-failure-dialog.js';
import { formatTimeEntry24H } from '@/lib/training-calendar.js';
import { runFailureActionChoices, runChecklistFailureSummaries, type RunChecklistSourceForm } from '@/lib/run-checklist-failures.js';
import { RunChecklistUncheckedDialog, type UncheckedChoice, type UncheckedItem } from '@/components/run-checklist-unchecked-dialog.js';
import { applyTrafficDataCollectionRule } from '@/lib/traffic-data-collection.js';
import { activeFailureStatementEdits, activeNotApplicable, runFailureStatements } from '@/lib/run-failure-statements.js';
import { SEG_TASK_DIRECTORY } from '@/lib/seg-deficiencies.js';
import '@/components/run-sheet-workflow.css';

import { PacketSubmitControl } from '@/components/packet-review/submit-control.js';

import { activeFtoIdentity, useOperationalProfile } from '@/state/operational-profile.js';

import { RunOptionsDialog } from '@/components/run-options-dialog.js';
import { savedOrientationHref } from '@/lib/saved-orientation.js';

import { searchTrainingRunsByIncidentNumber } from '@/lib/training-run-search.js';

type EditorStage = 'shift'|'duty'|'runs'|'activity'|'evaluation'|'narrative';
type FailurePromptTarget = { form:RunChecklistSourceForm;key:string;label:string;choices:readonly string[];mode:'clear'|'edit' };
type ChecklistActionTarget = { form:RunChecklistSourceForm;key:string;label:string };
const EDITOR_STAGES: {id:EditorStage;label:string;hash:string}[] = [
  {id:'shift',label:'Shift',hash:'shift-details'},
  {id:'duty',label:'Reporting for Duty',hash:'duty-form'},
  {id:'runs',label:'Runs & forms',hash:'run-forms'},
  {id:'activity',label:'Activity',hash:'activity-summary'},
  {id:'evaluation',label:'SEG evaluation',hash:'seg-ratings'},
  {id:'narrative',label:'Narrative & comments',hash:'shift-narrative'},
];
const QUICK_ADD = [
  {form:'building_search',label:'Building Search'},
  {form:'arrest_process',label:'Arrest Process'},
  {form:'ovi_process',label:'OVI Process'},
  {form:'narrative_addition',label:'Narrative Addition'},
] as const satisfies readonly {form:SupplementalRunForm;label:string}[];
function stageForError(message:string):EditorStage {
  if(/Reporting for Duty|Shotgun|Cruiser|duty/i.test(message))return 'duty';
  if(/run|Run|Call for Service|Traffic|Building Search|Domestic|Self-Initiated/.test(message)&&/complet|review/i.test(message))return 'runs';
  if(/Shift date|day off|PO |badge|class|phase|week|assignment/i.test(message))return 'shift';
  if(/activity|statistic/i.test(message))return 'activity';
  if(/narrative|remedial/i.test(message)&&!/articulation/i.test(message))return 'narrative';
  return 'evaluation';
}

function checklistHelp(form:string,meaning:string) {
  return `${form}: ${meaning} Keep checked only when the PO completed the described action acceptably. Clearing an applicable task creates a UA deficiency. Use the Not applicable control for an inapplicable form or group; document observed facts and any training actually completed.`;
}
function dutyChecklistHelp(section:string,item:string) {
  return `Reporting for Duty · ${section}: indicates the PO ${item.toLowerCase()}. Clearing an applicable task creates a UA deficiency. Use the section's Not applicable control when the section does not apply.`;
}

export default function ReportEditor() {
  const { profile, contextKey: operationalContextKey } = useOperationalProfile();
  const params = useParams<{ id?: string }>();
  const isNew = !params.id || params.id === 'new';
  const { ws, upsertReport, deleteReport, setEditorDirty, getOperationalPacket, previewOnly,
    authAccountId, saveAuthRecoverySnapshot } = useWorkspace();
  const requestedReportDate = (folder: NonNullable<typeof ws.caseFolder>, reports: typeof ws.reports) => {
    const value = isNew ? new URLSearchParams(window.location.search).get('date') : null;
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < folder.phaseStartDate) return undefined;
    return reports.some(report => report.date === value && report.phase === folder.phase && report.recruitBadge === folder.recruitBadge) ? undefined : value;
  };
  const [, nav] = useLocation();
  const { toast } = useToast();
  useEffect(() => {
    document.body.classList.add('print-daily-route');
    return () => document.body.classList.remove('print-daily-route');
  }, []);
  const existing = isNew ? undefined : ws.reports.find(r => r.id === params.id);
  const [r, setR] = useState<Report | undefined>(() => existing ? structuredClone(existing) : isNew && ws.caseFolder && !!ws.caseFolder.ftoAssignment && isValidAssignment(ws.caseFolder.zone, ws.caseFolder.precinct, ws.caseFolder.cruiserDistrict, ws.caseFolder.shift) && (ws.caseFolder.daysOff?.length ?? 0) === requiredDaysOff(ws.caseFolder.shift) ? createDailyReportDraft(ws.caseFolder,requestedReportDate(ws.caseFolder,ws.reports)??getNextReportDate(ws.caseFolder,ws.reports),ws.reports.filter(report=>report.phase===ws.caseFolder?.phase&&report.recruitBadge===ws.caseFolder.recruitBadge&&(report.className??'')===(ws.caseFolder.className??'')).sort((a,b)=>b.date.localeCompare(a.date))[0],activeFtoIdentity(profile,ws.caseFolder)) : undefined);
  const operationalPacket = useOperationalStateMachine(r);
  const [initialReport] = useState(()=>authoredReportSnapshot(r));
  const [dateText, setDateText] = useState(() => r ? formatDateDMY(r.date) : '');
  const [showErr, setShowErr] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf'|'xlsx'>('pdf');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [editingRunId, setEditingRunId] = useState<string | null>(null);
  const [runOpen,setRunOpen]=useState(false);
  const [runDraftId, setRunDraftId] = useState(uid);
  const [runKind, setRunKind] = useState<PrimaryRunForm>('call_for_service');
  const [runDateTimeText, setRunDateTimeText] = useState(() => r ? formatDateDMY(r.date) : '');
  const [runTimeText, setRunTimeText] = useState('');
  const [incidentNumber, setIncidentNumber] = useState('');
  const [runIncidentSearch, setRunIncidentSearch] = useState('');
  const [runLocation, setRunLocation] = useState('');
  const [runLocationCity, setRunLocationCity] = useState('');
  const [runLocationState, setRunLocationState] = useState('');
  const [runLocationZip, setRunLocationZip] = useState('');
  const [runZone, setRunZone] = useState('');
  const [runCruiserDistrict, setRunCruiserDistrict] = useState('');
  const [runError, setRunError] = useState('');
  const [runDispatched, setRunDispatched] = useState(true);
  const [trafficMode, setTrafficMode] = useState<TrainingRun['trafficMode']>('none');
  const [runOptionsOpen,setRunOptionsOpen] = useState(false);
  const [activityFlags, setActivityFlags] = useState<Partial<Record<ActivityKey,boolean>>>({});
  const [dispatchedCode, setDispatchedCode] = useState('');
  const [situationFoundCode, setSituationFoundCode] = useState('');
  const [clearanceCode, setClearanceCode] = useState<NonNullable<TrainingRun['clearanceCode']>>('');
  const [arrestSeverity, setArrestSeverity] = useState('');
  const [arrestType, setArrestType] = useState('');
  const [arrestMade, setArrestMade] = useState(false);
  const [transported, setTransported] = useState(false);
  const [transportDestination, setTransportDestination] = useState('');
  const [transportDestinationType, setTransportDestinationType] = useState<TrainingRun['transportDestinationType']>();
  const [arrestProcessRequired, setArrestProcessRequired] = useState(false);
  const [buildingSearchRequired, setBuildingSearchRequired] = useState(false);
  const [oviProcessRequired, setOviProcessRequired] = useState(false);
  const [runUnitNumber, setRunUnitNumber] = useState('');
  const [runDispatchedAtText, setRunDispatchedAtText] = useState('');
  const [runClearedAtText, setRunClearedAtText] = useState('');
  const [runStep, setRunStep] = useState('details');
  const [sheetReviews, setSheetReviews] = useState<Partial<Record<RunSheetKey,string>>>({});
  const [legacyReviewSheets, setLegacyReviewSheets] = useState<RunSheetKey[]|null>(null);
  const [newRunOpen, setNewRunOpen] = useState(false);
  const [riskPrompt,setRiskPrompt]=useState(false);
  const [riskCandidate,setRiskCandidate]=useState<PrimaryRunForm|''>('');
  const [riskCodeDirty,setRiskCodeDirty]=useState(false);
  const [confirmAction, setConfirmAction] = useState<{title:string;body:string;label:string;action:()=>void}|null>(null);
  const [stage, setStage] = useState<EditorStage>(()=>EDITOR_STAGES.find(item=>`#${item.hash}`===window.location.hash)?.id??(window.location.hash.startsWith('#run-')?'runs':'shift'));
  useEffect(()=>{
    const target=decodeURIComponent(window.location.hash.slice(1));
    if(!target.startsWith('run-')||target==='run-forms')return;
    const frame=requestAnimationFrame(()=>document.getElementById(target)?.scrollIntoView({block:'start'}));
    return ()=>cancelAnimationFrame(frame);
  },[]);
  const [oviProcessed, setOviProcessed] = useState(false);
  const [narrativeAdditionRequired, setNarrativeAdditionRequired] = useState(false);
  const [runNarrative, setRunNarrative] = useState('');
  const [runChecklist, setRunChecklistState] = useState<Record<string, boolean>>(()=>newRunChecklist('call_for_service'));
  const [runChecklistFailures, setRunChecklistFailuresState] = useState<Record<string,string[]>>({});
  const [failurePrompt, setFailurePrompt] = useState<FailurePromptTarget|null>(null);
  const [failurePromptSelection, setFailurePromptSelection] = useState<string[]>([]);
  const [failurePromptQueue, setFailurePromptQueue] = useState<FailurePromptTarget[]>([]);
  const [runChecklistNA, setRunChecklistNAState] = useState<Record<string, true>>({});
  const [runFailureEdits, setRunFailureEdits] = useState<Record<string, string>>({});
  const [uncheckedPrompt, setUncheckedPrompt] = useState<{form:RunChecklistSourceForm;naKey:string;rowLabel:string;items:UncheckedItem[];itemLabels:Record<string,string>}|null>(null);
  const [uncheckedChoices, setUncheckedChoices] = useState<Record<string, UncheckedChoice|undefined>>({});
  const setRunChecklist: typeof setRunChecklistState = update => {
    setRunChecklistState(update);
    setR(current => current && ({ ...current, deficiencyAutomationEnabled: true, ratingsReviewedAt: undefined }));
  };
  const setRunChecklistFailures: typeof setRunChecklistFailuresState = update => {
    setRunChecklistFailuresState(update);
    setR(current => current && ({ ...current, deficiencyAutomationEnabled: true, ratingsReviewedAt: undefined }));
  };
  const setRunChecklistNA: typeof setRunChecklistNAState = update => {
    setRunChecklistNAState(update);
    setR(current => current && ({ ...current, deficiencyAutomationEnabled: true, ratingsReviewedAt: undefined }));
  };
  const [directiveReviews,setDirectiveReviews]=useState<Partial<Record<DirectiveReviewForm,DirectiveReviewRecord>>>({});
  const generatedNarrativeRef = useRef('');
  const candidateRun = useMemo<TrainingRun | undefined>(() => {
    const occurredAt=parseRunDateTime(runDateTimeText);
    if (!r || !occurredAt || (!editingRunId && !Object.entries(runChecklist).some(([key, value]) => !value && /^(task-|supp-)/.test(key)))) return undefined;
    return {
      clearanceRulesVersion:editingRunId?r?.runs.find(run=>run.id===editingRunId)?.clearanceRulesVersion:1,
      id: editingRunId ?? runDraftId, occurredAt,
      runKind, isDispatched: runDispatched, trafficMode, arrestMade,
      transportedAfterArrest: arrestMade && transported, arrestProcessRequired, buildingSearchRequired, oviProcessRequired,
      transportDestination:arrestMade&&transported?transportDestination.trim()||undefined:undefined,
      transportDestinationType:arrestMade&&transported?transportDestinationType:undefined,
      clearanceCode,
       oviProcessed, narrativeAdditionRequired, checklist: runChecklist, checklistFailures:runChecklistFailures, checklistNotApplicable:runChecklistNA, failureStatements:runFailureEdits, narrative: runNarrative, directiveReviews,
      formStatus: runNarrative.trim() ? 'complete' : 'in_progress',
    };
  }, [runChecklistNA, runFailureEdits, r?.date, editingRunId, runDraftId, runDateTimeText, runKind, runDispatched, trafficMode, arrestMade, transported, transportDestination, transportDestinationType, clearanceCode, arrestProcessRequired, buildingSearchRequired, oviProcessRequired, oviProcessed, narrativeAdditionRequired, runChecklist, runChecklistFailures, runNarrative, directiveReviews]);
  const deficiencyEditor = useDeficiencyEditor(r, setR, getOperationalPacket, candidateRun, r?.status === 'draft' && ws.role === 'fto');
  const parsedDate = parseDateDMY(dateText);
  const runDateTimeParts = splitDateTimeEntryMDY(runDateTimeText);
  const dateWeekday = parsedDate ? getWeekdayIndex(parsedDate) : undefined;
  const selectedDayOff = !!(isNew && ws.caseFolder && dateWeekday !== undefined && ws.caseFolder.daysOff?.includes(dateWeekday));
  const checkItems = RUN_CHECKLIST_ITEMS[runKind];
  const primaryDirectiveIndex=checkItems.indexOf(DIRECTIVE_REVIEW_LABEL);
  const primaryDirectiveReview=directiveReviews[runKind]??defaultDirectiveReviewRecord();
  const primaryChecklistAllChecked=checkItems.length>0&&checkItems.every((_,index)=>runChecklist[`task-${index}`]!==false)
    &&(primaryDirectiveIndex<0||(runChecklist[`task-${primaryDirectiveIndex}`]!==false&&primaryDirectiveReview.divisionDirectives&&primaryDirectiveReview.ohioRevisedCode&&primaryDirectiveReview.columbusCityCode&&primaryDirectiveReview.other));
  const primaryChecklistGroups=REVISED_PRIMARY_CHECKLISTS[runKind];
  const runMeta = { runKind, trafficMode, isDispatched:runDispatched, arrestMade, transportedAfterArrest:arrestMade && transported, arrestProcessRequired, buildingSearchRequired, oviProcessed, oviProcessRequired, narrativeAdditionRequired };
  const requiredSupplements = requiredSupplementalForms(runMeta);
  const workflowDraft: RunWorkflowDraft = {
    ...runMeta, checklist: runChecklist, checklistFailures:runChecklistFailures, checklistNotApplicable:runChecklistNA, failureStatements:runFailureEdits, directiveReviews, narrative: runNarrative,
    arrestClassificationVersion: editingRunId ? r?.runs.find(run=>run.id===editingRunId)?.arrestClassificationVersion ?? 1 : 1,
    arrestSeverity, arrestType,
    incidentNumber: incidentNumber.trim() || undefined, location: runLocation.trim() || undefined,
    locationCity:runLocationCity.trim()||undefined,locationState:runLocationState.trim()||undefined,locationZip:runLocationZip.trim()||undefined,
    incidentZone:runZone.trim()||undefined,incidentCruiserDistrict:runCruiserDistrict.trim()||undefined,
    unitNumber:runUnitNumber.trim()||undefined,
    dispatchedAt:parseRunDateTime(runDispatchedAtText)??runDispatchedAtText,
    endedAt:parseRunDateTime(runClearedAtText)??runClearedAtText,
    occurredAt: parseRunDateTime(runDateTimeText) ?? '', dispatchedCode, situationFoundCode, clearanceCode,
    transportDestination: arrestMade && transported ? transportDestination.trim() : undefined,
    transportDestinationType: arrestMade && transported ? transportDestinationType : undefined,
  };
  const runSteps = getRunWorkflowSteps(workflowDraft);
  const currentStep = runSteps.find(step => step.id === runStep) ?? runSteps[0];
  const stepIndex = runSteps.indexOf(currentStep);
  const runChecklistSteps = runSteps.filter(step => step.kind === 'checklist');
  const sheetReviewed = (sheet: RunSheetKey) => sheetReviews[sheet] !== undefined && sheetReviews[sheet] === runSheetReviewSnapshot(workflowDraft, sheet);
  const allSheetsReviewed = runChecklistSteps.every(step => sheetReviewed(step.id as RunSheetKey));
  useEffect(() => {
    if (!legacyReviewSheets) return;
    // Saved explicit review covers only the sheets that existed when it was saved.
    setSheetReviews(Object.fromEntries(legacyReviewSheets.map(sheet => [sheet, runSheetReviewSnapshot(workflowDraft, sheet)])));
    setLegacyReviewSheets(null);
  }, [legacyReviewSheets,workflowDraft]);
  const supplementCheckItems = RUN_SUPPLEMENT_CHECKLIST_ITEMS;
  const isLimboDay=!!r?.limboDay;
  const citationSummonsRecorded=isEligibleCitationSummons({runKind,clearanceCode});
  useEffect(()=>{
    if(runKind!=='traffic_stop')return;
    const next=applyTrafficDataCollectionRule({runKind,isDispatched:runDispatched,checklist:runChecklist,checklistNotApplicable:runChecklistNA,activityFlags});
    if(next.checklist!==runChecklist)setRunChecklistState(next.checklist);
    if(next.checklistNotApplicable!==runChecklistNA)setRunChecklistNAState(next.checklistNotApplicable);
  },[runKind,runDispatched,activityFlags.solveCitationSummons,runChecklist,runChecklistNA]);

  const baseline = useMemo(() => authoredReportSnapshot(existing), [existing]);
  useEffect(()=>{
    if(existing?.syncStatus==='synchronized_complete') setR(structuredClone(existing));
  },[existing?.syncStatus,existing?.serverVersion]);
  const previousRun=editingRunId?r?.runs.find(item=>item.id===editingRunId):undefined;
  const directiveReviewsDirty=JSON.stringify(directiveReviews)!==JSON.stringify(previousRun?.directiveReviews??{});
  const runFormDirty = editingRunId !== null || !!dispatchedCode || situationFoundCode !== '' || !!clearanceCode || Object.values(activityFlags).some(Boolean) || runDateTimeText !== (r ? formatDateDMY(r.date) : '') || runTimeText !== '' || runKind !== 'call_for_service' || !runDispatched || trafficMode !== 'none' || arrestMade || transported || transportDestination.trim() !== '' || !!transportDestinationType || arrestSeverity !== '' || arrestType !== '' || arrestProcessRequired || buildingSearchRequired || oviProcessRequired || runUnitNumber.trim() !== '' || runDispatchedAtText.trim() !== '' || runClearedAtText.trim() !== '' || oviProcessed || narrativeAdditionRequired || incidentNumber.trim() !== '' || runLocation.trim() !== '' || runLocationCity.trim() !== '' || runLocationState.trim() !== '' || runLocationZip.trim() !== '' || runZone.trim() !== '' || runCruiserDistrict.trim() !== '' || runNarrative.trim() !== '' || directiveReviewsDirty || hasRunChecklistEdits(runChecklist) || Object.keys(runFailureEdits).length>0;
  const matchingRuns = useMemo(
    () => searchTrainingRunsByIncidentNumber(r?.runs ?? [], runIncidentSearch),
    [r?.runs, runIncidentSearch],
  );
  const isDirty = !!r && (authoredReportSnapshot(r) !== (isNew ? initialReport : baseline) || dateText !== formatDateDMY(r.date) || runFormDirty);
  const recoveryBuffer = useRef<{ accountId?: string; reportId: string; dirty: boolean; fields: Array<{ form: string; field: string; value: string }> }>({
    accountId: authAccountId, reportId: r?.id ?? '', dirty: isDirty, fields: [],
  });
  recoveryBuffer.current = {
    accountId: authAccountId,
    reportId: r?.id ?? '',
    dirty: isDirty,
    fields: r ? [
      { form: `report:${r.id}`, field: 'input-narrative', value: r.narrative },
      { form: `report:${r.id}`, field: 'input-remedial', value: r.remedial },
      { form: `report:${r.id}`, field: 'input-recruit-comments', value: r.recruitComments },
      { form: `report:${r.id}`, field: 'input-duty-notes', value: r.reportingForDuty?.notes ?? '' },
      { form: `report:${r.id}`, field: 'input-run-narrative', value: runNarrative },
    ] : [],
  };
  useEffect(() => { setEditorDirty(isDirty); }, [isDirty, setEditorDirty]);
  useEffect(() => () => {
    const recovery = recoveryBuffer.current;
    if (recovery.dirty && recovery.fields.length)
      void saveAuthRecoverySnapshot?.(recovery.accountId, recovery.fields).catch(() => {});
    setEditorDirty(false);
  }, [saveAuthRecoverySnapshot, setEditorDirty]);
  useEffect(() => {
    if (!r) return;
    setDateText(formatDateDMY(r.date));
    if (!editingRunId) setRunDateTimeText(current=>current.includes(' ')?current:formatDateDMY(r.date));
  }, [r?.date, editingRunId]);
  const errs = useMemo(() => r ? [
    ...validateReport(r),
    ...(operationalPacket?.blockingIssues ?? []),
    ...(!r.limboDay && deficiencyEditor.groups.some(group=>!group.narrative.trim()) ? ['Complete the FTO articulation for each checklist deficiency category'] : []),
    ...(r.deficiencyAutomationEnabled && !r.reportingForDuty.shotgunTraining ? ['Record Shotgun Training as Y or N'] : []),
    ...(!r.reportingForDuty?.reviewedAt ? ['Reporting for Duty checklist must be reviewed and confirmed'] : []),
     ...(r.runs??[]).filter(run=>run.formStatus!=='complete'||!run.checklistReviewedAt).map(run=>`${PRIMARY_RUN_FORMS.find(form=>form.key===run.runKind)?.label??'Run'} must be completed and reviewed before submission`),
    ...(parsedDate ? [] : ['Shift date must be a valid date in MM/DD/YYYY format']),
    ...(selectedDayOff ? ['Shift date falls on a day off selected in the phase case folder'] : []),
  ] : [], [r, parsedDate, selectedDayOff, operationalPacket, deficiencyEditor.groups]);
  const pii = useMemo(() => r ? Array.from(new Set(scanPII([r.narrative, r.remedial, r.recruitComments, r.reportingForDuty?.notes, r.zone, r.precinct, r.cruiserDistrict, r.ftoAssignment, ...CATEGORIES.map(c=>r.ratings[c].justification), ...(r.runs ?? []).map(run=>run.narrative)].join('\n')))) : [], [r]);

  if (!r) return <div className="py-20 text-center"><div className="mono text-5xl font-bold text-muted-foreground">{isNew ? <Lock className="mx-auto h-10 w-10" /> : '404'}</div><p className="mt-2">{isNew ? ws.caseFolder ? 'Complete the shift schedule and valid Zone → Precinct → FTO Assignment in phase setup before starting this shift.' : 'Complete phase setup before starting a shift.' : 'Report not found.'}</p><Link href={isNew ? '/phase-setup' : '/reports'} className="underline font-semibold mt-3 inline-block">{isNew ? 'Open phase setup' : 'Back to saved records'}</Link></div>;

  const locked = r.status === 'locked'
    || r.syncStatus === 'synchronized_complete' || existing?.syncStatus === 'synchronized_complete'
    || r.syncStatus === 'submitted_complete' || existing?.syncStatus === 'submitted_complete'
    || r.syncAttemptPending === true || r.finalizationAttemptPending === true
    || existing?.syncAttemptPending === true || existing?.finalizationAttemptPending === true;
  const editable = !locked && r.status === 'draft' && ws.role === 'fto';
  const commentsEditable = !locked && r.status === 'fto_signed' && ws.role === 'po';
  const set = <K extends keyof Report>(k: K, v: Report[K]) => setR(x => x && ({ ...x, deficiencyAutomationEnabled:k==='reportingForDuty'?true:x.deficiencyAutomationEnabled, ratingsReviewedAt: undefined, [k]: v }));
  const applyShiftDate = (value: string) => {
    const parsed = parseDateDMY(value);
    if (!parsed) return;
    if (isNew && ws.caseFolder) {
      const schedule = getPhaseScheduleInfo(ws.caseFolder.phase, parsed, ws.caseFolder.phaseStartDate, ws.caseFolder.daysOff,ws.caseFolder.phaseWeekRanges,ws.caseFolder.limboExtensionWeeks);
      setR(current => current && ({
        ...current,
        date: parsed,
        phaseWeek: schedule.phaseWeek,
        limboDay: schedule.limboDay,
        ratings: !!current.limboDay !== schedule.limboDay
          ? (schedule.limboDay ? emptyRatings() : defaultRatings())
          : current.ratings,
        ratingsReviewedAt: undefined,
      }));
    } else {
      set('date', parsed);
    }
  };
  const setRating = (c: typeof CATEGORIES[number], patch: Partial<Report['ratings'][typeof c]>) => {
    if(r?.notApplicableCategories?.includes(c)&&!deficiencyEditor.groups.some(group=>group.category===c)&&patch.rating) {
      toast({title:'Category is not applicable',description:'The current shift record marks this category as not applicable.',variant:'destructive'});
      return;
    }
    if(patch.rating&&r?.deficiencySafetyLocks?.includes(c)&&patch.rating!=='UA') {
      toast({title:'Officer Safety UA is locked for this day',description:'This rating cannot be cleared or changed on the current daily report.',variant:'destructive'});
      return;
    }
    if(patch.rating && !['UA','NRT'].includes(patch.rating) && deficiencyEditor.groups.some(group=>group.category===c)) {
      toast({title:'Checklist deficiency requires UA',description:'Resolve or reroute the source deficiency before selecting a different rating.',variant:'destructive'});
      return;
    }
    setR(x => x && ({ ...x, ratingsReviewedAt: undefined, ratings: { ...x.ratings, [c]: { ...x.ratings[c], ...patch } } }));
  };
  const updateDutyGroup = (section:string,notApplicable:boolean) => {
    if(!r)return;
    const group=DAILY_DUTY_CHECKLIST.find(item=>item.section===section);
    const checklist={...(r.reportingForDuty?.checklist??{})};
    group?.items.forEach(item=>{if(notApplicable)checklist[item.key]=false;});
    set('reportingForDuty',{...(r.reportingForDuty??emptyReportingForDutyRecord()),checklist,notApplicable:{...(r.reportingForDuty?.notApplicable??{}),[section]:notApplicable},reviewedAt:undefined});
  };
  const setShotgunTraining=(value:'Y'|'N')=>{
    setR(current=>{
      if(!current)return current;
      const categories=new Set(current.notApplicableCategories??[]);
      if(value==='N')categories.add('resourceEquipmentUsage');
      else categories.delete('resourceEquipmentUsage');
      const hasEquipmentDeficiency=current.checklistDeficiencies?.some(group=>group.category==='resourceEquipmentUsage')===true;
      const ratings={...current.ratings,resourceEquipmentUsage:{
        ...current.ratings.resourceEquipmentUsage,
        ...(!hasEquipmentDeficiency?{rating:'' as Rating,justification:''}:{}),
      }};
      return {
        ...current,
        ratingsReviewedAt:undefined,
        ratings,
        notApplicableCategories:[...categories],
        reportingForDuty:{...current.reportingForDuty,shotgunTraining:value,reviewedAt:undefined},
      };
    });
  };
  const clearDutyGroup = (section:string) => {
    if(!r)return;
    const group=DAILY_DUTY_CHECKLIST.find(item=>item.section===section);
    const checklist={...(r.reportingForDuty?.checklist??{})};
    group?.items.forEach(item=>{checklist[item.key]=false;});
    set('reportingForDuty',{...(r.reportingForDuty??emptyReportingForDutyRecord()),checklist,notApplicable:{...(r.reportingForDuty?.notApplicable??{}),[section]:false},reviewedAt:undefined});
  };
  const updateDirectiveReview=(form:DirectiveReviewForm,field:DirectiveReviewField,value:boolean|string|string[])=>{
    setDirectiveReviews(current=>({...current,[form]:{...defaultDirectiveReviewRecord(),...(current[form]??{}),[field]:value}}));
  };
  const setDirectiveReviewFlags=(form:DirectiveReviewForm,checked:boolean)=>{
    for(const field of ['divisionDirectives','ohioRevisedCode','columbusCityCode','other'] as const)updateDirectiveReview(form,field,checked);
    if(!checked)updateDirectiveReview(form,'selectedDirectives',[]);
  };
  const dutyItems:{key:string;label:string}[]=DAILY_DUTY_CHECKLIST.reduce((items,group)=>{items.push(...group.items);return items;},[] as {key:string;label:string}[]);
  const dutyAllChecked=dutyItems.length>0&&dutyItems.every(item=>dutyChecklistChecked(r?.reportingForDuty?.checklist,item.key));
  const toggleDutyChecklist=()=>{
    if(!r)return;
    const select=!dutyAllChecked;
    set('reportingForDuty',{
      ...(r.reportingForDuty??emptyReportingForDutyRecord()),
      checklist:Object.fromEntries(dutyItems.map(item=>[item.key,select])),
      notApplicable:Object.fromEntries(DAILY_DUTY_CHECKLIST.map(group=>[group.section,false])),
      reviewedAt:undefined,
    });
  };
  const recompute = (overrides: Partial<typeof runMeta> = {}) => {
    const meta = { ...runMeta, ...overrides };
    meta.transportedAfterArrest = meta.arrestMade && meta.transportedAfterArrest;
    setRunChecklist(prev => checklistForMetadata(meta, prev));
  };
  const setArrestState = (value:boolean) => {
    setArrestMade(value);
    const nextTransported=value;
    if(value){setTransported(true);setClearanceCode('3V');}
    if(!value){
      setTransported(false);setTransportDestination('');setTransportDestinationType(undefined);
      setArrestSeverity('');setArrestType('');
      if(clearanceCode==='3V')setClearanceCode('');
    }
    recompute({arrestMade:value,transportedAfterArrest:nextTransported});
    
  };
  const setTransportState=(value:boolean)=>{
    setTransported(value);
    if(!value){
      setTransportDestination('');
      setTransportDestinationType(undefined);
      if(arrestMade&&clearanceCode!=='1V')setClearanceCode('1V');
    }
    recompute({transportedAfterArrest:value});
    
  };
  const openFailurePrompt=(target:ChecklistActionTarget,mode:'clear'|'edit')=>{
    const choices=runFailureActionChoices(target.form,target.key,target.label);
    if(!choices)return;
    setFailurePromptQueue([]);
    setFailurePrompt({ ...target, choices, mode });
    setFailurePromptSelection([...(runChecklistFailures[target.key]??[])]);
  };
  const closeFailurePrompt=()=>{
    const next=failurePromptQueue[0];
    setFailurePromptQueue(current=>current.slice(1));
    if(next){
      setFailurePrompt(next);
      setFailurePromptSelection([...(runChecklistFailures[next.key]??[])]);
    }else{
      setFailurePrompt(null);
      setFailurePromptSelection([]);
    }
  };
  const cancelFailurePrompt=()=>{
    // Clearing is staged until confirmation, so cancel leaves the checkbox and its
    // saved details untouched. Bulk clears continue to the next combined item.
    closeFailurePrompt();
  };
  const confirmFailurePrompt=()=>{
    if(!failurePrompt||!failurePromptSelection.length)return;
    setRunChecklist(current=>({...current,[failurePrompt.key]:false}));
    setRunChecklistFailures(current=>({...current,[failurePrompt.key]:[...failurePromptSelection]}));
    setRunError('');
    closeFailurePrompt();
  };
  const changeRunChecklistItem=(target:ChecklistActionTarget,checked:boolean)=>{
    if(checked){
      setRunChecklist(current=>({...current,[target.key]:true}));
      setRunChecklistFailures(current=>{
        if(!(target.key in current))return current;
        const next={...current};delete next[target.key];return next;
      });
      setRunError('');
      return;
    }
    const choices=runFailureActionChoices(target.form,target.key,target.label);
    if(choices){
      openFailurePrompt(target,'clear');
      return;
    }
    setRunChecklist(current=>({...current,[target.key]:false}));
    setRunChecklistFailures(current=>{
      if(!(target.key in current))return current;
      const next={...current};delete next[target.key];return next;
    });
    setRunError('');
  };
  const clearChecklistItems=(targets:ChecklistActionTarget[],notApplicableKey:string)=>{
    setRunChecklistNA(current=>{
      if(!targets.some(target=>target.key in current))return current;
      const next={...current};targets.forEach(target=>{delete next[target.key];});return next;
    });
    const changed=targets.filter(target=>runChecklist[target.key]!==false);
    const updates:Record<string,boolean>={[notApplicableKey]:false};
    const queued:FailurePromptTarget[]=[];
    for(const target of changed){
      const choices=runFailureActionChoices(target.form,target.key,target.label);
      if(choices){
        // Keep combined items checked until their individual failure is confirmed.
        updates[target.key]=true;
        queued.push({...target,choices,mode:'clear'});
      }else updates[target.key]=false;
    }
    setRunChecklist(current=>({...current,...updates}));
    setRunChecklistFailures(current=>{
      const next={...current};
      changed.forEach(target=>{delete next[target.key];});
      return next;
    });
    setFailurePromptQueue(queued.slice(1));
    if(queued[0]){
      setFailurePrompt(queued[0]);
      setFailurePromptSelection([]);
    }else{
      setFailurePrompt(null);
      setFailurePromptSelection([]);
    }
    setRunError('');
  };
  const selectChecklistItems=(targets:ChecklistActionTarget[],notApplicableKey:string)=>{
    setRunChecklistNA(current=>{
      if(!targets.some(target=>target.key in current))return current;
      const next={...current};targets.forEach(target=>{delete next[target.key];});return next;
    });
    setRunFailureEdits(current=>{
      if(!targets.some(target=>target.key in current))return current;
      const next={...current};targets.forEach(target=>{delete next[target.key];});return next;
    });
    setRunChecklist(current=>({...current,[notApplicableKey]:false,...Object.fromEntries(targets.map(target=>[target.key,true]))}));
    setRunChecklistFailures(current=>{
      const next={...current};
      targets.forEach(target=>{delete next[target.key];});
      return next;
    });
    setRunError('');
  };
  /** The clicked row, or every row of a section when the whole section is unchecked. */
  const checklistRowFor=(sections:readonly RevisedChecklistSection[],indices:readonly number[]):RevisedChecklistRow|undefined=>{
    const rows=sections.flatMap(section=>section.items);
    const exact=rows.find(item=>item.indices===indices);
    if(exact)return exact;
    const included=rows.filter(item=>item.indices.every(index=>indices.includes(index)));
    if(!included.length)return undefined;
    const label=included.map(item=>item.label).join(' / ');
    return {id:included.map(item=>item.id).join('+'),label,help:label,indices:included.flatMap(item=>item.indices),units:included.flatMap(item=>item.units),unitLabels:included.flatMap(item=>item.unitLabels),unitSentences:included.flatMap(item=>item.unitSentences)};
  };
  const openUncheckedPrompt=(form:RunChecklistSourceForm,prefix:string,naKey:string,row:RevisedChecklistRow|undefined,labels:readonly string[])=>{
    if(!row)return;
    const items=row.units.map((unit,position)=>({key:`${prefix}${unit[0]}`,keys:unit.map(index=>`${prefix}${index}`),label:row.unitLabels[position]??labels[unit[0]!]??''}));
    const itemLabels=Object.fromEntries(row.indices.map(index=>[`${prefix}${index}`,labels[index]??`Checklist item ${index+1}`]));
    setUncheckedChoices(Object.fromEntries(items.map(item=>{
      const unchecked=item.keys.filter(key=>runChecklist[key]===false);
      return [item.key,unchecked.length===0?undefined:unchecked.every(key=>runChecklistNA[key])?'na':'fail'];
    })));
    setUncheckedPrompt({form,naKey,rowLabel:row.label,items,itemLabels});
  };
  const confirmUncheckedPrompt=()=>{
    if(!uncheckedPrompt)return;
    const {form,naKey,items,itemLabels}=uncheckedPrompt;
    const targetsFor=(choice:UncheckedChoice|undefined)=>items.filter(item=>uncheckedChoices[item.key]===choice).flatMap(item=>item.keys.map(key=>({form,key,label:itemLabels[key]??''})));
    const failed=targetsFor('fail');
    const notApplicable=targetsFor('na');
    const satisfied=targetsFor(undefined);
    setUncheckedPrompt(null);
    if(satisfied.length)selectChecklistItems(satisfied,naKey);
    if(notApplicable.length){
      setRunChecklist(current=>({...current,[naKey]:false,...Object.fromEntries(notApplicable.map(item=>[item.key,false]))}));
      setRunChecklistNA(current=>({...current,...Object.fromEntries(notApplicable.map(item=>[item.key,true as const]))}));
      setRunChecklistFailures(current=>{const next={...current};notApplicable.forEach(item=>{delete next[item.key];});return next;});
      setRunFailureEdits(current=>{const next={...current};notApplicable.forEach(item=>{delete next[item.key];});return next;});
    }
    if(failed.length)clearChecklistItems(failed,naKey);
  };
  const failureStatements=runFailureStatements(workflowDraft as Parameters<typeof runFailureStatements>[0]);
  const statementCategory=(key:string)=>{
    const supplement=/^supp-(.+)-\d+$/.exec(key)?.[1];
    const category=SEG_TASK_DIRECTORY[`${supplement??runKind}:${key}`];
    return category?CATEGORY_LABEL[category]:undefined;
  };
  const renderChecklistFailureDetails=(form:RunChecklistSourceForm,prefix:string,indices:readonly number[],labels:readonly string[])=>(
    <div className="ml-6 space-y-1">
      {indices.map(index=>{
        const key=`${prefix}${index}`;
        const label=labels[index]??`Checklist item ${index+1}`;
        const actions=runChecklistFailures[key]??[];
        const choices=runFailureActionChoices(form,key,label);
        if(!actions.length&&!(choices&&runChecklist[key]===false))return null;
        const target={form,key,label};
        return <div key={index} className="text-xs text-muted-foreground">
          {actions.map((action,actionIndex)=><span key={`${index}-${actionIndex}`} className="block">Not completed: <strong className="font-bold text-destructive">{action}</strong></span>)}
          {choices&&runChecklist[key]===false&&<button type="button" onClick={()=>openFailurePrompt(target,'edit')} className="min-h-8 text-left font-semibold text-primary underline" data-testid={`button-edit-checklist-failure-${prefix.replaceAll('-','')}-${index}`}>{actions.length?'Edit specific actions':'Add specific actions'}</button>}
        </div>;
      })}
    </div>
  );

  const addRun = () => {
    if (!r || !editable) return;
    const previous = editingRunId ? r.runs.find(item => item.id === editingRunId) : undefined;
    const localRunDateTime = parseRunDateTime(runDateTimeText);
    if (!localRunDateTime) {
      setRunError('Enter a valid run date and time together as MM/DD/YYYY HH:MM in 24-hour time.');
      setRunStep('details');
      return;
    }
    if (!isValidRadioCode(dispatchedCode) || !isValidSituationFoundCode(situationFoundCode)) {
      setRunError('Enter the code number and optional letters, such as 6 or 17A. The 10- prefix is supplied.');
      setRunStep('details');
      return;
    }
    const activityError=runActivityValidationError({
      runKind,dispatchedCode,clearanceCode,activityFlags,arrestMade,
      clearanceRulesVersion:editingRunId?r.runs.find(run=>run.id===editingRunId)?.clearanceRulesVersion:1,
      arrestClassificationVersion:previous?.arrestClassificationVersion??1,
      arrestSeverity,arrestType,
      transportedAfterArrest:arrestMade&&transported,
      transportDestination,
      transportDestinationType,
    });
    if(activityError){setRunError(activityError);setRunStep('details');return;}
    const pending = runChecklistSteps.filter(step => !sheetReviewed(step.id as RunSheetKey));
    if (pending.length) {
      setRunError(`Confirm the review at the bottom of: ${pending.map(step => step.title).join(', ')}.`);
      setRunStep(pending[0].id);
      return;
    }
    const dispatchedAtIso = runDispatchedAtText.trim() ? parseRunDateTime(runDispatchedAtText.trim()) : undefined;
    const clearedAtIso = runClearedAtText.trim() ? parseRunDateTime(runClearedAtText.trim()) : undefined;
    if ((runDispatchedAtText.trim() && !dispatchedAtIso) || (runClearedAtText.trim() && !clearedAtIso)) {
      setRunError('Dispatched and cleared times must be MM/DD/YYYY HH:MM in 24-hour time, or left blank.');
      setRunStep('details');
      return;
    }
    if(dispatchedAtIso&&clearedAtIso&&Date.parse(clearedAtIso)<Date.parse(dispatchedAtIso)){
      setRunError('Cleared time cannot be earlier than dispatched time. Correct the dates for an overnight run.');
      setRunStep('details');
      return;
    }
    setRunError('');
    // Inactive directive reviews are kept so a deselected sheet restores intact.
    const directiveReviewsToSave={...directiveReviews};
    const nextRun: TrainingRun = {
      clearanceRulesVersion: previous ? previous.clearanceRulesVersion : 1,
      arrestClassificationVersion: previous?.arrestClassificationVersion ?? 1,
      ...(isArrestSeverity(arrestSeverity) ? { arrestSeverity } : {}),
      ...(isArrestType(arrestType) ? { arrestType } : {}),
      ...(previous?.charges ? { charges: structuredClone(previous.charges) } : {}),
      id: previous?.id ?? runDraftId,
      ...serializeDispatchPrefillFields({
        runDateTimeText, runTimeText, incidentNumber, runLocation,
        runLocationCity, runLocationState, runLocationZip, runZone,
        runCruiserDistrict, clearanceCode, dispatchedCode,
      }),
      unitNumber: runUnitNumber.trim() || undefined,
      dispatchedAt: dispatchedAtIso,
      endedAt: clearedAtIso ?? (runClearedAtText.trim() ? previous?.endedAt : undefined),
      transportDestination:arrestMade&&transported?transportDestination.trim():undefined,
      transportDestinationType:arrestMade&&transported?transportDestinationType:undefined,
      occurredAt: localRunDateTime,
      runKind, isDispatched: runDispatched, trafficMode, arrestMade,
      activityFlags:{...activityFlags}, situationFoundCode,
      transportedAfterArrest: arrestMade && transported, arrestProcessRequired, buildingSearchRequired, oviProcessRequired, oviProcessed, narrativeAdditionRequired,
      formStatus: !!runNarrative.trim() ? 'complete' : 'in_progress',
      checklist: { ...runChecklist }, directiveReviews:directiveReviewsToSave, checklistReviewedAt:new Date().toISOString(), narrative: runNarrative,
    };
    // Keep detached-sheet details in the open editor for reattachment, but only
    // persist failures belonging to the run's active, applicable unchecked items.
    const activeFailures = Object.fromEntries(runChecklistFailureSummaries({
      ...nextRun, checklistFailures: runChecklistFailures,
    }).filter(item => item.failureActions.length).map(item => [item.key, [...item.failureActions]]));
    if (Object.keys(activeFailures).length) nextRun.checklistFailures = activeFailures;
    const savedNotApplicable=activeNotApplicable({checklist:nextRun.checklist,checklistNotApplicable:runChecklistNA});
    if(savedNotApplicable)nextRun.checklistNotApplicable=savedNotApplicable;
    const savedStatements=activeFailureStatementEdits({...nextRun,checklistNotApplicable:savedNotApplicable,failureStatements:runFailureEdits});
    if(savedStatements)nextRun.failureStatements=savedStatements;
    nextRun.generatedDocuments=buildClearanceDocuments(nextRun);
    setR(current=>current && ({...current,ratingsReviewedAt:undefined,runs: previous ? current.runs.map(item => item.id === previous.id ? nextRun : item) : [...current.runs, nextRun]}));
    resetRunForm();
    toast({title: previous ? 'Run updated in the daily log' : 'Run added to the daily log', description: previewOnly ? 'Preview only: kept in memory until refresh. Save draft to keep it in this session.' : 'The daily log itself is not saved yet. Use Save draft to record it in the workspace.'});
  };
  const draftNarrative = () => {
    if (!allSheetsReviewed) return;
    if (runNarrative.trim() && runNarrative !== generatedNarrativeRef.current) {
      toast({title:'Your narrative was kept',description:'An outline is only drafted into an empty or unedited narrative.'});
      return;
    }
    const draft = buildRunNarrativeDraft(runKind, runChecklist, requiredSupplements);
    generatedNarrativeRef.current = draft;
    setRunNarrative(draft);
    // Narrative Addition review depends on the narrative text: re-confirm it, never auto-confirm.
  };
  const resetRunForm = () => {
    setRiskPrompt(false);setRiskCodeDirty(false);setRiskCandidate('');
    setRunOptionsOpen(false);
    setRunOpen(false);
    deficiencyEditor.resetIncident();
    const pendingId=editingRunId??runDraftId;
    setR(current=>{
      if(!current||current.runs.some(run=>run.id===pendingId))return current;
      return {...current,
        deficiencyNarratives:Object.fromEntries(Object.entries(current.deficiencyNarratives??{}).filter(([key])=>!key.startsWith(`${pendingId}:`))),
        deficiencyOverrides:Object.fromEntries(Object.entries(current.deficiencyOverrides??{}).filter(([key])=>!key.includes(`:run:${pendingId}:`))),
      };
    });
    setRunDraftId(uid());
    setArrestSeverity('');setArrestType('');
    setEditingRunId(null); setRunKind('call_for_service'); setRunDateTimeText(dateText); setRunTimeText(''); setRunDispatched(true); setRunError('');
    setRunStep('details'); setSheetReviews({}); setLegacyReviewSheets(null); setRunUnitNumber(''); setRunDispatchedAtText(''); setRunClearedAtText('');
    setIncidentNumber(''); setRunLocation(''); setRunLocationCity(''); setRunLocationState(''); setRunLocationZip(''); setRunZone(''); setRunCruiserDistrict(''); generatedNarrativeRef.current = '';
    setTrafficMode('none'); setArrestMade(false); setTransported(false); setTransportDestination(''); setTransportDestinationType(undefined); setArrestProcessRequired(false); setBuildingSearchRequired(false); setOviProcessRequired(false); setOviProcessed(false); setNarrativeAdditionRequired(false);
    setActivityFlags({}); setDispatchedCode(''); setSituationFoundCode(''); setClearanceCode('');
    setRunNarrative('');
    setRunChecklist(newRunChecklist('call_for_service'));
    setRunChecklistFailures({});
    setRunChecklistNA({});
    setRunFailureEdits({});
    setUncheckedPrompt(null);
    setFailurePrompt(null);
    setFailurePromptQueue([]);
    setFailurePromptSelection([]);
    setDirectiveReviews({});
  };
  const editRun = (run: TrainingRun) => {
    setRiskPrompt(false);setRiskCodeDirty(false);setRiskCandidate('');
    setRunOpen(true);
    deficiencyEditor.resetIncident();
    setArrestSeverity(run.arrestSeverity??'');setArrestType(run.arrestType??'');
    setEditingRunId(run.id); setRunKind(run.runKind);
    setRunStep('details'); setRunError('');
    setRunUnitNumber(run.unitNumber ?? ''); setRunDispatchedAtText(run.dispatchedAt ? formatDateTimeMDY(run.dispatchedAt) : ''); setRunClearedAtText(run.endedAt ? formatDateTimeMDY(run.endedAt) : '');
    const dispatchFields=restoreDispatchPrefillFields(run);
    setIncidentNumber(dispatchFields.incidentNumber); setRunLocation(dispatchFields.runLocation);
    setRunLocationCity(dispatchFields.runLocationCity);setRunLocationState(dispatchFields.runLocationState);setRunLocationZip(dispatchFields.runLocationZip);
    setRunZone(dispatchFields.runZone);setRunCruiserDistrict(dispatchFields.runCruiserDistrict);generatedNarrativeRef.current = '';
    const occurredAt = new Date(run.occurredAt);
    const localDateTime = new Date(occurredAt.getTime() - occurredAt.getTimezoneOffset() * 60000).toISOString();
    const localRunDateTime=`${formatDateDMY(localDateTime.slice(0,10))} ${localDateTime.slice(11,16)}`;
    setRunDateTimeText(localRunDateTime); setRunTimeText(splitDateTimeEntryMDY(localRunDateTime).time); setRunDispatched(run.isDispatched);
    setTrafficMode(run.trafficMode); setArrestMade(run.arrestMade);
    setActivityFlags(run.activityFlags ?? {}); setDispatchedCode(dispatchFields.dispatchedCode);
    setSituationFoundCode(run.situationFoundCode ?? ''); setClearanceCode(dispatchFields.clearanceCode);
    setTransported(run.transportedAfterArrest); setTransportDestination(run.transportDestination??''); setTransportDestinationType(run.transportDestinationType); setArrestProcessRequired(!!run.arrestProcessRequired); setBuildingSearchRequired(!!run.buildingSearchRequired); setOviProcessRequired(!!run.oviProcessRequired); setOviProcessed(run.oviProcessed);
    setNarrativeAdditionRequired(run.narrativeAdditionRequired);
    setDirectiveReviews(run.directiveReviews??{});
    setRunNarrative(run.narrative); setRunChecklist(run.checklist ?? {});setRunChecklistFailures(run.checklistFailures??{});setRunChecklistNA(run.checklistNotApplicable??{});setRunFailureEdits(run.failureStatements??{});
    setSheetReviews({});
    setLegacyReviewSheets(run.checklistReviewedAt ? ['primary' as RunSheetKey, ...requiredSupplementalForms(run)] : null);
    setStage('runs');
  };
  const requestEditRun = (run: TrainingRun) => {
    if (runFormDirty && editingRunId !== run.id) {
      setConfirmAction({title:'Replace the open run draft?',body:'The run currently open has unsaved entries. Opening another run discards them. Add the open run to the daily log first to keep it.',label:'Discard and open',action:()=>editRun(run)});
      return;
    }
    editRun(run);
  };
  const startNewRun = (seed: NewRunSeed) => {
    resetRunForm();
    const kind = seed.runKind;
    const dispatched = kind==='call_for_service'?true:kind==='self_initiated'?false:true;
    const mode: TrainingRun['trafficMode'] = 'none';
    setRunKind(kind); setRunDispatched(dispatched); setTrafficMode(mode);
    const importedArrest=seed.clearanceCode==='3V';
    setRunChecklist(checklistForMetadata({ runKind:kind, trafficMode:mode, isDispatched:dispatched, arrestMade:importedArrest, transportedAfterArrest:importedArrest, arrestProcessRequired:importedArrest, buildingSearchRequired:false, oviProcessed:false, oviProcessRequired:false, narrativeAdditionRequired:false }, {}));
    setIncidentNumber(seed.incidentNumber); setRunLocation(seed.location); setRunLocationCity(seed.locationCity); setRunLocationState(seed.locationState); setRunLocationZip(seed.locationZip);
    setRunZone(seed.zone); setRunCruiserDistrict(seed.cruiserDistrict); setRunUnitNumber(seed.unitNumber);
    setDispatchedCode(normalizeRadioCode(seed.dispatchedCode)||(DEFAULT_RUN_TYPE_CODES[kind]??''));
    setSituationFoundCode(normalizeSituationFoundCode(seed.situationFoundCode));
    setClearanceCode(seed.clearanceCode);
    setArrestMade(importedArrest);setTransported(importedArrest);setArrestProcessRequired(importedArrest);
    const occurred = splitDateTimeEntryMDY(seed.occurredAtText);
    if (occurred.date) { setRunDateTimeText(seed.occurredAtText); setRunTimeText(occurred.time); }
    setRunDispatchedAtText(seed.dispatchedAtText); setRunClearedAtText(seed.clearedAtText);
    setNewRunOpen(false); setStage('runs'); setRunStep(kind==='traffic_stop'||kind==='high_risk_stop'?'primary':'details');
    setRunOpen(true);
    setRunOptionsOpen(kind==='traffic_stop'||kind==='high_risk_stop');
  };
  const requestNewRun = () => {
    if (runFormDirty) {
      setConfirmAction({title:'Discard the open run draft?',body:'The run currently open has unsaved entries. Starting a new run clears them. Add the open run to the daily log first to keep it.',label:'Discard and start new',action:()=>setNewRunOpen(true)});
      return;
    }
    setNewRunOpen(true);
  };
  const applyRunKind = (next: PrimaryRunForm) => {
    const dispatched=next==='call_for_service'?true:next==='self_initiated'?false:runDispatched;
    const stopSwitch=(runKind==='traffic_stop'||runKind==='high_risk_stop')&&(next==='traffic_stop'||next==='high_risk_stop');
    const mode:TrainingRun['trafficMode']=stopSwitch?trafficMode:next==='traffic_stop'?'motor_vehicle':'none';
    const previousKind = runKind;
    setRunKind(next);setRunDispatched(dispatched);setTrafficMode(mode);
    setRunOptionsOpen(next==='traffic_stop'||next==='high_risk_stop');
    setDispatchedCode(current=>current||DEFAULT_RUN_TYPE_CODES[next]||'');
    // Primary task indices mean different things per form: reset them; keep supplement answers.
    setRunChecklist(prev=>resetPrimaryChecklist({...runMeta,runKind:next,trafficMode:mode,isDispatched:dispatched},prev));
    setRunChecklistFailures(current=>Object.fromEntries(Object.entries(current).filter(([key])=>!/^task-\d+$/.test(key))));
    setDirectiveReviews(current=>{const copy={...current};delete copy[previousKind];return copy;});
    setSheetReviews(current=>{const copy={...current};delete copy.primary;return copy;});
    setRunError('');
  };
  const requestRunKind = (next: PrimaryRunForm,openPrimary=false) => {
    if (next===runKind) {if(openPrimary)setRunStep('primary');return;}
    const apply=()=>{applyRunKind(next);if(openPrimary)setRunStep('primary');};
    if (sheetHasEdits('primary',runKind,runChecklist,directiveReviews as Record<string,unknown>) || sheetReviews.primary) {
      setConfirmAction({title:`Change the primary form to ${PRIMARY_RUN_FORMS.find(form=>form.key===next)?.label}?`,body:'The current primary checklist answers and its directive review apply to a different form and will be reset. Attached forms keep their answers.',label:'Change and reset primary sheet',action:apply});
      return;
    }
    apply();
  };
  const askStopRisk=(next:PrimaryRunForm=runKind)=>{setRiskCandidate(next);setRiskPrompt(true);};
  const quickAddLock = (form: SupplementalRunForm): string|undefined => {
    if (form==='building_search'&&runKind==='building_search') return 'Primary form is already Building Search';
    if (form==='arrest_process'&&arrestMade) return 'Required because an arrest is recorded';
    if (form==='ovi_process'&&oviProcessed) return 'Required because OVI processing is recorded';
    return undefined;
  };
  const setQuickAddFlag = (form: SupplementalRunForm, value: boolean) => {
    if (form==='building_search') { setBuildingSearchRequired(value); recompute({buildingSearchRequired:value}); }
    if (form==='arrest_process') { setArrestProcessRequired(value); recompute({arrestProcessRequired:value}); }
    if (form==='ovi_process') { setOviProcessRequired(value); recompute({oviProcessRequired:value}); }
    if (form==='narrative_addition') { setNarrativeAdditionRequired(value); recompute({narrativeAdditionRequired:value}); }
    if (!value) setSheetReviews(current=>{const copy={...current};delete copy[form];return copy;});
    setRunError('');
  };
  const toggleQuickAdd = (form: SupplementalRunForm, value: boolean) => {
    if (!value && (sheetHasEdits(form,runKind,runChecklist,directiveReviews as Record<string,unknown>) || sheetReviews[form])) {
      const label = QUICK_ADD.find(item=>item.form===form)?.label;
      setConfirmAction({title:`Detach ${label}?`,body:'This sheet has entries or a review. Its answers are kept with the run and come back if you attach it again, but it will not be part of the saved packet while detached.',label:'Detach form',action:()=>setQuickAddFlag(form,false)});
      return;
    }
    setQuickAddFlag(form, value);
  };
  const setSheetReview = (sheet: RunSheetKey, checked: boolean) => {
    setSheetReviews(current=>{const copy={...current};if(checked)copy[sheet]=runSheetReviewSnapshot(workflowDraft,sheet);else delete copy[sheet];return copy;});
    setRunError('');
  };
  const goStep = (delta: number) => {
    const next = runSteps[stepIndex+delta];
    if (next) { setRunStep(next.id); setRunError(''); window.scrollTo({top:0,behavior:'smooth'}); }
  };
  const sheetReviewFooter = (sheet: RunSheetKey) => {
    const reviewed = sheetReviewed(sheet);
    const stale = sheetReviews[sheet]!==undefined && !reviewed;
    return <div className={cn('run-sheet-review', reviewed && 'is-reviewed')} data-testid={`section-sheet-review-${sheet}`}>
      <label className="flex items-start gap-2 text-sm leading-5">
        <input type="checkbox" disabled={!editable} checked={reviewed} onChange={event=>setSheetReview(sheet,event.target.checked)} data-testid={`checkbox-sheet-review-${sheet}`}/>
        <span><b>I reviewed every item on this sheet</b> and cleared exceptions, non-applicable items, and items performed by the FTO.{sheet==='narrative_addition'?' This includes the run narrative continued on these pages.':''}</span>
      </label>
      {stale&&<p className="mt-1 text-xs font-semibold text-warn">Changed since the last review. Confirm again.</p>}
      <div className="mt-2"><SheetStatus state={reviewed?'reviewed':'needs_review'} unsaved={runFormDirty} testId={`status-sheet-review-${sheet}`}/></div>
    </div>;
  };
  const selectedForm = PRIMARY_RUN_FORMS.find(item => item.key === runKind)!;
  function save(reviewed = false,nextWorkingDay = false): boolean {
    if (!r) return false;
    if(reviewed&&errs.length){setShowErr(true);setStage(stageForError(errs[0]));return false;}
    if (!parsedDate || selectedDayOff) { setShowErr(true); setStage('shift'); return false; }
    if (runFormDirty) { setStage('runs'); toast({title:'Add or discard the open run first',description:'The open run is held on this screen only and is not yet part of this daily log. It is shown now.',variant:'destructive'}); return false; }
    const next = { ...r, date: parsedDate, ratingsReviewedAt: reviewed ? new Date().toISOString() : r.ratingsReviewedAt, updatedAt: new Date().toISOString() };
    upsertReport(next); setR(next);
    toast({
      title: 'Draft updated in workspace',
      description: previewOnly
        ? 'This temporary test draft remains in memory and clears when the preview refreshes.'
        : 'Use "Save locally" to encrypt it on this device.',
    });
    if (nextWorkingDay) nav('/reports/new');
    else if (isNew) nav('/reports/' + next.id, { replace: true });
    return true;
  }
  const openNrtFollowUp = (category:Category) => {
    if (!parsedDate || selectedDayOff) { setShowErr(true); return; }
    if (runFormDirty) { setStage('runs'); toast({title:'Save the open run first',description:'Finish or cancel the run form before opening NRT follow-up.',variant:'destructive'}); return; }
    const next={...r,date:parsedDate,updatedAt:new Date().toISOString()};
    upsertReport(next); setR(next);
    nav(`/reports/${next.id}/nrt-follow-up?category=${encodeURIComponent(category)}`);
  };
  const inp = 'h-10 w-full rounded border bg-card px-3 text-sm disabled:opacity-70';
  const radioCodePrefix='inline-flex h-10 w-12 shrink-0 items-center justify-center whitespace-nowrap rounded-l border border-r-0 bg-muted px-3 text-base font-bold leading-none';
  const radioCodeInput='h-10 min-w-0 flex-1 rounded-r border bg-card px-3 font-mono text-base uppercase disabled:opacity-70';
  const week = getSundaySaturdayWeek(r.date);
  const orientationForReport=operationalPacket?.orientation;
  const orientationHref=savedOrientationHref(ws.role,orientationForReport);
  const trainingDayReference=operationalPacket?.dayReference;
  const runDerivedActivity=runDerivedActivityCounts(r?.runs??[]);
  const trafficSolveSuggestion=runKind==='traffic_stop'&&dispatchedCode==='6'&&citationSummonsRecorded;
  const totalActivity=activityTotals(r??{activity:emptyDailyActivitySummary()});
  const activityMismatchFields=activityDiscrepancies(totalActivity,runDerivedActivity)
    .filter(key=>runDerivedActivity[key]>0||totalActivity[key]>0)
    .map(key=>DAILY_ACTIVITY_FIELDS.find(field=>field.key===key)!)
    .filter(Boolean);

  return (
    <div className="report-editor-page max-w-5xl" data-auth-recovery-form={`report:${r.id}`}>
      <DeficiencyDialog group={deficiencyEditor.active} onNarrative={deficiencyEditor.setNarrative} onOverride={deficiencyEditor.override} onClose={deficiencyEditor.close}/>
      <Link href="/reports" className="text-sm font-semibold inline-flex items-center gap-1 mb-2 hover:underline" data-testid="link-back"><ArrowLeft className="h-4 w-4" />Saved records</Link>
      <PageHead kicker="Shift workspace · Daily Performance Summary · U-10.174" title={r.recruitName ? `PO ${r.recruitName} #${r.recruitBadge}` : 'Probationary Officer shift'} titleIsData>
        <StatusPill s={r.status} />
        <span className="inline-flex h-10 shrink-0 items-stretch overflow-hidden rounded border bg-card" role="group" aria-label="Export">
          <select value={exportFormat} onChange={event=>setExportFormat(event.target.value==='xlsx'?'xlsx':'pdf')} aria-label="Export format" title="Choose the export file" className="w-36 border-r bg-card px-2 text-sm font-semibold" data-testid="select-daily-export-format">
            <option value="pdf">PDF · all forms</option>
            <option value="xlsx">Excel row</option>
          </select>
          <button type="button" data-testid="button-print-daily-log" onClick={() => {
            if (exportFormat==='xlsx') { const filename=exportDailyRow(r); toast({title:'Excel row exported',description:filename}); return; }
            if(operationalPacket?.blockingIssues.length){toast({title:'Complete the phase-start packet',description:operationalPacket.blockingIssues.join(' '),variant:'destructive'});return;}
            window.print();
          }} className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-sm font-bold">{exportFormat==='xlsx'?<FileSpreadsheet className="h-4 w-4" />:<Printer className="h-4 w-4" />}Export</button>
        </span>
        {orientationHref&&<Link href={orientationHref} data-testid="link-saved-orientation" className="inline-flex h-10 items-center rounded border bg-card px-3 text-sm font-bold">Substation Orientation</Link>}
        {(editable || commentsEditable) && <button data-testid="button-save-draft" onClick={()=>save()} className="h-10 px-4 rounded bg-primary text-primary-foreground font-bold text-sm active:scale-[.98] transition">{commentsEditable ? 'Save comments' : 'Save draft'}{isDirty && ' *'}</button>}
        {editable && <button data-testid="button-save-next-workday" onClick={()=>save(false,true)} className="h-10 rounded border bg-card px-3 text-sm font-semibold">Save and next workday</button>}
        {editable && !isLimboDay && <button type="button" className="h-10 rounded border bg-card px-3 text-sm font-bold" onClick={()=>{setReviewConfirmed(false);setReviewOpen(true);}} data-testid="button-review-ratings">Review before submission</button>}
        {!isNew && r.status === 'draft' && ws.role === 'fto' && <button data-testid="button-delete" onClick={()=>setConfirmDel(true)} className="h-10 px-3 rounded border text-sm text-destructive inline-flex items-center gap-1.5 hover:bg-destructive/10"><Trash2 className="h-4 w-4" />Delete</button>}
      </PageHead>
      {r.substituteCoverage && <p className="mb-4 rounded border border-accent/40 bg-accent/10 p-3 text-sm" data-testid="text-substitute-coverage"><b>Substitute coverage:</b> FTO {r.ftoName} #{r.ftoBadge} for FTO {r.substituteCoverage.regularFtoName} #{r.substituteCoverage.regularFtoBadge} on {formatDateDMY(r.date)}. This log does not change the regular phase assignment.</p>}
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 rounded border bg-card p-3 text-xs" aria-label="Performance rating legend">
        {RATING_LEGEND.map(({code,label})=><span key={code}><b>{code}</b> · {label}</span>)}
      </div>
      <nav aria-label="Shift stages" className="editor-stage-nav sticky top-10 z-30 mb-4" data-testid="nav-shift-sections">
        {EDITOR_STAGES.map((item,index)=>{const count=showErr?errs.filter(e=>stageForError(e)===item.id).length:0;return <button key={item.id} type="button" onClick={()=>{setStage(item.id);window.history.replaceState(null,'',`#${item.hash}`);}} aria-current={stage===item.id?'page':undefined} className={cn('editor-stage',stage===item.id&&'is-active')} data-testid={`button-stage-${item.id}`}>
          <span className="editor-stage-index">{index+1}</span>{item.label}{item.id==='evaluation'&&isLimboDay?' · Limbo':''}{item.id==='runs'&&<span className="mono text-[0.7rem] opacity-75">{r.runs.length}{runFormDirty?' + draft':''}</span>}{count>0&&<span className="editor-stage-count">{count}</span>}
        </button>;})}
      </nav>
      {ws.role !== 'fto_coordinator' && !editable && !locked && <div className="rise mb-3 text-sm rounded border bg-card p-3 flex gap-2"><Info className="h-4 w-4 mt-0.5 shrink-0" />{r.status === 'draft' ? 'Switch to the FTO role view to edit this draft.' : 'No official signature or approval has been recorded.'}</div>}
      {locked && <div className="rise mb-3 text-sm rounded border border-foreground bg-foreground text-background p-3 flex gap-2"><Lock className="h-4 w-4 mt-0.5" />This record is locked locally. No official signature or approval is verified.</div>}

      <div className="rise mb-4 rounded-md border-2 border-destructive/60 bg-destructive/5 p-3 text-sm flex gap-2" data-testid="warning-pii"><ShieldAlert className="h-5 w-5 text-destructive shrink-0" /><div><b>Do not enter suspect PII, criminal history, or restricted identifiers</b> (SSNs, DOBs, license numbers, case or booking numbers, records-system results). Describe the PO's performance only.
        {pii.length > 0 && <ul className="mt-1.5 font-semibold text-destructive list-disc pl-5" data-testid="list-pii-hits">{pii.map(p=><li key={p}>Possible: {p}. Remove before saving.</li>)}</ul>}</div></div>

      {r.legacyEvaluation && <details className="mb-4 rounded border bg-card p-3 text-sm"><summary className="cursor-pointer font-semibold">Preserved earlier SEG values · excluded from current totals</summary><p className="my-2">Only matching current category keys were carried forward. Superseded category values remain here for comparison, not as extra SEGs.</p><ul>{Object.entries(r.legacyEvaluation.ratings).map(([key,value])=><li key={key}>{key}: {value.rating || 'Unrated'} {value.justification}</li>)}</ul></details>}
      {r.legacyGeography && <div className="rise mb-4 rounded border border-warn bg-card p-3 text-sm" data-testid="warning-legacy-geography"><b>Previous assignment text was preserved but not mapped.</b> It is not used as current Division geography. New logs inherit the selected Zone, Precinct, and FTO Assignment from the case folder.</div>}

      {showErr && errs.length > 0 && <div role="alert" className="rise mb-4 rounded border border-destructive bg-card p-3 text-sm" data-testid="list-errors"><b className="text-destructive">Required before any signature (drafts may be saved incomplete):</b><ul className="list-disc pl-5 mt-1">{errs.map(e=><li key={e}><button type="button" className="text-left underline-offset-2 hover:underline" onClick={()=>setStage(stageForError(e))} data-testid="button-error-goto">{e}</button></li>)}</ul></div>}

      {stage==='shift'&&<>
      <Panel id="shift-details" title="Shift metadata" className="mb-4 scroll-mt-28">
        <p className="border-b px-4 py-3 text-sm text-muted-foreground">The assigned FTO’s name and badge come from the phase assignment and are saved as this report’s identity snapshot.</p>
        <fieldset disabled={!editable} className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
          <F l="Shift date (MM/DD/YYYY)"><input type="text" inputMode="text" maxLength={10} placeholder="MM/DD/YYYY" className={inp+' mono'} value={dateText} onChange={e=>{const value=formatDateEntryMDY(e.target.value);setDateText(value);if(!editingRunId)setRunDateTimeText(current=>alignRunDateToShift(current,value));applyShiftDate(value);}} onKeyDown={event=>applyCurrentDateTimeShortcut(event,'date',today=>{setDateText(today);if(!editingRunId)setRunDateTimeText(current=>alignRunDateToShift(current,today));applyShiftDate(today);})} data-testid="input-date" /><span className="text-xs font-normal text-muted-foreground">Slashes are added automatically. Enter ? then press Tab for today.</span></F>
            <F l="Shift time"><input required type="text" inputMode="numeric" maxLength={5} placeholder="HH:MM" pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]" className={inp+' mono'} value={r.shiftStartTime??''} onChange={event=>set('shiftStartTime',formatTimeEntry24H(event.target.value))} onKeyDown={event=>applyCurrentDateTimeShortcut(event,'time',value=>set('shiftStartTime',value))} data-testid="input-shift-start-time" /><span className="text-xs font-normal text-muted-foreground">Enter the actual shift start time in 24-hour HH:MM format; four digits add the colon. Enter ? then press Tab for the current time.</span></F>
          <F l="Shift (from case folder)"><input className={inp} value={shiftDisplayLabel(r.shift)} disabled data-testid="input-shift" /></F>
          <F l="Phase (from case folder)"><input className={inp} value={phaseLabel(r.phase)} disabled data-testid="input-phase" /></F>
          <F l="Probationary Officer (PO)"><input className={inp} value={r.recruitName} onChange={e=>set('recruitName',e.target.value)} data-testid="input-po-name" /></F>
          <F l="PO badge"><input className={inp+' mono'} value={r.recruitBadge} onChange={e=>set('recruitBadge',e.target.value)} data-testid="input-po-badge" /></F>
          <F l="Training class"><input className={inp} value={r.className ?? ''} onChange={e=>set('className',e.target.value)} data-testid="input-report-class" /></F>
          <F l="Phase week · calculated from date"><input type="number" min={1} step={1} className={inp} value={r.phaseWeek ?? ''} onChange={e=>set('phaseWeek',e.target.value ? Number(e.target.value) : undefined)} disabled={isNew&&!!ws.caseFolder} data-testid="input-phase-week" /></F>
          <F l="FTO week · confirm assignment"><input type="number" min={1} step={1} className={inp} value={r.ftoWeek ?? ''} onChange={e=>set('ftoWeek',e.target.value ? Number(e.target.value) : undefined)} data-testid="input-fto-week" /></F>
           <F l="Assigned FTO name"><input className={inp} value={r.ftoName} readOnly data-testid="input-fto" /></F>
           <F l="Assigned FTO badge"><input className={inp+' mono'} value={r.ftoBadge} readOnly data-testid="input-fto-badge" /></F>
          <F l="Patrol zone"><input className={inp} value={r.zone ? `Zone ${r.zone}` : 'Not assigned'} disabled data-testid="input-zone" /></F>
          <F l="Precinct"><input className={inp} value={r.precinct ? `Precinct ${r.precinct}` : 'Not assigned'} disabled data-testid="input-precinct" /></F>
          <F l="FTO Assignment"><input className={inp} value={phaseAssignmentLabel(r.ftoAssignment,r.shift,r.cruiserDistrict)} disabled data-testid="input-fto-assignment" /></F>
        </fieldset>
        {week && <div className="border-t px-4 py-3 text-sm" data-testid="text-report-week">
          <b>Training week:</b> Sunday {formatDateDMY(week.start)} – Saturday {formatDateDMY(week.end)}.
          <span className="ml-1 text-muted-foreground">{shiftWeekDescription(r.shift)}</span>
          {isNew && ws.caseFolder && <div className="mt-1 text-muted-foreground">FTO-selected days off: {ws.caseFolder.daysOff.map(day=>WEEKDAYS.find(item=>item.value===day)?.label).filter(Boolean).join(', ')}</div>}
          {r.phaseWeek && <div className="mt-1 text-muted-foreground">Phase week {r.phaseWeek} · program week {r.phaseWeek+PHASE_PROGRAM_WEEK_START[r.phase]-1}.</div>}
        </div>}
        {isLimboDay && <div role="note" className="mx-4 mb-4 rounded border border-primary/40 bg-primary/5 p-3 text-sm" data-testid="notice-limbo-day"><b>Limbo day · no SEG ratings.</b> Complete Reporting for Duty, record the day’s activity, and complete applicable run forms. The manual says not to enter performance ratings during this day.</div>}
      </Panel>
      </>}

      {stage==='duty'&&<>
        <Panel id="duty-form" title="Reporting for Duty Form" className="mb-4 scroll-mt-28">
         <div className="border-b px-4 py-3 text-sm text-muted-foreground">
            New daily logs start with duty-check boxes selected to speed entry. Review every item; clearing an applicable task creates a UA deficiency. Each section’s <b>Not applicable</b> box starts unchecked; use it for an inapplicable section. Confirm the review before submission.
         </div>
         <div className="grid gap-4 p-4">
           <fieldset disabled={!editable} className="grid gap-4 sm:grid-cols-3">
             <F l="Unit / cruiser assignment"><input value={r.reportingForDuty.cruiserId||r.reportingForDuty.unitNumber||''} maxLength={40} className={inp+' mono'} onChange={event=>set('reportingForDuty',{...r.reportingForDuty,unitNumber:event.target.value,cruiserId:event.target.value,reviewedAt:undefined})} placeholder="Enter assigned unit or cruiser" data-testid="input-unit-number"/></F>
              <F l="Shotgun Training"><select className={inp} value={r.reportingForDuty.shotgunTraining??''} onChange={event=>{const value=event.target.value;if(value==='Y'||value==='N')setShotgunTraining(value);}} data-testid="select-shotgun-training"><option value="" disabled>Select Y / N</option><option value="Y">Y</option><option value="N">N</option></select></F>
           </fieldset>
            {deficiencyEditor.groups.length>0&&<div className="flex flex-wrap gap-2">{deficiencyEditor.groups.map(group=><button type="button" key={group.id} disabled={!editable||!group.reviewed} className="min-h-11 rounded border bg-card px-3 text-sm font-semibold" onClick={()=>deficiencyEditor.open(group.id)} data-testid={`review-deficiency-${group.id}`}>Review {CATEGORY_LABEL[group.category]} articulation</button>)}</div>}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded border bg-muted/20 p-3">
              <span className="text-sm font-semibold">Reporting for Duty form checkboxes</span>
              <button type="button" disabled={!editable} onClick={toggleDutyChecklist} className="min-h-11 rounded border bg-card px-4 text-sm font-bold disabled:opacity-50" data-testid="button-toggle-duty-checklist">{dutyAllChecked?'Deselect all':'Select all'}</button>
            </div>
           <F l="Duty status">
              <div role="radiogroup" aria-label="Duty status" className="grid grid-cols-2 gap-2 sm:grid-cols-5" data-testid="select-duty-status">
                {([{value:'on_duty',label:'On duty'},{value:'training',label:'Training'},{value:'sick',label:'Sick'},{value:'off_duty',label:'Off duty'},{value:'other',label:'Other'}] as const).map(option=><label key={option.value} className={cn('flex min-h-11 items-center gap-2 rounded border px-3 text-sm font-semibold',r.reportingForDuty?.dutyStatus===option.value?'border-primary bg-primary/10':'bg-card')}><input type="radio" name="duty-status" disabled={!editable} checked={(r.reportingForDuty?.dutyStatus??'on_duty')===option.value} onChange={()=>set('reportingForDuty',{...(r.reportingForDuty ?? emptyReportingForDutyRecord()),dutyStatus:option.value,reviewedAt:undefined})} />{option.label}</label>)}
              </div>
           </F>
           {DAILY_DUTY_CHECKLIST.map(group=><fieldset key={group.section} disabled={!editable} className="rounded border p-3">
              <legend className="px-2 text-sm font-bold">{group.section}</legend>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <label className="flex min-h-10 items-center gap-2 rounded border px-3 text-sm font-semibold"><input type="checkbox" checked={!!r.reportingForDuty?.notApplicable?.[group.section]} onChange={event=>updateDutyGroup(group.section,event.target.checked)} data-testid={`checkbox-duty-na-${group.section}`} />Not applicable</label>
                <button type="button" disabled={!editable} onClick={()=>clearDutyGroup(group.section)} className="min-h-11 rounded border border-destructive/60 bg-destructive/5 px-4 text-sm font-bold text-destructive disabled:opacity-50" data-testid={`button-clear-duty-${group.section}`}>Clear all checkboxes</button>
              </div>
                <div className="grid gap-2 sm:grid-cols-2">{group.items.map(item=><label key={item.key} title={dutyChecklistHelp(group.section,item.label)} className="flex items-start gap-2 text-xs leading-5"><input type="checkbox" disabled={!!r.reportingForDuty?.notApplicable?.[group.section]} checked={dutyChecklistChecked(r.reportingForDuty?.checklist,item.key)} onChange={event=>set('reportingForDuty',{...(r.reportingForDuty ?? emptyReportingForDutyRecord()),checklist:{...(r.reportingForDuty?.checklist ?? {}),[item.key]:event.target.checked},reviewedAt:undefined})} data-testid={`checkbox-duty-${item.key}`} /><span>{item.label}</span></label>)}</div>
           </fieldset>)}
            <label className="flex items-start gap-2 rounded border p-3 text-sm leading-5">
              <input type="checkbox" disabled={!editable} checked={!!r.reportingForDuty?.reviewedAt} onChange={event=>set('reportingForDuty',{...(r.reportingForDuty??emptyReportingForDutyRecord()),reviewedAt:event.target.checked?new Date().toISOString():undefined})} data-testid="checkbox-duty-review"/>
              <span>I reviewed the daily duty checklist and cleared non-applicable or incomplete items. The “Not applicable” boxes remain unchecked unless I selected them.</span>
            </label>
             <F l="Duty form notes"><textarea rows={2} disabled={!editable} value={r.reportingForDuty?.notes ?? ''} onChange={event=>set('reportingForDuty',{...(r.reportingForDuty ?? emptyReportingForDutyRecord()),notes:event.target.value,reviewedAt:undefined})} className="w-full rounded border bg-card p-2.5 text-sm" placeholder="FTO drove during tour; FTO ______ substituting for FTO ______." data-testid="input-duty-notes" /></F>
         </div>
       </Panel>
      </>}

      {stage==='runs'&&<>
      <Panel id="run-forms" title="Per-run paperwork" className="mb-4 scroll-mt-28">
         <div className="border-b px-4 py-3 text-sm text-muted-foreground">
            <p>Record each training run and its required paperwork. Incident number and location are optional run metadata shared with its supplemental forms and narrative continuation pages.</p>
            <p className="mt-1"><b className="text-foreground">Fictional preview · no operational data.</b> Saved workspace records are encrypted on this device; printed forms and Excel exports are plain text.</p>
            <Link href="/resources?topic=local-save#application-help" className="mt-2 inline-flex text-sm font-semibold text-primary underline underline-offset-2">Save and reopen help</Link>
           <p className="mt-1"><b className="text-foreground">Daily requirements:</b> Reporting for Duty is tracked separately above; this Daily Performance Summary is completed once per tour.</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <span className="text-sm text-muted-foreground">One run at a time. Each run opens as a packet of sheets: details, the primary form, attached forms, then narrative.</span>
          <button type="button" disabled={!editable} onClick={requestNewRun} className="inline-flex min-h-10 items-center gap-2 rounded bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50" data-testid="button-new-run"><Plus className="h-4 w-4"/>New run</button>
        </div>
        <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_17rem]">
          {runOpen?<div className="min-w-0 rounded border bg-muted/35 p-3 sm:p-4" data-testid="section-run-workflow">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="label-caps">{editingRunId ? 'Editing saved run' : 'New run packet'}</div>
                <div className="text-sm font-bold text-foreground" data-testid="text-run-packet-title">{selectedForm.label}{incidentNumber.trim()?` · ${incidentNumber.trim()}`:''}{runLocation.trim()?` · ${runLocation.trim()}`:''}</div>
              </div>
              <span className="text-xs text-muted-foreground" data-testid="status-run-draft">{runFormDirty?<><b className="text-accent">Unsaved run</b> · held on this screen only, not yet in the daily log</>:editingRunId?'No changes to this saved run':'Empty run form'}</span>
            </div>
            <RunStepRail steps={runSteps} current={currentStep.id} stateFor={step=>step.kind==='checklist'?(sheetReviewed(step.id as RunSheetKey)?'reviewed':'needs_review'):'info'} onSelect={id=>{setRunStep(id);setRunError('');}}/>
            {currentStep.kind==='details'&&<div data-testid="sheet-run-details">
            <p className="mb-3 rounded border bg-card px-3 py-2 text-xs text-muted-foreground">These run facts are shared by every sheet in this run. Attached sheets inherit the incident, location, date and time, PO, FTO, unit, and cruiser.</p>
            <fieldset disabled={!editable} className="grid gap-3 sm:grid-cols-2">
              <F l="Primary form">
                 <SearchableSelect className={inp} value={runKind} onChange={e=>{
                   const next=e.target.value as PrimaryRunForm;
                   if(next==='traffic_stop'||next==='high_risk_stop')askStopRisk(next);
                   else requestRunKind(next);
                 }} data-testid="select-run-kind">
                   {PRIMARY_RUN_FORMS.map(form=><option key={form.key} value={form.key}>{form.label}</option>)}
                 </SearchableSelect>
              </F>
                {['call_for_service','self_initiated'].includes(runKind)
                  ? <p className="text-xs text-muted-foreground sm:col-span-2">{runKind==='call_for_service'?'Call for Service is the default for each new run.':'Use Self-Initiated Run / Training when the PO initiates the activity.'} Choose a dedicated form when the manual calls for one.</p>
                  : <F l="Run origin"><SearchableSelect className={inp} value={runDispatched?'call_for_service':'self_initiated'} onChange={e=>{const dispatched=e.target.value==='call_for_service';setRunDispatched(dispatched);recompute({isDispatched:dispatched});setRunError('');}} data-testid="select-run-origin"><option value="call_for_service">Call for Service / dispatched</option><option value="self_initiated">Self-initiated</option></SearchableSelect></F>}
                 {(runKind==='traffic_stop'||runKind==='high_risk_stop')&&<div className="sm:col-span-2">
                   <button type="button" className="min-h-10 rounded border bg-card px-3 text-sm font-semibold"
                     onClick={()=>askStopRisk()} data-testid="button-change-stop-type">Change Stop Type</button>
                 </div>}
                  <F l="Run event date · MM/DD/YYYY"><input required inputMode="text" maxLength={10} placeholder="MM/DD/YYYY" className={inp+' mono'} value={runDateTimeParts.date} onChange={event=>{const date=formatDateEntryMDY(event.target.value);setRunDateTimeText(date==='?'?'?':`${date}${runTimeText?` ${runTimeText}`:''}`);setRunError('');}} onKeyDown={event=>applyCurrentDateTimeShortcut(event,'date',date=>{setRunDateTimeText(`${date}${runTimeText?` ${runTimeText}`:''}`);setRunError('');})} data-testid="input-run-date" /></F>
                  <F l="Run event time"><input required type="text" inputMode="numeric" maxLength={5} placeholder="HH:MM" pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]" className={inp+' mono'} value={runTimeText} onChange={event=>{const time=formatTimeEntry24H(event.target.value);setRunTimeText(time);setRunDateTimeText(current=>{const date=splitDateTimeEntryMDY(current).date;return date?`${date}${time?` ${time}`:''}`:'';});setRunError('');}} onKeyDown={event=>applyCurrentDateTimeShortcut(event,'time',time=>{setRunTimeText(time);setRunDateTimeText(current=>{const date=splitDateTimeEntryMDY(current).date;return date?`${date} ${time}`:'';});setRunError('');})} data-testid="input-run-time" /><span className="text-xs font-normal text-muted-foreground">Enter the time the call was aired or initiated in 24-hour HH:MM format; four digits add the colon. Enter ? then press Tab for the current time. Correct dispatch details as needed.</span></F>
                 <F l="Incident Number"><input className={inp} value={incidentNumber} onChange={event=>setIncidentNumber(event.target.value)} maxLength={120} data-testid="input-run-incident-number" /></F>
                 <F l="Unit / cruiser assignment"><input className={inp+' mono'} value={runUnitNumber} onChange={event=>setRunUnitNumber(event.target.value)} maxLength={40} placeholder="Assigned unit or cruiser" data-testid="input-run-unit-number" /></F>
                 <F l="Dispatched at · MM/DD/YYYY HH:MM"><input className={inp+' mono'} value={runDispatchedAtText} onChange={event=>setRunDispatchedAtText(event.target.value)} onKeyDown={event=>applyCurrentDateTimeShortcut(event,'datetime',setRunDispatchedAtText)} maxLength={16} placeholder="Optional" data-testid="input-run-dispatched-at" /></F>
                 <F l="Cleared at · MM/DD/YYYY HH:MM"><input className={inp+' mono'} value={runClearedAtText} onChange={event=>setRunClearedAtText(event.target.value)} onKeyDown={event=>applyCurrentDateTimeShortcut(event,'datetime',setRunClearedAtText)} maxLength={16} placeholder="Optional" data-testid="input-run-cleared-at" /></F>
                 <F l="Street address"><input className={inp} value={runLocation} onChange={event=>setRunLocation(event.target.value)} maxLength={200} data-testid="input-run-location" /></F>
                 <F l="City"><input className={inp} value={runLocationCity} onChange={event=>setRunLocationCity(event.target.value)} maxLength={80} data-testid="input-run-city" /></F>
                 <F l="State"><input className={inp} value={runLocationState} onChange={event=>setRunLocationState(event.target.value.toUpperCase())} maxLength={2} data-testid="input-run-state" /></F>
                 <F l="ZIP code"><input className={inp} value={runLocationZip} onChange={event=>setRunLocationZip(event.target.value)} maxLength={10} data-testid="input-run-zip" /></F>
                 <F l="Zone"><input className={inp} value={runZone} onChange={event=>setRunZone(event.target.value)} maxLength={40} data-testid="input-run-zone" /></F>
                 <F l="Cruiser district"><input className={inp} value={runCruiserDistrict} onChange={event=>setRunCruiserDistrict(event.target.value)} maxLength={40} data-testid="input-run-cruiser-district" /></F>
                <F l="Run type / 10-code">
                  <div className="flex min-w-0">
                    <span className={radioCodePrefix} aria-hidden="true">10-</span>
                    <input aria-label="Dispatched code without 10 prefix" className={radioCodeInput+(runKind==='traffic_stop'?' bg-muted':'')} value={dispatchedCode}
                      onChange={e=>{setDispatchedCode(normalizeRadioCode(e.target.value));setRiskCodeDirty(true);}}
                      onBlur={()=>{if(riskCodeDirty){setRiskCodeDirty(false);if(dispatchedCode==='6')askStopRisk();}}}
                      onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();setRiskCodeDirty(false);if(dispatchedCode==='6')askStopRisk();}}}
                      list="radio-code-list" placeholder="6 or 17A" data-testid="input-dispatched-code" />
                  </div>
                  {dispatchedCode&&<span className="text-xs text-muted-foreground">{RADIO_CODES[dispatchedCode]??'Unlisted code — confirm against approved code table'}</span>}
               </F>
                <F l="Situation found code">
                    <div className="flex min-w-0">{situationFoundCode&&situationFoundCode!==SITUATION_FOUND_NA&&<span className={radioCodePrefix} aria-hidden="true">10-</span>}<input aria-label="Situation found code" className={radioCodeInput} value={situationFoundCode} onChange={e=>setSituationFoundCode(normalizeSituationFoundCode(e.target.value))} list="radio-code-list" placeholder="Optional" data-testid="input-situation-found-code" /></div>
                    <span className="text-xs text-muted-foreground">{situationFoundCode===SITUATION_FOUND_NA?'N/A was recorded explicitly.':situationFoundCode ? RADIO_CODES[situationFoundCode] ?? 'Unlisted code — confirm against approved code table' : 'Blank by default. Enter only the code when the situation found differs.'}</span>
               </F>
               <datalist id="radio-code-list">{Object.entries(RADIO_CODES).map(([code,label])=><option key={code} value={code}>{label}</option>)}</datalist>
                    <F l="Clearance code"><SearchableSelect className={inp} value={clearanceCode} onChange={e=>{const code=e.target.value as typeof clearanceCode;setClearanceCode(code);if(code==='3V')setArrestState(true);}} data-testid="select-clearance-code"><option value="">Not recorded</option>{CLEARANCE_CODES.map(item=><option key={item.code} value={item.code}>{item.code} · {item.label}</option>)}</SearchableSelect></F>
                    {clearanceCode==='3V'&&<p className="rounded border border-accent/40 bg-accent/5 p-2 text-xs sm:col-span-2">3V records an arrest with transport. Selecting it opens the transport fields. If no transport occurred, clear Transported after arrest to use 1V. If no arrest occurred, correct the clearance code and related statistics before saving.</p>}
                    {arrestMade&&!transported&&clearanceCode==='1V'&&<p className="rounded border bg-muted/30 p-2 text-xs sm:col-span-2">No transport occurred. This arrest run is recorded as 1V; use 3V only when transport was completed.</p>}
          {(clearanceCode==='1V')&&<p className="rounded border bg-primary/5 p-2 text-xs sm:col-span-2">{runKind==='traffic_stop'?'For a 10-6 Traffic Stop, select Solve Citation/Summons* below when applicable. Do not select PremierOne Reports or Axon Reports. This is guidance only; no statistic is prefilled.':runKind==='traffic_crash'?'Select Accident Reports below only when a crash report was completed; a crash report is not a PremierOne Report. No statistic is prefilled.':'Select PremierOne Reports below only when that report was completed. No statistic is prefilled from the clearance code.'}</p>}
                  {runKind==='traffic_stop'&&clearanceCode==='3V'&&<p className="rounded border bg-primary/5 p-2 text-xs sm:col-span-2">For a 10-6 Traffic Stop, select Solve Citation/Summons* below when applicable. Do not select PremierOne Reports or Axon Reports. No statistic is prefilled.</p>}
            </fieldset>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!editable} checked={arrestMade} onChange={e=>setArrestState(e.target.checked)} data-testid="checkbox-arrest-made" />Arrest made</label>
              {clearanceCode==='3V'&&arrestMade&&<ArrestClassificationFields
                severity={arrestSeverity}
                arrestType={arrestType}
                disabled={!editable}
                inputClassName={inp}
                onSeverityChange={setArrestSeverity}
                onArrestTypeChange={setArrestType}
                onEdit={()=>setRunError('')}
              />}
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!editable || !arrestMade} checked={transported} onChange={e=>setTransportState(e.target.checked)} data-testid="checkbox-transported" />Transported after arrest</label>
              {arrestMade&&transported&&<F l="Transport destination type"><SearchableSelect disabled={!editable} className={inp} value={transportDestinationType??''} onChange={event=>{const value=event.target.value as TrainingRun['transportDestinationType'];setTransportDestinationType(value||undefined);setRunError('');}} data-testid="select-transport-destination-type"><option value="">Select destination</option><option value="Jail">Jail</option><option value="HQ">HQ</option><option value="Clerks">Clerks</option></SearchableSelect></F>}
              {arrestMade&&transported&&<F l="Actual transport destination"><input disabled={!editable} className={inp} maxLength={200} value={transportDestination} onChange={event=>{setTransportDestination(event.target.value);setRunError('');}} placeholder="Enter the destination that actually occurred" data-testid="input-transport-destination"/></F>}
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!editable} checked={oviProcessed} onChange={e=>{const value=e.target.checked;setOviProcessed(value);recompute({oviProcessed:value});}} data-testid="checkbox-ovi-processed" />OVI processing occurred</label>
            </div>
            <section className="mt-4 rounded border bg-card p-3">
              <div className="text-sm font-bold">Optional Items and Additional Forms</div>
              <p className="mt-1 text-xs text-muted-foreground">Choose Traffic Violator, Solve Citation/Summons, additional forms, or related activity only when needed. Unselected optional items do not print.</p>
              <button type="button" onClick={()=>setRunOptionsOpen(true)} className="mt-3 min-h-11 rounded border bg-card px-4 text-sm font-bold" data-testid="button-open-run-options">{editable?'Choose':'View'} Optional Items and Forms</button>
              <p className="mt-2 text-xs">{trafficMode!=='none'?`Traffic violator: ${trafficMode.replaceAll('_',' ')} · `:''}{requiredSupplements.length} additional form(s) · {Object.values(activityFlags).filter(Boolean).length} activity selection(s)</p>
            </section>
            <RunOptionsDialog open={runOptionsOpen} onOpenChange={setRunOptionsOpen} disabled={!editable}
              showTraffic={runKind==='traffic_stop'||runKind==='high_risk_stop'} trafficMode={trafficMode}
              onTrafficChange={mode=>{setTrafficMode(mode);recompute({trafficMode:mode});setRunError('');}}
              forms={QUICK_ADD.map(item=>({key:item.form,label:item.label,selected:requiredSupplements.includes(item.form),lockedReason:quickAddLock(item.form)}))}
              onFormChange={toggleQuickAdd}
              activities={DAILY_ACTIVITY_FIELDS.map(({key,label})=>({key,label,selected:!!activityFlags[key],
                disabled:key==='premierOneReports'&&runKind==='traffic_stop'&&dispatchedCode==='6'&&['1V','3V'].includes(clearanceCode)&&!activityFlags[key]}))}
              onActivityChange={(key,selected)=>{setActivityFlags(current=>({...current,[key]:selected}));setRunError('');}}
              onClearActivities={()=>{setActivityFlags({});setRunError('');}}
              activityHint={arrestMade?'Select Prisoner Searches and Prisoners Slated only when they occurred. Other activities must also have actually occurred.':trafficSolveSuggestion?'For this 10-6 Traffic Stop, select Solve Citation/Summons when applicable. Do not select PremierOne Reports for this traffic-stop citation.':'Choose only completed reports and activities. Nothing is preselected from the run type, codes, or attached forms.'}/>
            </div>}
            {currentStep.id==='primary'&&<div data-testid="sheet-primary">
            <div className="mt-4 rounded border bg-card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold text-sm" title={RUN_FORM_GUIDANCE[runKind]}>{selectedForm.label}</div>
                <div className="flex flex-wrap gap-2">
                <label className="flex min-h-11 items-center gap-2 rounded border px-3 text-sm font-semibold"><input type="checkbox" disabled={!editable} checked={!!runChecklist['na-task']} onChange={event=>{const notApplicable=event.target.checked;setRunChecklist(current=>({...current,'na-task':notApplicable,...(notApplicable?Object.fromEntries(checkItems.map((_,index)=>[`task-${index}`,false])):{})}));if(notApplicable){setRunChecklistFailures(current=>{const next={...current};checkItems.forEach((_,index)=>{delete next[`task-${index}`];});return next;});}if(notApplicable&&primaryDirectiveIndex>=0)setDirectiveReviewFlags(runKind,false);setRunError('');}} data-testid="checkbox-run-na"/>Not applicable</label>
                     <button type="button" disabled={!editable} onClick={()=>{const targets=checkItems.map((label,index)=>({form:runKind,key:`task-${index}`,label}));if(primaryChecklistAllChecked)clearChecklistItems(targets,'na-task');else selectChecklistItems(targets,'na-task');if(primaryDirectiveIndex>=0)setDirectiveReviewFlags(runKind,!primaryChecklistAllChecked);}} className="min-h-11 rounded border bg-card px-4 text-sm font-bold disabled:opacity-50" data-testid="button-toggle-run-checklist">{primaryChecklistAllChecked?'Deselect all':'Select all'}</button>
                    <button type="button" disabled={!editable} onClick={()=>{const targets=checkItems.map((label,index)=>({form:runKind,key:`task-${index}`,label}));clearChecklistItems(targets,'na-task');if(primaryDirectiveIndex>=0)setDirectiveReviewFlags(runKind,false);}} className="min-h-11 rounded border border-destructive/60 bg-destructive/5 px-4 text-sm font-bold text-destructive disabled:opacity-50" data-testid="button-clear-run-checklist">Clear all checkboxes</button>
                </div>
              </div>
               <div className="mt-2 grid gap-3">
                      <RunChecklistFields sections={primaryChecklistGroups} state={runChecklist} prefix="task-"
                        disabled={!editable||!!runChecklist['na-task']} testId={`checklist-primary-${runKind}`}
                        onChange={(indices,checked)=>{
                          const targets=indices.map(index=>({form:runKind,key:`task-${index}`,label:checkItems[index]}));
                          if(checked)selectChecklistItems(targets,'na-task');else openUncheckedPrompt(runKind,'task-','na-task',checklistRowFor(primaryChecklistGroups,indices),checkItems);
                          if(indices.includes(primaryDirectiveIndex))setDirectiveReviewFlags(runKind,checked);
                        }}
                        notApplicable={runChecklistNA}
                        renderItemDetails={indices=>renderChecklistFailureDetails(runKind,'task-',indices,checkItems)}/>
                     {primaryDirectiveIndex>=0&&<DirectiveReviewEditor value={primaryDirectiveReview} disabled={!editable||runChecklist[`task-${primaryDirectiveIndex}`]===false} dataTestId={`directive-review-${runKind}`} onChange={(field,value)=>updateDirectiveReview(runKind,field,value)}/>}
               </div>
              {sheetReviewFooter('primary')}
            </div>
            </div>}
             {requiredSupplements.filter(supplement=>supplement===currentStep.id).map(supplement=>{
               const form=SUPPLEMENTAL_RUN_FORMS.find(item=>item.key===supplement)!;
                  const supplementItems=supplementCheckItems[supplement];
                  const supplementDirectiveIndex=supplementItems.indexOf(DIRECTIVE_REVIEW_LABEL);
                  const supplementDirectiveReview=directiveReviews[supplement]??defaultDirectiveReviewRecord();
                  const supplementAllChecked=supplementItems.length>0&&supplementItems.every((_,index)=>runChecklist[`supp-${supplement}-${index}`]!==false)
                    &&(supplementDirectiveIndex<0||(runChecklist[`supp-${supplement}-${supplementDirectiveIndex}`]!==false&&supplementDirectiveReview.divisionDirectives&&supplementDirectiveReview.ohioRevisedCode&&supplementDirectiveReview.columbusCityCode&&supplementDirectiveReview.other));
                 const groups=REVISED_SUPPLEMENT_CHECKLISTS[supplement];
                 return <div key={supplement} className="mt-3 rounded border border-accent/40 bg-accent/5 p-3" data-testid={`section-supplement-${supplement}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2"><div className="font-semibold text-sm" title={SUPPLEMENTAL_FORM_GUIDANCE[supplement]}>{form.label}</div>
                      {supplementItems.length>0&&<div className="flex flex-wrap gap-2">
                        <label className="flex min-h-11 items-center gap-2 rounded border px-3 text-sm font-semibold"><input type="checkbox" disabled={!editable} checked={!!runChecklist[`na-supp-${supplement}`]} onChange={event=>{const notApplicable=event.target.checked;setRunChecklist(current=>({...current,[`na-supp-${supplement}`]:notApplicable,...(notApplicable?Object.fromEntries(supplementItems.map((_,index)=>[`supp-${supplement}-${index}`,false])):{})}));if(notApplicable){setRunChecklistFailures(current=>{const next={...current};supplementItems.forEach((_,index)=>{delete next[`supp-${supplement}-${index}`];});return next;});}if(notApplicable&&supplementDirectiveIndex>=0)setDirectiveReviewFlags(supplement,false);setRunError('');}} data-testid={`checkbox-supplement-na-${supplement}`}/>Not applicable</label>
                         <button type="button" disabled={!editable} onClick={()=>{const targets=supplementItems.map((label,index)=>({form:supplement,key:`supp-${supplement}-${index}`,label}));if(supplementAllChecked)clearChecklistItems(targets,`na-supp-${supplement}`);else selectChecklistItems(targets,`na-supp-${supplement}`);if(supplementDirectiveIndex>=0)setDirectiveReviewFlags(supplement,!supplementAllChecked);}} className="min-h-11 rounded border bg-card px-4 text-sm font-bold disabled:opacity-50" data-testid={`button-toggle-supplement-${supplement}`}>{supplementAllChecked?'Deselect all':'Select all'}</button>
                          <button type="button" disabled={!editable} onClick={()=>{const targets=supplementItems.map((label,index)=>({form:supplement,key:`supp-${supplement}-${index}`,label}));clearChecklistItems(targets,`na-supp-${supplement}`);if(supplementDirectiveIndex>=0)setDirectiveReviewFlags(supplement,false);}} className="min-h-11 rounded border border-destructive/60 bg-destructive/5 px-4 text-sm font-bold text-destructive disabled:opacity-50" data-testid={`button-clear-supplement-${supplement}`}>Clear all checkboxes</button>
                      </div>}
                   </div>
                     <p className="mt-2 rounded border bg-muted/30 p-2 text-xs">{SUPPLEMENTAL_FORM_GUIDANCE[supplement]}</p>
                     {supplementItems.length>0?<><details className="mt-2 rounded border bg-muted/30 p-2 text-xs"><summary className="cursor-pointer font-semibold">How to review this form</summary><p className="mt-1">Hover or focus each item for its meaning. Check only when the PO completed the action acceptably. Clear it if not completed acceptably, not applicable, or performed by the FTO; document deficiencies and training in the narrative.</p></details>
                      <RunChecklistFields sections={groups} state={runChecklist} prefix={`supp-${supplement}-`}
                        disabled={!editable||!!runChecklist[`na-supp-${supplement}`]} testId={`checklist-supplement-${supplement}`}
                        onChange={(indices,checked)=>{
                           const targets=indices.map(index=>({form:supplement,key:`supp-${supplement}-${index}`,label:supplementItems[index]}));
                           if(checked)selectChecklistItems(targets,`na-supp-${supplement}`);else openUncheckedPrompt(supplement,`supp-${supplement}-`,`na-supp-${supplement}`,checklistRowFor(groups,indices),supplementItems);
                          if(indices.includes(supplementDirectiveIndex))setDirectiveReviewFlags(supplement,checked);
                         }}
                         notApplicable={runChecklistNA}
                         renderItemDetails={indices=>renderChecklistFailureDetails(supplement,`supp-${supplement}-`,indices,supplementItems)}/>
                     {supplementDirectiveIndex>=0&&<DirectiveReviewEditor value={supplementDirectiveReview} disabled={!editable||runChecklist[`supp-${supplement}-${supplementDirectiveIndex}`]===false} dataTestId={`directive-review-${supplement}`} onChange={(field,value)=>updateDirectiveReview(supplement,field,value)}/>}</>:<p className="mt-2 text-xs text-muted-foreground">The submitted form has no separate checkbox list here.</p>}
                     {supplement==='narrative_addition'&&<p className="mt-2 rounded border bg-card p-2 text-xs">The continuation pages print the run narrative written on the Narrative &amp; save sheet. Changing that narrative requires this sheet to be reviewed again.</p>}
                     {sheetReviewFooter(supplement)}
               </div>;
             })}
            {currentStep.kind==='finish'&&<div data-testid="sheet-run-finish">
              <div className="rounded border bg-card p-3">
                <div className="text-sm font-bold">Sheets in this run</div>
                <ul className="mt-2 divide-y text-sm">{runChecklistSteps.map(step=><li key={step.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><button type="button" className="font-semibold underline-offset-2 hover:underline" onClick={()=>setRunStep(step.id)} data-testid={`link-finish-sheet-${step.id}`}>{step.title}</button><SheetStatus state={sheetReviewed(step.id as RunSheetKey)?'reviewed':'needs_review'} testId={`status-sheet-${step.id}`}/></li>)}</ul>
                {!allSheetsReviewed&&<p className="mt-2 text-xs text-warn font-semibold">Open each sheet marked Needs review and confirm the review at the bottom of its checklist. Visiting a sheet does not count as a review.</p>}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" disabled={!editable||!allSheetsReviewed} onClick={draftNarrative} className="min-h-10 rounded border bg-card px-3 text-sm font-semibold disabled:opacity-50" data-testid="button-draft-run-narrative">Draft narrative outline from reviewed sheets</button>
                <span className="text-xs text-muted-foreground">Only fills an empty narrative or an unedited outline. Written text is never replaced.</span>
              </div>
            {failureStatements.length>0&&<section className="my-3 rounded border border-destructive/40 bg-destructive/5 p-3" data-testid="section-po-failed-to">
              <h4 className="text-xs font-bold uppercase tracking-wide text-destructive">PO failed to</h4>
              <ul className="mt-2 space-y-2">
                {failureStatements.map((statement,index)=>{
                  const category=statementCategory(statement.key);
                  return <li key={statement.keys.join('|')} className="flex flex-col gap-1">
                    {category&&<span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground" data-testid={`text-po-failed-category-${index}`}>UA · {category}</span>}
                    <textarea rows={Math.max(2,Math.ceil(statement.text.length/85))} disabled={!editable} className="w-full rounded border bg-card p-2 text-sm" value={statement.text}
                      aria-label={`PO failed to statement ${index+1}`}
                      onChange={event=>{const value=event.target.value;setRunFailureEdits(current=>({...current,...Object.fromEntries(statement.keys.map(key=>[key,value]))}));}}
                      data-testid={`input-po-failed-${index}`}/>
                  </li>;
                })}
              </ul>
            </section>}
            <F l="Training narrative · performance, coaching, response"><textarea rows={3} disabled={!editable} className="mt-3 w-full rounded border bg-card p-2.5 text-sm" value={runNarrative} onChange={e=>setRunNarrative(e.target.value)} placeholder="Describe observed performance, response, and coaching." data-testid="input-run-narrative" /></F>
            {narrativeAdditionRequired&&<button type="button" onClick={()=>{document.body.classList.add('print-narrative-only');window.addEventListener('afterprint',()=>document.body.classList.remove('print-narrative-only'),{once:true});window.print();}} className="mt-2 min-h-10 rounded border bg-card px-3 text-sm font-semibold" data-testid="button-print-narrative-continuation">Print narrative continuation pages only</button>}
            </div>}
            <div className="run-stepbar" data-testid="bar-run-steps">
              <button type="button" disabled={stepIndex<=0} onClick={()=>goStep(-1)} className="inline-flex min-h-10 items-center gap-1 rounded border bg-card px-3 text-sm font-semibold disabled:opacity-40" data-testid="button-run-back"><ChevronLeft className="h-4 w-4"/>Back</button>
              <div className="flex flex-wrap items-center gap-2">
                {currentStep.kind==='checklist'&&<SheetStatus state={sheetReviewed(currentStep.id as RunSheetKey)?'reviewed':'needs_review'} unsaved={runFormDirty} testId="status-current-sheet"/>}
                <button type="button" disabled={!editable} onClick={()=>addRun()} className="inline-flex min-h-10 items-center gap-2 rounded bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50" data-testid="button-save-run"><Plus className="h-4 w-4" />{editingRunId ? 'Save run changes' : 'Save run'}</button>
                {(editingRunId||runFormDirty) && <button type="button" onClick={()=>setConfirmAction({title:editingRunId?'Discard changes to this run?':'Discard this run draft?',body:'Unsaved entries on every sheet of this run will be cleared. Runs already in the daily log are unchanged.',label:'Discard',action:resetRunForm})} className="min-h-10 rounded border bg-card px-3 text-sm font-semibold" data-testid="button-cancel-run-edit">{editingRunId?'Cancel edit':'Discard draft'}</button>}
              </div>
              <button type="button" disabled={stepIndex>=runSteps.length-1} onClick={()=>goStep(1)} className="inline-flex min-h-10 items-center gap-1 rounded border bg-card px-3 text-sm font-semibold disabled:opacity-40" data-testid="button-run-next">Next<ChevronRight className="h-4 w-4"/></button>
            </div>
             {runError && <p role="alert" className="mt-2 text-sm font-semibold text-destructive" data-testid="text-run-error">{runError}</p>}
          </div>:<div className="rounded border border-dashed bg-muted/20 p-8" data-testid="section-no-open-run"><ClipboardList className="mb-3 h-7 w-7 text-primary" aria-hidden/><h3 className="font-bold">Ready for the next run</h3><p className="mt-2 text-sm text-muted-foreground">The previous run is in today’s unsaved daily-log draft. Select New run, enter the next incident number, and review its details. Save the daily draft before leaving if you need it kept in your encrypted workspace.</p><button type="button" disabled={!editable} onClick={requestNewRun} className="mt-4 min-h-11 rounded bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">New run</button></div>}
          <div>
            <div className="flex items-center justify-between border-b pb-2"><h3 className="font-bold">Runs recorded</h3><span className="mono text-xs" data-testid="status-run-count">{runIncidentSearch.trim()?`${matchingRuns.length} of ${r.runs.length} matching`:`${r.runs.length} recorded`}</span></div>
            {r.runs.length > 0 && <label className="mt-3 block">
              <span className="label-caps">Find by incident number</span>
              <input
                type="search"
                inputMode="numeric"
                maxLength={16}
                value={runIncidentSearch}
                onChange={event=>setRunIncidentSearch(event.target.value)}
                placeholder="Enter 9–16 digits"
                aria-label="Find saved runs by incident number"
                className="mt-1 h-10 w-full rounded border bg-card px-3 text-sm"
                data-testid="input-search-runs-by-incident"
              />
            </label>}
            {r.runs.length === 0 ? <div className="mt-3 rounded border border-dashed p-5 text-sm text-muted-foreground" data-testid="text-no-runs"><ClipboardList className="mb-2 h-5 w-5" />No runs recorded for this day yet.</div> :
              matchingRuns.length === 0 ? <div className="mt-3 rounded border border-dashed p-5 text-sm text-muted-foreground" data-testid="text-no-matching-runs">
                <ClipboardList className="mb-2 h-5 w-5" />
                <p>No saved runs match that incident number.</p>
                <button type="button" className="mt-2 font-semibold text-primary underline underline-offset-2" onClick={()=>setRunIncidentSearch('')} data-testid="button-clear-run-search">Clear search</button>
              </div> :
              <ul className="divide-y" data-testid="list-training-runs">{matchingRuns.map(run=>{
                const form=PRIMARY_RUN_FORMS.find(item=>item.key===run.runKind);
                 const supplements=requiredSupplementalForms(run).map(key=>{
                   const item=SUPPLEMENTAL_RUN_FORMS.find(form=>form.key===key);
                   return item ? `${item.label}${item.formNumber ? ` · ${item.formNumber}` : ''}` : '';
                 }).filter(Boolean);
                 const failureSummaries=runChecklistFailureSummaries(run);
                return <li id={`run-${run.id}`} key={run.id} className="scroll-mt-28 py-3" data-testid={`row-training-run-${run.id}`}>
                   <div className="min-w-0"><div className="font-semibold text-sm">{form?.label ?? 'Training run'}</div><div className="text-xs text-muted-foreground">{formatDateTimeMDY(run.occurredAt)} · {run.isDispatched?'Dispatched':'Self-initiated'}</div></div>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]"><span className="rounded bg-muted px-2 py-0.5" data-testid={`status-run-form-${run.id}`}>{run.formStatus.replace('_',' ')}</span>{supplements.map(name=><span key={name} className="rounded border border-accent/40 bg-accent/10 px-2 py-0.5">{name}</span>)}</div>
                   {run.incidentNumber&&<p className="mt-1 text-xs mono" data-testid={`text-run-incident-number-${run.id}`}>Incident number · {run.incidentNumber}</p>}
                   <p className="mt-1 text-xs">Run: {run.dispatchedCode ? `10-${run.dispatchedCode}`:'Not recorded'} · Found: {run.situationFoundCode ? formatRadioCode(run.situationFoundCode):'Not recorded'} · Clearance: {run.clearanceCode || 'Not recorded'}</p>
                      {(run.runKind==='traffic_stop'||run.runKind==='high_risk_stop')&&run.trafficMode!=='none'&&<p className="mt-1 text-xs">Traffic violator: {run.trafficMode.replaceAll('_',' ')}{run.activityFlags?.solveCitationSummons?' · Solve Citation/Summons selected':''}</p>}
                   {failureSummaries.length>0&&<div className="mt-2 rounded border border-destructive/30 bg-destructive/5 p-2" data-testid={`list-run-failures-${run.id}`}>
                     <div className="text-xs font-bold">Unchecked run checklist items</div>
                     <ul className="mt-1 space-y-1">{failureSummaries.map(item=><li key={item.key} className="text-xs">
                       <span>{item.label}</span>
                       {item.failureActions.map(action=><span key={action} className="ml-2 block text-muted-foreground">Not completed: <strong className="font-bold text-destructive">{action}</strong></span>)}
                     </li>)}</ul>
                   </div>}
                  {run.narrative && <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{run.narrative}</p>}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-x-12 gap-y-2 border-t pt-3">
                    <button type="button" disabled={!editable} onClick={()=>setConfirmAction({title:'Remove this run from the daily log?',body:'The run and its attached sheets leave this daily record. Save the daily log to keep the removal.',label:'Remove run',action:()=>setR(current=>current&&({...current,runs:current.runs.filter(item=>item.id!==run.id)}))})} className="min-h-10 rounded border border-destructive/60 px-3 py-2 text-xs font-semibold text-destructive disabled:opacity-50" data-testid={`button-delete-run-${run.id}`}>Remove run</button>
                    <button type="button" disabled={!editable} onClick={()=>requestEditRun(run)} className="min-h-10 rounded border px-3 py-2 text-xs font-semibold disabled:opacity-50" data-testid={`button-edit-run-${run.id}`}>Edit</button>
                  </div>
                </li>;
              })}</ul>}
          </div>
        </div>
        <div className="border-t bg-warn/5 px-4 py-3 text-xs text-muted-foreground" data-testid="status-patrol-integration">
          <b className="text-foreground">Patrol View import and online submission are unavailable.</b> Run details must be entered manually. Saved records do not have verified signatures or official approval.
        </div>
      </Panel>
      </>}

      {stage==='evaluation'&&<>
      <Panel id="seg-ratings" title="Standard Evaluation Guidelines · 30 categories · descriptive ratings" className="mb-4 scroll-mt-28">
        <div className="border-b px-4 py-3 text-sm text-muted-foreground">
          {isLimboDay
            ? <p className="font-semibold text-foreground">Limbo day: no performance ratings are recorded. The manual requires the daily categories to remain blank; run checklists and activity are still completed.</p>
            : <><p>These 30 categories follow your updated Weekly Performance Summary. Most start at Acceptable; EVO, Initiating Arrests, Handling Prisoners, Vehicle Stops, Building Search, Pat Down/Searches, High Stress Situations, and Arrest Situations start at Not Observed. The FTO must review each selection against observed performance; no rating is inferred from activity.</p>
              <p className="mt-1">The manual definition and source SEG are shown under every category. Before submission, the PO and FTO must review every category; defaults are not proof of review.</p></>}
        </div>
        <div className="grid gap-2 border-b bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="rating-legend">
          {RATING_LEGEND.map(({code,label})=><div key={code} className="flex items-center gap-2 text-sm" data-testid={`legend-rating-${code}`}><span className="mono min-w-9 font-bold">{code}</span><span>— {label}</span></div>)}
        </div>
        <div className="border-b bg-muted/20" data-testid="rating-matrix">
          <div className="hidden border-x border-t bg-muted/70 px-3 py-2 md:grid md:grid-cols-[minmax(0,1fr)_14rem]">
            <span className="label-caps">Category and definition</span>
            <div className="grid grid-cols-5 gap-1 text-center">
              {RATINGS.map(code => <span key={code} className="mono text-xs font-bold" title={ratingLabel(code)}>{code}</span>)}
            </div>
          </div>
          {SEG_RATING_COLUMNS.flatMap(column => column).map(group => (
            <section key={group}>
              <h3 className="label-caps border-x border-b bg-muted/60 px-3 py-2">{SEG_RATING_GROUP_LABELS[group] ?? group}</h3>
              {SEG_CATEGORIES.filter(item => item.group === group).map(item => {
                const c=item.key;
                const v=r.ratings[c];
                const need=needsJustification(v.rating);
                return <div key={c} className="border-x" data-testid={'category-' + c}>
                  <div className="grid items-start gap-3 border-b bg-card p-3 xl:grid-cols-[minmax(0,1fr)_14rem]">
                    <div className="min-w-0">
                      <div className="font-bold text-sm">{item.label}</div>
                      <p className="mt-1 text-xs leading-4 text-muted-foreground">{item.definition}</p>
                      <p className="mt-1 text-[10px] leading-4 text-muted-foreground">Manual: {item.manualReference}</p>
                    </div>
                    <div role="radiogroup" aria-label={CATEGORY_LABEL[c]} className="grid h-fit grid-cols-5 gap-1 self-start">
                      {r.notApplicableCategories?.includes(c)&&!deficiencyEditor.groups.some(group=>group.category===c)&&v.rating!=='UA'
                        ? <span role="status" className="seg-rating-choice col-span-5 flex h-9 items-center justify-center rounded-sm border bg-muted text-xs font-bold" data-testid={`rating-${c}-na`}>N/A · Not applicable</span>
                        : RATINGS.map(code => {
                        const rtRestricted=code==='RT' && isRtRestricted(c);
                        return <button
                          key={code}
                          type="button"
                          role="radio"
                          aria-label={`${item.label} — ${code}: ${ratingLabel(code)}`}
                          aria-checked={v.rating===code}
                          disabled={!editable || isLimboDay || rtRestricted}
                          title={isLimboDay?'No ratings are recorded on Limbo Days.':rtRestricted ? 'RT is shaded out for this category on the updated form.' : `${code} · ${ratingLabel(code)}`}
                          data-testid={'rating-' + c + '-' + code}
                          onClick={()=>setRating(c,{rating:code,nrtWithUnacceptable:false,nrtPriorUnacceptableIds:[],nrtPriorDocumentationReviewed:false,nrtTrainingReviewed:false,nrtCoordinatorsNotified:false,nrtFtoSergeantNotified:false,nrtCorrectiveActions:'',nrtOfficeReviewStatus:'not_submitted',nrtOfficeAction:undefined,nrtOfficeResponse:'',nrtOfficeSubmittedAt:undefined,nrtOfficeRespondedAt:undefined})}
                          className={cn('seg-rating-choice h-9 w-full rounded-sm border text-center text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40',v.rating===code?(code==='UA'||code==='NRT'?'bg-destructive text-destructive-foreground border-destructive':code==='RT'?'bg-accent text-accent-foreground border-accent':'bg-primary text-primary-foreground border-primary'):'bg-card hover:bg-muted')}
                        >
                          <span className="mono">{code}</span>
                        </button>;
                      })}
                    </div>
                  </div>
                  {v.rating==='NRT' && <div className="border-x border-b border-destructive/30 bg-destructive/5 p-3 text-sm">
                    <b>NRT is exclusive; do not also mark this evaluation UA.</b>
                    <p className="mt-1">Link earlier UA entries for this PO and category, document retraining, and submit the FTO Office review request.</p>
                    <button type="button" disabled={!editable} onClick={()=>openNrtFollowUp(c)} className="mt-3 min-h-11 rounded bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50" data-testid={`button-nrt-follow-up-${c}`}>Review prior UA entries and complete NRT</button>
                    <p className="mt-2 text-xs text-muted-foreground">Linked earlier UA entries: {(v.nrtPriorUnacceptableIds??[]).length} · FTO Office review: {v.nrtOfficeReviewStatus==='submitted'?'Submitted locally':v.nrtOfficeReviewStatus==='responded'?'Response saved locally':'Not submitted'}</p>
                    <Link href="/nrt-ua" className="mt-2 inline-flex text-xs font-semibold underline">Open the NRT / UA Portal</Link>
                    {v.nrtOfficeReviewStatus==='responded' && <p role="status" className="mt-2 rounded border bg-card p-2 text-xs"><b>FTO Office response:</b> {v.nrtOfficeAction?.replaceAll('_',' ')}{v.nrtOfficeResponse ? ` — ${v.nrtOfficeResponse}` : ''}</p>}
                  </div>}
                  {(need || v.justification) && <div className="border-x border-b bg-muted/20 p-3">
                    <label className={cn('label-caps', need && 'text-destructive')}>{need ? 'Document observed performance and training' : 'Comment'}</label>
                    <textarea disabled={!editable||isLimboDay} data-testid={'input-justification-' + c} value={v.justification} onChange={e=>setRating(c,{justification:e.target.value})} rows={3} placeholder="Record the observed behavior, coaching or training, and response." className="mt-1 w-full rounded border bg-card p-2.5 text-sm" />
                  </div>}
                </div>;
              })}
            </section>
          ))}
        </div>
      </Panel>
      </>}

      {stage==='activity'&&<>
      <Panel id="activity-summary" title="Daily Activity Summary" className="mb-4 scroll-mt-28">
        {activityMismatchFields.length>0&&<div className="border-b px-4 py-3 text-sm text-muted-foreground">
          {activityMismatchFields.length>0&&<div role="note" className="mt-2 rounded border border-accent bg-accent/10 p-2.5 text-foreground" data-testid="status-activity-discrepancy"><b>Review the daily statistics against run records</b><p className="mt-1 text-xs text-muted-foreground">The portal did not change either value.</p><ul className="mt-1 grid gap-1 text-xs sm:grid-cols-2">{activityMismatchFields.map(({key,label})=><li key={key}><b>{label}:</b> daily statistic {totalActivity[key]} · run checkboxes {runDerivedActivity[key]}</li>)}</ul></div>}
        </div>}
        <fieldset disabled={!editable} className="grid grid-cols-1 border-l border-t sm:grid-cols-2 xl:grid-cols-4">
          {DAILY_ACTIVITY_COLUMNS.map(column => (
            <section key={column.title} className="min-w-0 border-b border-r bg-card" data-testid={`activity-group-${column.title.toLowerCase().replaceAll(/[^a-z0-9]+/g,'-')}`}>
              <h3 className="label-caps border-b bg-muted px-3 py-2">{column.title}</h3>
              <div className="divide-y">
                {column.keys.map(key => {
                  const field=DAILY_ACTIVITY_FIELDS.find(item=>item.key===key);
                  if(!field)return null;
                  return <div key={key} className="grid grid-cols-[minmax(0,1fr)_4rem] items-center gap-x-2 px-3 py-2">
                    <label htmlFor={`activity-${key}`} className="text-xs font-medium leading-4">{field.label}</label>
                    <input
                      id={`activity-${key}`}
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      className={inp + ' mono text-right'}
                      value={totalActivity[key]}
                      onChange={event => setR(current=>current&&({...current,ratingsReviewedAt:undefined,activityCountsIncludeRuns:false,activity:{...current.activity,[key]:manualActivityEntryForTotal(event.target.value,clearanceDerivedActivityCounts(current.runs)[key])}}))}
                      data-testid={'activity-' + key}
                    />
                    {runDerivedActivity[key]>0&&<p className="col-span-2 text-[10px] leading-4 text-muted-foreground">Supporting run records contain {runDerivedActivity[key]} selected item(s); this does not change the manual daily statistic.</p>}
                  </div>;
                })}
              </div>
            </section>
          ))}
        </fieldset>
      </Panel>
      </>}

      {stage==='narrative'&&<>
      <Panel id="shift-narrative" title="Narrative" className="mb-4 scroll-mt-28">
        <div className="p-4 grid gap-3">
          <F l="Shift narrative"><textarea disabled={!editable} rows={4} value={r.narrative} onChange={e=>set('narrative',e.target.value)} className="w-full rounded border bg-card p-2.5 text-sm" data-testid="input-narrative" /></F>
          <F l="Remedial training assigned"><textarea disabled={!editable} rows={2} value={r.remedial} onChange={e=>set('remedial',e.target.value)} className="w-full rounded border bg-card p-2.5 text-sm" data-testid="input-remedial" /></F>
        </div>
      </Panel>

      <Panel id="po-comments" title="PO comments" className="mb-4 scroll-mt-28">
        <div className="p-4">
          {commentsEditable ? <textarea rows={3} value={r.recruitComments} onChange={e=>set('recruitComments',e.target.value)} placeholder="PO’s response to this evaluation (optional)." className="w-full rounded border bg-card p-2.5 text-sm" data-testid="input-recruit-comments" />
            : <p className="text-sm whitespace-pre-wrap" data-testid="text-recruit-comments">{r.recruitComments || <span className="text-muted-foreground">{r.status === 'draft' ? 'PO may comment after the FTO signs.' : r.status === 'fto_signed' ? 'Switch to the PO role view to add comments.' : 'No comments provided.'}</span>}</p>}
          {r.recruitComments && r.signatures.recruit && <p className="mt-1 text-xs text-muted-foreground">Frozen at PO acknowledgment.</p>}
        </div>
      </Panel>

      <Panel title="Weekly packet signatures">
        <div className="p-4 text-sm">
          <p>The daily log does not contain signature fields. The Weekly Packet Acknowledgement uses the Probationary Officer → FTO → Field Training Office sequence.</p>
          <Link href="/reports/weekly-ack" className="mt-2 inline-flex h-10 items-center rounded-sm bg-primary px-4 font-bold text-primary-foreground">Open Weekly Packet Acknowledgement</Link>
        </div>
      </Panel>
      </>}

      <PacketSubmitControl
        reportId={r.id}
        disabled={isDirty||runFormDirty||isNew}
        missingIncidentNumberCount={r.runs.filter(isDispatchedRunMissingIncidentNumber).length}
        onReturnToMissingRun={()=>{
          const missingRun=r.runs.find(isDispatchedRunMissingIncidentNumber);
          if(!missingRun)return;
          setStage('runs');
          editRun(missingRun);
          window.scrollTo({top:0,behavior:'smooth'});
        }}
      />
      <div className="editor-savebar" data-testid="bar-daily-save">
        <button type="button" disabled={EDITOR_STAGES[0].id===stage} onClick={()=>{const i=EDITOR_STAGES.findIndex(item=>item.id===stage);setStage(EDITOR_STAGES[Math.max(0,i-1)].id);window.scrollTo({top:0});}} className="inline-flex min-h-10 items-center gap-1 rounded border bg-card px-3 text-sm font-semibold disabled:opacity-40" data-testid="button-stage-back"><ChevronLeft className="h-4 w-4"/>Back</button>
        <span className="editor-savebar-state" data-testid="status-daily-save">
          {runFormDirty&&<><b className="text-accent">Open run not in daily log</b> · </>}
          {isDirty?<><b>Unsaved daily log changes</b>{previewOnly?' · preview keeps data in memory only until refresh':' · Save draft records them in this workspace'}</>:<>Daily log matches the saved workspace draft{previewOnly?' · preview memory only':''}</>}
        </span>
        <span className="flex gap-2">
          {(editable || commentsEditable) && <button type="button" onClick={()=>save()} className="min-h-10 rounded bg-primary px-4 text-sm font-bold text-primary-foreground" data-testid="button-save-draft-bar">{commentsEditable ? 'Save comments' : 'Save draft'}</button>}
          <button type="button" disabled={EDITOR_STAGES[EDITOR_STAGES.length-1].id===stage} onClick={()=>{const i=EDITOR_STAGES.findIndex(item=>item.id===stage);setStage(EDITOR_STAGES[Math.min(EDITOR_STAGES.length-1,i+1)].id);window.scrollTo({top:0});}} className="inline-flex min-h-10 items-center gap-1 rounded border bg-card px-3 text-sm font-semibold disabled:opacity-40" data-testid="button-stage-next">Next<ChevronRight className="h-4 w-4"/></button>
        </span>
      </div>
      <NewRunDialog open={newRunOpen&&editable} contextKey={operationalContextKey} defaultUnit={profile?.role==='FTO'&&profile.badge===r.ftoBadge?profile.identity?.cadUnit??'':''} onCancel={()=>setNewRunOpen(false)} onConfirm={startNewRun}/>
      <TrafficStopRiskPrompt open={riskPrompt&&editable} onOpenChange={setRiskPrompt} kind={riskCandidate} code={dispatchedCode}
        testId="dialog-run-high-risk" onChange={next=>{setRiskPrompt(false);requestRunKind(next,true);}}/>
      <RunChecklistUncheckedDialog
        open={!!uncheckedPrompt}
        rowLabel={uncheckedPrompt?.rowLabel??''}
        items={uncheckedPrompt?.items??[]}
        choices={uncheckedChoices}
        onChoicesChange={setUncheckedChoices}
        onCancel={()=>setUncheckedPrompt(null)}
        onConfirm={confirmUncheckedPrompt}/>
      <RunChecklistFailureDialog
        open={!!failurePrompt}
        parentLabel={failurePrompt?.label??''}
        choices={failurePrompt?.choices??[]}
        selected={failurePromptSelection}
        mode={failurePrompt?.mode??'clear'}
        onSelectedChange={setFailurePromptSelection}
        onCancel={()=>{if(failurePrompt)cancelFailurePrompt();}}
        onConfirm={confirmFailurePrompt}
      />
      <AlertDialog open={!!confirmAction} onOpenChange={open=>{if(!open)setConfirmAction(null);}}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{confirmAction?.title}</AlertDialogTitle><AlertDialogDescription>{confirmAction?.body}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel data-testid="button-confirm-action-cancel">Keep as is</AlertDialogCancel><AlertDialogAction onClick={()=>{const action=confirmAction?.action;setConfirmAction(null);action?.();}} data-testid="button-confirm-action">{confirmAction?.label}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>PO and FTO: review every performance category</AlertDialogTitle><AlertDialogDescription>Most categories start at Acceptable; eight categories start at Not Observed. Review all 30 category definitions and ratings, the Reporting for Duty checklist, and every run form for completeness. This saves a local review confirmation only; it does not submit a report or verify the PO’s identity.</AlertDialogDescription></AlertDialogHeader>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={reviewConfirmed} onChange={e=>setReviewConfirmed(e.target.checked)} data-testid="checkbox-rating-review" />I confirm every category was reviewed with the PO for the correct rating.</label>
          {errs.length>0 && <p role="alert" className="text-sm text-destructive">{errs.length} required evaluation or header items still need attention.</p>}
          <AlertDialogFooter><AlertDialogCancel>Return to categories</AlertDialogCancel><AlertDialogAction disabled={!reviewConfirmed || errs.length>0 || runFormDirty} onClick={()=>save(true)} data-testid="button-confirm-rating-review">Save local review</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete report for {r.recruitName}?</AlertDialogTitle><AlertDialogDescription>This draft will be removed from the workspace.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction data-testid="button-confirm-delete" onClick={()=>{ deleteReport(r.id); nav('/reports'); }}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="print-daily-package">
        <PrintableDailyForms report={r} orientation={orientationForReport} dayReference={trainingDayReference} packet={operationalPacket}/>
        <PrintableDailyLog report={r} dayReference={trainingDayReference} packet={operationalPacket}/>
      </div>
    </div>
  );
}
function F({ l, children }: { l: string; children: React.ReactNode }) { return <label className="block space-y-1"><span className="label-caps">{l}</span>{children}</label>; }
function DirectiveReviewEditor({value,onChange,disabled,dataTestId}:{value:DirectiveReviewRecord;onChange:(field:DirectiveReviewField,value:boolean|string|string[])=>void;disabled:boolean;dataTestId:string}) {
  const [query,setQuery]=useState('');
  const matchingDirectives=DIVISION_DIRECTIVES.filter(item=>`${item.number} ${item.title}`.toLowerCase().includes(query.trim().toLowerCase()));
  const directiveGroups=matchingDirectives.reduce((groups,item)=>{
    const chapter=item.number.split('.')[0];
    groups.set(chapter,[...(groups.get(chapter)??[]),item]);
    return groups;
  },new Map<string,typeof DIVISION_DIRECTIVES[number][]>());
  const selectedDirectives=value.selectedDirectives??[];
  const materials=reviewedTrainingMaterials(value);
  return <section className="rounded border border-primary/25 bg-muted/20 p-3" data-testid={dataTestId}>
    <h3 className="mb-2 text-sm font-bold">Directive and code references reviewed</h3>
    <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
      <div className="grid content-start gap-2">
        <label className="flex min-h-10 items-center gap-2 rounded border bg-card px-3 text-sm font-semibold"><input type="checkbox" disabled={disabled} checked={value.divisionDirectives} onChange={event=>onChange('divisionDirectives',event.target.checked)} data-testid={`${dataTestId}-division-directives`}/>Division Directives</label>
        {value.divisionDirectives&&<div className="rounded border bg-card p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <label className="block min-w-48 flex-1"><span className="label-caps">Find a directive</span><input type="search" disabled={disabled} value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search number or name" className="mt-1 h-10 w-full rounded border bg-background px-3 text-sm" data-testid={`${dataTestId}-directive-search`}/></label>
            <span className="text-xs text-muted-foreground">{selectedDirectives.length} selected</span>
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto rounded border bg-background p-2" aria-label="Division Directives list">
            {directiveGroups.size?Array.from(directiveGroups.entries()).map(([chapter,items])=><details key={chapter} open={!!query.trim()} className="rounded border p-2">
              <summary className="cursor-pointer font-semibold">Chapter {chapter} · {items.length} directives</summary>
              <div className="mt-2 grid gap-x-3 sm:grid-cols-2">{items.map(item=><label key={item.number} className="flex min-h-9 items-start gap-2 rounded-sm py-1 text-xs leading-5">
                <input type="checkbox" disabled={disabled} checked={selectedDirectives.includes(item.number)} onChange={event=>onChange('selectedDirectives',event.target.checked?[...selectedDirectives,item.number]:selectedDirectives.filter(number=>number!==item.number))} data-testid={`${dataTestId}-directive-${item.number.replace('.','-')}`}/>
                <span><b>{item.number}</b> {item.title}</span>
              </label>)}</div>
            </details>):<p className="p-2 text-sm text-muted-foreground">No directive matches that search.</p>}
          </div>
          <F l="Additional directive number(s) and name(s), if not listed"><input disabled={disabled} value={value.directiveDetails} onChange={event=>onChange('directiveDetails',event.target.value)} placeholder="Optional additional reference" className="mt-2 h-10 w-full rounded border bg-background px-3 text-sm font-normal" data-testid={`${dataTestId}-directive-details`}/></F>
          <a className="mt-2 inline-block text-xs text-primary underline" href={DIVISION_DIRECTIVE_SOURCE_URL} target="_blank" rel="noreferrer">Official directive library · revised {DIVISION_DIRECTIVE_SOURCE_REVISION}</a>
        </div>}
      </div>
      <div className="grid content-start gap-2">
        <label className="flex min-h-10 items-center gap-2 rounded border bg-card px-3 text-sm"><input type="checkbox" disabled={disabled} checked={value.ohioRevisedCode} onChange={event=>onChange('ohioRevisedCode',event.target.checked)} data-testid={`${dataTestId}-ohio-revised-code`}/>Ohio Revised Code</label>
        {value.ohioRevisedCode&&<ReferencePicker label="Add ORC sections" placeholder="Example: 2903.13 — Assault" values={value.selectedOrcReferences??[]} disabled={disabled} dataTestId={`${dataTestId}-orc`} onChange={references=>onChange('selectedOrcReferences',references)}/>}
        <label className="flex min-h-10 items-center gap-2 rounded border bg-card px-3 text-sm"><input type="checkbox" disabled={disabled} checked={value.columbusCityCode} onChange={event=>onChange('columbusCityCode',event.target.checked)} data-testid={`${dataTestId}-city-code`}/>Columbus City Code</label>
        {value.columbusCityCode&&<ReferencePicker label="Add Columbus City Code sections" placeholder="Enter section number and name" values={value.selectedColumbusCodeReferences??[]} disabled={disabled} dataTestId={`${dataTestId}-city-code-ref`} onChange={references=>onChange('selectedColumbusCodeReferences',references)}/>}
        <label className="flex min-h-10 items-center gap-2 rounded border bg-card px-3 text-sm"><input type="checkbox" disabled={disabled} checked={value.other} onChange={event=>onChange('other',event.target.checked)} data-testid={`${dataTestId}-other`}/>Other</label>
        {value.other&&<F l="Other reference"><input disabled={disabled} value={value.otherDetails} onChange={event=>onChange('otherDetails',event.target.value)} placeholder="Enter the reference name or number" className="h-10 w-full rounded border bg-card px-3 text-sm font-normal" data-testid={`${dataTestId}-other-details`}/></F>}
      </div>
    </div>
    <div className="mt-3 overflow-x-auto rounded border bg-card">
      <table className="w-full min-w-[25rem] border-collapse text-left text-sm" data-testid={`${dataTestId}-reviewed-materials`}>
        <caption className="border-b px-3 py-2 text-left font-bold">Reviewed training materials · {materials.length}</caption>
        <thead><tr className="bg-muted/40"><th scope="col" className="w-48 border-b px-3 py-2">Type</th><th scope="col" className="border-b px-3 py-2">Reference or material</th></tr></thead>
        <tbody>{materials.map((material,index)=><tr key={`${material.type}-${material.reference}-${index}`}><td className="border-b px-3 py-2 font-semibold">{material.type}</td><td className="border-b px-3 py-2">{material.reference}</td></tr>)}
          {!materials.length&&<tr><td colSpan={2} className="px-3 py-3 text-muted-foreground">No specific reference has been added yet.</td></tr>}
        </tbody>
      </table>
    </div>
  </section>;
}

function ReferencePicker({label,placeholder,values,disabled,dataTestId,onChange}:{label:string;placeholder:string;values:string[];disabled:boolean;dataTestId:string;onChange:(values:string[])=>void}) {
  const [draft,setDraft]=useState('');
  const addReference=()=>{
    const reference=draft.trim().replace(/[;,]+$/,'');
    if(!reference)return;
    if(!values.some(value=>value.toLowerCase()===reference.toLowerCase()))onChange([...values,reference]);
    setDraft('');
  };
  return <div className="rounded border bg-card p-2">
    <label className="block text-xs font-semibold">
      <span>{label}</span>
      <span className="mt-1 flex gap-2">
        <input disabled={disabled} value={draft} onChange={event=>setDraft(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();addReference();}}} placeholder={placeholder} className="h-10 min-w-0 flex-1 rounded border bg-background px-2 text-sm font-normal" data-testid={`${dataTestId}-input`}/>
        <button type="button" disabled={disabled||!draft.trim()} onClick={addReference} className="h-10 shrink-0 rounded border px-3 text-xs font-bold disabled:opacity-50" data-testid={`${dataTestId}-add`}>Add</button>
      </span>
    </label>
    {values.length>0&&<ul className="mt-2 divide-y rounded border" aria-label={`${label} selected items`}>
      {values.map((reference,index)=><li key={`${reference}-${index}`} className="flex min-h-10 items-center gap-2 px-2 py-1 text-sm">
        <span className="min-w-0 flex-1 break-words">{reference}</span>
        <button type="button" disabled={disabled} onClick={()=>onChange(values.filter((_,itemIndex)=>itemIndex!==index))} className="rounded border px-2 py-1 text-xs font-semibold text-destructive disabled:opacity-50" aria-label={`Remove ${reference}`} data-testid={`${dataTestId}-remove-${index}`}>Remove</button>
      </li>)}
    </ul>}
  </div>;
}
