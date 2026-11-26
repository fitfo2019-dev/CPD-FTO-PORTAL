import React, { useState } from "react";
import {
  AlertCircle, Archive, Check, CheckCircle2, ChevronDown, ChevronRight, Clock3, FileCheck2,
  FileText, LockKeyhole, MessageSquareText, RefreshCw, ShieldCheck, UserRound, X,
} from "lucide-react";
import { CATEGORIES, CATEGORY_LABEL } from "@/lib/model.js";
import type { AgencyPacket, AgencyPacketsEnvelope, PacketReviewAction, PacketReviewDraft } from "@/lib/agency-packets.js";

import { Link } from "wouter";
import "./agency-packet-review.css";

type Role = AgencyPacketsEnvelope["metadata"]["role"];
export type AgencyPacketReviewProps = {
  packets: AgencyPacket[]; role: Role | null; loading: boolean; refreshing: boolean;
  unavailable: string; actionError: string; message: string; busy: boolean;
  canRefresh?: boolean;
  pendingAction: PacketReviewAction | null; onRefresh: () => void;
  onAction: (packet: AgencyPacket, draft: PacketReviewDraft) => void; onRetry: () => void;
};

const MAX_TEXT = 4000;
const RATING_LABEL: Record<string, string> = {
  NO: "Not Observed", A: "Acceptable", RT: "Responding to Training", UA: "Unacceptable", NRT: "Not Responding to Training",
};
const ACTION_LABEL: Record<PacketReviewAction, string> = { release: "release", withdraw: "withdrawal", acknowledge: "acknowledgment" };

/** Converts any unknown uploaded value into plain text. Never produces markup. */
function text(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  try { return JSON.stringify(value, null, 2) ?? "—"; } catch { return "[unrenderable value]"; }
}
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const when = (d: Date | null | undefined) => d instanceof Date && !Number.isNaN(d.getTime())
  ? d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";
const humanize = (key: string) => key.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, c => c.toUpperCase());

type Workflow = "committed" | "released" | "withdrawn";
const workflowOf = (p: AgencyPacket): Workflow => p.withdrawn_at ? "withdrawn" : p.released_to_po ? "released" : "committed";
const WORKFLOW_LABEL: Record<Workflow, string> = {
  committed: "Committed · coordinator review", released: "Released to PO", withdrawn: "Withdrawn · permanently closed",
};
const stateKey = (p: AgencyPacket) =>
  `${p.id}|${p.content_hash}|${workflowOf(p)}|${p.acknowledgment ? p.acknowledgment.content_hash : "none"}`;

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, (_k, v) => typeof v === "bigint" ? String(v) : v, 2);
  } catch { return "[Snapshot could not be serialized]"; }
}

export function AgencyPacketReview(props: AgencyPacketReviewProps) {
  const { packets, role, loading, refreshing, unavailable, actionError, message, busy, pendingAction, onRefresh, onRetry, canRefresh = true } = props;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const locked = busy || pendingAction !== null;

  const visible = role === "PO" ? packets.filter(p => p.released_to_po && !p.withdrawn_at) : packets;
  const selected = visible.find(p => p.id === selectedId) ?? visible[0] ?? null;
  const roleMissing = !unavailable && !loading && role === null;
  const blocked = Boolean(unavailable) || roleMissing;

  const subtitle = role === "FTO_COORDINATOR" ? "Review committed training records before releasing an immutable packet to the officer."
    : role === "PO" ? "Read released packets for your training record and acknowledge receipt of review."
    : role === "FTO" ? "Read-only view of packets you uploaded. Release and acknowledgment are handled by others."
    : "View packet status and preserved history.";
  const listTitle = role === "FTO_COORDINATOR" ? "Authorized class packets" : role === "PO" ? "Your released packets" : role === "FTO" ? "Your uploaded packets" : "Packets";
  const listSub = role === "FTO_COORDINATOR" ? "Only packets for your authorized training classes are shown."
    : role === "PO" ? "Only released packets are shown."
    : role === "FTO" ? "Packets returned for your assignments. Read-only." : "";

  return (
    <div className="apr" data-testid="page-agency-packets">
      <div className="apr-crumb"><span>Training records</span><ChevronRight size={11} /><span>Agency packets</span></div>
      <div className="apr-title-row">
        <div><h1>Agency packets</h1><p>{subtitle}</p></div>
        <div className="apr-title-actions">
          <Link href="/resources?topic=packet-status#application-help" className="apr-help-link" data-testid="link-packet-status-help">Packet status help</Link>
          <button type="button" className="apr-refresh" onClick={onRefresh} disabled={!canRefresh || busy || refreshing} data-testid="button-refresh-packets">
            <RefreshCw size={13} className={refreshing ? "apr-spin" : undefined} />{refreshing ? "Refreshing" : "Refresh"}
          </button>
          <span className="apr-refresh-note" data-testid="text-refresh-state">{!canRefresh ? "Packet updates unavailable" : refreshing ? "Checking status" : "Updates every 30 seconds"}</span>
        </div>
      </div>

      {message && <p className="apr-feedback" role="status" data-testid="status-packet-message"><CheckCircle2 size={13} />{message}</p>}
      {actionError && !blocked && <div className="apr-note bad" role="alert" data-testid="status-packet-error"><AlertCircle size={14} /><span>{actionError}</span></div>}
      {pendingAction && !blocked && (
        <div className="apr-note warn" role="status" data-testid="status-pending-action">
          <Clock3 size={14} />
          <div>
            <div>{busy ? `Sending ${ACTION_LABEL[pendingAction]} to the agency server.` :
              `The ${ACTION_LABEL[pendingAction]} result is not confirmed. Refresh to check the server, or retry the same request. Retrying reuses the same operation and will not create a duplicate.`}</div>
            {!busy && <div className="apr-actions" style={{ marginTop: 9 }}>
              <button type="button" className="apr-button primary" onClick={onRetry} data-testid="button-retry-pending"><RefreshCw size={12} />Retry same {ACTION_LABEL[pendingAction]}</button>
            </div>}
          </div>
        </div>
      )}

      <div className="apr-columns">
        <section className="apr-list" aria-label="Agency packet list">
          <div className="apr-list-head"><h2>{listTitle}</h2>{!blocked && !loading && <span className="apr-count" data-testid="text-packet-count">{visible.length} {visible.length === 1 ? "PACKET" : "PACKETS"}</span>}</div>
          {listSub && !blocked && <p className="apr-list-sub">{listSub}</p>}
          {unavailable ? <div className="apr-empty" role="alert" data-testid="status-packets-unavailable"><div className="apr-empty-icon err"><AlertCircle size={17} /></div><h3>Packets unavailable</h3><p>{unavailable}</p>
              <button className="apr-button" type="button" onClick={onRefresh} disabled={!canRefresh || busy || refreshing} data-testid="button-try-refresh"><RefreshCw size={12} />Try refresh</button></div>
            : loading ? [0, 1, 2].map(i => <div className="apr-skel" key={i} aria-hidden><i style={{ width: "45%" }} /><i style={{ width: "70%" }} /><i style={{ width: "55%" }} /></div>)
            : roleMissing ? <div className="apr-empty" role="alert" data-testid="status-role-missing"><div className="apr-empty-icon err"><AlertCircle size={17} /></div><h3>Role not confirmed</h3><p>Your account role could not be confirmed. No packet actions are available.</p></div>
            : visible.length ? visible.map(p => {
              const wf = workflowOf(p);
              return <button key={p.id} type="button" className={`apr-row ${selected?.id === p.id ? "selected" : ""}`} onClick={() => setSelectedId(p.id)} aria-pressed={selected?.id === p.id} data-testid={`button-packet-${p.id}`}>
                <div className="apr-row-top"><span className="apr-id">{p.id}</span><span className={`apr-status ${wf}`}>{wf === "committed" ? "Committed" : wf === "released" ? (p.acknowledgment ? "Acknowledged" : "Released") : "Withdrawn"}</span></div>
                <div className="apr-row-name">{text(p.report.recruitName)} <span style={{ color: "#899698", fontWeight: 500 }}>· PO {text(p.report.recruitBadge)}</span></div>
                <div className="apr-row-meta"><span>Phase {p.phase} · {p.record_date}</span>{p.amendment_of && <span>Replacement</span>}</div>
              </button>;
            })
            : <div className="apr-empty" data-testid="status-packets-empty"><div className="apr-empty-icon"><Archive size={17} /></div>
                <h3>{role === "PO" ? "No released packets yet" : role === "FTO" ? "No uploaded packets" : "No committed packets"}</h3>
                <p>{role === "PO" ? "When your coordinator releases a packet, it will appear here. Draft and withdrawn packets are not visible to you."
                  : role === "FTO" ? "Packets you commit through sync will appear here as read-only records."
                  : "Committed daily records for your authorized classes will appear here for review."}</p></div>}
          <div className="apr-list-foot"><LockKeyhole size={11} /><span>Your confirmed account role determines which packets and actions are available.</span></div>
        </section>

        <section className="apr-detail" aria-label="Packet snapshot">
          {unavailable ? <div className="apr-empty" role="alert"><div className="apr-empty-icon err"><AlertCircle size={17} /></div><h3>Packet snapshot unavailable</h3><p>No record details are shown. No packet state has been changed.</p></div>
            : loading ? <div className="apr-snapshot" aria-busy="true">{[0, 1, 2, 3].map(i => <div className="apr-skel" key={i} style={{ border: 0 }}><i style={{ width: "35%" }} /><i /><i style={{ width: "80%" }} /></div>)}</div>
            : roleMissing ? <div className="apr-empty"><div className="apr-empty-icon err"><LockKeyhole size={17} /></div><h3>No access confirmed</h3><p>Sign in again. If your role remains unavailable, follow your established department process.</p></div>
            : selected && role ? <PacketDetail key={stateKey(selected)} packet={selected} role={role} locked={locked} onAction={props.onAction} />
            : <div className="apr-empty"><div className="apr-empty-icon"><FileText size={17} /></div><h3>{role === "PO" ? "No released packets yet" : "Select a packet"}</h3>
                <p>{role === "PO" ? "Packets appear here only after coordinator release. Committed and withdrawn records remain hidden from this view." : "Choose a packet from the list to inspect its immutable snapshot."}</p></div>}
        </section>
      </div>
    </div>
  );
}

function PacketDetail({ packet, role, locked, onAction }: {
  packet: AgencyPacket; role: Role; locked: boolean; onAction: AgencyPacketReviewProps["onAction"];
}) {
  const [showRaw, setShowRaw] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [closeConfirmed, setCloseConfirmed] = useState(false);
  const [comments, setComments] = useState("");
  const wf = workflowOf(packet);
  const r = packet.report as Record<string, unknown>;
  const ack = packet.acknowledgment;
  const ackCurrent = ack && ack.content_hash === packet.content_hash;

  const known = new Set(["id", "date", "phase", "className", "recruitName", "recruitBadge", "ftoName", "ftoBadge", "runs", "activity", "reportingForDuty", "ratings", "status", "narrative", "remedial", "recruitComments"]);
  const extras = Object.keys(r).filter(k => !known.has(k));
  const duty = isRecord(r.reportingForDuty) ? Object.entries(r.reportingForDuty) : [];
  const runs = Array.isArray(r.runs) ? r.runs : [];
  const activity = isRecord(r.activity) ? Object.entries(r.activity) : [];
  const ratings = isRecord(r.ratings) ? r.ratings : {};
  const reasonOk = withdrawReason.trim().length > 0 && withdrawReason.length <= MAX_TEXT;

  return <>
    <header className="apr-detail-head">
      <div className="apr-detail-top"><span className="apr-kicker">Immutable packet snapshot</span><span className={`apr-status ${wf}`} data-testid="status-workflow">{WORKFLOW_LABEL[wf]}</span></div>
      <h2 data-testid="text-packet-title">{text(r.recruitName)} · Daily Performance Log</h2>
      <div className="apr-sub">{packet.id} · Source record {text(r.id)} · Hash {packet.content_hash.slice(0, 16)}</div>
      <div className="apr-meta" data-testid="section-server-metadata">
        <div><small>Server workflow state</small><div>{WORKFLOW_LABEL[wf]}</div></div>
        <div><small>Released to PO</small><div data-testid="text-released-at">{packet.released_to_po ? when(packet.released_at) : "Not released"}</div></div>
        <div><small>PO acknowledgment</small><div data-testid="text-acknowledged-at">{ack ? `${when(ack.acknowledged_at)}${ackCurrent ? "" : " (earlier content)"}` : "Not acknowledged"}</div></div>
        <div><small>Server version</small><div>{packet.server_version}</div></div>
        <div><small>Record date / phase</small><div>{packet.record_date} · Phase {packet.phase}</div></div>
        <div><small>Withdrawn</small><div data-testid="text-withdrawn-at">{packet.withdrawn_at ? when(packet.withdrawn_at) : "No"}</div></div>
        {packet.withdrawal_reason && <div className="wide"><small>Withdrawal reason</small><div data-testid="text-withdrawal-reason">{packet.withdrawal_reason}</div></div>}
        {packet.amendment_of && <div className="wide"><small>Replacement of packet</small><div data-testid="text-amendment-of">{packet.amendment_of}{packet.amendment_reason ? `\nReason: ${packet.amendment_reason}` : ""}</div></div>}
        {ack && <div className="wide"><small>PO acknowledgment comments</small><div data-testid="text-ack-comments">{ack.comments || "None provided"}</div></div>}
      </div>
    </header>

    <div className="apr-unverified"><AlertCircle size={14} /><span><strong>Snapshot not independently verified.</strong> Uploaded record content, including its status ({text(r.status)}) and any signature fields, is displayed as submitted. It is not the source of release, withdrawal, or acknowledgment state.</span></div>

    <div className="apr-snapshot">
      <section className="apr-section">
        <h3 className="apr-section-head"><span><FileText size={13} />Record header</span><small>uploaded content</small></h3>
        <div className="apr-facts">
          {([["Report ID", r.id], ["Date", r.date], ["Phase", r.phase], ["Class", r.className],
            ["Probationary officer", r.recruitName], ["PO badge", r.recruitBadge], ["FTO", r.ftoName], ["FTO badge", r.ftoBadge],
            ["Uploaded status (unverified)", r.status]] as const).map(([label, v]) =>
            <div className="apr-fact" key={label}><small>{label}</small><div>{text(v)}</div></div>)}
        </div>
      </section>

      <section className="apr-section">
        <h3 className="apr-section-head"><span><Clock3 size={13} />Reporting for duty</span><small>{duty.length} fields</small></h3>
        {duty.length ? <dl className="apr-kv">{duty.map(([k, v]) => <FragmentKV key={k} k={humanize(k)} v={v} />)}</dl> : <div className="apr-prose empty">No duty record content was uploaded.</div>}
      </section>

      <section className="apr-section">
        <h3 className="apr-section-head"><span><FileCheck2 size={13} />Calls / runs</span><small>{runs.length} entries</small></h3>
        {runs.length ? <div className="apr-runs">{runs.map((run, i) =>
          <div className="apr-run" key={i} data-testid={`card-run-${i}`}><div className="apr-run-head">RUN {String(i + 1).padStart(2, "0")}</div>
            {isRecord(run) ? <dl className="apr-kv">{Object.entries(run).map(([k, v]) => <FragmentKV key={k} k={humanize(k)} v={v} />)}</dl> : <div className="apr-prose">{text(run)}</div>}
          </div>)}</div> : <div className="apr-prose empty">No runs were uploaded.</div>}
      </section>

      <section className="apr-section">
        <h3 className="apr-section-head"><span><Archive size={13} />Activity totals</span><small>uploaded counts</small></h3>
        {activity.length ? <div className="apr-activity">{activity.map(([k, v]) => <div className="apr-activity-item" key={k}><span>{humanize(k)}</span><strong>{text(v)}</strong></div>)}</div>
          : <div className="apr-prose empty">No activity totals were uploaded.</div>}
      </section>

      <section className="apr-section">
        <h3 className="apr-section-head"><span><CheckCircle2 size={13} />Daily evaluations</span><small>{CATEGORIES.length} manual categories · full snapshot</small></h3>
        <div className="apr-evals">{CATEGORIES.map((key, i) => {
          const entry = ratings[key];
          const rec = isRecord(entry) ? entry : null;
          const code = rec ? rec.rating : entry;
          const codeText = typeof code === "string" && code ? code : "—";
          const note = rec && typeof rec.justification === "string" ? rec.justification : "";
          const rest = rec ? Object.entries(rec).filter(([k, v]) => k !== "rating" && k !== "justification" && v !== "" && v !== false && !(Array.isArray(v) && !v.length)) : [];
          return <div className="apr-eval-row" key={key} data-testid={`row-eval-${key}`}>
            <span className="apr-eval-no">{String(i + 1).padStart(2, "0")}</span>
            <span className="apr-eval-name">{CATEGORY_LABEL[key]}</span>
            <span className={`apr-rating ${codeText === "NO" ? "no" : codeText === "UA" || codeText === "NRT" ? "flag" : ""}`} title={RATING_LABEL[codeText] ?? "Unrecognized or missing rating"}>{codeText}</span>
            <span className="apr-eval-note">{note || (entry === undefined ? "No rating uploaded for this category." : "")}
              {rest.map(([k, v]) => <span className="extra" key={k}>{humanize(k)}: {text(v)}</span>)}
              {!rec && entry !== undefined && typeof entry !== "string" && <span className="extra">{text(entry)}</span>}
            </span>
          </div>;
        })}</div>
        <p className="apr-help">Manual rating codes: NO · Not Observed; A · Acceptable; RT · Responding to Training; UA · Unacceptable; NRT · Not Responding to Training.</p>
      </section>

      <section className="apr-section">
        <h3 className="apr-section-head"><span><MessageSquareText size={13} />Narrative</span><small>uploaded content</small></h3>
        <Prose value={r.narrative} empty="No narrative uploaded." testId="text-narrative" />
      </section>
      <section className="apr-section">
        <h3 className="apr-section-head"><span><MessageSquareText size={13} />Remedial training</span><small>uploaded content</small></h3>
        <Prose value={r.remedial} empty="No remedial training recorded." testId="text-remedial" />
      </section>
      <section className="apr-section">
        <h3 className="apr-section-head"><span><MessageSquareText size={13} />PO comments</span><small>uploaded content</small></h3>
        <Prose value={r.recruitComments} empty="No PO comments uploaded." testId="text-recruit-comments" />
      </section>
      {extras.length > 0 && <section className="apr-section">
        <h3 className="apr-section-head"><span><FileText size={13} />Additional uploaded fields</span><small>{extras.length} unverified</small></h3>
        <dl className="apr-kv">{extras.map(k => <FragmentKV key={k} k={k} v={r[k]} />)}</dl>
      </section>}

      <section className="apr-section">
        <button className="apr-raw-toggle" type="button" onClick={() => setShowRaw(v => !v)} aria-expanded={showRaw} data-testid="button-toggle-raw-json">
          <ChevronDown size={13} style={{ transform: showRaw ? "rotate(180deg)" : undefined }} />{showRaw ? "Hide" : "Expand"} complete raw snapshot JSON (unverified)
        </button>
        {showRaw && <pre className="apr-json" data-testid="text-raw-json">{safeJson(packet.report)}</pre>}
      </section>
    </div>

    {role === "FTO_COORDINATOR" ? <footer className="apr-workflow">
      <div className="apr-workflow-heading"><UserRound size={14} />Coordinator review</div>
      {wf === "committed" && <>
        <label className="apr-confirm"><input type="checkbox" checked={reviewed} disabled={locked} onChange={e => setReviewed(e.target.checked)} data-testid="checkbox-coordinator-reviewed" />
          <span>I reviewed the complete snapshot above and confirm it is the packet I intend to release to {text(r.recruitName)}.</span></label>
        <div className="apr-actions"><button type="button" className="apr-button primary" disabled={!reviewed || locked} onClick={() => onAction(packet, { action: "release" })} data-testid="button-release-packet"><Check size={13} />Release for PO review</button></div>
          <p className="apr-help">Release follows the packet’s recorded status, not text inside the uploaded file. The snapshot cannot be edited after commit.</p>
      </>}
      {wf === "released" && ack && <div className="apr-ack" style={{ marginTop: 0, marginBottom: 12 }}><CheckCircle2 size={14} /><span>PO review receipt recorded {when(ack.acknowledged_at)}. Receipt is not agreement and is not an electronic signature.</span></div>}
      {wf !== "withdrawn" ? <>
        <div className="apr-actions" style={{ marginTop: 12 }}><button type="button" className="apr-button danger" disabled={locked} onClick={() => setShowWithdraw(v => !v)} aria-expanded={showWithdraw} data-testid="button-open-withdraw"><X size={13} />Withdraw packet</button></div>
        {showWithdraw && <div className="apr-withdraw-box">
          <p><strong>Permanent closure.</strong> Withdrawal removes this packet from the PO's view and it can never be reopened or edited. Corrections require a new linked replacement uploaded by the assigned FTO, which needs fresh coordinator review and PO acknowledgment. This packet's history is preserved.</p>
          <label className="apr-field-label" htmlFor="apr-withdraw-reason"><span>Correction reason · required</span><span>{withdrawReason.length}/{MAX_TEXT}</span></label>
          <textarea id="apr-withdraw-reason" className="apr-textarea" value={withdrawReason} maxLength={MAX_TEXT} disabled={locked} onChange={e => setWithdrawReason(e.target.value)} placeholder="Describe why this packet must be withdrawn." data-testid="input-correction-reason" />
          <label className="apr-confirm" style={{ marginTop: 10 }}><input type="checkbox" checked={closeConfirmed} disabled={locked} onChange={e => setCloseConfirmed(e.target.checked)} data-testid="checkbox-confirm-withdraw" />
            <span>I understand this packet will be permanently closed and cannot be reopened.</span></label>
          <div className="apr-actions">
            <button type="button" className="apr-button danger" disabled={!reasonOk || !closeConfirmed || locked} onClick={() => onAction(packet, { action: "withdraw", reason: withdrawReason.trim() })} data-testid="button-confirm-withdraw">Permanently withdraw</button>
            <button type="button" className="apr-button" disabled={locked} onClick={() => { setShowWithdraw(false); setWithdrawReason(""); setCloseConfirmed(false); }} data-testid="button-cancel-withdraw">Cancel</button>
          </div>
        </div>}
      </> : <AmendmentPolicy />}
    </footer>
    : role === "PO" ? <footer className="apr-workflow">
      <div className="apr-workflow-heading"><UserRound size={14} />Your review</div>
      {ackCurrent ? <div className="apr-ack" style={{ marginTop: 0 }} data-testid="status-acknowledged"><CheckCircle2 size={14} /><span>Receipt of review acknowledged {when(ack.acknowledged_at)}. This is not agreement with the contents and is not an electronic signature.</span></div> : <>
        <label className="apr-confirm"><input type="checkbox" checked={reviewed} disabled={locked} onChange={e => setReviewed(e.target.checked)} data-testid="checkbox-po-reviewed" /><span>I reviewed this complete packet and acknowledge receipt of the snapshot.</span></label>
        <label className="apr-field-label" htmlFor="apr-po-comment"><span>Optional comments for the training record</span><span>{comments.length}/{MAX_TEXT}</span></label>
        <textarea id="apr-po-comment" className="apr-textarea" value={comments} maxLength={MAX_TEXT} disabled={locked} onChange={e => setComments(e.target.value)} placeholder="Add a comment if useful. You may leave this blank." data-testid="input-po-comment" />
        <div className="apr-actions" style={{ marginTop: 10 }}><button type="button" className="apr-button primary" disabled={!reviewed || comments.length > MAX_TEXT || locked} onClick={() => onAction(packet, { action: "acknowledge", comments })} data-testid="button-acknowledge"><Check size={13} />Acknowledge review</button></div>
      </>}
      <p className="apr-help">Acknowledgment confirms receipt and review only. It does not mean agreement with the record and is not an electronic signature.</p>
    </footer>
    : <footer className="apr-workflow">
      <div className="apr-workflow-heading"><ShieldCheck size={14} />Read-only</div>
      {wf === "withdrawn" ? <AmendmentPolicy /> : <p className="apr-help" style={{ marginTop: 0 }}>FTO’s can view their returned packets. Release, withdrawal, and acknowledgment are recorded by the coordinator and PO on the agency server.</p>}
    </footer>}
  </>;
}

function AmendmentPolicy() {
  return <div className="apr-closed" data-testid="status-withdrawn-policy"><LockKeyhole size={14} /><span>This packet is permanently closed and remains immutable. A correction must be a new linked replacement uploaded by the assigned FTO; it requires fresh coordinator review and PO acknowledgment. The original and its history are preserved.</span></div>;
}

function Prose({ value, empty, testId }: { value: unknown; empty: string; testId: string }) {
  const t = typeof value === "string" ? value.trim() : value;
  return t ? <div className="apr-prose" data-testid={testId}>{text(value)}</div> : <div className="apr-prose empty" data-testid={testId}>{empty}</div>;
}

function FragmentKV({ k, v }: { k: string; v: unknown }) {
  return <><dt>{k}</dt><dd>{text(v)}</dd></>;
}
