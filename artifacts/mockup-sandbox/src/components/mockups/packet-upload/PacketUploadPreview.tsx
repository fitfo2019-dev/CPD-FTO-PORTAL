import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, CloudUpload, FileText, Home, Loader2, LockKeyhole, RefreshCw, Save, ShieldCheck, Wifi, WifiOff } from "lucide-react";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog.js";
import { beginUpload, examplePackets, finishUpload, pendingPackets, uploadBlockReason, type PacketState } from "./_simulation.js";
import "./_group.css";

const stateLabel: Record<PacketState, string> = {
  pending: "Pending Upload", uploading: "Uploading", failed: "Failed · Unconfirmed", synchronized: "Synchronized · Sealed",
};

/** Approval-only sandbox. Deliberately does not import the live WorkspaceProvider. */
export function PacketUploadPreview() {
  const [packets, setPackets] = useState(examplePackets);
  const [accessPath, setAccessPath] = useState<"station" | "remote">("station");
  const [online, setOnline] = useState(true);
  const [unlocked, setUnlocked] = useState(true);
  const [unsaved, setUnsaved] = useState(false);
  const [ready, setReady] = useState(true);
  const [failUpload, setFailUpload] = useState(false);
  const [failRefresh, setFailRefresh] = useState(false);
  const [emptyRefresh, setEmptyRefresh] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [shared, setShared] = useState<ReturnType<typeof examplePackets> | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [message, setMessage] = useState("Preview Ready. No Packet Has Been Sent.");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const pending = pendingPackets(packets);
  const busy = uploading || refreshing;
  const blockReason = uploadBlockReason({ online, unlocked, unsaved, ready, busy, count: pending.length });
  const failed = packets.some(packet => packet.state === "failed");

  function upload() {
    // Only this confirmed click begins the simulation. Connectivity never starts it.
    if (blockReason || !acknowledged) return;
    setConfirm(false);
    setUploading(true);
    setPackets(beginUpload);
    setMessage("Preview: Uploading Saved Packet Snapshots. Wait for Confirmation Before Treating Them as Synchronized.");
    timer.current = setTimeout(() => {
      setPackets(current => finishUpload(current, failUpload));
      setUploading(false);
      setFailUpload(false);
      setMessage(failUpload
        ? "Preview: Upload Not Confirmed. The Server May Have Committed It. Keep the Exact Saved Snapshot Protected and Retry; Do Not Edit, Delete, or Create a Duplicate."
        : "Preview: Upload Confirmed. Packets Are Synchronized and Sealed. An Authorized Correction Is Required for Changes. No Signature or PO Release Was Created.");
    }, 1800);
  }
  function refresh() {
    if (busy || !online || !unlocked || !ready) return;
    setRefreshing(true);
    setRefreshError(null);
    timer.current = setTimeout(() => {
      if (failRefresh) {
        setRefreshError("Refresh Failed. Previously Loaded Records Are Not Current. Local Drafts Were Not Changed. Try Again.");
      } else {
        setShared(emptyRefresh ? [] : packets.filter(packet => packet.state === "synchronized"));
        setRefreshedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      }
      setFailRefresh(false);
      setRefreshing(false);
    }, 1200);
  }
  function reset() {
    if (busy) return;
    setPackets(examplePackets()); setShared(null); setRefreshedAt(null); setRefreshError(null);
    setOnline(true); setUnlocked(true); setUnsaved(false); setReady(true);
    setFailUpload(false); setFailRefresh(false); setEmptyRefresh(false);
    setMessage("Preview Reset. No Packet Has Been Sent.");
  }

  return <main className="packet-preview">
    <div className="pp-approval"><strong>Sandbox Preview — Awaiting Your Approval</strong><span>Fictional Data · Actions Are Simulated · Live Portal Unchanged</span></div>
    <header className="pp-header">
      <div><p className="pp-eyebrow">Division of Police</p><h1>Field Training Officer Portal</h1></div>
      <span className="pp-role">FTO Workflow Preview</span>
    </header>
    <div className="pp-unapproved"><AlertTriangle size={16} /> Not Approved for Operational or CJIS-Restricted Data. Do Not Enter Real Records.</div>
    <div className="pp-body">
      <div className="pp-heading"><div><p className="pp-eyebrow">Daily Records / Packet Transfer</p><h2>Save Here. Upload Only When Ready.</h2></div>
        <span className="pp-connection">{online ? <Wifi size={16} /> : <WifiOff size={16} />}{online ? "Browser Online" : "Offline"}</span></div>
      <p className="pp-intro">Both Access Paths Can Reach the Same Agency Service, Without Requiring Each FTO to Take Turns at One Network Jack. Agency IT Must Establish and Verify the Selected Route. Ordinary Internet Access Alone Does Not Grant Access. Reconnecting Never Starts an Upload.</p>

      <section className="pp-access" aria-labelledby="pp-access-title">
        <div className="pp-access-heading"><div><p className="pp-eyebrow">Connection Options</p><h3 id="pp-access-title">Choose a Path to Review</h3></div><span>Both Use the Same Agency Service</span></div>
        <div className="pp-access-tabs" role="group" aria-label="Preview a connection path">
          <button type="button" aria-pressed={accessPath === "station"} className={accessPath === "station" ? "selected" : ""} onClick={() => setAccessPath("station")}><Wifi size={17} />At a Substation</button>
          <button type="button" aria-pressed={accessPath === "remote"} className={accessPath === "remote" ? "selected" : ""} onClick={() => setAccessPath("remote")}><Home size={17} />At Home</button>
        </div>
        <div className="pp-access-detail" aria-live="polite">
          {accessPath === "station" ? <>
            <Wifi size={21} />
            <div><strong>Agency-Managed Wi-Fi</strong><p>An IT-Managed Access Point on the Existing Network Connection Lets Multiple FTOs Connect at Once. IT Controls Who and Which Devices Can Join; No Unmanaged Router Is Implied.</p></div>
          </> : <>
            <ShieldCheck size={21} />
            <div><strong>Agency-Approved Remote Access</strong><p>A Department VPN or Zero-Trust Route on an Approved Device Can Provide Access from Home, if Agency Policy Allows It. Home Wi-Fi Alone Is Not Authorization.</p></div>
          </>}
        </div>
        <p className="pp-access-boundary">Preview Selector Only: It Does Not Detect or Establish Either Route, Verify Access, or Enable Upload. The Server Must Authorize Identity and Assignment on Every Request.</p>
      </section>

      <section className="pp-local" aria-labelledby="pp-local-title">
        <div><h3 id="pp-local-title"><Save size={18} /> On This Device</h3><p>Save Locally Keeps Work in the Device Vault. It Does Not Upload or Refresh Shared Records.</p></div>
        <button type="button" className="pp-button pp-primary" disabled={busy || !unlocked} onClick={() => {
          setUnsaved(false);
          setMessage("Preview: Local Save Simulated. Nothing Uploaded. Pending and Sealed Packet States Are Unchanged.");
        }}><Save size={16} />Save Locally</button>
      </section>

      <section className="pp-card" aria-labelledby="pp-upload-title">
        <div className="pp-section-heading"><div><h3 id="pp-upload-title"><CloudUpload size={20} /> Upload Saved Packets</h3><p>Fictional PO · Demo Class · Phase II</p></div><span className="pp-count">{pending.length} Pending</span></div>
        <p className="pp-note">Only the Assigned, Server-Verified FTO May Upload. A Confirmed Commit Seals the Packet; Uploading Is Not a Signature, Approval, or Release to the PO.</p>
        <ul className="pp-packets" aria-label="Packet upload status">
          {packets.map(packet => <li key={packet.id}>
            <FileText size={18} aria-hidden="true" />
            <div className="pp-packet-name"><strong>{packet.date}</strong><span>{packet.id}{packet.version ? ` · Server Version ${packet.version}` : " · Saved Daily Packet"}</span></div>
            <div className={`pp-status pp-${packet.state}`}>
              {packet.state === "uploading" ? <Loader2 className="pp-spin" size={15} /> : packet.state === "synchronized" ? <LockKeyhole size={14} /> : packet.state === "failed" ? <AlertTriangle size={15} /> : <span className="pp-dot" />}
              {stateLabel[packet.state]}
            </div>
          </li>)}
        </ul>
        {failed && <p className="pp-warning"><AlertTriangle size={16} />Unconfirmed Snapshots Stay Protected Until an Exact Retry Confirms the Outcome. “Failed” Does Not Mean the Server Did Not Save Them.</p>}
        <div className="pp-action-row"><p id="pp-upload-hint">{blockReason ?? `Review and Explicitly Confirm All ${pending.length} Pending Packets Before Upload.`}</p>
          <button type="button" className="pp-button pp-primary" disabled={!!blockReason} aria-describedby="pp-upload-hint" onClick={() => { setAcknowledged(false); setConfirm(true); }}>
            {uploading ? <Loader2 size={16} className="pp-spin" /> : <CloudUpload size={16} />}
            {uploading ? "Uploading…" : failed ? "Review and Retry Upload" : "Review and Upload"}
          </button>
        </div>
        <div role="status" aria-live="polite" className="pp-feedback">{message}</div>
      </section>

      <section className="pp-card" aria-labelledby="pp-shared-title">
        <div className="pp-section-heading"><div><h3 id="pp-shared-title"><RefreshCw size={19} /> Shared Records</h3><p>Read-Only Agency Copies, Separate from Device Drafts.</p></div>
          <button type="button" className="pp-button pp-secondary" disabled={busy || !online || !unlocked || !ready} onClick={refresh}>
            <RefreshCw size={15} className={refreshing ? "pp-spin" : ""} />{refreshing ? "Refreshing…" : "Refresh Shared Records"}
          </button>
        </div>
        <p className="pp-note">Refresh Only Reads Records Your Verified Account May Access. It Never Uploads, Replaces, or Merges Local Drafts.</p>
        {(!online || !unlocked || !ready) && <p className="pp-warning">{!unlocked ? "Unlock Saved Work to View Shared Records." : !online ? "Offline. Shared Records Cannot Be Refreshed." : "Verified Agency Access Is Unavailable."}</p>}
        {refreshError && <p role="alert" className="pp-warning">{refreshError}</p>}
        <div className="pp-shared-content" aria-live="polite" aria-busy={refreshing}>
          {refreshing ? <p><Loader2 size={16} className="pp-spin" />Loading Authorized Shared Records…</p>
            : shared === null ? <p>Not Loaded. Choose Refresh Shared Records to Request the Latest Authorized Copies.</p>
            : !shared.length ? <p>No Shared Packets Were Returned for This Account’s Authorized Scope. Local Drafts Are Unchanged.</p>
            : <ul>{shared.map(packet => <li key={packet.id}><CheckCircle2 size={16} /><strong>{packet.date}</strong><span>Read-Only · Version {packet.version} · Sealed</span></li>)}</ul>}
        </div>
        {refreshedAt && <p className="pp-freshness">{refreshError ? "Previous Successful Preview Refresh" : "Last Successful Preview Refresh"}: {refreshedAt}. {refreshError ? "Results May Be Stale." : "Not a Live Connection."}</p>}
      </section>

      <details className="pp-demo-controls">
        <summary>Try Preview Outcomes</summary>
        <p>These Switches Simulate Conditions Only. They Do Not Verify Identity, Unlock a Real Vault, or Connect to Agency Storage.</p>
        <fieldset disabled={busy}><legend className="pp-sr-only">Simulation settings</legend>
          {([
            ["Browser Online", online, setOnline], ["Vault Unlocked", unlocked, setUnlocked],
            ["Open Edits Need Saving", unsaved, setUnsaved], ["Agency Service and FTO Assignment Available", ready, setReady],
            ["Fail Next Upload Response", failUpload, setFailUpload], ["Fail Next Refresh", failRefresh, setFailRefresh],
            ["Return No Shared Records", emptyRefresh, setEmptyRefresh],
          ] as const).map(([label, value, setter]) => <label key={label}><input type="checkbox" checked={value} onChange={event => setter(event.target.checked)} />{label}</label>)}
          <button type="button" className="pp-button pp-secondary" onClick={reset}>Reset Fictional Preview</button>
        </fieldset>
      </details>
      <p className="pp-footer">Approval Preview Only. No Agency API Requests, Local Vault Writes, or Real Packet Transfers Occur Here.</p>
    </div>
    <AlertDialog open={confirm} onOpenChange={setConfirm}>
      <AlertDialogContent className="pp-confirm">
        <AlertDialogHeader>
          <AlertDialogTitle>Upload and Seal {pending.length} Saved Packets?</AlertDialogTitle>
          <AlertDialogDescription>Only Continue After Reviewing These Daily Packets. In the Connected Portal, a Confirmed Server Commit Seals Each Packet and Prevents Ordinary Editing or Deletion. Changes Require an Authorized Correction.</AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="pp-confirm-list">{pending.map(packet => <li key={packet.id}>{packet.date} · {packet.id}{packet.state === "failed" ? " · exact retry" : ""}</li>)}</ul>
        <p>This Sends Complete Saved Packet Snapshots, Not the Entire Workspace or Unsent Chat Drafts. It Creates No Electronic Signature and Does Not Release Records to the PO.</p>
        {failed && <p>An Earlier Attempt Was Not Confirmed. Retry Preserves Its Exact Snapshot and Request Identity to Avoid Duplicate Commits.</p>}
        <label className="pp-ack"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} />I Reviewed These Packets and Understand That Confirmed Uploads Become Sealed.</label>
        <p className="pp-modal-preview">This Sandbox Simulates the Outcome. Nothing Will Be Sent.</p>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep on This Device</AlertDialogCancel>
          <button type="button" className="pp-button pp-primary" disabled={!acknowledged || !!blockReason} onClick={upload}>Simulate Upload and Seal</button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </main>;
}
