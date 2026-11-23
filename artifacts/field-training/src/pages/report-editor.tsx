import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { ArrowLeft, ShieldAlert, Lock, Trash2, Info, Printer, Plus, ClipboardList, Trash } from 'lucide-react';
import { useOperationalStateMachine, useWorkspace } from '@/state/workspace.js';
import { CATEGORIES, CATEGORY_LABEL, DAILY_ACTIVITY_COLUMNS, DAILY_ACTIVITY_FIELDS, DAILY_DUTY_CHECKLIST, DIRECTIVE_REVIEW_LABEL, PHASE_PROGRAM_WEEK_START, defaultDirectiveReviewRecord, defaultRatings, dutyChecklistChecked, emptyRatings, emptyDailyActivitySummary, emptyReportingForDutyRecord, hasRunChecklistEdits, requiredSupplementalForms, SEG_CATEGORIES, SEG_RATING_COLUMNS, SEG_RATING_GROUP_LABELS, phaseAssignmentLabel, phaseLabel, RATINGS, RATING_LEGEND, WEEKDAYS, shiftDisplayLabel, needsJustification, ratingLabel, scanPII, uid, validateReport, PRIMARY_RUN_FORMS, RUN_FORM_GUIDANCE, SUPPLEMENTAL_FORM_GUIDANCE, SUPPLEMENTAL_RUN_FORMS, RUN_CHECKLIST_ITEMS, RUN_CHECKLIST_SECTIONS, RUN_SUPPLEMENT_CHECKLIST_ITEMS, RUN_SUPPLEMENT_CHECKLIST_SECTIONS, newRunChecklist, type ActivityKey, type Category, type DirectiveReviewField, type DirectiveReviewForm, type DirectiveReviewRecord, type PhaseCaseFolder, type Rating, type Report, type TrainingRun, type PrimaryRunForm, type SupplementalRunForm } from '@/lib/model.js';
import { PageHead, Panel, StatusPill } from '@/components/bits.js';
import { SearchableSelect } from '@/components/searchable-select.js';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog.js';
import {
  DIVISION_DIRECTIVES, DIVISION_DIRECTIVE_SOURCE_REVISION, DIVISION_DIRECTIVE_SOURCE_URL,
} from '@/lib/division-directives.js';
import { reviewedTrainingMaterials } from '@/lib/training-materials.js';
import { useToast } from '@/hooks/use-toast.js';
import { cn } from '@/lib/utils.js';
import { currentDateTimeMDY, formatDateDMY, formatDateEntryMDY, formatDateTimeMDY, getNextReportDate, getPhaseScheduleInfo, getSundaySaturdayWeek, getWeekdayIndex, parseDateDMY, requiredDaysOff, shiftWeekDescription, splitDateTimeEntryMDY } from '@/lib/training-calendar.js';
import { isValidAssignment } from '@/lib/cpd-geography.js';
import { PrintableDailyLog } from '@/components/printable-daily-log.js';
import { PrintableDailyForms } from '@/components/printable-daily-forms.js';
import { activityDiscrepancies, activityTotals, buildClearanceDocuments, clearanceDerivedActivityCounts, manualActivityEntryForTotal, runActivityValidationError, runDerivedActivityCounts } from '@/lib/run-activity.js';
import { checklistForMetadata, toggleChecklistSection } from '@/lib/run-checklist-state.js';
import { buildRunNarrativeDraft } from '@/lib/run-narrative-draft.js';
import { isRtRestricted } from '@/lib/model.js';
import { DEFAULT_RUN_TYPE_CODES, RADIO_CODES, CLEARANCE_CODES, SITUATION_FOUND_NA, formatRadioCode, isEligibleCitationSummons, normalizeRadioCode, normalizeSituationFoundCode, isValidRadioCode, isValidSituationFoundCode } from '@/lib/radio-codes.js';
import { alignRunDateToShift, parseRunDateTime } from '@/lib/run-details.js';
import { useDeficiencyEditor } from '@/hooks/use-deficiency-editor.js';
import { DeficiencyDialog } from '@/components/deficiency-dialog.js';
import { createDailyReportDraft } from '@/lib/daily-report-draft.js';
import { applyDispatchPrefillValue } from '@/lib/dispatch-prefill.js';
import { usePatrolViewSync } from '@/hooks/use-patrolview-sync.js';

function checklistHelp(form:string,meaning:string) {
  return `${form}: ${meaning} Keep checked only when the PO completed the described action acceptably. Clearing an applicable task creates a UA deficiency. Use the Not applicable control for an inapplicable form or group; document observed facts and any training actually completed.`;
}
function dutyChecklistHelp(section:string,item:string) {
  return `Reporting for Duty · ${section}: indicates the PO ${item.toLowerCase()}. Clearing an applicable task creates a UA deficiency. Use the section's Not applicable control when the section does not apply.`;
}
function runTypeCodeHelp(kind:PrimaryRunForm) {
  if(kind==='traffic_stop')return 'Traffic Stop is fixed to 10-6 · Traffic Violator/Complaint.';
  if(kind==='domestic_incident')return 'Defaults to 10-17 · Domestic Violence. Situation Found can use any listed code.';
  if(kind==='traffic_crash')return 'Defaults to 10-4 · property-damage crash. Change to the applicable injury or hit-skip code when needed.';
  if(kind==='high_risk_stop')return 'Defaults to 10-6. Change to the original dispatched code if it was different.';
  if(kind==='building_search')return 'No single code represents every building search; choose the actual dispatched code.';
  if(kind==='self_initiated')return 'No single code represents every self-initiated run; choose the actual code.';
  return 'Choose the actual dispatched code; calls for service can use different 10-codes.';
}

export default function ReportEditor() {
  const params = useParams<{ id?: string }>();
  const isNew = !params.id || params.id === 'new';
  const { ws, upsertReport, deleteReport, setEditorDirty, getOperationalPacket, previewOnly } = useWorkspace();
  const [, nav] = useLocation();
  const { toast } = useToast();
  useEffect(() => {
    document.body.classList.add('print-daily-route');
    return () => document.body.classList.remove('print-daily-route');
  }, []);
  const existing = isNew ? undefined : ws.reports.find(r => r.id === params.id);
  const [r, setR] = useState<Report | undefined>(() => existing ? structuredClone(existing) : isNew && ws.caseFolder && !!ws.caseFolder.ftoAssignment && isValidAssignment(ws.caseFolder.zone, ws.caseFolder.precinct, ws.caseFolder.cruiserDistrict) && (ws.caseFolder.daysOff?.length ?? 0) === requiredDaysOff(ws.caseFolder.shift) ? createDailyReportDraft(ws.caseFolder,getNextReportDate(ws.caseFolder,ws.reports),ws.reports.filter(report=>report.phase===ws.caseFolder?.phase&&report.recruitBadge===ws.caseFolder.recruitBadge&&(report.className??'')===(ws.caseFolder.className??'')).sort((a,b)=>b.date.localeCompare(a.date))[0]) : undefined);
  const operationalPacket = useOperationalStateMachine(r);
  const [initialReport] = useState(()=>JSON.stringify(r ?? null));
  const [dateText, setDateText] = useState(() => r ? formatDateDMY(r.date) : '');
  const [showErr, setShowErr] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [editingRunId, setEditingRunId] = useState<string | null>(null);
  const [runDraftId, setRunDraftId] = useState(uid);
  const [runKind, setRunKind] = useState<PrimaryRunForm>('call_for_service');
  const [runDateTimeText, setRunDateTimeText] = useState(() => r ? formatDateDMY(r.date) : '');
  const [runTimeText, setRunTimeText] = useState('');
  const [incidentNumber, setIncidentNumber] = useState('');
  const [runLocation, setRunLocation] = useState('');
  const dispatchEventId = useMemo(() => new URLSearchParams(window.location.search).get('patrolViewEventId')?.trim() ?? '', []);
  const [runError, setRunError] = useState('');
  const [runDispatched, setRunDispatched] = useState(true);
  const [trafficMode, setTrafficMode] = useState<TrainingRun['trafficMode']>('none');
  const [activityFlags, setActivityFlags] = useState<Partial<Record<ActivityKey,boolean>>>({});
  const [dispatchedCode, setDispatchedCode] = useState('');
  const { status: dispatchPrefillStatus, reset: resetDispatchPrefill } = usePatrolViewSync({
    eventId: dispatchEventId,
    enabled: isNew && !!r && r.status === 'draft' && ws.role === 'fto',
    draft: {
      runDateTimeText,
      runTimeText,
      incidentNumber,
      runLocation,
      dispatchedCode,
    },
    onPrefill: (initial, prefill) => {
      const eventDateTimeText = prefill.eventIngressAt
        ? formatDateTimeMDY(prefill.eventIngressAt)
        : undefined;
      setRunDateTimeText(current => applyDispatchPrefillValue(current, initial.runDateTimeText, eventDateTimeText));
      setRunTimeText(current => applyDispatchPrefillValue(current, initial.runTimeText, eventDateTimeText?.split(' ')[1]));
      setIncidentNumber(current => applyDispatchPrefillValue(current, initial.incidentNumber, prefill.incidentNumber));
      setRunLocation(current => applyDispatchPrefillValue(current, initial.runLocation, prefill.location));
      setDispatchedCode(current => applyDispatchPrefillValue(current, initial.dispatchedCode, prefill.dispatchedCode));
    },
  });
  const [situationFoundCode, setSituationFoundCode] = useState(SITUATION_FOUND_NA);
  const [clearanceCode, setClearanceCode] = useState<NonNullable<TrainingRun['clearanceCode']>>('');
  const [chargeText, setChargeText] = useState('');
  const [arrestMade, setArrestMade] = useState(false);
  const [transported, setTransported] = useState(false);
  const [transportDestination, setTransportDestination] = useState('');
  const [transportDestinationType, setTransportDestinationType] = useState<TrainingRun['transportDestinationType']>();
  const [arrestProcessRequired, setArrestProcessRequired] = useState(false);
  const [oviProcessed, setOviProcessed] = useState(false);
  const [narrativeAdditionRequired, setNarrativeAdditionRequired] = useState(false);
  const [runNarrative, setRunNarrative] = useState('');
  const [runChecklist, setRunChecklistState] = useState<Record<string, boolean>>(()=>newRunChecklist('call_for_service'));
  const setRunChecklist: typeof setRunChecklistState = update => {
    setRunChecklistState(update);
    setR(current => current && ({ ...current, deficiencyAutomationEnabled: true, ratingsReviewedAt: undefined }));
  };
  const [directiveReviews,setDirectiveReviews]=useState<Partial<Record<DirectiveReviewForm,DirectiveReviewRecord>>>({});
  const [runReviewOpen, setRunReviewOpen] = useState(false);
  const [runChecklistReviewed, setRunChecklistReviewed] = useState(false);
  const generatedNarrativeRef = useRef('');
  const runReviewConfirmedRef = useRef(false);
  const candidateRun = useMemo<TrainingRun | undefined>(() => {
    const occurredAt=parseRunDateTime(runDateTimeText);
    if (!r || !occurredAt || (!editingRunId && !Object.entries(runChecklist).some(([key, value]) => !value && /^(task-|supp-)/.test(key)))) return undefined;
    return {
      clearanceRulesVersion:editingRunId?r?.runs.find(run=>run.id===editingRunId)?.clearanceRulesVersion:1,
      id: editingRunId ?? runDraftId, occurredAt,
      runKind, isDispatched: runDispatched, trafficMode, arrestMade,
      transportedAfterArrest: arrestMade && transported, arrestProcessRequired,
      transportDestination:arrestMade&&transported?transportDestination.trim()||undefined:undefined,
      transportDestinationType:arrestMade&&transported?transportDestinationType:undefined,
      clearanceCode,
      oviProcessed, narrativeAdditionRequired, checklist: runChecklist, narrative: runNarrative,
      formStatus: runNarrative.trim() ? 'complete' : 'in_progress',
    };
  }, [r?.date, editingRunId, runDraftId, runDateTimeText, runKind, runDispatched, trafficMode, arrestMade, transported, transportDestination, transportDestinationType, clearanceCode, arrestProcessRequired, oviProcessed, narrativeAdditionRequired, runChecklist, runNarrative]);
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
  let checklistOffset=0;
  const primaryChecklistGroups=RUN_CHECKLIST_SECTIONS[runKind].map(section=>{
    const start=checklistOffset;
    checklistOffset+=section.items.length;
    return {...section,start};
  });
  const requiredSupplements = requiredSupplementalForms({ runKind, trafficMode, isDispatched:runDispatched, arrestMade, transportedAfterArrest:arrestMade && transported, arrestProcessRequired, oviProcessed, narrativeAdditionRequired });
  const supplementCheckItems = RUN_SUPPLEMENT_CHECKLIST_ITEMS;
  const isLimboDay=!!r?.limboDay;
  const citationSummonsRecorded=isEligibleCitationSummons({runKind,clearanceCode});

  const baseline = useMemo(() => JSON.stringify(existing ?? null), [existing]);
  const previousRun=editingRunId?r?.runs.find(item=>item.id===editingRunId):undefined;
  const directiveReviewsDirty=JSON.stringify(directiveReviews)!==JSON.stringify(previousRun?.directiveReviews??{});
  const runFormDirty = editingRunId !== null || !!dispatchedCode || situationFoundCode !== SITUATION_FOUND_NA || !!clearanceCode || Object.values(activityFlags).some(Boolean) || runDateTimeText !== (r ? formatDateDMY(r.date) : '') || runTimeText !== '' || runKind !== 'call_for_service' || !runDispatched || trafficMode !== 'none' || arrestMade || transported || transportDestination.trim() !== '' || !!transportDestinationType || arrestProcessRequired || oviProcessed || narrativeAdditionRequired || incidentNumber.trim() !== '' || runLocation.trim() !== '' || runNarrative.trim() !== '' || directiveReviewsDirty || hasRunChecklistEdits(runChecklist);
  const isDirty = !!r && (JSON.stringify(r) !== (isNew ? initialReport : baseline) || dateText !== formatDateDMY(r.date) || runFormDirty);
  useEffect(() => { setEditorDirty(isDirty); }, [isDirty, setEditorDirty]);
  useEffect(() => () => setEditorDirty(false), [setEditorDirty]);
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

  const locked = r.status === 'locked';
  const editable = r.status === 'draft' && ws.role === 'fto';
  const commentsEditable = r.status === 'fto_signed' && ws.role === 'po';
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
  const checklistFor = (kind:PrimaryRunForm,mode:TrainingRun['trafficMode'],dispatched:boolean,arrest:boolean,transport:boolean,ovi:boolean,narrative:boolean,prior:Record<string,boolean>={},arrestProcess=false) =>
    checklistForMetadata({
      runKind:kind,
      trafficMode:mode,
      isDispatched:dispatched,
      arrestMade:arrest,
      transportedAfterArrest:arrest&&transport,
      arrestProcessRequired:arrestProcess,
      oviProcessed:ovi,
      narrativeAdditionRequired:narrative,
    },prior);
  const setArrestState = (value:boolean) => {
    setArrestMade(value);
    const nextTransported=value;
    if(value){setTransported(true);setClearanceCode('3V');}
    if(!value){
      setTransported(false);setTransportDestination('');setTransportDestinationType(undefined);setArrestProcessRequired(false);
      if(clearanceCode==='3V')setClearanceCode('');
    }
    setRunChecklist(prev=>checklistFor(runKind,trafficMode,runDispatched,value,nextTransported,oviProcessed,narrativeAdditionRequired,prev,value&&arrestProcessRequired));
    setRunChecklistReviewed(false);
  };
  const setTransportState=(value:boolean)=>{
    setTransported(value);
    if(!value){
      setTransportDestination('');
      setTransportDestinationType(undefined);
      if(arrestMade&&clearanceCode!=='1V')setClearanceCode('1V');
    }
    setRunChecklist(prev=>checklistFor(runKind,trafficMode,runDispatched,arrestMade,value,oviProcessed,narrativeAdditionRequired,prev,arrestProcessRequired));
    setRunChecklistReviewed(false);
  };

  const addRun = () => {
    if (!r || !editable) return;
    const localRunDateTime = parseRunDateTime(runDateTimeText);
    if (!localRunDateTime) {
      setRunError('Enter a valid run date and time together as MM/DD/YYYY HH:MM in 24-hour time.');
      return;
    }
    if (!isValidRadioCode(dispatchedCode) || !isValidSituationFoundCode(situationFoundCode)) {
      setRunError('Enter the code number and optional letters, such as 6 or 17A. The 10- prefix is supplied.');
      return;
    }
    const activityError=runActivityValidationError({
      runKind,dispatchedCode,clearanceCode,activityFlags,arrestMade,
      clearanceRulesVersion:editingRunId?r.runs.find(run=>run.id===editingRunId)?.clearanceRulesVersion:1,
      transportedAfterArrest:arrestMade&&transported,
      transportDestination,
      transportDestinationType,
    });
    if(activityError){setRunError(activityError);return;}
    if (!runChecklistReviewed) {
      setRunReviewOpen(true);
      return;
    }
    setRunReviewOpen(false);
    setRunError('');
    const previous = editingRunId ? r.runs.find(item => item.id === editingRunId) : undefined;
    const activeDirectiveForms:DirectiveReviewForm[]=[
      ...(primaryDirectiveIndex>=0&&runChecklist[`task-${primaryDirectiveIndex}`]!==false?[runKind]:[]),
      ...requiredSupplements.filter(form=>RUN_SUPPLEMENT_CHECKLIST_ITEMS[form].includes(DIRECTIVE_REVIEW_LABEL)&&runChecklist[`supp-${form}-${RUN_SUPPLEMENT_CHECKLIST_ITEMS[form].indexOf(DIRECTIVE_REVIEW_LABEL)}`]!==false),
    ];
    const directiveReviewsToSave=Object.fromEntries(activeDirectiveForms.filter(form=>directiveReviews[form]).map(form=>[form,directiveReviews[form]])) as Partial<Record<DirectiveReviewForm,DirectiveReviewRecord>>;
    const nextRun: TrainingRun = {
      clearanceRulesVersion: previous ? previous.clearanceRulesVersion : 1,
      charges: chargeText.split('\n').map(text=>text.trim()).filter(Boolean).map((description,index)=>({
        id: previous?.charges?.[index]?.description===description ? previous.charges[index].id : `${previous?.id??runDraftId}:charge:${index}`,
        description,
      })),
      id: previous?.id ?? runDraftId,
      incidentNumber: incidentNumber.trim() || undefined,
      location: runLocation.trim() || undefined,
      transportDestination:arrestMade&&transported?transportDestination.trim():undefined,
      transportDestinationType:arrestMade&&transported?transportDestinationType:undefined,
      occurredAt: localRunDateTime,
      runKind, isDispatched: runDispatched, trafficMode, arrestMade,
      activityFlags:{...activityFlags}, dispatchedCode, situationFoundCode, clearanceCode,
      transportedAfterArrest: arrestMade && transported, arrestProcessRequired: arrestMade && arrestProcessRequired, oviProcessed, narrativeAdditionRequired,
      formStatus: !!runNarrative.trim() ? 'complete' : 'in_progress',
      checklist: { ...runChecklist }, directiveReviews:directiveReviewsToSave, checklistReviewedAt:new Date().toISOString(), narrative: runNarrative,
    };
    nextRun.generatedDocuments=buildClearanceDocuments(nextRun);
    setR(current=>current && ({...current,ratingsReviewedAt:undefined,runs: previous ? current.runs.map(item => item.id === previous.id ? nextRun : item) : [...current.runs, nextRun]}));
    resetRunForm();
  };
  const confirmRunReview = () => {
    if (!runChecklistReviewed) return;
    if (!runNarrative.trim() || runNarrative === generatedNarrativeRef.current) {
      const draft = buildRunNarrativeDraft(runKind, runChecklist, requiredSupplements);
      generatedNarrativeRef.current = draft;
      setRunNarrative(draft);
    }
    runReviewConfirmedRef.current = true;
    setRunReviewOpen(false);
  };
  const resetRunForm = () => {
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
    setChargeText('');
    setEditingRunId(null); setRunKind('call_for_service'); setRunDateTimeText(dateText); setRunTimeText(''); setRunDispatched(true); setRunError(''); runReviewConfirmedRef.current = false;
    resetDispatchPrefill();
    setIncidentNumber(''); setRunLocation(''); generatedNarrativeRef.current = '';
    setTrafficMode('none'); setArrestMade(false); setTransported(false); setTransportDestination(''); setTransportDestinationType(undefined); setArrestProcessRequired(false); setOviProcessed(false); setNarrativeAdditionRequired(false);
    setActivityFlags({}); setDispatchedCode(''); setSituationFoundCode(SITUATION_FOUND_NA); setClearanceCode('');
    setRunNarrative(''); setRunChecklist(newRunChecklist('call_for_service')); setDirectiveReviews({}); setRunReviewOpen(false); setRunChecklistReviewed(false);
  };
  const editRun = (run: TrainingRun) => {
    deficiencyEditor.resetIncident();
    setChargeText((run.charges??[]).map(charge=>charge.description).join('\n'));
    setEditingRunId(run.id); setRunKind(run.runKind);
    runReviewConfirmedRef.current = false;
    setIncidentNumber(run.incidentNumber ?? ''); setRunLocation(run.location ?? ''); generatedNarrativeRef.current = '';
    const occurredAt = new Date(run.occurredAt);
    const localDateTime = new Date(occurredAt.getTime() - occurredAt.getTimezoneOffset() * 60000).toISOString();
    const localRunDateTime=`${formatDateDMY(localDateTime.slice(0,10))} ${localDateTime.slice(11,16)}`;
    setRunDateTimeText(localRunDateTime); setRunTimeText(splitDateTimeEntryMDY(localRunDateTime).time); setRunDispatched(run.isDispatched);
    setTrafficMode(run.trafficMode); setArrestMade(run.arrestMade);
    setActivityFlags(run.activityFlags ?? {}); setDispatchedCode(run.runKind==='traffic_stop'?'6':run.dispatchedCode ?? DEFAULT_RUN_TYPE_CODES[run.runKind] ?? '');
    setSituationFoundCode(run.situationFoundCode ?? ''); setClearanceCode(run.clearanceCode ?? '');
    setTransported(run.transportedAfterArrest); setTransportDestination(run.transportDestination??''); setTransportDestinationType(run.transportDestinationType); setArrestProcessRequired(!!run.arrestProcessRequired); setOviProcessed(run.oviProcessed);
    setNarrativeAdditionRequired(run.narrativeAdditionRequired);
    setDirectiveReviews(run.directiveReviews??{});
    setRunNarrative(run.narrative); setRunChecklist(run.checklist ?? {}); setRunReviewOpen(false); setRunChecklistReviewed(false);
  };
  const selectedForm = PRIMARY_RUN_FORMS.find(item => item.key === runKind)!;
  function save(reviewed = false,nextWorkingDay = false): boolean {
    if (!r) return false;
    if(reviewed&&errs.length){setShowErr(true);return false;}
    if (!parsedDate || selectedDayOff) { setShowErr(true); return false; }
    if (runFormDirty) { toast({title:'Add or update the run first',description:'The open run form is not yet part of this daily log.',variant:'destructive'}); return false; }
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
    if (runFormDirty) { toast({title:'Save the open run first',description:'Finish or cancel the run form before opening NRT follow-up.',variant:'destructive'}); return; }
    const next={...r,date:parsedDate,updatedAt:new Date().toISOString()};
    upsertReport(next); setR(next);
    nav(`/reports/${next.id}/nrt-follow-up?category=${encodeURIComponent(category)}`);
  };
  const inp = 'h-10 w-full rounded border bg-card px-3 text-sm disabled:opacity-70';
  const radioCodePrefix='inline-flex h-10 w-12 shrink-0 items-center justify-center whitespace-nowrap rounded-l border border-r-0 bg-muted px-3 text-base font-bold leading-none';
  const radioCodeInput='h-10 min-w-0 flex-1 rounded-r border bg-card px-3 font-mono text-base uppercase disabled:opacity-70';
  const week = getSundaySaturdayWeek(r.date);
  const orientationForReport=operationalPacket?.orientation;
  const trainingDayReference=operationalPacket?.dayReference;
  const runDerivedActivity=runDerivedActivityCounts(r?.runs??[]);
  const trafficSolveSuggestion=runKind==='traffic_stop'&&dispatchedCode==='6'&&citationSummonsRecorded;
  const totalActivity=activityTotals(r??{activity:emptyDailyActivitySummary()});
  const activityMismatchFields=activityDiscrepancies(totalActivity,runDerivedActivity)
    .filter(key=>runDerivedActivity[key]>0||totalActivity[key]>0)
    .map(key=>DAILY_ACTIVITY_FIELDS.find(field=>field.key===key)!)
    .filter(Boolean);

  return (
    <div className="report-editor-page max-w-5xl">
      <DeficiencyDialog group={deficiencyEditor.active} onNarrative={deficiencyEditor.setNarrative} onOverride={deficiencyEditor.override} onClose={deficiencyEditor.close}/>
      <Link href="/reports" className="text-sm font-semibold inline-flex items-center gap-1 mb-2 hover:underline" data-testid="link-back"><ArrowLeft className="h-4 w-4" />Saved records</Link>
      <PageHead kicker="Shift workspace · Daily Performance Log · U-10.174" title={r.recruitName ? `PO ${r.recruitName} #${r.recruitBadge}` : 'Probationary Officer shift'}>
        <StatusPill s={r.status} />
        <button type="button" data-testid="button-print-daily-log" onClick={() => { if(operationalPacket?.blockingIssues.length){toast({title:'Complete the phase-start packet',description:operationalPacket.blockingIssues.join(' '),variant:'destructive'});return;} window.print(); }} className="h-10 px-3 rounded border bg-card text-sm font-bold inline-flex items-center gap-1.5"><Printer className="h-4 w-4" />Print all forms / PDF</button>
        {r.phase===1&&<Link href="/substation-orientation" className="inline-flex h-10 items-center rounded border bg-card px-3 text-sm font-bold">Substation Orientation</Link>}
        {(editable || commentsEditable) && <button data-testid="button-save-draft" onClick={()=>save()} className="h-10 px-4 rounded bg-primary text-primary-foreground font-bold text-sm active:scale-[.98] transition">{commentsEditable ? 'Save comments' : 'Save draft'}{isDirty && ' *'}</button>}
        {editable && <button data-testid="button-save-next-workday" onClick={()=>save(false,true)} className="h-10 rounded border bg-card px-3 text-sm font-semibold">Save and next workday</button>}
        {editable && !isLimboDay && <button type="button" className="h-10 rounded border bg-card px-3 text-sm font-bold" onClick={()=>{setReviewConfirmed(false);setReviewOpen(true);}} data-testid="button-review-ratings">Review before submission</button>}
        {!isNew && r.status === 'draft' && ws.role === 'fto' && <button data-testid="button-delete" onClick={()=>setConfirmDel(true)} className="h-10 px-3 rounded border text-sm text-destructive inline-flex items-center gap-1.5 hover:bg-destructive/10"><Trash2 className="h-4 w-4" />Delete</button>}
      </PageHead>
      {r.substituteCoverage && <p className="mb-4 rounded border border-accent/40 bg-accent/10 p-3 text-sm" data-testid="text-substitute-coverage"><b>Substitute coverage:</b> FTO {r.ftoName} #{r.ftoBadge} for FTO {r.substituteCoverage.regularFtoName} #{r.substituteCoverage.regularFtoBadge} on {formatDateDMY(r.date)}. This log does not change the regular phase assignment.</p>}
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 rounded border bg-card p-3 text-xs" aria-label="Performance rating legend">
        {RATING_LEGEND.map(({code,label})=><span key={code}><b>{code}</b> · {label}</span>)}
      </div>
      <p className="mb-3 rounded border bg-muted/30 p-3 text-sm text-muted-foreground">One shift workspace holds the daily duty form, each run and its required paperwork, activity counts, SEG ratings, and narrative. Use these shortcuts to move between sections without leaving the shift or opening a separate page for each form.</p>
      <nav aria-label="Shift form sections" className="sticky top-10 z-30 mb-4 flex gap-1 overflow-x-auto rounded border bg-card p-1 shadow-sm" data-testid="nav-shift-sections">
        {[['shift-details','Shift'],['duty-form','Duty'],['run-forms','Runs & forms'],['activity-summary','Activity'],['seg-ratings','SEG ratings'],['shift-narrative','Narrative'],['po-comments','PO comments']].map(([id,label])=><a key={id} href={`#${id}`} className="shrink-0 rounded px-3 py-2 text-xs font-semibold hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{label}</a>)}
      </nav>
      {ws.role !== 'fto_coordinator' && !editable && !locked && <div className="rise mb-3 text-sm rounded border bg-card p-3 flex gap-2"><Info className="h-4 w-4 mt-0.5 shrink-0" />{r.status === 'draft' ? 'Switch to the FTO role view to edit this draft.' : 'No official signature or approval has been recorded.'}</div>}
      {locked && <div className="rise mb-3 text-sm rounded border border-foreground bg-foreground text-background p-3 flex gap-2"><Lock className="h-4 w-4 mt-0.5" />This record is locked locally. No official signature or approval is verified.</div>}

      <div className="rise mb-4 rounded-md border-2 border-destructive/60 bg-destructive/5 p-3 text-sm flex gap-2" data-testid="warning-pii"><ShieldAlert className="h-5 w-5 text-destructive shrink-0" /><div><b>Do not enter suspect PII, criminal history, or restricted identifiers</b> (SSNs, DOBs, license numbers, case or booking numbers, records-system results). Describe the PO's performance only.
        {pii.length > 0 && <ul className="mt-1.5 font-semibold text-destructive list-disc pl-5" data-testid="list-pii-hits">{pii.map(p=><li key={p}>Possible: {p}. Remove before saving.</li>)}</ul>}</div></div>

      {r.legacyEvaluation && <details className="mb-4 rounded border bg-card p-3 text-sm"><summary className="cursor-pointer font-semibold">Preserved earlier SEG values · excluded from current totals</summary><p className="my-2">Only matching current category keys were carried forward. Superseded category values remain here for comparison, not as extra SEGs.</p><ul>{Object.entries(r.legacyEvaluation.ratings).map(([key,value])=><li key={key}>{key}: {value.rating || 'Unrated'} {value.justification}</li>)}</ul></details>}
      {r.legacyGeography && <div className="rise mb-4 rounded border border-warn bg-card p-3 text-sm" data-testid="warning-legacy-geography"><b>Previous assignment text was preserved but not mapped.</b> It is not used as current Division geography. New logs inherit the selected Zone, Precinct, and FTO Assignment from the case folder.</div>}

      {showErr && errs.length > 0 && <div role="alert" className="rise mb-4 rounded border border-destructive bg-card p-3 text-sm" data-testid="list-errors"><b className="text-destructive">Required before any signature (drafts may be saved incomplete):</b><ul className="list-disc pl-5 mt-1">{errs.map(e=><li key={e}>{e}</li>)}</ul></div>}

      <Panel id="shift-details" title="Shift metadata" className="mb-4 scroll-mt-28">
        <p className="border-b px-4 py-3 text-sm text-muted-foreground">The assigned FTO’s name and badge come from the phase assignment and are saved as this report’s identity snapshot.</p>
        <fieldset disabled={!editable} className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
          <F l="Shift date (MM/DD/YYYY)"><input type="text" inputMode="text" maxLength={10} placeholder="MM/DD/YYYY" className={inp+' mono'} value={dateText} onChange={e=>{const value=formatDateEntryMDY(e.target.value);setDateText(value);if(!editingRunId)setRunDateTimeText(current=>alignRunDateToShift(current,value));applyShiftDate(value);}} onKeyDown={event=>{if(event.key==='Enter'&&event.currentTarget.value.trim()==='?'){event.preventDefault();const today=currentDateTimeMDY().date;setDateText(today);if(!editingRunId)setRunDateTimeText(current=>alignRunDateToShift(current,today));applyShiftDate(today);}}} data-testid="input-date" /><span className="text-xs font-normal text-muted-foreground">Slashes are added automatically. Enter ? then press Enter for today.</span></F>
           <F l="Shift time"><input required type="time" className={inp+' mono'} value={r.shiftStartTime??''} onChange={event=>set('shiftStartTime',event.target.value)} data-testid="input-shift-start-time" /><span className="text-xs font-normal text-muted-foreground">Enter the actual shift start time in 24-hour format.</span></F>
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
          <F l="FTO Assignment"><input className={inp} value={phaseAssignmentLabel(r.ftoAssignment,r.shift)} disabled data-testid="input-fto-assignment" /></F>
        </fieldset>
        {week && <div className="border-t px-4 py-3 text-sm" data-testid="text-report-week">
          <b>Training week:</b> Sunday {formatDateDMY(week.start)} – Saturday {formatDateDMY(week.end)}.
          <span className="ml-1 text-muted-foreground">{shiftWeekDescription(r.shift)}</span>
          {isNew && ws.caseFolder && <div className="mt-1 text-muted-foreground">FTO-selected days off: {ws.caseFolder.daysOff.map(day=>WEEKDAYS.find(item=>item.value===day)?.label).filter(Boolean).join(', ')}</div>}
          {r.phaseWeek && <div className="mt-1 text-muted-foreground">Phase week {r.phaseWeek} · program week {r.phaseWeek+PHASE_PROGRAM_WEEK_START[r.phase]-1}.</div>}
        </div>}
        {isLimboDay && <div role="note" className="mx-4 mb-4 rounded border border-primary/40 bg-primary/5 p-3 text-sm" data-testid="notice-limbo-day"><b>Limbo day · no SEG ratings.</b> Complete Reporting for Duty, record the day’s activity, and complete applicable run forms. The manual says not to enter performance ratings during this day.</div>}
      </Panel>

        <Panel id="duty-form" title="Reporting for Duty Form" className="mb-4 scroll-mt-28">
         <div className="border-b px-4 py-3 text-sm text-muted-foreground">
            New daily logs start with duty-check boxes selected to speed entry. Review every item; clearing an applicable task creates a UA deficiency. Each section’s <b>Not applicable</b> box starts unchecked; use it for an inapplicable section. Confirm the review before submission.
         </div>
         <div className="grid gap-4 p-4">
           <fieldset disabled={!editable} className="grid gap-4 sm:grid-cols-2">
             <F l="Cruiser ID"><input value={r.reportingForDuty.cruiserId??''} maxLength={80} className={inp} onChange={event=>set('reportingForDuty',{...r.reportingForDuty,cruiserId:event.target.value,reviewedAt:undefined})} data-testid="input-cruiser-id"/></F>
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

      <Panel id="run-forms" title="Per-run paperwork" className="mb-4 scroll-mt-28">
         <div className="border-b px-4 py-3 text-sm text-muted-foreground">
            <p>Record each training run and its required paperwork. Incident number and location are optional run metadata shared with its supplemental forms and narrative continuation pages.</p>
            <p className="mt-1"><b className="text-foreground">Prototype data boundary:</b> this fictional demonstration is not approved for operational data. Saved workspace records are encrypted on this device; printed forms and Excel exports contain these values in plain text.</p>
           <p className="mt-1"><b className="text-foreground">Daily requirements:</b> Reporting for Duty is tracked separately above; this Daily Performance Log is completed once per tour.</p>
        </div>
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.8fr)]">
          <div className="rounded border bg-muted/35 p-4">
            <div className="label-caps mb-3">{editingRunId ? 'Edit run' : 'Add training run'}</div>
             {dispatchPrefillStatus!=='idle'&&<p role="status" className="mb-3 rounded border bg-card px-3 py-2 text-xs text-muted-foreground">
               {dispatchPrefillStatus==='loading'?'Checking approved dispatch details…':dispatchPrefillStatus==='loaded'?'Available dispatch details were added as editable defaults. Review and correct them; fill in any missing fields.':dispatchPrefillStatus==='empty'?'No dispatch details were available. Enter the run details manually.':'Dispatch details are unavailable. The run can still be completed manually.'}
             </p>}
            <fieldset disabled={!editable} className="grid gap-3 sm:grid-cols-2">
              <F l="Primary form">
                 <SearchableSelect className={inp} value={runKind} onChange={e=>{const next=e.target.value as PrimaryRunForm;const dispatched=next==='call_for_service'?true:next==='self_initiated'?false:runDispatched;const mode:TrainingRun['trafficMode']=next==='traffic_stop'?'motor_vehicle':'none';setRunKind(next);setRunDispatched(dispatched);setTrafficMode(mode);setDispatchedCode(DEFAULT_RUN_TYPE_CODES[next]??'');setSituationFoundCode(SITUATION_FOUND_NA);setRunChecklist(checklistFor(next,mode,dispatched,arrestMade,transported,oviProcessed,narrativeAdditionRequired,{},arrestProcessRequired));setRunChecklistReviewed(false);setRunError('');}} data-testid="select-run-kind">
                   {PRIMARY_RUN_FORMS.map(form=><option key={form.key} value={form.key}>{form.label}</option>)}
                 </SearchableSelect>
              </F>
                {['call_for_service','self_initiated'].includes(runKind)
                  ? <p className="text-xs text-muted-foreground sm:col-span-2">{runKind==='call_for_service'?'Call for Service is the default for each new run.':'Use Self-Initiated Run / Training when the PO initiates the activity.'} Choose a dedicated form when the manual calls for one.</p>
                  : <F l="Run origin"><SearchableSelect className={inp} value={runDispatched?'call_for_service':'self_initiated'} onChange={e=>{const dispatched=e.target.value==='call_for_service';setRunDispatched(dispatched);setRunChecklist(prev=>checklistFor(runKind,trafficMode,dispatched,arrestMade,transported,oviProcessed,narrativeAdditionRequired,prev,arrestProcessRequired));setRunChecklistReviewed(false);setRunError('');}} data-testid="select-run-origin"><option value="call_for_service">Call for Service / dispatched</option><option value="self_initiated">Self-initiated</option></SearchableSelect></F>}
                 <F l="Run event date · MM/DD/YYYY"><input required inputMode="text" maxLength={10} placeholder="MM/DD/YYYY" className={inp+' mono'} value={runDateTimeParts.date} onChange={event=>{const date=formatDateEntryMDY(event.target.value);setRunDateTimeText(`${date}${runTimeText?` ${runTimeText}`:''}`);setRunError('');}} onKeyDown={event=>{if(event.key==='Enter'&&event.currentTarget.value.trim()==='?'){event.preventDefault();const now=currentDateTimeMDY();setRunDateTimeText(`${now.date} ${now.time}`);setRunTimeText(now.time);setRunError('');}}} data-testid="input-run-date" /></F>
                 <F l="Run event time"><input required type="time" className={inp+' mono'} value={runTimeText} onChange={event=>{const time=event.target.value;setRunTimeText(time);setRunDateTimeText(current=>{const date=splitDateTimeEntryMDY(current).date;return date?`${date}${time?` ${time}`:''}`:'';});setRunError('');}} data-testid="input-run-time" /><span className="text-xs font-normal text-muted-foreground">Enter the time the call was aired or initiated. Correct dispatch details as needed.</span></F>
                 <F l="Incident Number"><input className={inp} value={incidentNumber} onChange={event=>setIncidentNumber(event.target.value)} maxLength={120} data-testid="input-run-incident-number" /></F>
                 <F l="Location"><input className={inp} value={runLocation} onChange={event=>setRunLocation(event.target.value)} maxLength={200} data-testid="input-run-location" /></F>
                {runKind==='traffic_stop' && <F l="Traffic violator"><SearchableSelect className={inp} value={trafficMode==='none'?'motor_vehicle':trafficMode} onChange={e=>{const mode=e.target.value as TrainingRun['trafficMode'];setTrafficMode(mode);setRunChecklist(prev=>checklistFor(runKind,mode,runDispatched,arrestMade,transported,oviProcessed,narrativeAdditionRequired,prev,arrestProcessRequired));setRunChecklistReviewed(false);setRunError('');}} data-testid="select-traffic-violator"><option value="motor_vehicle">Motor vehicle</option><option value="pedestrian">Pedestrian</option><option value="bicycle">Bicycle</option><option value="other">Other</option></SearchableSelect></F>}
                <F l="Run type / 10-code">
                  <div className="flex min-w-0">
                    <span className={radioCodePrefix} aria-hidden="true">10-</span>
                    <input aria-label="Dispatched code without 10 prefix" className={radioCodeInput+(runKind==='traffic_stop'?' bg-muted':'')} value={dispatchedCode} onChange={e=>setDispatchedCode(normalizeRadioCode(e.target.value))} list="radio-code-list" placeholder="6 or 17A" data-testid="input-dispatched-code" />
                  </div>
                  <span className="text-xs text-muted-foreground">{runTypeCodeHelp(runKind)}{dispatchedCode?` ${RADIO_CODES[dispatchedCode]??'Unlisted code — confirm against approved code table'}`:''}</span>
               </F>
                <F l="Situation found code">
                   <div className="flex min-w-0">{situationFoundCode!==SITUATION_FOUND_NA&&<span className={radioCodePrefix} aria-hidden="true">10-</span>}<input aria-label="Situation found code or N/A" className={radioCodeInput} value={situationFoundCode} onChange={e=>setSituationFoundCode(normalizeSituationFoundCode(e.target.value))} list="radio-code-list" placeholder="N/A" data-testid="input-situation-found-code" /></div>
                   <span className="text-xs text-muted-foreground">{situationFoundCode===SITUATION_FOUND_NA?'Defaults to N/A; change it when a situation-found 10-code applies.':situationFoundCode ? RADIO_CODES[situationFoundCode] ?? 'Unlisted code — confirm against approved code table' : 'Enter the applicable code or N/A.'}</span>
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
              {clearanceCode==='3V'&&<F l="Criminal charges · one per line"><textarea disabled={!editable} rows={3} className={inp} value={chargeText} onChange={event=>setChargeText(event.target.value)} data-testid="input-criminal-charges"/></F>}
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!editable || !arrestMade} checked={transported} onChange={e=>setTransportState(e.target.checked)} data-testid="checkbox-transported" />Transported after arrest</label>
              {arrestMade&&transported&&<F l="Transport destination type"><SearchableSelect disabled={!editable} className={inp} value={transportDestinationType??''} onChange={event=>{const value=event.target.value as TrainingRun['transportDestinationType'];setTransportDestinationType(value||undefined);setRunChecklistReviewed(false);setRunError('');}} data-testid="select-transport-destination-type"><option value="">Select destination</option><option value="Jail">Jail</option><option value="HQ">HQ</option><option value="Clerks">Clerks</option></SearchableSelect></F>}
              {arrestMade&&transported&&<F l="Actual transport destination"><input disabled={!editable} className={inp} maxLength={200} value={transportDestination} onChange={event=>{setTransportDestination(event.target.value);setRunChecklistReviewed(false);setRunError('');}} placeholder="Enter the destination that actually occurred" data-testid="input-transport-destination"/></F>}
              {arrestMade&&!transported&&<label title="Use for payout arrests or when the arrestee is remanded to another jurisdiction; transported arrests add the form automatically." className="flex items-start gap-2 text-sm"><input type="checkbox" disabled={!editable} checked={arrestProcessRequired} onChange={e=>{const value=e.target.checked;setArrestProcessRequired(value);setRunChecklist(prev=>checklistFor(runKind,trafficMode,runDispatched,arrestMade,transported,oviProcessed,narrativeAdditionRequired,prev,value));setRunChecklistReviewed(false);}} data-testid="checkbox-arrest-process-required" />Arrest Process required · payout / transfer</label>}
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!editable} checked={oviProcessed} onChange={e=>{const value=e.target.checked;setOviProcessed(value);setRunChecklist(prev=>checklistFor(runKind,trafficMode,runDispatched,arrestMade,transported,value,narrativeAdditionRequired,prev,arrestProcessRequired));setRunChecklistReviewed(false);}} data-testid="checkbox-ovi-processed" />OVI processing occurred</label>
               <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!editable} checked={narrativeAdditionRequired} onChange={e=>{const value=e.target.checked;setNarrativeAdditionRequired(value);setRunChecklist(prev=>checklistFor(runKind,trafficMode,runDispatched,arrestMade,transported,oviProcessed,value,prev,arrestProcessRequired));setRunChecklistReviewed(false);}} data-testid="checkbox-narrative-addition" />Narrative Addition supplement required</label>
            </div>
              <div className="mt-3 rounded border border-accent/40 bg-accent/5 p-3" data-testid="section-related-activity">
                 <div className="font-semibold text-sm">Related activity recorded on this run</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {arrestMade
                    ? 'For an arrest, select Prisoner Searches and Prisoners Slated only when they occurred. Select each other report or activity that was completed; the arrest flag does not add statistics automatically.'
                    : trafficSolveSuggestion
                      ? 'For this 10-6 Traffic Stop, select Solve Citation/Summons* when applicable. Do not select PremierOne Reports or Axon Reports for this traffic-stop citation.'
                      : 'Select each statistic that actually applies to this run. No statistics are preselected from the run type, codes, or forms.'}
                  {' '}These selections are supporting records only. They never change daily, weekly, phase, class, or monthly statistics; enter official totals manually in Daily Activity Summary.
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Check every completed statistic that applies to this run.</span>
                  <button type="button" disabled={!editable} onClick={()=>{setActivityFlags({});setRunChecklistReviewed(false);setRunError('');}} className="min-h-10 rounded border border-destructive/60 bg-card px-3 text-xs font-bold text-destructive disabled:opacity-50" data-testid="button-clear-run-activity">Clear all stats</button>
               </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {DAILY_ACTIVITY_FIELDS.map(({key,label})=>{
                    const premierOneNotApplicable=key==='premierOneReports'&&runKind==='traffic_stop'&&dispatchedCode==='6'&&['1V','3V'].includes(clearanceCode);
                    return <label key={key} title={premierOneNotApplicable?'For a 10-6 Traffic Stop with 1V or 3V, clear PremierOne Reports and select Solve Citation/Summons* only when applicable.':''} className="flex min-h-10 items-center gap-2 rounded border bg-card px-2 text-xs leading-4">
                    <input type="checkbox" disabled={!editable||(premierOneNotApplicable&&!activityFlags[key])} checked={!!activityFlags[key]} onChange={event=>{setActivityFlags(current=>({...current,[key]:event.target.checked}));setRunChecklistReviewed(false);setRunError('');}} data-testid={`checkbox-related-activity-${key}`}/>
                    <span>{label}</span>
                  </label>;
                  })}
                </div>
              </div>
            <div className="mt-4 rounded border bg-card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold text-sm" title={RUN_FORM_GUIDANCE[runKind]}>{selectedForm.label}</div>
                <div className="flex flex-wrap gap-2">
                  <label className="flex min-h-11 items-center gap-2 rounded border px-3 text-sm font-semibold"><input type="checkbox" disabled={!editable} checked={!!runChecklist['na-task']} onChange={event=>{const notApplicable=event.target.checked;setRunChecklist(current=>({...current,'na-task':notApplicable,...(notApplicable?Object.fromEntries(checkItems.map((_,index)=>[`task-${index}`,false])):{})}));if(notApplicable&&primaryDirectiveIndex>=0)setDirectiveReviewFlags(runKind,false);setRunChecklistReviewed(false);setRunError('');}} data-testid="checkbox-run-na"/>Not applicable</label>
                   <button type="button" disabled={!editable} onClick={()=>{const select=!primaryChecklistAllChecked;setRunChecklist(current=>({...current,'na-task':false,...Object.fromEntries(checkItems.map((_,index)=>[`task-${index}`,select]))}));if(primaryDirectiveIndex>=0)setDirectiveReviewFlags(runKind,select);setRunChecklistReviewed(false);setRunError('');}} className="min-h-11 rounded border bg-card px-4 text-sm font-bold disabled:opacity-50" data-testid="button-toggle-run-checklist">{primaryChecklistAllChecked?'Deselect all':'Select all'}</button>
                  <button type="button" disabled={!editable} onClick={()=>{setRunChecklist(current=>({...current,'na-task':false,...Object.fromEntries(checkItems.map((_,index)=>[`task-${index}`,false]))}));if(primaryDirectiveIndex>=0)setDirectiveReviewFlags(runKind,false);setRunChecklistReviewed(false);setRunError('');}} className="min-h-11 rounded border border-destructive/60 bg-destructive/5 px-4 text-sm font-bold text-destructive disabled:opacity-50" data-testid="button-clear-run-checklist">Clear all checkboxes</button>
                </div>
              </div>
                <details className="mt-2 rounded border bg-muted/30 p-2 text-xs"><summary className="cursor-pointer font-semibold">{RUN_FORM_GUIDANCE[runKind]}</summary><p className="mt-1">The segments below follow the selected manual form. Hover or focus each item for its meaning. Check only when the PO completed the action acceptably; clear it if not completed acceptably, not applicable, or performed by the FTO, and document deficiencies or training in the narrative.</p></details>
                <p className="my-2 rounded border border-warn/50 bg-warn/10 p-2 text-xs">Run checklist items start checked. Review every segment before saving; clear any item the PO did not complete acceptably or that did not apply.</p>
               <div className="mt-2 grid gap-3">
                      {primaryChecklistGroups.map(group=><fieldset key={group.title} disabled={!editable||!!runChecklist['na-task']} className="rounded border p-3">
                        {group.title&&<legend className="px-2 text-xs font-bold"><button type="button" disabled={!editable||!!runChecklist['na-task']} aria-label={`Toggle ${group.title} checklist`} aria-pressed={group.items.every((_,index)=>runChecklist[`task-${group.start+index}`]!==false)} onClick={()=>{const result=toggleChecklistSection(runChecklist,'task-',group.start,group.items.length,'na-task');setRunChecklist(result.checklist);if(primaryDirectiveIndex>=group.start&&primaryDirectiveIndex<group.start+group.items.length)setDirectiveReviewFlags(runKind,result.checked);setRunChecklistReviewed(false);setRunError('');}} data-testid={`button-toggle-run-section-${runKind}-${group.start}`}>{group.title}</button></legend>}
                       <div className="grid gap-2 sm:grid-cols-2">{group.items.map((item,index)=>{const itemIndex=group.start+index;return <label key={itemIndex} title={checklistHelp(selectedForm.label,item.help)} aria-label={`${item.label}. ${item.help}`} className="flex items-start gap-2 rounded-sm py-1 text-xs leading-5"><input type="checkbox" checked={runChecklist[`task-${itemIndex}`]!==false} onChange={e=>{setRunChecklist(x=>({...x,[`task-${itemIndex}`]:e.target.checked}));setRunChecklistReviewed(false);setRunError('');}} data-testid={`checkbox-run-task-${itemIndex}`} /><span>{item.label}</span></label>})}</div>
                    </fieldset>)}
                     {primaryDirectiveIndex>=0&&runChecklist[`task-${primaryDirectiveIndex}`]!==false&&<DirectiveReviewEditor value={primaryDirectiveReview} disabled={!editable} dataTestId={`directive-review-${runKind}`} onChange={(field,value)=>updateDirectiveReview(runKind,field,value)}/>}
               </div>
            </div>
             {requiredSupplements.map(supplement=>{
               const form=SUPPLEMENTAL_RUN_FORMS.find(item=>item.key===supplement)!;
                  const supplementItems=supplementCheckItems[supplement];
                  const supplementDirectiveIndex=supplementItems.indexOf(DIRECTIVE_REVIEW_LABEL);
                  const supplementDirectiveReview=directiveReviews[supplement]??defaultDirectiveReviewRecord();
                  const supplementAllChecked=supplementItems.length>0&&supplementItems.every((_,index)=>runChecklist[`supp-${supplement}-${index}`]!==false)
                    &&(supplementDirectiveIndex<0||(runChecklist[`supp-${supplement}-${supplementDirectiveIndex}`]!==false&&supplementDirectiveReview.divisionDirectives&&supplementDirectiveReview.ohioRevisedCode&&supplementDirectiveReview.columbusCityCode&&supplementDirectiveReview.other));
                 let supplementOffset=0;
                 const groups=RUN_SUPPLEMENT_CHECKLIST_SECTIONS[supplement].map(section=>{const start=supplementOffset;supplementOffset+=section.items.length;return {...section,start};});
                 return <div key={supplement} className="mt-3 rounded border border-accent/40 bg-accent/5 p-3" data-testid={`section-supplement-${supplement}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2"><div className="font-semibold text-sm" title={SUPPLEMENTAL_FORM_GUIDANCE[supplement]}>{form.label}</div>
                      {supplementItems.length>0&&<div className="flex flex-wrap gap-2">
                        <label className="flex min-h-11 items-center gap-2 rounded border px-3 text-sm font-semibold"><input type="checkbox" disabled={!editable} checked={!!runChecklist[`na-supp-${supplement}`]} onChange={event=>{const notApplicable=event.target.checked;setRunChecklist(current=>({...current,[`na-supp-${supplement}`]:notApplicable,...(notApplicable?Object.fromEntries(supplementItems.map((_,index)=>[`supp-${supplement}-${index}`,false])):{})}));if(notApplicable&&supplementDirectiveIndex>=0)setDirectiveReviewFlags(supplement,false);setRunChecklistReviewed(false);setRunError('');}} data-testid={`checkbox-supplement-na-${supplement}`}/>Not applicable</label>
                        <button type="button" disabled={!editable} onClick={()=>{const select=!supplementAllChecked;setRunChecklist(current=>({...current,[`na-supp-${supplement}`]:false,...Object.fromEntries(supplementItems.map((_,index)=>[`supp-${supplement}-${index}`,select]))}));if(supplementDirectiveIndex>=0)setDirectiveReviewFlags(supplement,select);setRunChecklistReviewed(false);setRunError('');}} className="min-h-11 rounded border bg-card px-4 text-sm font-bold disabled:opacity-50" data-testid={`button-toggle-supplement-${supplement}`}>{supplementAllChecked?'Deselect all':'Select all'}</button>
                        <button type="button" disabled={!editable} onClick={()=>{setRunChecklist(current=>({...current,[`na-supp-${supplement}`]:false,...Object.fromEntries(supplementItems.map((_,index)=>[`supp-${supplement}-${index}`,false]))}));if(supplementDirectiveIndex>=0)setDirectiveReviewFlags(supplement,false);setRunChecklistReviewed(false);setRunError('');}} className="min-h-11 rounded border border-destructive/60 bg-destructive/5 px-4 text-sm font-bold text-destructive disabled:opacity-50" data-testid={`button-clear-supplement-${supplement}`}>Clear all checkboxes</button>
                      </div>}
                   </div>
                     <p className="mt-2 rounded border bg-muted/30 p-2 text-xs">{SUPPLEMENTAL_FORM_GUIDANCE[supplement]}</p>
                     {supplementItems.length>0?<><details className="mt-2 rounded border bg-muted/30 p-2 text-xs"><summary className="cursor-pointer font-semibold">How to review this form</summary><p className="mt-1">Hover or focus each item for its meaning. Check only when the PO completed the action acceptably. Clear it if not completed acceptably, not applicable, or performed by the FTO; document deficiencies and training in the narrative.</p></details>
                      <div className="mt-2 grid gap-3">{groups.map(group=><fieldset key={group.title||group.start} disabled={!editable||!!runChecklist[`na-supp-${supplement}`]} className="rounded border border-accent/30 p-3">{group.title&&<legend className="px-2 text-xs font-bold"><button type="button" disabled={!editable||!!runChecklist[`na-supp-${supplement}`]} aria-label={`Toggle ${group.title} checklist`} aria-pressed={group.items.every((_,index)=>runChecklist[`supp-${supplement}-${group.start+index}`]!==false)} onClick={()=>{const result=toggleChecklistSection(runChecklist,`supp-${supplement}-`,group.start,group.items.length,`na-supp-${supplement}`);setRunChecklist(result.checklist);if(supplementDirectiveIndex>=group.start&&supplementDirectiveIndex<group.start+group.items.length)setDirectiveReviewFlags(supplement,result.checked);setRunChecklistReviewed(false);setRunError('');}} data-testid={`button-toggle-supplement-section-${supplement}-${group.start}`}>{group.title}</button></legend>}<div className="grid gap-2 sm:grid-cols-2">{group.items.map((item,index)=>{const itemIndex=group.start+index;return <label key={itemIndex} title={checklistHelp(form.label,item.help)} aria-label={`${item.label}. ${item.help}`} className="flex items-start gap-2 rounded-sm py-1 text-xs leading-5"><input type="checkbox" checked={runChecklist[`supp-${supplement}-${itemIndex}`]!==false} onChange={event=>{setRunChecklist(x=>({...x,[`supp-${supplement}-${itemIndex}`]:event.target.checked}));setRunChecklistReviewed(false);setRunError('');}} data-testid={`checkbox-supplement-${supplement}-${itemIndex}`} /><span>{item.label}</span></label>})}</div></fieldset>)}</div>
                     {supplementDirectiveIndex>=0&&runChecklist[`supp-${supplement}-${supplementDirectiveIndex}`]!==false&&<DirectiveReviewEditor value={supplementDirectiveReview} disabled={!editable} dataTestId={`directive-review-${supplement}`} onChange={(field,value)=>updateDirectiveReview(supplement,field,value)}/>}</>:<p className="mt-2 text-xs text-muted-foreground">The submitted form has no separate checkbox list here.</p>}
               </div>;
             })}
            <F l="Training narrative · performance, coaching, response"><textarea rows={3} disabled={!editable} className="mt-3 w-full rounded border bg-card p-2.5 text-sm" value={runNarrative} onChange={e=>setRunNarrative(e.target.value)} placeholder="Describe observed performance, response, and coaching." data-testid="input-run-narrative" /></F>
            {narrativeAdditionRequired&&<button type="button" onClick={()=>{document.body.classList.add('print-narrative-only');window.addEventListener('afterprint',()=>document.body.classList.remove('print-narrative-only'),{once:true});window.print();}} className="mt-2 min-h-10 rounded border bg-card px-3 text-sm font-semibold" data-testid="button-print-narrative-continuation">Print narrative continuation pages only</button>}
             <div className="mt-3 flex flex-wrap gap-2">
               <button type="button" disabled={!editable} onClick={()=>addRun()} className="inline-flex h-10 items-center gap-2 rounded bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50" data-testid="button-save-run"><Plus className="h-4 w-4" />{editingRunId ? 'Save run changes' : 'Save run'}</button>
              {editingRunId && <button type="button" onClick={resetRunForm} className="h-10 rounded border bg-card px-3 text-sm font-semibold" data-testid="button-cancel-run-edit">Cancel edit</button>}
            </div>
             {runError && <p role="alert" className="mt-2 text-sm font-semibold text-destructive" data-testid="text-run-error">{runError}</p>}
          </div>
          <div>
            <div className="flex items-center justify-between border-b pb-2"><h3 className="font-bold">Runs recorded</h3><span className="mono text-xs" data-testid="status-run-count">{r.runs.length} recorded</span></div>
            {r.runs.length === 0 ? <div className="mt-3 rounded border border-dashed p-5 text-sm text-muted-foreground" data-testid="text-no-runs"><ClipboardList className="mb-2 h-5 w-5" />No runs recorded for this day yet.</div> :
              <ul className="divide-y" data-testid="list-training-runs">{r.runs.map(run=>{
                const form=PRIMARY_RUN_FORMS.find(item=>item.key===run.runKind);
                 const supplements=requiredSupplementalForms(run).map(key=>{
                   const item=SUPPLEMENTAL_RUN_FORMS.find(form=>form.key===key);
                   return item ? `${item.label}${item.formNumber ? ` · ${item.formNumber}` : ''}` : '';
                 }).filter(Boolean);
                return <li key={run.id} className="py-3" data-testid={`row-training-run-${run.id}`}>
                   <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><div className="font-semibold text-sm">{form?.label ?? 'Training run'}</div><div className="text-xs text-muted-foreground">{formatDateTimeMDY(run.occurredAt)} · {run.isDispatched?'Dispatched':'Self-initiated'}</div></div><button type="button" disabled={!editable} onClick={()=>editRun(run)} className="rounded border px-2 py-1 text-xs font-semibold disabled:opacity-50" data-testid={`button-edit-run-${run.id}`}>Edit</button><button type="button" disabled={!editable} onClick={()=>set('runs',r.runs.filter(item=>item.id!==run.id))} aria-label="Remove run" className="rounded border p-1.5 text-destructive disabled:opacity-50" data-testid={`button-delete-run-${run.id}`}><Trash className="h-4 w-4" /></button></div>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]"><span className="rounded bg-muted px-2 py-0.5" data-testid={`status-run-form-${run.id}`}>{run.formStatus.replace('_',' ')}</span>{supplements.map(name=><span key={name} className="rounded border border-accent/40 bg-accent/10 px-2 py-0.5">{name}</span>)}</div>
                   <p className="mt-1 text-xs">Run: {run.dispatchedCode ? `10-${run.dispatchedCode}`:'Not recorded'} · Found: {run.situationFoundCode ? formatRadioCode(run.situationFoundCode):'Not recorded'} · Clearance: {run.clearanceCode || 'Not recorded'}</p>
                      {run.runKind==='traffic_stop'&&<p className="mt-1 text-xs">Traffic violator: {run.trafficMode.replace('_',' ')}{run.activityFlags?.solveCitationSummons?' · Solve Citation/Summons selected':''}</p>}
                  {run.narrative && <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{run.narrative}</p>}
                </li>;
              })}</ul>}
          </div>
        </div>
        <div className="border-t bg-warn/5 px-4 py-3 text-xs text-muted-foreground" data-testid="status-patrol-integration">
          <b className="text-foreground">Patrol View import and online submission are unavailable.</b> Run details must be entered manually. Saved records do not have verified signatures or official approval.
        </div>
      </Panel>

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

      <Panel id="activity-summary" title="Daily Activity Summary" className="mb-4 scroll-mt-28">
        <div className="border-b px-4 py-3 text-sm text-muted-foreground">
          Totals combine manual entries with clearance-derived counts from newly created, reviewed run records. Run activity checkboxes remain supporting evidence only.
          <div className="mt-2 text-foreground">1V uses the explicitly selected Traffic Citations metric, otherwise Solve Citation/Summons* for traffic stops, otherwise PremierOne Reports. These distinct metrics are not counted twice. 3V adds the approved arrest-report, prisoner, case-report, affidavit, and individual-charge counts. Existing legacy runs are not recounted automatically.</div>
          {activityMismatchFields.length>0&&<div role="note" className="mt-2 rounded border border-accent bg-accent/10 p-2.5 text-foreground" data-testid="status-activity-discrepancy"><b>Review the daily statistics against run records</b><p className="mt-1 text-xs text-muted-foreground">The portal did not change either value.</p><ul className="mt-1 grid gap-1 text-xs sm:grid-cols-2">{activityMismatchFields.map(({key,label})=><li key={key}><b>{label}:</b> daily statistic {totalActivity[key]} · run checkboxes {runDerivedActivity[key]}</li>)}</ul></div>}
        </div>
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

      <AlertDialog open={runReviewOpen} onOpenChange={open=>{if(!open&&!runReviewConfirmedRef.current)setRunChecklistReviewed(false);runReviewConfirmedRef.current=false;setRunReviewOpen(open);}}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Review the prefilled run categories</AlertDialogTitle><AlertDialogDescription>The run checklist starts checked for speed. Review the full form, clear items that did not apply or were not completed acceptably, and confirm arrest-related counts and additional forms. Confirming creates an editable checklist-based narrative outline and returns you to the form for review and editing before saving.</AlertDialogDescription></AlertDialogHeader>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={runChecklistReviewed} onChange={event=>setRunChecklistReviewed(event.target.checked)} data-testid="checkbox-run-checklist-review" /><span>I reviewed every active run checklist and cleared exceptions, non-applicable items, and items performed by the FTO.</span></label>
          {runError && <p role="alert" className="text-sm font-semibold text-destructive" data-testid="text-run-review-error">{runError}</p>}
          <AlertDialogFooter><AlertDialogCancel data-testid="button-run-review-cancel">Return to run</AlertDialogCancel><AlertDialogAction disabled={!runChecklistReviewed} onClick={confirmRunReview} data-testid="button-run-review-confirm">Confirm review and draft narrative</AlertDialogAction></AlertDialogFooter>
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
