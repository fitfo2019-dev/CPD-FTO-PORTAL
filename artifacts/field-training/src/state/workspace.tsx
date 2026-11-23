import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { OfflineStorage, persistentStorageStatus, requestPersistentStorage, WorkspaceConflictError, type LocalChatDraft, type RecoverySnapshot } from '@/lib/offlineStorage.js';
import { createEmptyWorkspace, createUiPreviewWorkspace } from '@/lib/empty-workspace.js';
import { CATEGORIES, DAILY_ACTIVITY_FIELDS, DAILY_DUTY_CHECKLIST, PHASE_LENGTH_WEEKS, PHASE_PROGRAM_WEEK_START, emptyReportingForDutyRecord, normalizeDailyActivitySummary, normalizePreviewRole, RATINGS, SHIFTS, type CoverageRequest, type DutyStatus, type FtoPhasePosting, type FtoPhaseSignup, type FtoRosterEntry, type LawReviewRecord, type PhaseCaseFolder, type PhaseExtensionRequest, type PhaseWeekRange, type Rating, type Report, type ReportShift, type Role, type Shift, type Task, type TrainingAssignment, type TrainingRun, type Weekday, type WeeklyPacketAcknowledgement, type WeeklyPerformanceLog, type SubstationOrientationRecord, type Workspace } from '@/lib/model.js';
import { assignmentFromPrecinctAndDistrict, isValidAssignment } from '@/lib/cpd-geography.js';
import { mergeReviewedUaEntries } from '@/lib/weekly-performance-log.js';
import { buildTimelineInterpolation, type TimelineInterpolation } from '@/lib/timeline-interpolation.js';
import { createPhaseWeekRanges, getPhaseWeekNumber, getSundaySaturdayWeek } from '@/lib/training-calendar.js';
import { applyApprovedPhaseExtensions, approvePhaseExtension, denyPhaseExtension, normalizePhaseExtensionRequests } from '@/lib/phase-extension.js';
import { CURRENT_PACKET_INDEX_VERSION, migrateOperationalReferenceReviews, reconcileOperationalReferences, resolveOperationalPacket, type OperationalPacket } from '@/lib/operational-state-machine.js';
import { reconcileDeficiencyRatings, SEG_TASK_DIRECTORY } from '@/lib/seg-deficiencies.js';
import { uploadPacketBatch } from '@/lib/training-packet-sync.js';
import { preserveProtectedPackets } from '@/lib/protected-packets.js';

export type VaultState = 'none' | 'unlocked';
export type PacketSyncState = 'idle' | 'uploading' | 'failed' | 'synchronized';
type VaultIntent = 'save' | 'restore' | null;
type WorkspaceSessionStatus = { sessionId: string; dirty: boolean; unlocked: boolean };
type RecoverySnapshotInfo = Pick<RecoverySnapshot<Workspace>, 'id' | 'capturedAt' | 'expiresAt'> & {
  reportCount: number;
  taskCount: number;
  assignmentCount: number;
};
type WorkspaceSessionMessage =
  | ({ type: 'status'; seenAt: number } & WorkspaceSessionStatus)
  | { type: 'close'; sessionId: string }
  | { type: 'overwrite'; sessionId: string }
  | { type: 'prepare-overwrite'; sessionId: string; requestId: string; targetSessionId: string }
  | { type: 'recovery-ready'; sessionId: string; requestId: string; recoveryId?: string; error?: string };

type PendingRecoveryRequest = {
  remaining: Set<string>;
  timer: number;
  error?: string;
  resolve(ids: string[]): void;
  reject(error: Error): void;
  recoveryIds: string[];
};

interface Ctx {
  ws: Workspace; epoch: number; saveError: string | null; editorDirty: boolean; setEditorDirty(d: boolean): void; vault: VaultState; restored: boolean; pending: number; dirty: boolean; online: boolean; lockedNotice: boolean; lockedWithUnsaved: boolean; storagePersistent: boolean | null; previewOnly: boolean; previewLabel: string; otherSessions: WorkspaceSessionStatus[]; overwrittenElsewhere: boolean; recoverySnapshots: RecoverySnapshotInfo[]; recoverySyncReviewRequired: boolean;
  setRole(r: Role): void; upsertReport(r: Report): void; upsertWeeklyAcknowledgement(ack: WeeklyPacketAcknowledgement): void; deleteReport(id: string): void; toggleTask(id: string, by: string): void; setCaseFolder(folder: PhaseCaseFolder): void;
  submitPhaseExtensionRequest(request:PhaseExtensionRequest):Promise<void>; syncSharedPhaseExtensionRequest(request:PhaseExtensionRequest):Promise<void>; resolvePhaseExtensionRequest(id:string,approve:boolean):Promise<void>;
  upsertWeeklyPerformanceLog(log:WeeklyPerformanceLog):void; upsertSubstationOrientation(record:SubstationOrientationRecord):void;
  upsertFtoPhasePosting(posting:FtoPhasePosting):void; upsertFtoPhaseSignup(signup:FtoPhaseSignup):void; upsertCoverageRequest(request:CoverageRequest):void;
  upsertLawReviewRecord(record:LawReviewRecord):void; deleteLawReviewRecord(id:string):void;
  importRoster(ftos: FtoRosterEntry[], assignments: TrainingAssignment[]): void; upsertAssignment(assignment: TrainingAssignment): void;
  loadLocalChatDrafts(): Promise<LocalChatDraft[]>; saveLocalChatDraft(draft: LocalChatDraft): Promise<void>; deleteLocalChatDraft(id: string): Promise<void>;
  intent: VaultIntent; openVault(i: Exclude<VaultIntent, null>): void; closeVault(): void;
  setupAndSave(pass: string): Promise<void>; unlockAndRestore(pass: string): Promise<void>; saveNow(): Promise<void>; overwriteOtherSessions(): Promise<void>; refreshRecoverySnapshots(): Promise<void>; restoreRecoverySnapshot(id: string): Promise<void>; lockNow(reason?: string): void; dismissLockedNotice(): void; dismissOverwrittenElsewhere(): void;
  resetWorkspace(): void;
  syncPackets(): Promise<void>;
  packetSyncState: PacketSyncState; packetSyncError: string | null;
  getOperationalPacket(report: Report): OperationalPacket;
  segTaskDirectory: typeof SEG_TASK_DIRECTORY;
}
const C = createContext<Ctx | null>(null);
const IDLE_MS = 15 * 60 * 1000;
const SESSION_EXPIRY_MS = 15_000;
const enc = (p: string) => new TextEncoder().encode(p);
const migrateShift = (value: unknown): ReportShift => {
  if (typeof value === 'string' && SHIFTS.includes(value as Shift)) return value as Shift;
  if (value === 'Day' || value === 'Swing' || value === 'Night') return value;
  throw new Error('A saved report has an unsupported shift. Its data was not changed.');
};
const emptyRatings = (): Report['ratings'] => Object.fromEntries<Report['ratings'][typeof CATEGORIES[number]]>(CATEGORIES.map(category => [category, { rating:'', nrtWithUnacceptable:false, nrtPriorUnacceptableIds:[], nrtPriorDocumentationReviewed:false, nrtTrainingReviewed:false, nrtCoordinatorsNotified:false, nrtFtoSergeantNotified:false, justification:'', nrtCorrectiveActions:'', nrtOfficeReviewStatus:'not_submitted' }])) as Report['ratings'];
const isRecord = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const DUTY_STATUSES: DutyStatus[] = ['on_duty','training','sick','off_duty','other'];
function normalizeReportingForDuty(value: unknown) {
  const empty = emptyReportingForDutyRecord();
  if (!isRecord(value)) return empty;
  const sourceChecklist = isRecord(value.checklist) ? value.checklist : {};
  return {
    dutyStatus: DUTY_STATUSES.includes(value.dutyStatus) ? value.dutyStatus as DutyStatus : empty.dutyStatus,
    checklist: Object.fromEntries(Object.entries(sourceChecklist).filter(([, checked]) => typeof checked === 'boolean')),
    notApplicable: Object.fromEntries(DAILY_DUTY_CHECKLIST.map(group=>[group.section,isRecord(value.notApplicable)&&value.notApplicable[group.section]===true])),
    notes: typeof value.notes === 'string' ? value.notes : '',
    cruiserId: typeof value.cruiserId === 'string' ? value.cruiserId : undefined,
    shotgunTraining: value.shotgunTraining === 'Y' || value.shotgunTraining === 'N' ? value.shotgunTraining : undefined,
    reviewedAt: typeof value.reviewedAt === 'string' ? value.reviewedAt : undefined,
  };
}

function upsertReportAndWeeklyUaLog(workspace:Workspace, inputReport:Report):Workspace {
  if (workspace.reports.some(item => item.id === inputReport.id && (item.syncStatus === 'synchronized_complete' || item.syncAttemptPending))) {
    throw new Error('This packet has been synchronized and is sealed. Request an authorized correction.');
  }
  inputReport = { ...inputReport, syncStatus: 'local_draft_pending', serverVersion: 0 };
  const report=reconcileDeficiencyRatings(inputReport,resolveOperationalPacket(inputReport,[...workspace.phaseFolders,...(workspace.caseFolder?[workspace.caseFolder]:[])],workspace.substationOrientations));
  const reports=workspace.reports.some(item=>item.id===report.id)
    ?workspace.reports.map(item=>item.id===report.id?report:item)
    :[report,...workspace.reports];
  const week=getSundaySaturdayWeek(report.date);
  if(!week||!report.ratingsReviewedAt||report.limboDay) {
    return {...workspace,reports};
  }
  const className=report.className??'';
  const existing=(workspace.weeklyPerformanceLogs??[]).find(log=>
    log.weekStart===week.start&&log.recruitBadge===report.recruitBadge&&log.className===className&&log.phase===report.phase,
  );
  if(!existing&&!CATEGORIES.some(category=>report.ratings[category]?.rating==='UA'))return {...workspace,reports};
  const phaseFolder=workspace.phaseFolders.find(folder=>
    folder.recruitBadge===report.recruitBadge&&folder.className===className&&folder.phase===report.phase,
  );
  const assignment=workspace.assignments.find(item=>
    item.recruitBadge===report.recruitBadge&&item.className===className&&item.phase===report.phase,
  );
  const phaseStartDate=phaseFolder?.phaseStartDate??assignment?.phaseStartDate;
  const phaseWeek=phaseStartDate?getPhaseWeekNumber(week.start,phaseStartDate,phaseFolder?.phaseWeekRanges)??(report.phaseWeek??1):report.phaseWeek??1;
  const weekNumber=PHASE_PROGRAM_WEEK_START[report.phase]+phaseWeek-1;
  const base:WeeklyPerformanceLog=existing??{
    id:`weekly-ua-${className}-${report.recruitBadge}-${report.phase}-${week.start}`,
    weekStart:week.start,weekEnd:week.end,weekNumber,phase:report.phase,phaseWeek:report.phaseWeek,ftoWeek:report.ftoWeek,
    className,recruitName:report.recruitName,recruitBadge:report.recruitBadge,ftoName:report.ftoName,ftoBadge:report.ftoBadge,
    entries:[],updatedAt:new Date().toISOString(),
  };
  const matchingWeekReports=reports.filter(item=>
    item.recruitBadge===report.recruitBadge&&(item.className??'')===className&&item.phase===report.phase
      &&getSundaySaturdayWeek(item.date)?.start===week.start,
  );
  const merged=mergeReviewedUaEntries(base,matchingWeekReports,workspace.assignments,phaseFolder??workspace.caseFolder);
  if(merged===base) return {...workspace,reports};
  const updated={...merged,updatedAt:new Date().toISOString()};
  const logs=workspace.weeklyPerformanceLogs??[];
  return {...workspace,reports,weeklyPerformanceLogs:existing
    ?logs.map(log=>log.id===existing.id?updated:log)
    :[updated,...logs]};
}

function migrateRatings(value: unknown, previous?: Report['legacyEvaluation']) {
  const source = isRecord(value) ? value : {};
  const alreadyManual = CATEGORIES.every(category => isRecord(source[category]) && (source[category].rating === '' || RATINGS.includes(source[category].rating as Exclude<Rating,''>)));
  if (alreadyManual) {
    const ratings = Object.fromEntries(CATEGORIES.map(category => {
      const entry = source[category] as Record<string, unknown>;
      return [category, {
        rating: entry.rating as Rating,
        nrtWithUnacceptable: entry.nrtWithUnacceptable === true,
        nrtPriorUnacceptableIds: Array.isArray(entry.nrtPriorUnacceptableIds) ? entry.nrtPriorUnacceptableIds.filter((id): id is string => typeof id === 'string') : [],
        nrtPriorDocumentationReviewed: entry.nrtPriorDocumentationReviewed === true,
        nrtTrainingReviewed: entry.nrtTrainingReviewed === true,
        nrtCoordinatorsNotified: entry.nrtCoordinatorsNotified === true,
        nrtFtoSergeantNotified: entry.nrtFtoSergeantNotified === true,
        justification: typeof entry.justification === 'string' ? entry.justification : '',
        nrtCorrectiveActions: typeof entry.nrtCorrectiveActions === 'string' ? entry.nrtCorrectiveActions : '',
        nrtOfficeReviewStatus: ['not_submitted','submitted','responded'].includes(String(entry.nrtOfficeReviewStatus)) ? entry.nrtOfficeReviewStatus as Report['ratings'][typeof CATEGORIES[number]]['nrtOfficeReviewStatus'] : 'not_submitted',
        nrtOfficeAction: ['accepted_meeting','call_office','more_information'].includes(String(entry.nrtOfficeAction)) ? entry.nrtOfficeAction as Report['ratings'][typeof CATEGORIES[number]]['nrtOfficeAction'] : undefined,
        nrtOfficeResponse: typeof entry.nrtOfficeResponse === 'string' ? entry.nrtOfficeResponse : '',
        nrtOfficeSubmittedAt: typeof entry.nrtOfficeSubmittedAt === 'string' ? entry.nrtOfficeSubmittedAt : undefined,
        nrtOfficeRespondedAt: typeof entry.nrtOfficeRespondedAt === 'string' ? entry.nrtOfficeRespondedAt : undefined,
      }];
    })) as Report['ratings'];
    return { ratings, legacyEvaluation: previous };
  }
  const preserved = Object.fromEntries(Object.entries(source).map(([category, raw]) => {
    const entry = isRecord(raw) ? raw : {};
    return [category, { rating: String(entry.rating ?? ''), justification: typeof entry.justification === 'string' ? entry.justification : '' }];
  }));
  const hasPreviousValues = Object.values(preserved).some(entry => entry.rating || entry.justification);
  const ratings = emptyRatings();
  for (const category of CATEGORIES) {
    const entry = source[category];
    if (!isRecord(entry) || !(entry.rating === '' || RATINGS.includes(entry.rating))) continue;
    ratings[category] = {
      ...ratings[category], ...entry, rating: entry.rating,
      justification: typeof entry.justification === 'string' ? entry.justification : '',
    };
  }
  return {
    ratings,
    legacyEvaluation: hasPreviousValues ? {
      source:'Preserved values from superseded SEG lists; not counted in current summaries',
      ratings:{ ...(previous?.ratings ?? {}), ...preserved },
    } : previous,
  };
}

function migrateGeography(value: { zone?: unknown; precinct?: unknown; cruiserDistrict?: unknown; beat?: unknown; legacyGeography?: Report['legacyGeography'] }) {
  const zone = String(value.zone ?? '');
  const precinct = String(value.precinct ?? '');
  const cruiserDistrict = String(value.cruiserDistrict ?? '');
  const direct = isValidAssignment(zone, precinct, cruiserDistrict)
    ? { zone, precinct, cruiserDistrict }
    : assignmentFromPrecinctAndDistrict(precinct, cruiserDistrict || String(value.beat ?? ''));
  const previousPrecinctText = direct ? undefined : (precinct || undefined);
  const previousAreaText = direct ? undefined : (String(value.beat ?? '') || undefined);
  const legacyGeography = value.legacyGeography ?? (previousPrecinctText || previousAreaText ? { previousPrecinctText, previousAreaText } : undefined);
  return { ...(direct ?? { zone:'', precinct:'', cruiserDistrict:'' }), legacyGeography };
}
function migrateCaseFolder(value:unknown):PhaseCaseFolder|undefined {
  if(!isRecord(value)) return undefined;
  const raw=value as PhaseCaseFolder&{beat?:unknown};
  const phase=Number(raw.phase);
  if(![1,2,3,4].includes(phase)||!SHIFTS.includes(raw.shift as Shift)) return undefined;
  const {beat:_oldAreaField,...folderWithoutOldField}=raw;
  const geography=migrateGeography(raw);
  const phaseStartDate=typeof raw.phaseStartDate==='string'?raw.phaseStartDate:'';
  const savedRanges=Array.isArray(raw.phaseWeekRanges)
    ?raw.phaseWeekRanges.filter((range):range is PhaseWeekRange=>isRecord(range)&&typeof range.startDate==='string'&&typeof range.endDate==='string'&&range.startDate<=range.endDate)
    :[];
  return {
    ...folderWithoutOldField,
    assignmentId:typeof raw.assignmentId==='string'?raw.assignmentId:undefined,
    className:typeof raw.className==='string'?raw.className:'',
    recruitName:typeof raw.recruitName==='string'?raw.recruitName:'',
    recruitBadge:typeof raw.recruitBadge==='string'?raw.recruitBadge:'',
    ftoName:typeof raw.ftoName==='string'?raw.ftoName:'',
    ftoBadge:typeof raw.ftoBadge==='string'?raw.ftoBadge:'',
    phase:phase as PhaseCaseFolder['phase'],
    shift:raw.shift as Shift,
    ...geography,
    zone:geography.zone,
    precinct:geography.precinct,
    cruiserDistrict:geography.cruiserDistrict,
    ftoAssignment:typeof raw.ftoAssignment==='string'?raw.ftoAssignment:'',
    daysOff:(Array.isArray(raw.daysOff)?raw.daysOff:[]).filter((day):day is Weekday=>Number.isInteger(day)&&day>=0&&day<=6),
    phaseStartDate,
    scheduledWeeks:Number.isInteger(raw.scheduledWeeks)&&Number(raw.scheduledWeeks)>0
      ?Number(raw.scheduledWeeks)
      :savedRanges.length||PHASE_LENGTH_WEEKS[phase as PhaseCaseFolder['phase']],
    phaseWeekRanges:savedRanges.length?savedRanges:createPhaseWeekRanges(
      phase as PhaseCaseFolder['phase'],phaseStartDate,0,
      Number.isInteger(raw.scheduledWeeks)&&Number(raw.scheduledWeeks)>0
        ?Number(raw.scheduledWeeks)
        :PHASE_LENGTH_WEEKS[phase as PhaseCaseFolder['phase']],
    ),
    limboExtensionWeeks:Number.isInteger(raw.limboExtensionWeeks)&&Number(raw.limboExtensionWeeks)>0?Number(raw.limboExtensionWeeks):0,
    openedAt:typeof raw.openedAt==='string'?raw.openedAt:'',
  };
}
function sameCaseFolder(a:PhaseCaseFolder,b:PhaseCaseFolder) {
  if(a.assignmentId&&b.assignmentId) return a.assignmentId===b.assignmentId;
  return (a.className??'').toLowerCase()===(b.className??'').toLowerCase()
    &&a.recruitBadge.toLowerCase()===b.recruitBadge.toLowerCase()
    &&a.phase===b.phase;
}
function sameExtensionTarget(left:PhaseExtensionRequest,right:PhaseExtensionRequest) {
  return left.recruitBadge.toLowerCase()===right.recruitBadge.toLowerCase()
    &&left.phase===right.phase
    &&left.className.toLowerCase()===right.className.toLowerCase();
}

export function WorkspaceProvider({
  children,
  storageNamespace = 'fieldready-demo',
  previewOnly = false,
  previewWorkspace,
  previewLabel = 'UI test workspace',
}: {
  children?: ReactNode;
  storageNamespace?: string;
  previewOnly?: boolean;
  previewWorkspace?: () => Workspace;
  previewLabel?: string;
}) {
  const storage = useRef<OfflineStorage>(null as unknown as OfflineStorage);
  if (!storage.current) storage.current = new OfflineStorage(storageNamespace);
  const previewWorkspaceFactory = useRef(previewWorkspace ?? createUiPreviewWorkspace);
  const hasCustomPreviewWorkspace = !!previewWorkspace;
  const [ws, setWs] = useState<Workspace>(() => previewOnly ? previewWorkspaceFactory.current() : createEmptyWorkspace());
  const [epoch, setEpoch] = useState(0);
  const [vault, setVault] = useState<VaultState>(previewOnly ? 'unlocked' : 'none');
  const [restored, setRestored] = useState(previewOnly);
  const [pending, setPending] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [otherSessions, setOtherSessions] = useState<WorkspaceSessionStatus[]>([]);
  const [overwrittenElsewhere, setOverwrittenElsewhere] = useState(false);
  const [recoverySnapshots, setRecoverySnapshots] = useState<RecoverySnapshotInfo[]>([]);
  const [recoverySyncReviewRequired, setRecoverySyncReviewRequired] = useState(false);
  const [previewChatDrafts, setPreviewChatDrafts] = useState<LocalChatDraft[]>([]);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [storagePersistent, setStoragePersistent] = useState<boolean | null>(null);
  const [intent, setIntent] = useState<VaultIntent>(null);
  const [lockedNotice, setLockedNotice] = useState(false);
  const [lockedWithUnsaved, setLockedWithUnsaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [packetSyncState, setPacketSyncState] = useState<PacketSyncState>('idle');
  const [packetSyncError, setPacketSyncError] = useState<string | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const wasOnline = useRef(online);
  const rev = useRef(0);
  const wsRef = useRef(ws); wsRef.current = ws;
  const dirtyRef = useRef(dirty); dirtyRef.current = dirty;
  const editorDirtyRef = useRef(editorDirty); editorDirtyRef.current = editorDirty;
  const lockedWithUnsavedRef = useRef(lockedWithUnsaved); lockedWithUnsavedRef.current = lockedWithUnsaved;
  const recoverySyncReviewRef = useRef(false);
  const vaultRef = useRef(vault); vaultRef.current = vault;
  const saveErrorRef = useRef(saveError); saveErrorRef.current = saveError;
  const syncing = useRef(false);
  const syncAbort = useRef<AbortController | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const sessionChannel = useRef<BroadcastChannel | null>(null);
  const sessionId = useRef('');
  const announceSession = useRef<() => void>(() => {});
  const liveSessions = useRef<() => WorkspaceSessionStatus[]>(() => []);
  const recoveryRequests = useRef(new Map<string, PendingRecoveryRequest>());
  useEffect(() => () => { syncAbort.current?.abort(); storage.current.lock(); }, []);

  useEffect(() => { const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); }; }, []);
  useEffect(() => { void persistentStorageStatus().then(setStoragePersistent); }, []);

  const refreshPending = useCallback(async () => { try { if (storage.current.isUnlocked) setPending(await storage.current.pendingCount()); } catch { /* ignore */ } }, []);

  const refreshRecoverySnapshots = useCallback(async () => {
    if (previewOnly || !storage.current.isUnlocked) {
      setRecoverySnapshots([]);
      return;
    }
    const snapshots = await storage.current.getRecoverySnapshots<Workspace>();
    setRecoverySnapshots(snapshots.map(snapshot => ({
      id: snapshot.id,
      capturedAt: snapshot.capturedAt,
      expiresAt: snapshot.expiresAt,
      reportCount: snapshot.workspace.reports?.length ?? 0,
      taskCount: snapshot.workspace.tasks?.length ?? 0,
      assignmentCount: snapshot.workspace.assignments?.length ?? 0,
    })));
  }, [previewOnly]);

  const requestRecoverySnapshots = useCallback((sessions: string[]) => {
    if (!sessions.length) return Promise.resolve([] as string[]);
    const channel = sessionChannel.current;
    if (!channel) return Promise.reject(new Error('Session sharing is unavailable. Keep both tabs open and try again.'));
    const requestId = crypto.randomUUID();
    return new Promise<string[]>((resolve, reject) => {
      const pending: PendingRecoveryRequest = {
        remaining: new Set(sessions),
        recoveryIds: [],
        timer: 0,
        resolve,
        reject,
      };
      pending.timer = window.setTimeout(() => {
        recoveryRequests.current.delete(requestId);
        reject(new Error('Another tab did not prepare its recovery copy. No workspace was overwritten.'));
      }, 5000);
      recoveryRequests.current.set(requestId, pending);
      for (const target of sessions) {
        channel.postMessage({
          type: 'prepare-overwrite',
          sessionId: sessionId.current,
          requestId,
          targetSessionId: target,
        } satisfies WorkspaceSessionMessage);
      }
    });
  }, []);

  const persist = useCallback(async (w: Workspace, overwrite = false) => {
    if (previewOnly) return;
    const at = rev.current;
    try { await storage.current.saveWorkspace<Workspace>(w, { overwrite }); }
    catch (e) {
      setSaveError(e instanceof WorkspaceConflictError
        ? 'Another session saved a newer version. Your edits are still on screen; review the session warning before saving again.'
        : e instanceof Error ? e.message : 'Local save failed');
      throw e;
    }
    setSaveError(null);
    if (recoverySyncReviewRef.current) {
      recoverySyncReviewRef.current = false;
      setRecoverySyncReviewRequired(false);
    }
    if (rev.current === at) setDirty(false);
    await refreshPending();
  }, [previewOnly, refreshPending]);

  // A recovered connection retries a failed encrypted local write. It does not
  // upload anything; no authenticated server transport is configured here.
  useEffect(() => {
    const recovered = online && !wasOnline.current;
    wasOnline.current = online;
    if (recovered && vault === 'unlocked' && dirty) {
      void persist(wsRef.current).catch(() => { /* surfaced via saveError banner */ });
    }
  }, [online, vault, dirty, persist]);

  const mutate = useCallback((fn: (w: Workspace) => Workspace) => {
    if (syncing.current) throw new Error('Wait for packet synchronization to finish.');
    rev.current++; setWs(w => preserveProtectedPackets(w, reconcileOperationalReferences(w, fn(w)))); setDirty(true);
  }, []);
  const mutateAndPersist = useCallback(async (fn:(w:Workspace)=>Workspace) => {
    if (syncing.current) throw new Error('Wait for packet synchronization to finish.');
    const next=preserveProtectedPackets(wsRef.current,reconcileOperationalReferences(wsRef.current,fn(wsRef.current)));
    rev.current++;
    wsRef.current=next;
    setWs(next);
    setDirty(true);
    if(vault==='unlocked')await persist(next);
  },[persist,vault]);

  // autosave when vault unlocked
  useEffect(() => {
    if (vault !== 'unlocked' || !dirty) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { persist(wsRef.current).catch(() => { /* surfaced via saveError banner */ }); }, 800);
    return () => window.clearTimeout(saveTimer.current);
  }, [ws, vault, dirty, persist]);

  useEffect(() => {
    if (previewOnly || typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(`fieldready-workspace:${storageNamespace}`);
    const ownSessionId = crypto.randomUUID();
    const peers = new Map<string, WorkspaceSessionStatus & { seenAt: number }>();
    sessionChannel.current = channel;
    sessionId.current = ownSessionId;
    const publishPeers = () => {
      const next = [...peers.values()].map(({ sessionId: id, dirty: peerDirty, unlocked }) =>
        ({ sessionId: id, dirty: peerDirty, unlocked }));
      setOtherSessions(current => current.length === next.length && current.every((item, index) =>
        item.sessionId === next[index]?.sessionId && item.dirty === next[index]?.dirty
          && item.unlocked === next[index]?.unlocked) ? current : next);
    };
    const pruneExpiredPeers = () => {
      const cutoff = Date.now() - SESSION_EXPIRY_MS;
      let changed = false;
      for (const [id, peer] of peers) {
        if (peer.seenAt < cutoff) {
          peers.delete(id);
          changed = true;
        }
      }
      if (changed) publishPeers();
      return [...peers.values()].map(({ sessionId: id, dirty: peerDirty, unlocked }) =>
        ({ sessionId: id, dirty: peerDirty, unlocked }));
    };
    const publishStatus = () => {
      channel.postMessage({
        type: 'status',
        sessionId: ownSessionId,
        dirty: dirtyRef.current || editorDirtyRef.current || lockedWithUnsavedRef.current,
        unlocked: vaultRef.current === 'unlocked',
        seenAt: Date.now(),
      } satisfies WorkspaceSessionMessage);
    };
    announceSession.current = publishStatus;
    channel.onmessage = (event: MessageEvent<WorkspaceSessionMessage>) => {
      const message = event.data;
      if (!message || !('sessionId' in message) || message.sessionId === ownSessionId) return;
      if (message.type === 'status') {
        if (message.seenAt < Date.now() - SESSION_EXPIRY_MS) {
          peers.delete(message.sessionId);
          publishPeers();
          return;
        }
        peers.set(message.sessionId, message);
        publishPeers();
        return;
      }
      if (message.type === 'prepare-overwrite') {
        if (message.targetSessionId !== ownSessionId) return;
        void (async () => {
          let recoveryId: string | undefined;
          let error: string | undefined;
          try {
            if (vaultRef.current !== 'unlocked') throw new Error('The other tab is no longer unlocked.');
            if (editorDirtyRef.current) throw new Error('Save or close the open form in the other tab before overwriting it.');
            if (syncing.current) throw new Error('Wait for packet synchronization in the other tab before overwriting it.');
            if (dirtyRef.current) {
              recoveryId = await storage.current.saveRecoverySnapshot<Workspace>(wsRef.current, ownSessionId);
            }
          } catch (cause) {
            error = cause instanceof Error ? cause.message : 'The other tab could not prepare a recovery copy.';
          }
          channel.postMessage({
            type: 'recovery-ready',
            sessionId: ownSessionId,
            requestId: message.requestId,
            ...(recoveryId ? { recoveryId } : {}),
            ...(error ? { error } : {}),
          } satisfies WorkspaceSessionMessage);
        })();
        return;
      }
      if (message.type === 'recovery-ready') {
        const pending = recoveryRequests.current.get(message.requestId);
        if (!pending || !pending.remaining.delete(message.sessionId)) return;
        if (message.recoveryId) pending.recoveryIds.push(message.recoveryId);
        if (message.error) pending.error ??= message.error;
        if (pending.remaining.size === 0) {
          window.clearTimeout(pending.timer);
          recoveryRequests.current.delete(message.requestId);
          if (pending.error) pending.reject(new Error(pending.error));
          else pending.resolve(pending.recoveryIds);
        }
        return;
      }
      peers.delete(message.sessionId);
      publishPeers();
      if (message.type === 'overwrite') {
        window.clearTimeout(saveTimer.current);
        syncAbort.current?.abort();
        storage.current.lock();
        setOverwrittenElsewhere(true);
        setLockedNotice(false);
        setLockedWithUnsaved(false);
        setSaveError(null);
        setPending(0);
        setDirty(false);
        setEditorDirty(false);
        setRecoverySnapshots([]);
        setRecoverySyncReviewRequired(false);
        recoverySyncReviewRef.current = false;
        setVault('none');
        setRestored(false);
        setWs(createEmptyWorkspace());
        setEpoch(value => value + 1);
      }
    };
    liveSessions.current = pruneExpiredPeers;
    const heartbeat = window.setInterval(() => {
      pruneExpiredPeers();
      publishStatus();
    }, 5_000);
    const refreshOnWake = () => {
      if (document.visibilityState === 'hidden') return;
      pruneExpiredPeers();
      publishStatus();
    };
    window.addEventListener('focus', refreshOnWake);
    window.addEventListener('pageshow', refreshOnWake);
    document.addEventListener('visibilitychange', refreshOnWake);
    publishStatus();
    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener('focus', refreshOnWake);
      window.removeEventListener('pageshow', refreshOnWake);
      document.removeEventListener('visibilitychange', refreshOnWake);
      channel.postMessage({ type: 'close', sessionId: ownSessionId } satisfies WorkspaceSessionMessage);
      channel.close();
      sessionChannel.current = null;
      sessionId.current = '';
      announceSession.current = () => {};
      liveSessions.current = () => [];
      setOtherSessions([]);
    };
  }, [previewOnly, storageNamespace]);

  useEffect(() => { announceSession.current(); }, [dirty, editorDirty, vault]);

  const lockNow = useCallback((reason?: string) => {
    syncAbort.current?.abort();
    setPacketSyncState('idle'); setPacketSyncError(null);
    if (previewOnly) {
      storage.current.lock();
      setLockedWithUnsaved(false);
      setVault('unlocked');
      setRestored(true);
      setPending(0);
      setDirty(false);
      setEditorDirty(false);
      setSaveError(null);
      setPreviewChatDrafts([]);
      setWs(hasCustomPreviewWorkspace ? previewWorkspaceFactory.current() : createUiPreviewWorkspace(wsRef.current.role));
      setEpoch(e => e + 1);
      setLockedNotice(false);
      return;
    }
    const hasUnsavedWork = !!reason && (dirtyRef.current || editorDirtyRef.current || !!saveErrorRef.current);
    lockedWithUnsavedRef.current = hasUnsavedWork;
    setLockedWithUnsaved(hasUnsavedWork);
    storage.current.lock();
    setVault('none'); setRestored(false); setPending(0); setDirty(false); setEditorDirty(false); setSaveError(null); setRecoverySnapshots([]);
    setRecoverySyncReviewRequired(false); recoverySyncReviewRef.current = false;
    setWs(createEmptyWorkspace()); setEpoch(e => e + 1);
    if (reason) setLockedNotice(true);
  }, [previewOnly, hasCustomPreviewWorkspace]);

  // inactivity
  useEffect(() => {
    if (previewOnly || vault !== 'unlocked') return;
    let t = window.setTimeout(() => lockNow('idle'), IDLE_MS);
    const reset = () => { window.clearTimeout(t); t = window.setTimeout(() => lockNow('idle'), IDLE_MS); };
    const ev = ['pointerdown','keydown','scroll','touchstart'];
    ev.forEach(e => window.addEventListener(e, reset, { passive: true }));
    return () => { window.clearTimeout(t); ev.forEach(e => window.removeEventListener(e, reset)); };
  }, [vault, lockNow, previewOnly]);

  const setupAndSave = useCallback(async (pass: string) => {
    if (previewOnly) throw new Error('The UI test preview is memory-only and cannot create a saved vault.');
    const s = storage.current;
    await s.unlock(enc(pass));
    let existing: Workspace | undefined;
    try { existing = await s.get<Workspace>('workspace'); }
    catch { s.lock(); throw new Error('A saved vault already exists on this device and this passphrase does not open it. Use "Unlock saved work" instead — nothing was overwritten.'); }
    if (existing) { s.lock(); throw new Error('Saved work already exists on this device. Use "Unlock saved work" to restore it first — nothing was overwritten.'); }
    const w = { ...wsRef.current, version: wsRef.current.version + 1 };
    try { await persist(w); } catch (e) { s.lock(); throw e; }
    setWs(w); setVault('unlocked'); setRestored(true);
    setStoragePersistent(await requestPersistentStorage());
    setLockedWithUnsaved(false); setLockedNotice(false); setOverwrittenElsewhere(false);
  }, [persist, previewOnly]);

  const unlockAndRestore = useCallback(async (pass: string) => {
    if (previewOnly) throw new Error('The UI test preview is memory-only and cannot open a saved vault.');
    const s = storage.current;
    await s.unlock(enc(pass));
    let data: Workspace | undefined;
    try { data = await s.get<Workspace>('workspace'); }
    catch { s.lock(); throw new Error('Could not decrypt saved work. The passphrase may be wrong, or the data is damaged.'); }
    if (!data) { s.lock(); throw new Error('No saved work found on this device. Use "Save locally" to create a vault.'); }
    let migratedReports: Report[];
    let restoredCaseFolder: PhaseCaseFolder | undefined;
    try {
      migratedReports = data.reports.filter(saved=>[1,2,3,4].includes(Number(saved.phase))).map(saved => {
        if (saved.syncStatus === 'synchronized_complete' || saved.syncAttemptPending) return saved;
        const raw = saved as Report & { beat?: unknown; ratings?: unknown };
        const { beat: _oldAreaField, ...reportWithoutOldField } = raw;
        const geography = migrateGeography(raw);
        const evaluation = migrateRatings(raw.ratings, raw.legacyEvaluation);
        return {
          ...reportWithoutOldField,
          ...geography,
          ...evaluation,
          activity: normalizeDailyActivitySummary(raw.activity),
          activityCountsIncludeRuns:raw.activityCountsIncludeRuns??true,
          legacyActivity: { ...raw.legacyActivity, ...(isRecord(raw.activity) && 'completedPayouts' in raw.activity ? { completedPayouts: raw.activity.completedPayouts } : {}) },
          runs: Array.isArray(raw.runs) ? raw.runs.map((sourceRun) => {
            if (!isRecord(sourceRun)) throw new Error('A saved run form is invalid. Its data was not changed.');
            const { citationDisposition: legacyDisposition, ...run } = sourceRun as TrainingRun & { citationDisposition?: unknown };
            void legacyDisposition;
            const flags = isRecord(run.activityFlags)
              ? Object.fromEntries(Object.entries(run.activityFlags).filter(([key,value]) =>
                  DAILY_ACTIVITY_FIELDS.some(field=>field.key===key) && typeof value==='boolean'))
              : undefined;
            return { ...run, activityFlags: flags } as unknown as TrainingRun;
          }) : [],
          reportingForDuty: normalizeReportingForDuty(raw.reportingForDuty),
          className: typeof raw.className === 'string' ? raw.className : '',
          shift: migrateShift(raw.shift),
          zone: geography.zone,
          precinct: geography.precinct,
          cruiserDistrict: geography.cruiserDistrict,
          ftoAssignment:typeof raw.ftoAssignment==='string'?raw.ftoAssignment:undefined,
          recruitComments: raw.recruitComments ?? '',
        };
      });
      restoredCaseFolder=migrateCaseFolder(data.caseFolder);
    } catch (e) {
      s.lock();
      throw e;
    }
    const savedWorkspace = data as Workspace & { weeklyAcknowledgements?: WeeklyPacketAcknowledgement[]; weeklyPerformanceLogs?:WeeklyPerformanceLog[]; substationOrientations?:SubstationOrientationRecord[]; assignmentMessages?: unknown };
    const { assignmentMessages: legacyChatHistory, ...workspaceWithoutChatHistory } = savedWorkspace;
    void legacyChatHistory;
    const phaseFolders=Array.isArray(savedWorkspace.phaseFolders)
      ?savedWorkspace.phaseFolders.map(migrateCaseFolder).filter((folder):folder is PhaseCaseFolder=>!!folder)
      :[];
    if(restoredCaseFolder&&!phaseFolders.some(folder=>sameCaseFolder(folder,restoredCaseFolder!))) phaseFolders.push(restoredCaseFolder);
    const weeklyAcknowledgements = Array.isArray(savedWorkspace.weeklyAcknowledgements)
      ? savedWorkspace.weeklyAcknowledgements.map(ack => {
          const legacy = ack.signatures as WeeklyPacketAcknowledgement['signatures'] & { sergeant?: WeeklyPacketAcknowledgement['signatures']['fto'] };
          const { sergeant, ...signatures } = legacy;
          return { ...ack, signatures: { ...signatures, ...(sergeant ? { legacySergeant: sergeant } : {}) } };
        })
      : [];
    const savedWeeklyPerformanceLogs=Array.isArray(savedWorkspace.weeklyPerformanceLogs)
      ?savedWorkspace.weeklyPerformanceLogs.filter(item=>isRecord(item)&&typeof item.id==='string'&&typeof item.weekStart==='string'&&typeof item.recruitBadge==='string'&&Array.isArray(item.entries))
      :[];
    const weeklyPerformanceLogs=migrateOperationalReferenceReviews(savedWorkspace.packetIndexVersion,savedWeeklyPerformanceLogs);
    const substationOrientations=Array.isArray(savedWorkspace.substationOrientations)
      ?savedWorkspace.substationOrientations.filter(item=>isRecord(item)&&typeof item.id==='string'&&typeof item.recruitBadge==='string'&&isRecord(item.checklist))
      :[];
    const ftoPhasePostings=Array.isArray(savedWorkspace.ftoPhasePostings)
      ?savedWorkspace.ftoPhasePostings.filter(item=>isRecord(item)&&typeof item.id==='string'&&typeof item.className==='string'&&[1,2,3,4].includes(Number(item.phase))&&typeof item.phaseStartDate==='string'&&['open','closed'].includes(String(item.status)))
      :[];
    const ftoPhaseSignups=Array.isArray(savedWorkspace.ftoPhaseSignups)
      ?savedWorkspace.ftoPhaseSignups.filter(item=>isRecord(item)&&typeof item.id==='string'&&typeof item.postingId==='string'&&typeof item.ftoBadge==='string'&&['local_unsent','selected_locally','withdrawn'].includes(String(item.status)))
      :[];
    const coverageRequests=Array.isArray(savedWorkspace.coverageRequests)
      ?savedWorkspace.coverageRequests.filter(item=>isRecord(item)&&typeof item.id==='string'&&typeof item.recruitBadge==='string'&&typeof item.startDateTime==='string'&&typeof item.endDateTime==='string'&&['local_unsent','cancelled'].includes(String(item.status)))
      :[];
    const phaseExtensionRequests=normalizePhaseExtensionRequests(savedWorkspace.phaseExtensionRequests);
    const lawReviewRecords=Array.isArray(savedWorkspace.lawReviewRecords)
      ?savedWorkspace.lawReviewRecords.filter((item):item is LawReviewRecord=>isRecord(item)&&typeof item.id==='string'&&typeof item.assignmentId==='string'&&typeof item.recruitBadge==='string'&&typeof item.recruitName==='string'&&typeof item.sourceId==='string'&&typeof item.sourceLabel==='string'&&[1,2,3,4].includes(Number(item.phase))&&['assigned','reviewed'].includes(String(item.state)))
      :[];
    const ftoDirectory = Array.isArray(savedWorkspace.ftoDirectory) ? savedWorkspace.ftoDirectory.filter(item=>isRecord(item)&&typeof item.badge==='string'&&typeof item.name==='string') : [];
    const assignments = Array.isArray(savedWorkspace.assignments) ? savedWorkspace.assignments.filter(item=>isRecord(item)&&typeof item.id==='string'&&typeof item.recruitBadge==='string'&&[1,2,3,4].includes(Number(item.phase))) : [];
    const tasks=Array.isArray(savedWorkspace.tasks)?savedWorkspace.tasks.filter(item=>isRecord(item)&&[1,2,3,4].includes(Number(item.phase))):[];
    const restoredWorkspace={ ...workspaceWithoutChatHistory, packetIndexVersion:CURRENT_PACKET_INDEX_VERSION as Workspace['packetIndexVersion'], role: normalizePreviewRole(savedWorkspace.role), caseFolder: restoredCaseFolder, phaseFolders, reports: migratedReports, tasks, ftoDirectory, assignments, weeklyAcknowledgements,weeklyPerformanceLogs,substationOrientations,ftoPhasePostings,ftoPhaseSignups,coverageRequests,lawReviewRecords,phaseExtensionRequests };
    const workspaceWithAppliedExtensions=preserveProtectedPackets(restoredWorkspace,applyApprovedPhaseExtensions(restoredWorkspace));
    const requiresSyncReview = await s.recoverySyncReviewRequired();
    recoverySyncReviewRef.current = requiresSyncReview;
    setRecoverySyncReviewRequired(requiresSyncReview);
    setWs(workspaceWithAppliedExtensions); setEpoch(e => e + 1); setVault('unlocked'); setRestored(true); setDirty(workspaceWithAppliedExtensions!==restoredWorkspace||weeklyPerformanceLogs!==savedWeeklyPerformanceLogs||savedWorkspace.packetIndexVersion!==CURRENT_PACKET_INDEX_VERSION); setLockedNotice(false); setLockedWithUnsaved(false); setOverwrittenElsewhere(false);
    setStoragePersistent(await requestPersistentStorage());
    await refreshPending();
    await refreshRecoverySnapshots();
  }, [previewOnly, refreshPending, refreshRecoverySnapshots]);

  const saveNow = useCallback(async () => {
    if (previewOnly) return;
    if (vault !== 'unlocked') { setIntent('save'); return; }
    await persist(wsRef.current);
  }, [previewOnly, vault, persist]);

  const overwriteOtherSessions = useCallback(async () => {
    if (previewOnly) throw new Error('The UI test preview cannot overwrite saved workspaces.');
    if (vault !== 'unlocked') throw new Error('Unlock the local vault before overwriting another session.');
    if (editorDirtyRef.current) throw new Error('Save the open form before overwriting another session.');
    const sessionsToOverwrite = liveSessions.current().filter(session => session.unlocked);
    if (!sessionsToOverwrite.length) throw new Error('No other unlocked session is available to overwrite.');
    if (syncing.current) throw new Error('Wait for packet synchronization to finish.');
    try {
      await requestRecoverySnapshots(sessionsToOverwrite.map(session => session.sessionId));
    } catch (error) {
      await refreshRecoverySnapshots();
      throw error;
    }
    await persist(wsRef.current, true);
    await refreshRecoverySnapshots();
    const ownSessionId = sessionId.current;
    if (ownSessionId) sessionChannel.current?.postMessage({ type: 'overwrite', sessionId: ownSessionId } satisfies WorkspaceSessionMessage);
    setOtherSessions([]);
  }, [previewOnly, vault, persist, requestRecoverySnapshots, refreshRecoverySnapshots]);

  const restoreRecoverySnapshot = useCallback(async (id: string) => {
    if (previewOnly) throw new Error('The UI test preview cannot restore saved workspaces.');
    if (vault !== 'unlocked') throw new Error('Unlock the local vault before restoring a recovery copy.');
    if (syncing.current) throw new Error('Wait for packet synchronization to finish before restoring a recovery copy.');
    const recovered = await storage.current.restoreRecoverySnapshot<Workspace>(
      id,
      (current, previous) => current ? preserveProtectedPackets(current, previous) : previous,
    );
    rev.current++;
    wsRef.current = recovered;
    setWs(recovered);
    setDirty(false);
    setSaveError(null);
    setOverwrittenElsewhere(false);
    recoverySyncReviewRef.current = true;
    setRecoverySyncReviewRequired(true);
    setEpoch(value => value + 1);
    await refreshPending();
    await refreshRecoverySnapshots();
    announceSession.current();
  }, [previewOnly, vault, refreshPending, refreshRecoverySnapshots]);

  const syncPackets = useCallback(async () => {
    if (previewOnly) return;
    if (recoverySyncReviewRef.current)
      throw new Error('Save the restored workspace locally before synchronizing packets.');
    if (vault !== 'unlocked' || !online || editorDirtyRef.current)
      throw new Error('Save open edits and unlock the online workspace before synchronizing.');
    if (syncing.current) throw new Error('Sync is already running.');
    syncing.current = true;
    setPacketSyncState('uploading'); setPacketSyncError(null);
    const controller = new AbortController();
    syncAbort.current = controller;
    try {
      await persist(wsRef.current);
      const next = await storage.current.syncPacketBatch<Workspace>(
        changes => uploadPacketBatch(changes, controller.signal),
      );
      if (controller.signal.aborted) return;
      if (next) { wsRef.current = next; setWs(next); setEpoch(value => value + 1); }
      await refreshPending();
      if (!controller.signal.aborted) setPacketSyncState('synchronized');
    } catch (error) {
      if (!controller.signal.aborted) {
        const guarded = await storage.current.get<Workspace>('workspace');
        if (guarded && !controller.signal.aborted) {
          wsRef.current = guarded; setWs(guarded); setEpoch(value => value + 1);
        }
        setPacketSyncError('Upload Not Confirmed. The Exact Saved Snapshot Is Protected Until Retry Confirms the Outcome.');
        setPacketSyncState('failed');
      }
      throw error;
    } finally { syncing.current = false; syncAbort.current = null; }
  }, [previewOnly, vault, online, persist, refreshPending]);

  const loadLocalChatDrafts = useCallback(() => previewOnly
    ? Promise.resolve(previewChatDrafts)
    : storage.current.getLocalOnlyDrafts<LocalChatDraft>(), [previewOnly, previewChatDrafts]);
  const saveLocalChatDraft = useCallback((draft: LocalChatDraft) => {
    if (previewOnly) {
      setPreviewChatDrafts(current => [draft, ...current.filter(item => item.id !== draft.id)]);
      return Promise.resolve();
    }
    return storage.current.saveLocalOnlyDraft(`chat-draft:${draft.id}`, draft);
  }, [previewOnly]);
  const deleteLocalChatDraft = useCallback((id: string) => {
    if (previewOnly) {
      setPreviewChatDrafts(current => current.filter(item => item.id !== id));
      return Promise.resolve();
    }
    return storage.current.deleteLocalOnlyDraft(`chat-draft:${id}`);
  }, [previewOnly]);

  const value = useMemo<Ctx>(() => ({
    ws, epoch, saveError, editorDirty, setEditorDirty, vault, restored, pending, dirty, online, intent, lockedNotice, lockedWithUnsaved, storagePersistent, previewOnly, previewLabel, otherSessions, overwrittenElsewhere, recoverySnapshots, recoverySyncReviewRequired,
    segTaskDirectory: SEG_TASK_DIRECTORY,
    getOperationalPacket: report => resolveOperationalPacket(
      report,
      [...ws.phaseFolders, ...(ws.caseFolder ? [ws.caseFolder] : [])],
      ws.substationOrientations,
    ),
    setRole: (role) => {
      if (!previewOnly) return;
      const nextRole = normalizePreviewRole(role);
      rev.current++;
      setWs(current => hasCustomPreviewWorkspace ? { ...current, role: nextRole } : createUiPreviewWorkspace(nextRole));
      setDirty(false);
      setEditorDirty(false);
      setSaveError(null);
      setPreviewChatDrafts([]);
      setEpoch(value => value + 1);
    },
    setCaseFolder: (caseFolder) => mutate(w => {
      const folders=w.phaseFolders??[];
      const index=folders.findIndex(existing=>sameCaseFolder(existing,caseFolder));
      const phaseFolders=index<0?[...folders,caseFolder]:folders.map((existing,i)=>i===index?caseFolder:existing);
      return applyApprovedPhaseExtensions({...w,caseFolder,phaseFolders});
    }),
    submitPhaseExtensionRequest:async(request)=>{
      if(previewOnly)throw new Error('Shared requests are disabled in this fictional test workspace.');
      if(wsRef.current.role!=='fto'||vault!=='unlocked')throw new Error('Unlock the local vault as the FTO before submitting a request.');
      await mutateAndPersist(w=>{
        const existing=w.phaseExtensionRequests.find(item=>sameExtensionTarget(item,request));
        if(existing&&existing.id!==request.id&&existing.status!=='local_draft')return w;
        const saved={...request,status:request.status??'local_draft'};
        return {...w,phaseExtensionRequests:existing
          ?w.phaseExtensionRequests.map(item=>item.id===existing.id?saved:item)
          :[...w.phaseExtensionRequests,saved]};
      });
    },
    syncSharedPhaseExtensionRequest:async(request)=>{
      if(previewOnly)return;
      if(wsRef.current.role!=='fto'||vault!=='unlocked')return;
      await mutateAndPersist(w=>{
        const existing=w.phaseExtensionRequests.find(item=>item.id===request.id);
        const synced={...request,status:request.status??'pending'};
        if(existing?.status===synced.status&&(synced.status!=='approved'||existing.appliedToLocalSchedule))return w;
        if(synced.status==='approved') {
          const staged={...w,phaseExtensionRequests:existing
            ?w.phaseExtensionRequests.map(item=>item.id===request.id?synced:item)
            :[...w.phaseExtensionRequests,synced]};
          return applyApprovedPhaseExtensions(staged);
        }
        if(!existing)return w;
        return {...w,phaseExtensionRequests:w.phaseExtensionRequests.map(item=>item.id===request.id?synced:item)};
      });
    },
    resolvePhaseExtensionRequest:async(id,approve)=>{
      if(previewOnly)throw new Error('Shared request reviews are disabled in this fictional test workspace.');
      if(wsRef.current.role!=='fto_coordinator'||vault!=='unlocked')throw new Error('Unlock the local vault as the FTO Coordinator to review requests.');
      await mutateAndPersist(w=>approve?approvePhaseExtension(w,id):denyPhaseExtension(w,id));
    },
    importRoster: (ftos, assignments) => mutate(w => {
      const directory = new Map(w.ftoDirectory.map(item=>[item.badge.toLowerCase(),item]));
      ftos.forEach(item=>{
        const previous=directory.get(item.badge.toLowerCase());
        directory.set(item.badge.toLowerCase(),{...previous,...item,email:item.email??previous?.email});
      });
      const byIdentity = new Map(w.assignments.map(item=>[[item.className.toLowerCase(),item.recruitBadge.toLowerCase(),item.phase,item.phaseStartDate].join('|'),item]));
      assignments.forEach(item=>{
        const key=[item.className.toLowerCase(),item.recruitBadge.toLowerCase(),item.phase,item.phaseStartDate].join('|');
        const old=byIdentity.get(key);
        byIdentity.set(key,{...old,...item,id:old?.id??item.id,recruitEmail:item.recruitEmail??old?.recruitEmail,shift:item.shift??old?.shift,daysOff:item.daysOff??old?.daysOff,zone:item.zone??old?.zone,precinct:item.precinct??old?.precinct,cruiserDistrict:item.cruiserDistrict??old?.cruiserDistrict,ftoAssignment:item.ftoAssignment??old?.ftoAssignment});
      });
      return {...w,ftoDirectory:[...directory.values()],assignments:[...byIdentity.values()]};
    }),
    loadLocalChatDrafts, saveLocalChatDraft, deleteLocalChatDraft,
    upsertAssignment: (assignment) => mutate(w=>({...w,assignments:w.assignments.some(item=>item.id===assignment.id)?w.assignments.map(item=>item.id===assignment.id?assignment:item):[...w.assignments,assignment]})),
    upsertReport: (r) => mutate(w => upsertReportAndWeeklyUaLog(w,r)),
    upsertWeeklyAcknowledgement: (ack) => mutate(w => ({ ...w, weeklyAcknowledgements: w.weeklyAcknowledgements.some(x => x.id === ack.id) ? w.weeklyAcknowledgements.map(x => x.id === ack.id ? ack : x) : [ack, ...w.weeklyAcknowledgements] })),
    upsertWeeklyPerformanceLog:(log)=>mutate(w=>({...w,weeklyPerformanceLogs:(w.weeklyPerformanceLogs??[]).some(item=>item.id===log.id)?w.weeklyPerformanceLogs.map(item=>item.id===log.id?log:item):[log,...(w.weeklyPerformanceLogs??[])]})),
    upsertSubstationOrientation:(record)=>mutate(w=>({...w,substationOrientations:(w.substationOrientations??[]).some(item=>item.id===record.id)?w.substationOrientations.map(item=>item.id===record.id?record:item):[record,...(w.substationOrientations??[])]})),
     upsertFtoPhasePosting:(posting)=>mutate(w=>({...w,ftoPhasePostings:(w.ftoPhasePostings??[]).some(item=>item.id===posting.id)?w.ftoPhasePostings.map(item=>item.id===posting.id?posting:item):[posting,...(w.ftoPhasePostings??[])]})),
     upsertFtoPhaseSignup:(signup)=>mutate(w=>({...w,ftoPhaseSignups:(w.ftoPhaseSignups??[]).some(item=>item.id===signup.id)?w.ftoPhaseSignups.map(item=>item.id===signup.id?signup:item):[signup,...(w.ftoPhaseSignups??[])]})),
     upsertCoverageRequest:(request)=>mutate(w=>({...w,coverageRequests:(w.coverageRequests??[]).some(item=>item.id===request.id)?w.coverageRequests.map(item=>item.id===request.id?request:item):[request,...(w.coverageRequests??[])]})),
      upsertLawReviewRecord:(record)=>mutate(w=>({...w,lawReviewRecords:(w.lawReviewRecords??[]).some(item=>item.id===record.id)?w.lawReviewRecords.map(item=>item.id===record.id?record:item):[record,...(w.lawReviewRecords??[])]})),
      deleteLawReviewRecord:(id)=>mutate(w=>({...w,lawReviewRecords:(w.lawReviewRecords??[]).filter(item=>item.id!==id)})),
    deleteReport: (id) => mutate(w => {
      if (w.reports.some(r => r.id === id && (r.syncStatus === 'synchronized_complete' || r.syncAttemptPending)))
        throw new Error('Synchronized packets cannot be deleted locally.');
      return { ...w, reports: w.reports.filter(r => r.id !== id) };
    }),
    toggleTask: (id, by) => mutate(w => ({ ...w, tasks: w.tasks.map((t: Task) => t.id !== id ? t : t.done ? { ...t, done: false, by: undefined, at: undefined } : { ...t, done: true, by, at: new Date().toISOString() }) })),
    openVault: (i) => { if (!previewOnly) setIntent(i); }, closeVault: () => setIntent(null),
    setupAndSave, unlockAndRestore, saveNow, overwriteOtherSessions, refreshRecoverySnapshots, restoreRecoverySnapshot, syncPackets, packetSyncState, packetSyncError, lockNow, dismissLockedNotice: () => setLockedNotice(false),
    dismissOverwrittenElsewhere: () => setOverwrittenElsewhere(false),
    resetWorkspace: () => { rev.current++; setWs(previewOnly ? (hasCustomPreviewWorkspace ? previewWorkspaceFactory.current() : createUiPreviewWorkspace(wsRef.current.role)) : createEmptyWorkspace()); setDirty(!previewOnly); setEditorDirty(false); setPreviewChatDrafts([]); setOverwrittenElsewhere(false); setEpoch(e => e + 1); },
  }), [ws, epoch, saveError, packetSyncState, packetSyncError, editorDirty, setEditorDirty, vault, restored, pending, dirty, online, intent, lockedNotice, lockedWithUnsaved, storagePersistent, otherSessions, overwrittenElsewhere, recoverySnapshots, recoverySyncReviewRequired, mutate, mutateAndPersist, setupAndSave, unlockAndRestore, saveNow, overwriteOtherSessions, refreshRecoverySnapshots, restoreRecoverySnapshot, syncPackets, lockNow, loadLocalChatDrafts, saveLocalChatDraft, deleteLocalChatDraft, previewOnly, previewLabel, hasCustomPreviewWorkspace]);

  return <C.Provider value={value}>{children}</C.Provider>;
}
export function useWorkspace() { const c = useContext(C); if (!c) throw new Error('WorkspaceProvider missing'); return c; }
export function useOperationalStateMachine(report: Report | undefined): OperationalPacket | undefined {
  const { getOperationalPacket } = useWorkspace();
  return useMemo(() => report ? getOperationalPacket(report) : undefined, [report, getOperationalPacket]);
}
export function useTimelineInterpolation(weekStart?: string, recruitBadge?: string, className?: string): TimelineInterpolation {
  const { ws } = useWorkspace();
  return useMemo(
    () => buildTimelineInterpolation(ws.reports, weekStart, recruitBadge, className),
    [ws.reports, weekStart, recruitBadge, className],
  );
}

export function useTheme() {
  const [night, setNight] = useState(() => { try { return localStorage.getItem('fieldready.theme') === 'night'; } catch { return false; } });
  useEffect(() => { document.documentElement.classList.toggle('dark', night); try { localStorage.setItem('fieldready.theme', night ? 'night' : 'day'); } catch { /* ignore */ } }, [night]);
  return { night, toggle: () => setNight(n => !n) };
}
