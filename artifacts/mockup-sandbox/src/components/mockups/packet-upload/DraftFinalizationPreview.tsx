import { useState } from "react";
import {
  CheckCircle2,
  CloudUpload,
  FileText,
  LockKeyhole,
  ShieldCheck,
  Wifi,
  WifiOff,
} from "lucide-react";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog.js";
import "./_group.css";

type PacketState = "local" | "server-draft" | "submitted";
type Packet = { id: string; date: string; recruit: string; state: PacketState };

const initialPackets: Packet[] = [
  { id: "DEMO-1123", date: "November 23, 2026", recruit: "Jordan Ellis", state: "server-draft" },
  { id: "DEMO-1122", date: "November 22, 2026", recruit: "Jordan Ellis", state: "local" },
  { id: "DEMO-1121", date: "November 21, 2026", recruit: "Jordan Ellis", state: "submitted" },
];

const stateDetails: Record<PacketState, { label: string; className: string }> = {
  local: { label: "Saved on this device", className: "pp-pending" },
  "server-draft": { label: "Agency draft · not in Coordinator queue", className: "pp-uploading" },
  submitted: { label: "Submitted · sealed", className: "pp-synchronized" },
};

/** Isolated fictional preview; it has no API, auth, or device-storage imports. */
export function DraftFinalizationPreview() {
  const [packets, setPackets] = useState(initialPackets);
  const [online, setOnline] = useState(true);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState("Preview only. No packet has been sent.");
  const target = packets.find(packet => packet.id === confirmId);

  function syncDraft(id: string) {
    if (!online) return;
    setPackets(current => current.map(packet =>
      packet.id === id && packet.state === "local" ? { ...packet, state: "server-draft" } : packet,
    ));
    setMessage("Preview: Editable agency draft synchronized. Coordinators cannot see it.");
  }

  function finalize() {
    if (!target || !confirmed || target.state !== "server-draft") return;
    setPackets(current => current.map(packet =>
      packet.id === target.id ? { ...packet, state: "submitted" } : packet,
    ));
    setConfirmId(null);
    setConfirmed(false);
    setMessage("Preview: Submitted and sealed for the assigned Coordinator. No signature or PO release was created.");
  }

  function reset() {
    setPackets(initialPackets);
    setConfirmId(null);
    setConfirmed(false);
    setMessage("Preview reset. No packet has been sent.");
  }

  return <main className="packet-preview">
    <div className="pp-approval">
      <strong>Sandbox Preview — Awaiting Your Approval</strong>
      <span>Fictional Data · Actions Are Simulated · Live Portal Unchanged</span>
    </div>
    <header className="pp-header">
      <div><p className="pp-eyebrow">Division of Police</p><h1>Field Training Officer Portal</h1></div>
      <span className="pp-role">FTO Workflow Preview</span>
    </header>
    <div className="pp-unapproved"><ShieldCheck size={16} /> Not Approved for Operational or CJIS-Restricted Data. Do Not Enter Real Records.</div>
    <div className="pp-body">
      <div className="pp-heading">
        <div><p className="pp-eyebrow">Daily Records / Packet Transfer</p><h2>Save Drafts. Submit When Ready.</h2></div>
        <button type="button" className="pp-button pp-secondary" onClick={() => setOnline(value => !value)}>
          {online ? <Wifi size={16} /> : <WifiOff size={16} />}{online ? "Online · click to preview offline" : "Offline · click to reconnect"}
        </button>
      </div>
      <p className="pp-intro">
        Local saving works offline and never submits. Draft synchronization keeps an editable agency copy outside the Coordinator queue. Only the explicit final action submits and seals a packet.
      </p>

      <section className="pp-local">
        <div>
          <h3><FileText size={18} /> Two Separate Steps</h3>
          <p>Draft sync is not submission. Reconnecting may synchronize saved drafts; it never finalizes a packet or records a signature.</p>
        </div>
        <span className="pp-count">FTO · Demo Class · Phase II</span>
      </section>

      <section className="pp-card" aria-labelledby="draft-packets-title">
        <div className="pp-section-heading">
          <div><h3 id="draft-packets-title"><CloudUpload size={20} /> Saved Daily Packets</h3><p>Fictional recruit · Review each packet before finalizing</p></div>
          <span className="pp-count">{packets.filter(packet => packet.state !== "submitted").length} Not Submitted</span>
        </div>
        <p className="pp-note">Agency drafts remain editable and hidden from Coordinators. Finalization verifies the signed FTO identity and active server roster assignment for this recruit, class, phase, and date.</p>
        <ul className="pp-packets" aria-label="Fictional packet statuses">
          {packets.map(packet => {
            const detail = stateDetails[packet.state];
            return <li key={packet.id}>
              <FileText size={18} aria-hidden="true" />
              <div className="pp-packet-name">
                <strong>{packet.date} · {packet.recruit}</strong>
                <span>{packet.id}{packet.state === "server-draft" ? " · Editable agency draft" : ""}</span>
              </div>
              <span className={`pp-status ${detail.className}`}>
                {packet.state === "submitted" ? <LockKeyhole size={14} /> : packet.state === "server-draft" ? <ShieldCheck size={14} /> : null}
                {detail.label}
              </span>
              {packet.state === "local" && <button type="button" className="pp-button pp-secondary"
                disabled={!online} onClick={() => syncDraft(packet.id)}>Sync draft</button>}
              {packet.state === "server-draft" && <button type="button" className="pp-button pp-primary"
                onClick={() => { setConfirmed(false); setConfirmId(packet.id); }}>Finalize and Submit to Coordinator</button>}
            </li>;
          })}
        </ul>
        <div role="status" aria-live="polite" className="pp-feedback">{message}</div>
        <div className="pp-action-row" style={{ marginTop: 14 }}>
          <p>Draft sync and finalization are separate. A submitted packet is sealed; corrections use the authorized amendment process.</p>
          <button type="button" className="pp-button pp-secondary" onClick={reset}>Reset fictional preview</button>
        </div>
      </section>

      <section className="pp-card" aria-labelledby="coordinator-visibility-title">
        <div className="pp-section-heading">
          <div><h3 id="coordinator-visibility-title"><CheckCircle2 size={19} /> Coordinator Queue</h3><p>Only explicitly finalized packets appear here.</p></div>
        </div>
        <div className="pp-shared-content" aria-live="polite">
          {packets.filter(packet => packet.state === "submitted").length
            ? <p><LockKeyhole size={16} /> {packets.filter(packet => packet.state === "submitted").map(packet => packet.id).join(", ")} · Submitted to assigned Coordinator · Sealed</p>
            : <p>No finalized packets. Synchronized drafts remain hidden from Coordinator review.</p>}
        </div>
        <p className="pp-note">Finalization does not release a packet to the PO, record an acknowledgment, or create an electronic signature.</p>
      </section>
      <p className="pp-footer">Approval Preview Only. No Agency API Requests, Local Vault Writes, or Real Packet Transfers Occur Here.</p>
    </div>

    <AlertDialog open={confirmId !== null} onOpenChange={open => { if (!open) { setConfirmId(null); setConfirmed(false); } }}>
      <AlertDialogContent className="pp-confirm">
        <AlertDialogHeader>
          <AlertDialogTitle>Finalize and submit this packet?</AlertDialogTitle>
          <AlertDialogDescription>
            {target ? `${target.date} · ${target.recruit} · ${target.id}` : "This packet"}
            {" "}will be sealed as submitted_complete and shown only to the Coordinator assigned through the server roster. The server verifies your identity, badge, and active assignment.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <p>This is not an electronic signature, PO release, or PO acknowledgment. Corrections require the authorized amendment process.</p>
        <label className="pp-ack">
          <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
          I reviewed this packet and want to submit it to the assigned Coordinator.
        </label>
        <p className="pp-modal-preview">Preview interaction only. Nothing will be sent.</p>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep as Draft</AlertDialogCancel>
          <button type="button" className="pp-button pp-primary" disabled={!confirmed} onClick={finalize}>
            Finalize and Submit to Coordinator
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </main>;
}
