import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, CloudUpload, FileText, Home, Loader2, LockKeyhole, RefreshCw, Save, ShieldCheck, Wifi, WifiOff } from 'lucide-react';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog.js';
import { useWorkspace } from '@/state/workspace.js';
import {
  checkPacketService, continueSharedPacketHistory, createSharedPacketHistory, PacketHistoryCursorError,
  type PacketHistoryFilters, type SharedPacket, type SharedPacketHistory,
} from '@/lib/training-packet-sync.js';
import { packetUploadBlock, queuedReports } from '@/lib/packet-upload-controls.js';
import { formatDateDMY } from '@/lib/training-calendar.js';
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
  const block = packetUploadBlock({ previewOnly: w.previewOnly, unlocked: w.vault === 'unlocked', online: w.online,
    busy, unsaved: w.dirty || w.editorDirty || !!w.saveError, serviceReady: service === 'available',
    ftoView: w.ws.role === 'fto', count: pending.length, savedCount: w.pending });
  const snapshot = JSON.stringify(pending);
  const failed = w.ws.reports.some(report => report.syncAttemptPending) || w.packetSyncState === 'failed';
  const canContinueHistory = shared !== null && historyReadFailed && historyHasMore &&
    historyCursor !== null && !history.current.blocked;

  async function checkAccess() {
    if (disabledReads || action.current) return;
    action.current = true;
    const controller = new AbortController(); request.current = controller;
    setService('checking'); setNotice(null);
    try {
      const available = await checkPacketService(controller.signal);
      if (!controller.signal.aborted && mounted.current) {
        setService(available ? 'available' : 'unavailable');
        setNotice(available ? 'Agency Service Available. FTO Identity and Assignment Are Verified by the Server on Upload.'
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
  async function upload() {
    if (block || !acknowledged || confirmation !== snapshot || action.current) return;
    action.current = true; setConfirmation(null);
    try { await w.syncPackets(); }
    catch { /* Provider owns the outcome across the packet acknowledgement remount. */ }
    finally { action.current = false; }
  }
  async function save() {
    if (busy || action.current || w.previewOnly) return;
    setNotice(null);
    try {
      await w.saveNow();
      if (mounted.current && w.vault === 'unlocked') setNotice('Saved Locally. Nothing Uploaded.');
    } catch { if (mounted.current) setNotice('Local Save Failed. Changes Are Not Confirmed Saved. Retry Save Locally.'); }
  }

  return <section className="packet-transfer packet-preview mb-5" aria-label="Packet Transfer">
    <div className="pp-heading"><div><p className="pp-eyebrow">Daily Records / Packet Transfer</p><h2>Save Here. Upload Only When Ready.</h2></div>
      <span className="pp-connection">{w.online ? <Wifi size={16} /> : <WifiOff size={16} />}{w.online ? 'Browser Online' : 'Offline'}</span></div>
    <p className="pp-intro">Both Access Paths Reach the Same Agency Service After IT Setup. Ordinary Internet Access Alone Does Not Grant Access. Reconnecting Never Starts an Upload.</p>
    <section className="pp-access" aria-labelledby="packet-access-title">
      <div className="pp-access-heading"><div><p className="pp-eyebrow">Connection Options</p><h3 id="packet-access-title">Choose a Path to Review</h3></div><span>Both Require Agency Approval</span></div>
      <div className="pp-access-tabs" role="group" aria-label="Connection Guidance">
        <button type="button" aria-pressed={accessPath === 'station'} className={accessPath === 'station' ? 'selected' : ''} onClick={() => setAccessPath('station')}><Wifi size={17} />At a Substation</button>
        <button type="button" aria-pressed={accessPath === 'remote'} className={accessPath === 'remote' ? 'selected' : ''} onClick={() => setAccessPath('remote')}><Home size={17} />At Home</button>
      </div>
      <div className="pp-access-detail" aria-live="polite">{accessPath === 'station'
        ? <><Wifi size={21} /><div><strong>Agency-Managed Wi-Fi</strong><p>An IT-Managed Access Point Can Let Multiple FTOs Use the Existing Network Connection Without Taking Turns at One Jack.</p></div></>
        : <><ShieldCheck size={21} /><div><strong>Agency-Approved Remote Access</strong><p>Use a Department-Approved Device and VPN or Zero-Trust Route, if Agency Policy Allows It. Home Wi-Fi Alone Is Not Authorization.</p></div></>}</div>
      <p className="pp-access-boundary">This Selector Shows Guidance Only. It Does Not Detect, Establish, or Authorize a Network Connection.</p>
    </section>
    <section className="pp-local">
      <div><h3><Save size={18} />On This Device</h3><p>Save Locally Keeps Work in the Encrypted Device Vault. It Never Uploads or Refreshes Shared Records.</p></div>
      <button type="button" className="pp-button pp-primary" disabled={busy || w.previewOnly} onClick={() => void save()}><Save size={16} />Save Locally</button>
    </section>
    <section className="pp-card" aria-labelledby="packet-upload-title">
      <div className="pp-section-heading"><div><h3 id="packet-upload-title"><CloudUpload size={20} />Upload Saved Packets</h3><p>All Pending Daily Packets in This Workspace</p></div><span className="pp-count">{pending.length} Pending</span></div>
      <p className="pp-note">Only the Assigned, Server-Verified FTO May Upload. Confirmed Packets Become Sealed; Uploading Is Not a Signature, Approval, or Release to the PO. Packet Transfer Status Is Separate from Form Review or Signature Status.</p>
      <button type="button" className="pp-button pp-secondary" disabled={disabledReads} onClick={() => void checkAccess()}>
        {service === 'checking' ? <Loader2 size={15} className="pp-spin" /> : <ShieldCheck size={15} />}{service === 'checking' ? 'Checking…' : 'Check Agency Access'}</button>
      <ul className="pp-packets" aria-label="Packet Upload Status">{w.ws.reports.map(report => {
        const sealed = report.syncStatus === 'synchronized_complete';
        const uploading = !sealed && w.packetSyncState === 'uploading';
        return <li key={report.id}><FileText size={18} /><div className="pp-packet-name"><strong>{formatDateDMY(report.date)} · {report.recruitName}</strong><span>{report.id}{sealed ? ` · Server Version ${report.serverVersion}` : ' · Saved Daily Packet'}</span></div>
          <span className={`pp-status pp-${sealed ? 'synchronized' : uploading ? 'uploading' : report.syncAttemptPending ? 'failed' : 'pending'}`}>
            {sealed ? <LockKeyhole size={14} /> : uploading ? <Loader2 size={15} className="pp-spin" /> : report.syncAttemptPending ? <AlertTriangle size={15} /> : <span className="pp-dot" />}
            {sealed ? 'Synchronized · Sealed' : uploading ? 'Uploading' : report.syncAttemptPending ? 'Failed · Unconfirmed' : 'Pending Upload'}</span></li>;
      })}</ul>
      {!w.ws.reports.length && <p className="pp-note">No Local Packets Yet.</p>}
      {failed && <p role="alert" className="pp-warning"><AlertTriangle size={16} />{w.packetSyncError ?? 'A Previous Upload Was Not Confirmed.'} The Server May Have Committed It. Retry the Exact Protected Snapshot; Do Not Edit, Delete, or Create a Duplicate.</p>}
      <div className="pp-action-row"><p id="packet-upload-hint">{block ?? `Review and Confirm All ${pending.length} Pending Packets Before Upload.`}</p>
        <button type="button" className="pp-button pp-primary" disabled={!!block} aria-describedby="packet-upload-hint" onClick={() => { setAcknowledged(false); setConfirmation(snapshot); }}>
          <CloudUpload size={16} />{w.packetSyncState === 'uploading' ? 'Uploading…' : failed ? 'Review and Retry Upload' : 'Review and Upload'}</button></div>
      {w.packetSyncState === 'synchronized' && <p role="status" className="pp-feedback">Upload Confirmed. Synchronized Packets Are Sealed. Changes Require an Authorized Correction. No Signature or PO Release Was Created.</p>}
      {notice && <p role="status" className="pp-feedback">{notice}</p>}
    </section>
    <section className="pp-card" aria-labelledby="packet-shared-title">
      <div className="pp-section-heading"><div><h3 id="packet-shared-title"><RefreshCw size={19} />Shared Records</h3><p>Read-Only Agency Copies, Separate from Device Drafts.</p></div>
        <button type="button" className="pp-button pp-secondary" disabled={disabledReads} onClick={() => void refresh()}><RefreshCw size={15} className={refreshing ? 'pp-spin' : ''} />{refreshing ? 'Refreshing…' : 'Refresh Shared Records'}</button></div>
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
          : <><ul>{shared.map(packet => <li key={packet.id} data-testid={`row-shared-packet-${packet.id}`}><CheckCircle2 size={16} /><strong>{formatDateDMY(packet.record_date)} · {packet.report.recruitName}</strong><span>Read-Only · Version {packet.server_version} · Sealed</span>
            <details className="w-full"><summary>View Saved Packet Data</summary><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words p-2 text-xs">{JSON.stringify(packet.report, null, 2)}</pre></details></li>)}</ul>
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
    <AlertDialog open={confirmation !== null} onOpenChange={open => { if (!open) setConfirmation(null); }}>
      <AlertDialogContent className="packet-confirm">
        <AlertDialogHeader><AlertDialogTitle>Upload and Seal {pending.length} Saved Packets?</AlertDialogTitle>
          <AlertDialogDescription>A Confirmed Server Commit Seals Each Packet and Prevents Ordinary Editing or Deletion. Changes Require an Authorized Correction. This Sends Complete Saved Packets, Not the Entire Workspace or Unsent Chat Drafts.</AlertDialogDescription></AlertDialogHeader>
        <ul className="max-h-40 overflow-auto text-sm">{pending.map(report => <li key={report.id}>{formatDateDMY(report.date)} · {report.recruitName} · {report.id}</li>)}</ul>
        <p className="text-sm">No Electronic Signature, Approval, or PO Release Is Created. An Unconfirmed Attempt Must Be Retried with Its Exact Saved Snapshot.</p>
        <label className="flex items-start gap-3 text-sm font-bold"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} />I Reviewed These Packets and Understand That Confirmed Uploads Become Sealed.</label>
        {confirmation !== snapshot && <p role="alert">Saved Packets Changed. Close This Dialog and Review Them Again.</p>}
        {block && <p role="alert" className="text-sm">{block}</p>}
        <AlertDialogFooter><AlertDialogCancel>Keep on This Device</AlertDialogCancel><button type="button" className="pp-button pp-primary" disabled={!acknowledged || !!block || confirmation !== snapshot} onClick={() => void upload()}>Upload and Seal Packets</button></AlertDialogFooter>
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
