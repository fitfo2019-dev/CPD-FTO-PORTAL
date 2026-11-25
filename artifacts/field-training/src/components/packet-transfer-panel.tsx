import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, CloudUpload, FileText, Home, Loader2, LockKeyhole, RefreshCw, Save, ShieldCheck, Wifi, WifiOff } from 'lucide-react';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog.js';
import { useWorkspace } from '@/state/workspace.js';
import {
  checkPacketService, continueSharedPacketHistory, createSharedPacketHistory, PacketHistoryCursorError,
  type PacketHistoryFilters, type SharedPacket, type SharedPacketHistory,
} from '@/lib/training-packet-sync.js';
import { packetDraftSyncBlock, packetFinalizationBlock, queuedReports } from '@/lib/packet-upload-controls.js';
import { formatDateDMY } from '@/lib/training-calendar.js';
import type { Report } from '@/lib/model.js';
import './packet-transfer.css';

/** Keyed by role/vault in Reports; session data is never stored in a shared cache. */
export function PacketTransferPanel() {
  const w = useWorkspace();
  const [accessPath, setAccessPath] = useState<'station' | 'remote'>('station');
  const [service, setService] = useState<'unchecked' | 'checking' | 'available' | 'unavailable'>('unchecked');
  const [shared, setShared] = useState<SharedPacket[] | null>(null);
  const [recruitFilter, setRecruitFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<PacketHistoryFilters>({});
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [continuingHistory, setContinuingHistory] = useState(false);
  const [historyReadFailed, setHistoryReadFailed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [finalizationConfirmation, setFinalizationConfirmation] = useState<{id:string;contentHash:string}|null>(null);
  const [finalizationAcknowledged, setFinalizationAcknowledged] = useState(false);
  const request = useRef<AbortController | null>(null);
  const history = useRef<SharedPacketHistory>(createSharedPacketHistory());
  const mounted = useRef(true);
  const action = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; request.current?.abort(); };
  }, []);
  // Connectivity only invalidates availability. Neither branch transmits data.
  useEffect(() => { if (!w.online) { request.current?.abort(); setService('unchecked'); setRefreshing(false); } }, [w.online]);
  const pending = queuedReports(w.ws.reports);
  const busy = w.packetSyncState === 'uploading' || service === 'checking' || refreshing;
  const disabledReads = w.previewOnly || w.vault !== 'unlocked' || !w.online || busy;
  const block = packetDraftSyncBlock({ previewOnly: w.previewOnly, unlocked: w.vault === 'unlocked', online: w.online,
    busy, unsaved: w.dirty || w.editorDirty || !!w.saveError, serviceReady: service === 'available',
    ftoView: w.ws.role === 'fto', count: pending.length, savedCount: w.pending });
  const snapshot = JSON.stringify(pending);
  const failed = w.ws.reports.some(report => report.syncAttemptPending || report.finalizationAttemptPending)
    || w.packetSyncState === 'failed';
  const canContinueHistory = shared !== null && historyReadFailed && historyHasMore &&
    historyCursor !== null && !history.current.blocked;
  const finalizationReport = finalizationConfirmation
    ? w.ws.reports.find(report => report.id === finalizationConfirmation.id)
    : undefined;
  const finalizationSnapshotCurrent = !!finalizationReport
    && finalizationReport.serverContentHash === finalizationConfirmation?.contentHash
    && finalizationReport.draftSyncPending === false
    && finalizationReport.syncStatus !== 'submitted_complete'
    && finalizationReport.syncStatus !== 'synchronized_complete';
  const finalizationBlock = (report:Report) => packetFinalizationBlock(report, {
    previewOnly: w.previewOnly, unlocked: w.vault === 'unlocked', online: w.online, busy,
    unsaved: w.dirty || w.editorDirty || !!w.saveError, serviceReady: service === 'available',
    ftoView: w.ws.role === 'fto',
  });

  async function checkAccess() {
    if (disabledReads || action.current) return;
    action.current = true;
    const controller = new AbortController(); request.current = controller;
    setService('checking'); setNotice(null);
    try {
      const available = await checkPacketService(controller.signal);
      if (!controller.signal.aborted && mounted.current) {
        setService(available ? 'available' : 'unavailable');
         setNotice(available ? 'Agency Service Available. The Server Verifies FTO Identity and Assignment for Draft Sync and Finalization.'
          : 'Agency Storage Is Unavailable. Keep Work Saved Locally.');
      }
    } catch {
      if (!controller.signal.aborted && mounted.current) {
        setService('unavailable'); setNotice('Agency Access Could Not Be Verified. Sign In with an Authorized Agency Account and Use an IT-Approved Connection. Local Drafts Are Unchanged.');
      }
    } finally { action.current = false; }
  }
  async function refresh(filters: PacketHistoryFilters = appliedFilters) {
    if (disabledReads || action.current) return;
    action.current = true;
    history.current = createSharedPacketHistory(filters);
    const controller = new AbortController(); request.current = controller;
    setHistoryCursor(null); setHistoryHasMore(false);
    setRefreshing(true); setContinuingHistory(false); setHistoryReadFailed(false);
    setRefreshedAt(null); setReadError(null);
    try {
      await continueSharedPacketHistory(history.current, controller.signal, current => {
        if (!controller.signal.aborted && mounted.current) {
          setShared([...current.data]);
          setHistoryCursor(current.nextCursor ?? null);
          setHistoryHasMore(current.hasMore);
          setAppliedFilters(filters);
          setRefreshedAt(new Date().toLocaleString());
        }
      }, 1);
      if (!controller.signal.aborted && mounted.current) {
        setHistoryReadFailed(false);
      }
    } catch (error) {
      if (!controller.signal.aborted && mounted.current) {
        setReadError(packetHistoryErrorMessage(error, history.current, shared !== null));
        setHistoryReadFailed(true);
        setHistoryCursor(history.current.nextCursor ?? null);
        setHistoryHasMore(history.current.hasMore);
      }
    } finally {
      action.current = false;
      if (!controller.signal.aborted && mounted.current) {
        setRefreshing(false);
        setContinuingHistory(false);
      }
    }
  }
  async function loadOlderHistory() {
    if (!history.current.nextCursor || !historyHasMore || disabledReads || action.current || history.current.blocked) return;
    action.current = true;
    const controller = new AbortController(); request.current = controller;
    setRefreshing(true); setContinuingHistory(true);
    try {
      await continueSharedPacketHistory(history.current, controller.signal, current => {
        if (!controller.signal.aborted && mounted.current) {
          setShared([...current.data]);
          setHistoryCursor(current.nextCursor ?? null);
          setHistoryHasMore(current.hasMore);
          setRefreshedAt(new Date().toLocaleString());
        }
      }, 1);
      if (!controller.signal.aborted && mounted.current) {
        setReadError(null);
        setHistoryReadFailed(false);
      }
    } catch (error) {
      if (!controller.signal.aborted && mounted.current) {
        setReadError(packetHistoryErrorMessage(error, history.current));
        setHistoryReadFailed(true);
        setHistoryCursor(history.current.nextCursor ?? null);
        setHistoryHasMore(history.current.hasMore);
      }
    } finally {
      action.current = false;
      if (!controller.signal.aborted && mounted.current) {
        setRefreshing(false);
        setContinuingHistory(false);
      }
    }
  }
  function applyHistoryFilters() {
    if (dateFromFilter && dateToFilter && dateFromFilter > dateToFilter) {
      setHistoryReadFailed(false);
      setReadError('The From Date Must Be on or Before the To Date.');
      return;
    }
    const filters: PacketHistoryFilters = {
      ...(recruitFilter.trim() ? { recruit: recruitFilter.trim() } : {}),
      ...(dateFromFilter ? { dateFrom: dateFromFilter } : {}),
      ...(dateToFilter ? { dateTo: dateToFilter } : {}),
    };
    void refresh(filters);
  }
  async function syncDrafts() {
    if (block || !acknowledged || confirmation !== snapshot || action.current) return;
    action.current = true; setConfirmation(null);
    try { await w.syncPackets(); }
    catch { /* Provider retains the exact encrypted draft for retry. */ }
    finally { action.current = false; }
  }
  async function finalize() {
    if (!finalizationReport || !finalizationConfirmation || !finalizationAcknowledged ||
      !finalizationSnapshotCurrent || finalizationBlock(finalizationReport) || action.current) return;
    action.current = true;
    try {
      await w.finalizePacket(finalizationReport.id);
      if (mounted.current) setNotice('Packet finalized and sealed. It is now available to the assigned Coordinator; PO release and acknowledgment remain separate.');
    } catch {
      if (mounted.current) setNotice(w.packetSyncError ??
        'Finalization was not confirmed. The exact saved snapshot is protected for a safe retry.');
    } finally {
      action.current = false;
      if (mounted.current) {
        setFinalizationConfirmation(null);
        setFinalizationAcknowledged(false);
      }
    }
  }
  async function save() {
    if (busy || action.current || w.previewOnly) return;
    setNotice(null);
    try {
      await w.saveNow();
      if (mounted.current && w.vault === 'unlocked')
        setNotice('Saved to the encrypted device vault. If online, an editable draft sync may follow; nothing was submitted or finalized.');
    } catch { if (mounted.current) setNotice('Local Save Failed. Changes Are Not Confirmed Saved. Retry Save Locally.'); }
  }

  return <section className="packet-transfer packet-preview mb-5" aria-label="Packet Transfer">
    <div className="pp-heading"><div><p className="pp-eyebrow">Daily Records / Packet Transfer</p><h2>Save Here. Finalize Only When Ready.</h2></div>
      <span className="pp-connection">{w.online ? <Wifi size={16} /> : <WifiOff size={16} />}{w.online ? 'Browser Online' : 'Offline'}</span></div>
    <p className="pp-intro">Both Access Paths Reach the Same Agency Service After IT Setup. Ordinary Internet Access Alone Does Not Grant Access. Reconnection May Sync Editable Drafts; It Never Finalizes or Submits Them.</p>
    <section className="pp-access" aria-labelledby="packet-access-title">
      <div className="pp-access-heading"><div><p className="pp-eyebrow">Connection Options</p><h3 id="packet-access-title">Choose a Path to Review</h3></div><span>Both Require Agency Approval</span></div>
      <div className="pp-access-tabs" role="group" aria-label="Connection Guidance">
        <button type="button" data-testid="button-access-station" aria-pressed={accessPath === 'station'} className={accessPath === 'station' ? 'selected' : ''} onClick={() => setAccessPath('station')}><Wifi size={17} />At a Substation</button>
        <button type="button" data-testid="button-access-remote" aria-pressed={accessPath === 'remote'} className={accessPath === 'remote' ? 'selected' : ''} onClick={() => setAccessPath('remote')}><Home size={17} />At Home</button>
      </div>
      <div className="pp-access-detail" aria-live="polite">{accessPath === 'station'
        ? <><Wifi size={21} /><div><strong>Agency-Managed Wi-Fi</strong><p>An IT-Managed Access Point Can Let Multiple FTOs Use the Existing Network Connection Without Taking Turns at One Jack.</p></div></>
        : <><ShieldCheck size={21} /><div><strong>Agency-Approved Remote Access</strong><p>Use a Department-Approved Device and VPN or Zero-Trust Route, if Agency Policy Allows It. Home Wi-Fi Alone Is Not Authorization.</p></div></>}</div>
      <p className="pp-access-boundary">This Selector Shows Guidance Only. It Does Not Detect, Establish, or Authorize a Network Connection.</p>
    </section>
    <section className="pp-local">
      <div><h3><Save size={18} />On This Device</h3><p>Save Locally Writes to the Encrypted Device Vault. When Online, a Separate Draft Sync May Follow; Saving Never Submits or Finalizes a Packet.</p></div>
      <button type="button" data-testid="button-save-packets-locally" className="pp-button pp-primary" disabled={busy || w.previewOnly} onClick={() => void save()}><Save size={16} />Save Locally</button>
    </section>
    <section className="pp-card" aria-labelledby="packet-upload-title">
      <div className="pp-section-heading"><div><h3 id="packet-upload-title"><CloudUpload size={20} />Sync Editable Drafts</h3><p>Server Drafts Stay Outside Coordinator and PO Review Until Finalized.</p></div><span className="pp-count">{pending.length} Pending Sync</span></div>
      <p className="pp-note">Only the Assigned, Server-Verified FTO May Synchronize or Finalize a Packet. Draft Sync Stays Editable and Is Not a Submission, Signature, Approval, or PO Release.</p>
      <button type="button" data-testid="button-check-agency-access" className="pp-button pp-secondary" disabled={disabledReads} onClick={() => void checkAccess()}>
        {service === 'checking' ? <Loader2 size={15} className="pp-spin" /> : <ShieldCheck size={15} />}{service === 'checking' ? 'Checking…' : 'Check Agency Access'}</button>
      <ul className="pp-packets" data-testid="list-packet-status" aria-label="Packet Draft and Submission Status">{w.ws.reports.map(report => {
        const sealed = report.syncStatus === 'submitted_complete' || report.syncStatus === 'synchronized_complete';
        const draftQueued = !sealed && (report.draftSyncPending !== false || report.syncAttemptPending === true);
        const uploading = draftQueued && w.packetSyncState === 'uploading';
        const finalizing = !!finalizationConfirmation && finalizationConfirmation.id === report.id && w.packetSyncState === 'uploading';
        const syncFailed = report.syncAttemptPending === true;
        const finalizationFailed = report.finalizationAttemptPending === true;
        const syncedDraft = report.syncStatus === 'local_draft_pending' && report.draftSyncPending === false
          && (report.serverVersion ?? 0) > 0 && !!report.serverContentHash;
        const showFinalization = syncedDraft || finalizationFailed;
        const finalizeBlock = finalizationBlock(report);
        const statusClass = sealed ? 'synchronized' : finalizationFailed || syncFailed ? 'failed'
          : uploading || finalizing ? 'uploading' : syncedDraft ? 'synchronized' : 'pending';
        const statusText = sealed ? 'Submitted · Sealed' : finalizing ? 'Finalizing…'
          : finalizationFailed ? 'Finalization Unconfirmed · Retry Exact Snapshot'
            : syncFailed ? 'Draft Sync Unconfirmed · Retry Exact Snapshot'
              : uploading ? 'Synchronizing Draft' : syncedDraft ? 'Editable Agency Draft · Not Submitted'
                : 'Saved Locally · Awaiting Draft Sync';
        return <li key={report.id}><FileText size={18} /><div className="pp-packet-name"><strong>{formatDateDMY(report.date)} · {report.recruitName}</strong>
          <span data-testid={`text-packet-version-${report.id}`}>{report.id}{report.serverVersion ? ` · Server Version ${report.serverVersion}` : ' · Local Snapshot'}</span>
          {showFinalization && <button type="button" data-testid={`button-finalize-packet-${report.id}`}
            className="pp-button pp-primary pp-finalize-button" disabled={!!finalizeBlock}
            title={finalizeBlock ?? undefined}
            onClick={() => { setFinalizationAcknowledged(false); setFinalizationConfirmation({
              id: report.id, contentHash: report.serverContentHash!,
            }); }}>
            <LockKeyhole size={15} />{finalizationFailed ? 'Retry Finalization' : 'Finalize and Submit to Coordinator'}
          </button>}
          </div>
          <span data-testid={`status-packet-${report.id}`} className={`pp-status pp-${statusClass}`}>
            {sealed ? <LockKeyhole size={14} /> : finalizationFailed || syncFailed ? <AlertTriangle size={15} />
              : uploading || finalizing ? <Loader2 size={15} className="pp-spin" />
                : syncedDraft ? <ShieldCheck size={14} /> : <span className="pp-dot" />}
            {statusText}</span></li>;
      })}</ul>
      {!w.ws.reports.length && <p className="pp-note">No Local Packets Yet.</p>}
      {failed && <p role="alert" data-testid="status-packet-sync-warning" className="pp-warning"><AlertTriangle size={16} />{w.packetSyncError ?? 'A Previous Server Operation Was Not Confirmed.'} The Server May Have Committed It. Retry the Exact Protected Snapshot; Do Not Edit, Delete, or Create a Duplicate.</p>}
      <div className="pp-action-row"><p id="packet-upload-hint">{block ?? `Review and Confirm All ${pending.length} Pending Drafts Before Sync.`}</p>
        <button type="button" data-testid="button-review-draft-sync" className="pp-button pp-primary" disabled={!!block} aria-describedby="packet-upload-hint" onClick={() => { setAcknowledged(false); setConfirmation(snapshot); }}>
          <CloudUpload size={16} />{w.packetSyncState === 'uploading' ? 'Synchronizing…' : failed ? 'Review and Retry Draft Sync' : 'Review and Sync Drafts'}</button></div>
      {w.packetSyncState === 'synchronized' && !notice?.startsWith('Packet finalized') && <p role="status" data-testid="status-draft-sync-success" className="pp-feedback">Draft Sync Confirmed. Server Copies Remain Editable and Hidden from Coordinator and PO Review Until Finalization. No Signature or PO Release Was Created.</p>}
      {notice && <p role="status" data-testid="status-packet-transfer-notice" className="pp-feedback">{notice}</p>}
    </section>
    <section className="pp-card" aria-labelledby="packet-shared-title">
      <div className="pp-section-heading"><div><h3 id="packet-shared-title"><RefreshCw size={19} />Shared Records</h3><p>Read-Only Agency Copies, Separate from Device Drafts.</p></div>
        <button type="button" data-testid="button-refresh-shared-packets" className="pp-button pp-secondary" disabled={disabledReads} onClick={() => void refresh()}><RefreshCw size={15} className={refreshing ? 'pp-spin' : ''} />{refreshing ? 'Refreshing…' : 'Refresh Shared Records'}</button></div>
      <p className="pp-note">Refresh Never Uploads, Replaces, or Merges Local Drafts. The Server Checks Your Authorized Roster on Every Page and Returns at Most 100 Records at a Time.</p>
      <div className="pp-history-filters" aria-label="Filter shared packet history">
        <label className="pp-history-recruit"><span>Recruit name or badge</span>
          <input data-testid="input-packet-history-recruit" value={recruitFilter}
            onChange={event => setRecruitFilter(event.target.value)} maxLength={120}
            placeholder="Search authorized recruits" disabled={disabledReads} />
        </label>
        <label><span>From date</span><input data-testid="input-packet-history-from" type="date"
          value={dateFromFilter} onChange={event => setDateFromFilter(event.target.value)} disabled={disabledReads} /></label>
        <label><span>To date</span><input data-testid="input-packet-history-to" type="date"
          value={dateToFilter} onChange={event => setDateToFilter(event.target.value)} disabled={disabledReads} /></label>
        <div className="pp-history-filter-actions">
          <button type="button" data-testid="button-packet-history-apply" className="pp-button pp-primary"
            disabled={disabledReads} onClick={applyHistoryFilters}>Apply Filters</button>
          <button type="button" data-testid="button-packet-history-clear" className="pp-button pp-secondary"
            disabled={disabledReads} onClick={() => {
              setRecruitFilter(''); setDateFromFilter(''); setDateToFilter('');
              void refresh({});
            }}>Clear</button>
        </div>
      </div>
      <p className="pp-history-filter-hint">Dates include both endpoints. Applying filters starts a new search from the newest matching packet.</p>
      {shared !== null && <p className="pp-history-scope" data-testid="text-packet-history-scope">
        Showing {shared.length} authorized record{shared.length === 1 ? '' : 's'}
        {appliedFilters.recruit ? ` matching “${appliedFilters.recruit}”` : ''}
        {appliedFilters.dateFrom || appliedFilters.dateTo
          ? ` · ${appliedFilters.dateFrom ?? 'Any date'} to ${appliedFilters.dateTo ?? 'Any date'}` : ''}
      </p>}
      {w.previewOnly && <p className="pp-warning">UI Preview Only. Agency Reads and Uploads Are Disabled.</p>}
      {w.vault !== 'unlocked' && <p className="pp-warning">Unlock Saved Work to Read Shared Records.</p>}
      {!w.online && <p className="pp-warning">Offline. Previously Loaded Copies May Be Stale.</p>}
      {readError && <div role="alert" className="pp-warning"><AlertTriangle size={16} /><div className="pp-read-error">
        <p>{readError}</p>
        {canContinueHistory && <button type="button" className="pp-button pp-secondary" disabled={disabledReads}
          onClick={() => void loadOlderHistory()}>
          {continuingHistory ? 'Loading next page…' : 'Continue loading records'}
        </button>}
      </div></div>}
      <div className="pp-shared-content" aria-busy={refreshing} aria-live="polite">
        {shared === null ? refreshing ? <p>Loading Authorized Records…</p> : <p>Not Loaded. Choose Refresh Shared Records to Request Authorized Copies.</p>
          : !shared.length && refreshing ? <p>Loading Authorized Records…</p>
          : !shared.length ? <p>No Shared Packets Were Returned for This Account’s Authorized Scope. Local Drafts Are Unchanged.</p>
          : <><ul>{shared.map(packet => <li key={packet.id} data-testid={`row-shared-packet-${packet.id}`}><CheckCircle2 size={16} /><strong>{formatDateDMY(packet.record_date)} · {packet.report.recruitName}</strong>
             <span>{packet.sync_status === 'submitted_complete'
               ? `Submitted · Sealed · Version ${packet.server_version}`
               : `Server Draft · Not Submitted · Version ${packet.server_version}`}</span>
              <details className="w-full"><summary data-testid={`button-view-shared-packet-${packet.id}`}>View Saved Packet Data</summary><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words p-2 text-xs">{JSON.stringify(packet.report, null, 2)}</pre></details></li>)}</ul>
            {refreshing && <p role="status" className="pp-history-loading">Loading the next page. Previously loaded records remain visible.</p>}</>}
      </div>
      {historyHasMore && !readError && <div className="pp-history-more">
        <button type="button" data-testid="button-packet-history-load-older" className="pp-button pp-secondary"
          disabled={disabledReads} onClick={() => void loadOlderHistory()}>
          {refreshing ? 'Loading…' : 'Load Older Records'}
        </button>
      </div>}
      {refreshedAt && <p className="pp-freshness">Last Successful Refresh: {refreshedAt}. {readError || !w.online ? 'Results May Be Stale.' : 'Not a Live Connection.'}</p>}
    </section>
    <AlertDialog open={confirmation !== null} onOpenChange={open => { if (!open) { setConfirmation(null); setAcknowledged(false); } }}>
      <AlertDialogContent className="packet-confirm">
        <AlertDialogHeader><AlertDialogTitle>Synchronize {pending.length} Editable Drafts?</AlertDialogTitle>
          <AlertDialogDescription>Draft Sync Creates or Updates Editable Agency Snapshots. It Does Not Submit or Seal Them, and Does Not Expose Them to Coordinators or POs.</AlertDialogDescription></AlertDialogHeader>
        <ul className="max-h-40 overflow-auto text-sm">{pending.map(report => <li key={report.id}>{formatDateDMY(report.date)} · {report.recruitName} · {report.id}</li>)}</ul>
        <p className="text-sm">Finalization Is a Separate FTO Action. Sync Does Not Create an Electronic Signature, Approval, or PO Release. An Unconfirmed Attempt Must Be Retried with Its Exact Saved Snapshot.</p>
        <label className="flex items-start gap-3 text-sm font-bold"><input type="checkbox" data-testid="checkbox-confirm-draft-sync" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} />I Reviewed These Drafts and Understand They Remain Editable and Unsubmitted.</label>
        {confirmation !== snapshot && <p role="alert">Saved Packets Changed. Close This Dialog and Review Them Again.</p>}
        {block && <p role="alert" className="text-sm">{block}</p>}
        <AlertDialogFooter><AlertDialogCancel data-testid="button-cancel-draft-sync">Keep Drafts on This Device</AlertDialogCancel><button type="button" data-testid="button-confirm-draft-sync" className="pp-button pp-primary" disabled={!acknowledged || !!block || confirmation !== snapshot} onClick={() => void syncDrafts()}>Synchronize Drafts Only</button></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={finalizationConfirmation !== null} onOpenChange={open => {
      if (!open && w.packetSyncState !== 'uploading') {
        setFinalizationConfirmation(null);
        setFinalizationAcknowledged(false);
      }
    }}>
      <AlertDialogContent className="packet-confirm">
        <AlertDialogHeader><AlertDialogTitle>Finalize and Submit to Coordinator?</AlertDialogTitle>
          <AlertDialogDescription>This Explicit Action Seals the Exact Server-Synchronized Snapshot. The Assigned Coordinator Can Review It; PO Release and Acknowledgment Remain Separate.</AlertDialogDescription></AlertDialogHeader>
        {finalizationReport && <p className="text-sm">{formatDateDMY(finalizationReport.date)} · {finalizationReport.recruitName} · Version {finalizationReport.serverVersion}</p>}
        <p className="text-sm">This Is Not an Electronic Signature, PO Release, or Acknowledgment. Corrections Continue Through the Authorized Amendment Process.</p>
        {!finalizationSnapshotCurrent && <p role="alert" className="text-sm">The Saved Snapshot Changed or Is No Longer Ready. Close This Dialog, Sync the Current Draft, and Review It Again.</p>}
        {finalizationReport && finalizationBlock(finalizationReport) && <p role="alert" className="text-sm">{finalizationBlock(finalizationReport)}</p>}
        <label className="flex items-start gap-3 text-sm font-bold"><input type="checkbox" data-testid="checkbox-confirm-finalization" checked={finalizationAcknowledged} onChange={event => setFinalizationAcknowledged(event.target.checked)} />I Reviewed This Exact Snapshot and Authorize Final Submission to the Assigned Coordinator.</label>
        <AlertDialogFooter><AlertDialogCancel data-testid="button-cancel-finalization">Keep as Editable Draft</AlertDialogCancel>
          <button type="button" data-testid="button-confirm-finalization" className="pp-button pp-primary"
            disabled={!finalizationAcknowledged || !finalizationSnapshotCurrent || !finalizationReport ||
              !!finalizationBlock(finalizationReport) || w.packetSyncState === 'uploading'}
            onClick={() => void finalize()}>Finalize and Submit to Coordinator</button></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}

function packetHistoryErrorMessage(error: unknown, history: SharedPacketHistory, hasPreviousRecords = false) {
  if (error instanceof PacketHistoryCursorError)
    return 'The agency returned an unsafe or repeated history page. Previously loaded records are preserved. Refresh Shared Records to start over safely.';
  return history.data.length
    ? 'Could not load the next history page. Previously loaded records are still shown. Local drafts are unchanged.'
    : hasPreviousRecords
      ? 'Could not refresh shared records. Previously shown records are still displayed. Local drafts are unchanged.'
      : 'Could not load shared records. Local drafts are unchanged. Refresh Shared Records to try again.';
}
