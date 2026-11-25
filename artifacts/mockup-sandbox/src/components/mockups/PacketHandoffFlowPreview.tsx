import { useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileCheck2,
  FileText,
  History,
  LockKeyhole,
  RotateCcw,
  Send,
  ShieldCheck,
  UserRound,
} from "lucide-react";

type FlowStatus =
  | "awaiting_po_totals_review"
  | "awaiting_coordinator_receipt"
  | "coordinator_review"
  | "complete"
  | "released"
  | "po_acknowledged"
  | "correction_requested";
type Role = "Coordinator" | "FTO" | "FTO COC" | "POLICENET" | "POLICENET Admin-SGT" | "PO";
const PREVIEW_ROLES: Role[] = ["Coordinator", "FTO", "FTO COC", "POLICENET", "POLICENET Admin-SGT", "PO"];
type SnapshotHistory = {
  version: number;
  status: FlowStatus;
  reason: string;
};

const stages: { title: string; detail: string }[] = [
  { title: "Submitted", detail: "FTO finalizes a fixed snapshot" },
  { title: "PO review", detail: "Daily, weekly, monthly counts + own UA details" },
  { title: "PO review recorded", detail: "Only then does Coordinator receive it" },
  { title: "Coordinator receipt", detail: "Coordinator confirms delivery" },
  { title: "COMPLETE", detail: "Coordinator approves the snapshot" },
  { title: "Released to PO", detail: "Own UA details + period counts" },
  { title: "PO receipt", detail: "PO acknowledges review receipt" },
];

const stateIndex = (status: FlowStatus) => {
  if (status === "awaiting_po_totals_review") return 1;
  if (status === "awaiting_coordinator_receipt") return 2;
  if (status === "coordinator_review") return 3;
  if (status === "complete") return 4;
  if (status === "released") return 5;
  if (status === "po_acknowledged") return 6;
  return -1;
};

const historyLabel = (status: FlowStatus) => ({
  awaiting_po_totals_review: "Waiting for PO review",
  awaiting_coordinator_receipt: "PO review recorded · Coordinator receipt pending",
  coordinator_review: "Coordinator receipt acknowledged",
  complete: "COMPLETE · Coordinator approved",
  released: "Released to PO",
  po_acknowledged: "PO receipt acknowledged",
  correction_requested: "Correction requested",
}[status]);

export default function PacketHandoffFlowPreview() {
  const [role, setRole] = useState<Role>(() => {
    if (typeof window === "undefined") return "PO";
    const requestedRole = new URLSearchParams(window.location.search).get("role");
    return PREVIEW_ROLES.find(option => option === requestedRole) ?? "PO";
  });
  const [status, setStatus] = useState<FlowStatus>("awaiting_po_totals_review");
  const [version, setVersion] = useState(1);
  const [history, setHistory] = useState<SnapshotHistory[]>([]);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionReason, setCorrectionReason] = useState("");
  const [notice, setNotice] = useState(() => role === "PO"
    ? "The PO can review their own unacceptable ratings and daily, weekly, and monthly counts."
    : `Previewing ${role} on assigned classes; only this role's authorized actions are available.`);

  const visibleToPo = status === "awaiting_po_totals_review" || status === "released" || status === "po_acknowledged";
  const coordinatorGate = role === "Coordinator" && status === "awaiting_po_totals_review";
  const activeStage = stateIndex(status);
  const isCorrection = status === "correction_requested";
  const changePreviewRole = (nextRole: Role) => {
    setRole(nextRole);
    setNotice(nextRole === "PO"
      ? "The PO can review their own unacceptable ratings and daily, weekly, and monthly counts."
      : `Previewing ${nextRole} on assigned classes; only this role's authorized actions are available.`);
  };

  const acknowledgeReceipt = () => {
    setStatus("coordinator_review");
    setNotice("Coordinator receipt acknowledged locally. Approval is still a separate step.");
  };
  const approvePacket = () => {
    setStatus("complete");
    setNotice("COMPLETE recorded in this local preview. The PO still cannot see this packet.");
  };
  const releasePacket = () => {
    setStatus("released");
    setNotice("Released locally. The PO can now see the same summary totals and acknowledge receipt.");
  };
  const acknowledgePoReceipt = () => {
    setStatus("po_acknowledged");
    setNotice("PO receipt acknowledged locally. The PO still sees their own UA details and period counts.");
  };
  const reviewPoTotals = () => {
    setStatus("awaiting_coordinator_receipt");
    setRole("PO");
    setNotice("Totals review recorded locally. The packet can now enter the Coordinator queue.");
  };
  const requestCorrection = () => {
    if (!correctionReason.trim()) return;
    setHistory((items) => [
      ...items,
      { version, status, reason: correctionReason.trim() },
    ]);
    setStatus("correction_requested");
    setCorrectionOpen(false);
    setNotice(`Correction requested for snapshot v${version}. That snapshot is preserved in history.`);
  };
  const resubmitCorrection = () => {
    setVersion((current) => current + 1);
    setStatus("awaiting_po_totals_review");
    setCorrectionReason("");
    setRole("PO");
    setNotice(`Corrected snapshot v${version + 1} is waiting for fresh PO review.`);
  };
  const resetPreview = () => {
    setRole("PO");
    setStatus("awaiting_po_totals_review");
    setVersion(1);
    setHistory([]);
    setCorrectionOpen(false);
    setCorrectionReason("");
    setNotice("The PO can review their own unacceptable ratings and daily, weekly, and monthly counts.");
  };

  return (
    <main className="ph-preview">
      <style>{`
        .ph-preview {
          --ph-navy: #203744;
          --ph-navy-deep: #172e39;
          --ph-ink: #263943;
          --ph-muted: #718087;
          --ph-line: #dce4e2;
          --ph-paper: #f3f6f4;
          --ph-surface: #fffefa;
          --ph-sage: #477d70;
          --ph-sage-dark: #345f5c;
          --ph-sage-soft: #e7f0eb;
          --ph-gold: #b18448;
          --ph-gold-soft: #f5efe3;
          --ph-red: #a54443;
          --ph-red-soft: #f6eae7;
          min-height: 100dvh;
          background: var(--ph-paper);
          color: var(--ph-ink);
          font: 13px/1.5 Arial, sans-serif;
        }
        .ph-preview * { box-sizing: border-box; }
        .ph-preview button, .ph-preview input, .ph-preview textarea { font: inherit; }
        .ph-preview button { cursor: pointer; }
        .ph-preview button:focus-visible, .ph-preview textarea:focus-visible {
          outline: 3px solid #d7a34e;
          outline-offset: 2px;
        }
        .ph-topbar {
          min-height: 66px;
          padding: 10px clamp(15px, 4vw, 52px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          background: var(--ph-navy);
          color: #f5f7f4;
          border-bottom: 1px solid #ffffff1b;
        }
        .ph-brand { display: flex; align-items: center; gap: 11px; min-width: 0; }
        .ph-brand-mark {
          display: grid; width: 35px; height: 35px; flex: 0 0 auto;
          place-items: center; border: 1px solid #8ba69c; border-radius: 5px;
          color: #c4d5cc;
        }
        .ph-brand-name {
          font-family: Oswald, "Arial Narrow", Arial, sans-serif;
          font-size: 15px; font-weight: 600; letter-spacing: .055em;
          line-height: 1.2; text-transform: uppercase;
        }
        .ph-brand-sub {
          margin-top: 3px; color: #b5c5c2; font-size: 9px;
          letter-spacing: .1em; text-transform: uppercase;
        }
        .ph-preview-tag {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 7px 9px; border: 1px solid #ffffff32; border-radius: 3px;
          color: #e1e9e4; font: 9px ui-monospace, SFMono-Regular, Menlo, monospace;
          letter-spacing: .07em; text-transform: uppercase; white-space: nowrap;
        }
        .ph-preview-tag i { width: 6px; height: 6px; border-radius: 50%; background: #d2ad68; }
        .ph-nav {
          display: flex; align-items: center; gap: 0; min-height: 37px;
          padding: 0 clamp(12px, 4vw, 52px); border-bottom: 1px solid var(--ph-line);
          background: #fbfcfa; color: #65767b;
        }
        .ph-nav span {
          display: inline-flex; align-items: center; min-height: 37px;
          padding: 0 12px; font-size: 10px; font-weight: 700; letter-spacing: .035em;
          text-transform: uppercase; white-space: nowrap;
        }
        .ph-nav span:last-child { color: var(--ph-navy); border-bottom: 2px solid var(--ph-sage); }
        .ph-page { width: min(100%, 1360px); margin: 0 auto; padding: 22px clamp(14px, 3.7vw, 48px) 36px; }
        .ph-banner {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 9px 12px; margin-bottom: 16px; border: 1px solid #d7c7a6;
          border-left: 3px solid var(--ph-gold); background: #fbf7ee; color: #735f3c;
          font-size: 10px; line-height: 1.45;
        }
        .ph-banner strong { color: #66512d; font-size: 10px; letter-spacing: .045em; text-transform: uppercase; }
        .ph-crumb {
          display: flex; align-items: center; gap: 6px; margin-bottom: 10px;
          color: #859196; font: 9px ui-monospace, SFMono-Regular, Menlo, monospace;
          letter-spacing: .06em; text-transform: uppercase;
        }
        .ph-title-row {
          display: flex; align-items: flex-end; justify-content: space-between; gap: 16px;
          margin-bottom: 18px;
        }
        .ph-eyebrow {
          margin: 0 0 4px; color: var(--ph-sage); font: 700 9px ui-monospace, SFMono-Regular, Menlo, monospace;
          letter-spacing: .1em; text-transform: uppercase;
        }
        .ph-title-row h1 {
          margin: 0; color: var(--ph-navy); font: 600 clamp(23px, 3vw, 31px)/1.12 Oswald, "Arial Narrow", Arial, sans-serif;
          letter-spacing: .012em;
        }
        .ph-title-row p { margin: 6px 0 0; color: var(--ph-muted); font-size: 11px; }
        .ph-role-box { display: flex; align-items: center; gap: 9px; flex: 0 0 auto; }
        .ph-role-label { color: #879397; font: 9px ui-monospace, SFMono-Regular, Menlo, monospace; text-transform: uppercase; }
         .ph-role-switch {
           display: flex; flex-wrap: wrap; justify-content: flex-end; padding: 3px;
           border: 1px solid #d4ddda; border-radius: 4px; background: #e9efeb;
        }
        .ph-role-switch button {
          min-height: 29px; padding: 0 9px; border: 0; border-radius: 2px;
          background: transparent; color: #627277; font-size: 9px; font-weight: 700;
           text-transform: uppercase; white-space: nowrap;
        }
        .ph-role-switch button[aria-pressed="true"] { background: var(--ph-surface); color: var(--ph-navy); box-shadow: 0 1px 3px #20374418; }
        .ph-state-banner {
          display: flex; align-items: flex-start; gap: 9px; margin-bottom: 14px;
          padding: 10px 12px; border: 1px solid #d7e2dd; border-radius: 3px;
          background: #eaf1ed; color: #4f6965; font-size: 10px; line-height: 1.5;
        }
        .ph-state-banner svg { flex: 0 0 auto; margin-top: 1px; color: #62857a; }
        .ph-state-banner strong { color: #385d56; }
        .ph-layout { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(280px, .85fr); gap: 14px; align-items: start; }
        .ph-main-column, .ph-side-column { display: grid; gap: 13px; min-width: 0; }
        .ph-panel {
          overflow: hidden; border: 1px solid var(--ph-line); border-radius: 5px;
          background: var(--ph-surface); box-shadow: 0 3px 11px #223d3a08;
        }
        .ph-panel-head {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          padding: 10px 13px; border-bottom: 1px solid var(--ph-line); background: #f8faf8;
        }
        .ph-panel-head h2 {
          margin: 0; color: var(--ph-navy); font: 600 13px Oswald, "Arial Narrow", Arial, sans-serif;
          letter-spacing: .045em; text-transform: uppercase;
        }
        .ph-panel-kicker {
          color: #879397; font: 8px ui-monospace, SFMono-Regular, Menlo, monospace;
          letter-spacing: .07em; text-transform: uppercase;
        }
        .ph-packet-head { padding: 14px 15px 12px; }
        .ph-packet-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .ph-packet-title {
          margin: 0; color: var(--ph-navy); font: 700 17px/1.25 Oswald, "Arial Narrow", Arial, sans-serif;
          letter-spacing: .01em;
        }
         .ph-class-list { padding: 10px 13px 12px; }
         .ph-class-list-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
         .ph-class-list-head h2 { margin: 0; color: var(--ph-navy); font: 600 12px Oswald, "Arial Narrow", Arial, sans-serif; text-transform: uppercase; letter-spacing: .04em; }
         .ph-class-list-head span { color: #869397; font: 8px ui-monospace, SFMono-Regular, Menlo, monospace; text-transform: uppercase; }
         .ph-class-row { display: grid; grid-template-columns: minmax(120px, 1.3fr) minmax(90px, .7fr) minmax(120px, 1fr); gap: 9px; align-items: center; padding: 7px 8px; border-top: 1px solid #edf0ee; color: #68787c; font-size: 9px; }
         .ph-class-row.header { color: #879397; font: 8px ui-monospace, SFMono-Regular, Menlo, monospace; text-transform: uppercase; }
         .ph-class-row.selected { border-left: 3px solid var(--ph-sage); background: #f0f6f2; color: #3e5f58; font-weight: 700; }
         .ph-class-status { color: #657a70; }
         .ph-class-list-note { margin: 7px 0 0; color: #8a9697; font-size: 8px; }
        .ph-packet-sub { margin: 5px 0 0; color: #7a898d; font: 9px ui-monospace, SFMono-Regular, Menlo, monospace; }
        .ph-status {
          display: inline-flex; align-items: center; gap: 5px; flex: 0 0 auto;
          padding: 4px 7px; border: 1px solid #dfd3b9; border-radius: 3px;
          background: var(--ph-gold-soft); color: #82673b; font: 8px ui-monospace, SFMono-Regular, Menlo, monospace;
          letter-spacing: .035em; text-transform: uppercase; white-space: nowrap;
        }
        .ph-status.complete, .ph-status.released, .ph-status.po_acknowledged {
          border-color: #cbded4; background: var(--ph-sage-soft); color: #3f7164;
        }
        .ph-status.correction_requested { border-color: #e8ceca; background: var(--ph-red-soft); color: #98524b; }
        .ph-facts {
          display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 11px 14px;
          padding: 12px 15px 14px; border-top: 1px solid #edf0ee;
        }
        .ph-fact small {
          display: block; margin-bottom: 4px; color: #8b999b;
          font: 8px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .045em;
          text-transform: uppercase;
        }
        .ph-fact strong { color: #3e555b; font-size: 10px; font-weight: 600; line-height: 1.4; }
        .ph-workflow { padding: 14px 15px 15px; }
        .ph-workflow-intro {
          display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
          margin-bottom: 13px;
        }
        .ph-workflow-intro h3 { margin: 0; color: #3c5359; font-size: 11px; font-weight: 700; }
        .ph-workflow-intro p { margin: 3px 0 0; color: #879397; font-size: 9px; }
        .ph-version-tag {
          flex: 0 0 auto; padding: 4px 6px; border: 1px solid #dce4e2; border-radius: 3px;
          color: #738287; font: 8px ui-monospace, SFMono-Regular, Menlo, monospace;
          text-transform: uppercase;
        }
        .ph-timeline { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); align-items: start; }
        .ph-stage { position: relative; min-width: 0; padding: 0 5px; text-align: center; }
        .ph-stage:not(:last-child)::after {
          position: absolute; z-index: 0; top: 10px; left: calc(50% + 12px);
          width: calc(100% - 24px); height: 2px; background: #dce4e2; content: "";
        }
        .ph-stage.done:not(:last-child)::after { background: #93b2a4; }
        .ph-stage-dot {
          position: relative; z-index: 1; display: grid; width: 21px; height: 21px;
          place-items: center; margin: 0 auto 7px; border: 1px solid #cbd5d1;
          border-radius: 50%; background: #fff; color: #a0acab;
        }
        .ph-stage.done .ph-stage-dot { border-color: var(--ph-sage); background: var(--ph-sage); color: #fff; }
        .ph-stage.current .ph-stage-dot { border: 2px solid var(--ph-gold); background: #fff; color: #9c743d; box-shadow: 0 0 0 3px #f5efe3; }
        .ph-stage-title { display: block; color: #77868a; font-size: 9px; font-weight: 700; line-height: 1.25; }
        .ph-stage.done .ph-stage-title, .ph-stage.current .ph-stage-title { color: #3f5c5d; }
        .ph-stage-title.complete-label { color: #3f7164; font-size: 10px; letter-spacing: .045em; }
        .ph-stage-detail { display: block; margin-top: 4px; color: #96a0a1; font-size: 8px; line-height: 1.35; }
        .ph-po-totals { padding: 13px; }
        .ph-po-totals-intro { margin: 0 0 10px; color: #758489; font-size: 9px; line-height: 1.5; }
        .ph-po-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
        .ph-total-card { padding: 10px; border: 1px solid #dce5e0; border-radius: 4px; background: #fafcf9; }
        .ph-total-card h3 { margin: 0 0 7px; color: var(--ph-navy); font: 600 11px Oswald, "Arial Narrow", Arial, sans-serif; letter-spacing: .04em; text-transform: uppercase; }
        .ph-total-card small { display: block; color: #889699; font: 8px ui-monospace, SFMono-Regular, Menlo, monospace; text-transform: uppercase; }
        .ph-total-number { display: block; margin: 2px 0 8px; color: #3d6259; font: 600 22px Oswald, "Arial Narrow", Arial, sans-serif; }
        .ph-total-row { display: flex; justify-content: space-between; gap: 7px; padding: 4px 0; border-top: 1px solid #e8eeea; color: #718084; font-size: 8px; }
        .ph-total-row strong { color: #40585e; font-size: 9px; }
        .ph-rating-strip { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 3px; margin: 5px 0 8px; }
        .ph-rating-strip span { padding: 4px 2px; border-radius: 2px; background: #edf3ef; color: #546c66; font: 8px ui-monospace, SFMono-Regular, Menlo, monospace; text-align: center; }
        .ph-rating-strip b { display: block; margin-top: 2px; font-size: 9px; }
         .ph-rating-label { margin: 9px 0 2px; color: #77868a; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
         .ph-ua-list { margin-top: 11px; padding: 10px; border: 1px solid #e4d6d0; border-radius: 4px; background: #fcf8f6; }
         .ph-ua-list h3 { margin: 0 0 7px; color: #6f4d47; font-size: 10px; }
         .ph-ua-item { padding: 7px 0; border-top: 1px solid #efe2dd; }
         .ph-ua-item:first-of-type { border-top: 0; }
         .ph-ua-item strong { color: #674943; font-size: 9px; }
         .ph-ua-item span { float: right; color: #9a5149; font: 700 8px ui-monospace, SFMono-Regular, Menlo, monospace; }
         .ph-ua-item p { margin: 4px 0 0; color: #776b67; font-size: 9px; line-height: 1.45; }
        .ph-po-review-box { margin-top: 10px; padding: 10px; border: 1px solid #d9e4de; border-radius: 4px; background: #f5f9f5; }
        .ph-po-review-box p { margin: 0 0 8px; color: #607471; font-size: 9px; line-height: 1.45; }
        .ph-po-reviewed { display: flex; align-items: flex-start; gap: 7px; margin-top: 8px; padding: 8px; border: 1px solid #dce7e0; background: #f6faf6; color: #58746b; font-size: 8px; line-height: 1.45; }
        .ph-complete-callout {
          display: flex; align-items: flex-start; gap: 8px; margin: 13px 1px 0;
          padding: 9px 10px; border: 1px solid #cfdfd6; border-left: 3px solid var(--ph-sage);
          background: #f0f6f2; color: #4b6c62; font-size: 9px; line-height: 1.5;
        }
        .ph-complete-callout svg { flex: 0 0 auto; margin-top: 1px; color: var(--ph-sage); }
        .ph-complete-callout strong { color: #345e55; }
        .ph-branch {
          display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 9px;
          margin-top: 14px; padding-top: 12px; border-top: 1px dashed #dfc8c3;
        }
        .ph-branch-label {
          display: inline-flex; align-items: center; gap: 6px; color: #92564e;
          font: 700 8px ui-monospace, SFMono-Regular, Menlo, monospace;
          letter-spacing: .06em; text-transform: uppercase;
        }
        .ph-branch-track { display: flex; align-items: center; gap: 6px; min-width: 0; }
        .ph-branch-step {
          padding: 5px 7px; border: 1px solid #e5d3cf; border-radius: 3px;
          background: #fcf6f4; color: #875750; font-size: 8px; font-weight: 700;
          text-align: center; white-space: nowrap;
        }
        .ph-branch-step.active { border-color: #be8279; background: var(--ph-red-soft); color: #8d443f; }
        .ph-branch-arrow { color: #b38b84; flex: 0 0 auto; }
        .ph-history {
          margin-top: 11px; padding: 9px 10px; border: 1px solid #e3e7e4; border-radius: 3px;
          background: #fafbf9;
        }
        .ph-history-head { display: flex; align-items: center; gap: 6px; color: #65777b; font-size: 9px; font-weight: 700; }
        .ph-history-item {
          display: grid; grid-template-columns: auto 1fr; gap: 7px; margin-top: 7px;
          padding-top: 7px; border-top: 1px solid #e8ece9; color: #728084; font-size: 9px;
        }
        .ph-history-item strong { color: #425b60; }
        .ph-side-body { padding: 13px; }
        .ph-actor {
          display: flex; align-items: center; gap: 9px; margin-bottom: 11px;
          padding-bottom: 11px; border-bottom: 1px solid #edf0ee;
        }
        .ph-actor-icon {
          display: grid; width: 32px; height: 32px; flex: 0 0 auto;
          place-items: center; border-radius: 4px; background: #eaf1ed; color: #5e8175;
        }
        .ph-actor small { display: block; color: #899698; font-size: 8px; text-transform: uppercase; letter-spacing: .06em; }
        .ph-actor strong { display: block; margin-top: 2px; color: #3b5359; font-size: 10px; }
        .ph-action-title { margin: 0 0 8px; color: #455d62; font-size: 10px; font-weight: 700; }
        .ph-action-copy { margin: 0 0 10px; color: #829093; font-size: 9px; line-height: 1.5; }
        .ph-actions { display: grid; gap: 7px; }
        .ph-button {
          display: inline-flex; align-items: center; justify-content: center; gap: 7px;
          min-height: 34px; padding: 7px 10px; border: 1px solid #cbd8d2;
          border-radius: 3px; background: #fffefa; color: #4e6867;
          font-size: 9px; font-weight: 700; letter-spacing: .035em; text-align: center;
           text-transform: uppercase;
        }
        .ph-button:hover:not(:disabled) { background: #f1f6f2; }
        .ph-button.primary { border-color: var(--ph-sage-dark); background: var(--ph-sage-dark); color: #fff; }
        .ph-button.primary:hover:not(:disabled) { background: #284e4c; }
        .ph-button.subtle-danger { border-color: #e2d1cc; color: #95574d; }
        .ph-button.subtle-danger:hover:not(:disabled) { background: #fbf2ef; }
        .ph-button:disabled { opacity: .46; cursor: not-allowed; }
        .ph-button-line { display: flex; gap: 7px; }
        .ph-button-line .ph-button { flex: 1; }
        .ph-inline-note {
          display: flex; align-items: flex-start; gap: 7px; margin-top: 10px;
          padding: 8px 9px; border: 1px solid #dfe6e2; border-radius: 3px;
          background: #f6f8f6; color: #718084; font-size: 8px; line-height: 1.5;
        }
        .ph-inline-note svg { flex: 0 0 auto; margin-top: 1px; color: #788d89; }
        .ph-correction-form { margin-top: 10px; padding: 10px; border: 1px solid #e5d3cf; background: #fcf6f4; }
        .ph-correction-form label { display: block; margin-bottom: 5px; color: #78554f; font-size: 9px; font-weight: 700; }
        .ph-correction-form textarea {
          display: block; width: 100%; min-height: 68px; resize: vertical; padding: 8px;
          border: 1px solid #d9c6c1; border-radius: 3px; background: #fffefa;
          color: #493c39; font-size: 9px; line-height: 1.45;
        }
        .ph-form-actions { display: flex; justify-content: flex-end; gap: 7px; margin-top: 8px; }
        .ph-form-actions .ph-button { min-height: 30px; }
        .ph-frozen {
          display: flex; align-items: flex-start; gap: 8px; padding: 10px;
          border: 1px solid #dfe5e2; border-radius: 3px; background: #f7f9f7;
          color: #65777b; font-size: 9px; line-height: 1.5;
        }
        .ph-frozen svg { flex: 0 0 auto; margin-top: 1px; color: #6d8880; }
        .ph-po-empty {
          padding: 13px; border: 1px dashed #cdd8d3; border-radius: 3px;
          background: #fafbf9; text-align: center;
        }
        .ph-po-empty svg { color: #738a83; }
        .ph-po-empty h3 { margin: 5px 0 3px; color: #3f585e; font-size: 10px; }
        .ph-po-empty p { margin: 0; color: #7d8c8e; font-size: 9px; line-height: 1.5; }
        .ph-disclaimer {
          margin-top: 12px; padding: 10px 12px; border: 1px solid #e0e5e2; border-radius: 3px;
          background: #f8faf8; color: #7b898d; font-size: 9px; line-height: 1.55;
        }
        .ph-disclaimer strong { color: #53696d; }
        .ph-footer {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          margin-top: 15px; padding-top: 10px; border-top: 1px solid var(--ph-line);
          color: #899598; font-size: 8px;
        }
        .ph-reset {
          display: inline-flex; align-items: center; gap: 5px; padding: 4px 0;
          border: 0; background: transparent; color: #627a79; font-size: 8px;
          text-decoration: underline; text-underline-offset: 2px;
        }
        @media (max-width: 900px) {
          .ph-layout { grid-template-columns: 1fr; }
          .ph-side-column { grid-template-columns: 1fr 1fr; align-items: start; }
        }
        @media (max-width: 650px) {
          .ph-topbar { align-items: flex-start; }
          .ph-preview-tag { font-size: 7px; padding: 6px; }
          .ph-nav { overflow-x: auto; }
          .ph-nav span { padding: 0 9px; font-size: 8px; }
          .ph-page { padding-top: 15px; }
          .ph-banner, .ph-title-row { align-items: flex-start; flex-direction: column; }
          .ph-role-box { width: 100%; justify-content: space-between; }
          .ph-role-switch { max-width: 100%; }
          .ph-role-switch button { padding: 0 7px; }
          .ph-class-row { grid-template-columns: minmax(100px, 1fr) minmax(66px, .7fr) minmax(100px, 1fr); gap: 5px; font-size: 8px; }
          .ph-side-column { grid-template-columns: 1fr; }
          .ph-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .ph-po-grid { grid-template-columns: 1fr; }
          .ph-timeline { grid-template-columns: 1fr; gap: 0; }
          .ph-stage {
            display: grid; grid-template-columns: 24px minmax(0, 1fr);
            column-gap: 8px; min-height: 48px; padding: 0; text-align: left;
          }
          .ph-stage:not(:last-child)::after {
            top: 21px; left: 10px; width: 2px; height: calc(100% - 14px);
          }
          .ph-stage-dot { grid-row: 1 / span 2; margin: 0; }
          .ph-stage-title { padding-top: 2px; }
          .ph-stage-detail { margin: 2px 0 8px; }
          .ph-branch { grid-template-columns: 1fr; gap: 7px; }
          .ph-branch-track { flex-wrap: wrap; }
          .ph-footer { align-items: flex-start; flex-direction: column; }
        }
        @media (max-width: 400px) {
          .ph-brand-name { font-size: 12px; }
          .ph-brand-sub { font-size: 7px; }
          .ph-role-label { display: none; }
          .ph-role-box { justify-content: flex-end; }
          .ph-packet-top { flex-direction: column; }
          .ph-facts { gap: 10px; padding-right: 12px; padding-left: 12px; }
          .ph-workflow { padding-right: 12px; padding-left: 12px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ph-preview *, .ph-preview *::before, .ph-preview *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; }
        }
      `}</style>

      <header className="ph-topbar">
        <div className="ph-brand">
          <span className="ph-brand-mark" aria-hidden="true"><ShieldCheck size={19} /></span>
          <div>
            <div className="ph-brand-name">Columbus Division of Police</div>
            <div className="ph-brand-sub">Field Training Officer Portal</div>
          </div>
        </div>
        <div className="ph-preview-tag"><i aria-hidden="true" /> Isolated preview · synthetic data</div>
      </header>
      <nav className="ph-nav" aria-label="Portal preview navigation">
        <span>Home</span><span>Daily Reports</span><span>Training Records</span><span>Packet Handoff</span>
      </nav>

      <div className="ph-page">
        <div className="ph-banner">
          <span><strong>Static preview</strong> · All names, packet details, timestamps, and actions on this screen are fictional and local to this preview.</span>
          <span>No API · no sign-in · no operational records</span>
        </div>
        <div className="ph-crumb"><span>Training records</span><ChevronRight size={11} /><span>Packet submissions</span><ChevronRight size={11} /><span>Handoff review</span></div>

        <div className="ph-title-row">
          <div>
            <p className="ph-eyebrow">Packet workflow</p>
            <h1>Packet approval and PO handoff</h1>
            <p>The PO sees their own unacceptable-rating details and period counts. Non-PO staff see read-only packets for classes assigned to their verified account; actions stay role-limited.</p>
          </div>
          <div className="ph-role-box">
            <span className="ph-role-label">Preview role</span>
            <div className="ph-role-switch" role="group" aria-label="Choose preview role">
              {PREVIEW_ROLES.map((option) => (
                <button key={option} type="button" aria-pressed={role === option} onClick={() => changePreviewRole(option)}>
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="ph-state-banner" role="status" aria-live="polite">
          <CheckCircle2 size={15} />
          <span><strong>Local preview state:</strong> {notice}</span>
        </div>

        <div className="ph-layout">
          <div className="ph-main-column">
            {role !== "PO" && (
              <section className="ph-panel" aria-labelledby="ph-class-list-heading">
                <div className="ph-class-list">
                  <div className="ph-class-list-head">
                    <h2 id="ph-class-list-heading">Authorized class packet access</h2>
                    <span>Read-only · assigned classes</span>
                  </div>
                  <div className="ph-class-row header"><span>Probationary officer</span><span>Latest packet</span><span>Workflow status</span></div>
                  {!coordinatorGate && <div className="ph-class-row selected"><span>Jordan Ellis · 48271</span><span>Nov 24, 2026</span><span className="ph-class-status">Awaiting PO review</span></div>}
                  <div className="ph-class-row"><span>Riley Chen · 48308</span><span>Nov 24, 2026</span><span className="ph-class-status">Coordinator review</span></div>
                  <div className="ph-class-row"><span>Casey Morgan · 48422</span><span>Nov 23, 2026</span><span className="ph-class-status">Released to PO</span></div>
                  <p className="ph-class-list-note">{coordinatorGate
                    ? "Only PO-reviewed packets appear in Coordinator class access and the review queue."
                    : "Names and records are synthetic. Only classes assigned to the verified staff account appear here."}</p>
                </div>
              </section>
            )}
            {coordinatorGate ? (
              <section className="ph-panel ph-po-empty" aria-label="Coordinator inbox status">
                <LockKeyhole size={17} />
                <h3>No packet in the Coordinator inbox</h3>
                <p>A packet is routed only after its PO reviews their own UA details and daily, weekly, and monthly counts.</p>
              </section>
            ) : <>
            <section className="ph-panel" aria-labelledby="ph-packet-heading">
              <div className="ph-packet-head">
                <div className="ph-packet-top">
                  <div>
                    <p className="ph-eyebrow">Synthetic packet · role-scoped example</p>
                    <h2 className="ph-packet-title" id="ph-packet-heading">{role === "PO" ? "Your training period" : "Class packets · Daily Performance Log"}</h2>
                    {role !== "PO" && <p className="ph-packet-sub">PX-26-1124-02 · source record DPL-2026-1124-06 · immutable snapshot v{version}</p>}
                  </div>
                  <span className={`ph-status ${status}`}><Clock3 size={11} />{status === "po_acknowledged" ? "PO receipt recorded" : status === "correction_requested" ? "Correction requested" : status === "complete" ? "COMPLETE · pending release" : status === "awaiting_po_totals_review" ? "Awaiting PO review" : status === "awaiting_coordinator_receipt" ? "Awaiting Coordinator receipt" : status === "coordinator_review" ? "Coordinator review" : status === "released" ? "Released · own UA + counts" : "Submitted"}</span>
                </div>
              </div>
              {role !== "PO" && <div className="ph-facts">
                <div className="ph-fact"><small>Probationary officer</small><strong>Jordan Ellis · 48271</strong></div>
                <div className="ph-fact"><small>Field training officer</small><strong>Elena Martinez · 31764</strong></div>
                <div className="ph-fact"><small>Assigned coordinator</small><strong>Dana Brooks · 20618</strong></div>
                <div className="ph-fact"><small>Record date · phase</small><strong>Nov 24, 2026 · Phase 2</strong></div>
              </div>}
            </section>

            {role === "PO" && visibleToPo && (
              <section className="ph-panel" aria-labelledby="ph-po-totals-heading">
                <div className="ph-panel-head">
                  <h2 id="ph-po-totals-heading">Your counts and UA details</h2>
                  <span className="ph-panel-kicker">Own records only</span>
                </div>
                <div className="ph-po-totals">
                  <p className="ph-po-totals-intro">These summaries include only your daily, weekly, and monthly counts. Below are your unacceptable category ratings and their recorded justifications; narratives and run details remain hidden.</p>
                  <div className="ph-po-grid">
                    {[
                      { title: "Daily · Nov 24", range: "One daily log", activity: 15, reports: 7, traffic: 4, process: 4, ratings: [2, 22, 4, 2, 0], checks: "4 / 5" },
                      { title: "Weekly · Nov 22–28", range: "Sunday–Saturday", activity: 63, reports: 29, traffic: 18, process: 16, ratings: [8, 96, 19, 7, 0], checks: "16 / 18" },
                      { title: "Monthly · November", range: "Calendar month", activity: 214, reports: 97, traffic: 62, process: 55, ratings: [31, 318, 64, 22, 1], checks: "55 / 61" },
                    ].map((period) => (
                      <article className="ph-total-card" key={period.title}>
                        <h3>{period.title}</h3>
                        <small>{period.range}</small>
                        <strong className="ph-total-number">{period.activity}</strong>
                        <small>Activity total</small>
                        <div className="ph-total-row"><span>Reports</span><strong>{period.reports}</strong></div>
                        <div className="ph-total-row"><span>Traffic activity</span><strong>{period.traffic}</strong></div>
                        <div className="ph-total-row"><span>Arrest / processing</span><strong>{period.process}</strong></div>
                        <div className="ph-rating-label">Rating counts</div>
                        <div className="ph-rating-strip" aria-label="Aggregate rating counts by code">
                          {["NO", "A", "RT", "UA", "NRT"].map((code, index) => <span key={code}>{code}<b>{period.ratings[index]}</b></span>)}
                        </div>
                        <div className="ph-total-row"><span>Reviewed run checklists</span><strong>{period.checks}</strong></div>
                      </article>
                    ))}
                  </div>
                  <div className="ph-ua-list" aria-label="Your unacceptable ratings">
                    <h3>Your unacceptable ratings</h3>
                    <article className="ph-ua-item">
                      <strong>Nov 24 · Building Search</strong><span>UA</span>
                      <p>Entered before the designated cover position was established. FTO guidance was provided; the PO reviewed the explanation.</p>
                    </article>
                    <article className="ph-ua-item">
                      <strong>Nov 23 · Report/Prepared for Duty</strong><span>UA</span>
                      <p>Required equipment check was incomplete at roll call. The FTO reviewed the deficiency with the PO.</p>
                    </article>
                  </div>
                  {status === "awaiting_po_totals_review" && (
                    <div className="ph-po-review-box">
                      <p>Review your UA details and daily, weekly, and monthly counts before the packet can route to the Coordinator.</p>
                      <button type="button" className="ph-button primary" onClick={reviewPoTotals}><CheckCircle2 size={13} />Confirm review complete</button>
                    </div>
                  )}
                  {(status === "released" || status === "po_acknowledged") && (
                    <div className="ph-po-reviewed"><ShieldCheck size={13} /><span>Coordinator release is recorded. The PO view continues to show only its own UA details and period counts.</span></div>
                  )}
                </div>
              </section>
            )}

            <section className="ph-panel" aria-labelledby="ph-flow-heading">
              <div className="ph-panel-head">
                <h2 id="ph-flow-heading">Server-authoritative progression</h2>
                <span className="ph-panel-kicker">Current snapshot · v{version}</span>
              </div>
              <div className="ph-workflow">
                <div className="ph-workflow-intro">
                  <div>
                    <h3>One snapshot · seven distinct milestones</h3>
                    <p>PO review of own UA details and period counts comes before Coordinator routing; approval and release remain separate.</p>
                  </div>
                  <span className="ph-version-tag">Snapshot v{version}</span>
                </div>

                {!isCorrection ? (
                  <div className="ph-timeline" aria-label="Packet workflow timeline">
                    {stages.map((stage, index) => {
                      const complete = activeStage > index;
                      const current = activeStage === index;
                      return (
                        <div className={`ph-stage ${complete ? "done" : ""} ${current ? "current" : ""}`} key={stage.title}>
                          <span className="ph-stage-dot">{complete ? <Check size={12} /> : current ? <Clock3 size={11} /> : <span className="ph-dot-number">{index + 1}</span>}</span>
                          <span className={`ph-stage-title ${index === 2 ? "complete-label" : ""}`}>{stage.title}</span>
                          <span className="ph-stage-detail">{stage.detail}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="ph-frozen">
                    <History size={14} />
                    <span>Snapshot v{version} is in correction. The prior version is preserved below; a replacement starts with <strong>PO review</strong>.</span>
                  </div>
                )}

                {status === "awaiting_po_totals_review" && (
                  <div className="ph-complete-callout">
                    <LockKeyhole size={14} />
                    <span><strong>Coordinator routing is blocked.</strong> The PO must first review their UA details and daily, weekly, and monthly counts; full report details remain hidden.</span>
                  </div>
                )}
                {status === "awaiting_coordinator_receipt" && (
                  <div className="ph-complete-callout">
                    <CheckCircle2 size={14} />
                    <span><strong>PO review is recorded.</strong> The snapshot is now available in the assigned Coordinator inbox for receipt acknowledgment and review.</span>
                  </div>
                )}
                {status === "complete" && (
                  <div className="ph-complete-callout">
                    <CheckCircle2 size={14} />
                    <span><strong>COMPLETE means Coordinator approval only.</strong> The Coordinator must separately release this snapshot before the PO can again see their UA details and period counts.</span>
                  </div>
                )}
                {status === "released" && (
                  <div className="ph-complete-callout">
                    <Send size={14} />
                    <span><strong>Released to PO.</strong> The server-authoritative release has occurred; the PO can view their own UA details and period counts and acknowledge receipt. Full report content remains hidden.</span>
                  </div>
                )}

                <div className="ph-branch" aria-label="Separate correction and resubmission branch">
                  <span className="ph-branch-label"><RotateCcw size={12} /> Correction branch</span>
                  <div className="ph-branch-track">
                    <span className={`ph-branch-step ${status === "correction_requested" ? "active" : ""}`}>Correction requested</span>
                    <ArrowRight className="ph-branch-arrow" size={12} />
                    <span className="ph-branch-step">Prior snapshot preserved</span>
                    <ArrowRight className="ph-branch-arrow" size={12} />
                    <span className={`ph-branch-step ${status === "awaiting_po_totals_review" && version > 1 ? "active" : ""}`}>Resubmit new version</span>
                    <ArrowRight className="ph-branch-arrow" size={12} />
                    <span className="ph-branch-step">Fresh receipt + approval</span>
                  </div>
                </div>

                {history.length > 0 && (
                  <div className="ph-history">
                    <div className="ph-history-head"><History size={13} /> Preserved snapshot history</div>
                    {history.map((item) => (
                      <div className="ph-history-item" key={`${item.version}-${item.reason}`}>
                        <strong>v{item.version} · {historyLabel(item.status)} · retained</strong>
                        <span>Prior snapshot content remains unchanged; correction note: “{item.reason}”</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
            </>}
          </div>

          <div className="ph-side-column">
            <section className="ph-panel" aria-labelledby="ph-action-heading">
              <div className="ph-panel-head">
                    <h2 id="ph-action-heading">{role === "Coordinator" ? "Coordinator review" : role === "FTO" ? "FTO packet status" : role === "PO" ? "PO own-record view" : "Staff class access"}</h2>
                <span className="ph-panel-kicker">Local actions only</span>
              </div>
              <div className="ph-side-body">
                {role === "Coordinator" && (
                  <>
                    <div className="ph-actor">
                      <span className="ph-actor-icon"><UserRound size={16} /></span>
                      <div><small>Assigned coordinator</small><strong>Dana Brooks · synthetic preview identity</strong></div>
                    </div>
                    <h3 className="ph-action-title">{status === "awaiting_po_totals_review" ? "Not yet in the Coordinator inbox" : status === "awaiting_coordinator_receipt" ? "PO review recorded · receipt pending" : status === "coordinator_review" ? "Receipt acknowledged · review pending" : status === "complete" ? "Approval complete · release pending" : status === "released" || status === "po_acknowledged" ? "Released to PO · own UA + counts" : status === "correction_requested" ? "Waiting for corrected resubmission" : "Review the submitted snapshot"}</h3>
                    <p className="ph-action-copy">
                      {status === "awaiting_po_totals_review" ? "Packets appear in your queue only after their PO reviews the required UA details and period counts." :
                        status === "awaiting_coordinator_receipt" ? "The PO has reviewed totals. Acknowledge receipt before reviewing and approving the fixed snapshot." :
                          status === "coordinator_review" ? "Receipt is acknowledged. Review the fixed snapshot, then approve to mark it COMPLETE." :
                            status === "complete" ? "Approval marks this snapshot COMPLETE. Release is separate; the PO will receive only their own UA details and period counts." :
                            status === "correction_requested" ? "The FTO must submit a corrected new snapshot. The preserved prior snapshot cannot be edited or reused." :
                              "The PO can review their own UA details and period counts after release, then acknowledge receipt. Other report details remain hidden."}
                    </p>
                    <div className="ph-actions">
                      {status === "awaiting_po_totals_review" && <div className="ph-frozen"><LockKeyhole size={14} />No packet is shown or actionable before the PO review gate is complete.</div>}
                      {status === "awaiting_coordinator_receipt" && <button type="button" className="ph-button primary" onClick={acknowledgeReceipt}><CheckCircle2 size={13} />Acknowledge Coordinator receipt</button>}
                      {status === "coordinator_review" && <button type="button" className="ph-button primary" onClick={approvePacket}><FileCheck2 size={13} />Approve snapshot · mark COMPLETE</button>}
                      {status === "complete" && <button type="button" className="ph-button primary" onClick={releasePacket}><Send size={13} />Release to PO</button>}
                      {(status === "awaiting_coordinator_receipt" || status === "coordinator_review" || status === "complete") && (
                        <button type="button" className="ph-button subtle-danger" onClick={() => setCorrectionOpen((open) => !open)} aria-expanded={correctionOpen}>
                          <RotateCcw size={13} />Return for correction
                        </button>
                      )}
                      {(status === "released" || status === "po_acknowledged") && (
                          <div className="ph-frozen"><CheckCircle2 size={14} />Released snapshot is now visible to its PO. Only their UA details and period counts are exposed.</div>
                      )}
                      {status === "correction_requested" && <div className="ph-frozen"><Clock3 size={14} />Coordinator review is paused until the FTO submits a new corrected snapshot.</div>}
                    </div>
                    {correctionOpen && (
                      <div className="ph-correction-form">
                        <label htmlFor="ph-correction-reason">Correction reason · required</label>
                        <textarea id="ph-correction-reason" value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} placeholder="Describe the changes needed before resubmission." />
                        <div className="ph-form-actions">
                          <button type="button" className="ph-button" onClick={() => setCorrectionOpen(false)}>Cancel</button>
                          <button type="button" className="ph-button subtle-danger" disabled={!correctionReason.trim()} onClick={requestCorrection}>Request correction</button>
                        </div>
                      </div>
                    )}
                    {status === "complete" && (
                      <div className="ph-inline-note"><LockKeyhole size={13} /><span><strong>Post-release access: own UA details and counts only.</strong> The PO cannot read full report details or another PO’s records.</span></div>
                    )}
                    <div className="ph-inline-note"><ShieldCheck size={13} /><span>Preview controls illustrate the handoff sequence; no operation is sent to an agency server.</span></div>
                  </>
                )}

                {role === "FTO" && (
                  <>
                    <div className="ph-actor">
                      <span className="ph-actor-icon"><UserRound size={16} /></span>
                      <div><small>Submitting FTO</small><strong>Elena Martinez · synthetic preview identity</strong></div>
                    </div>
                    {status === "correction_requested" ? (
                      <>
                        <h3 className="ph-action-title">Correct and resubmit</h3>
                        <p className="ph-action-copy">Submit a new snapshot version. The prior version remains preserved; the replacement needs fresh PO review and Coordinator review.</p>
                        <div className="ph-inline-note"><AlertTriangle size={13} /><span>Correction note from Coordinator: “{history[history.length - 1]?.reason ?? "Review the requested correction."}”</span></div>
                        <div className="ph-actions" style={{ marginTop: 9 }}>
                          <button type="button" className="ph-button primary" onClick={resubmitCorrection}><Send size={13} />Submit corrected snapshot v{version + 1}</button>
                        </div>
                      </>
                    ) : (
                      <div className="ph-frozen"><FileText size={14} /><span>Read-only status view. Current packet version v{version} is <strong>{status.replaceAll("_", " ")}</strong>. Coordinator controls receipt, approval, release, and correction routing.</span></div>
                    )}
                    {history.length > 0 && <div className="ph-inline-note"><History size={13} /><span>Prior snapshot v{history[history.length - 1].version} is retained; resubmission does not overwrite it.</span></div>}
                  </>
                )}

                {!["Coordinator", "FTO", "PO"].includes(role) && (
                  <>
                    <div className="ph-actor">
                      <span className="ph-actor-icon"><UserRound size={16} /></span>
                      <div><small>Read-only class view</small><strong>{role} · synthetic preview role</strong></div>
                    </div>
                    <h3 className="ph-action-title">Class packets available</h3>
                    <p className="ph-action-copy">This non-PO role can read records for its assigned classes. Submission, PO review, approval, release, correction, and acknowledgment actions remain restricted to their assigned roles.</p>
                    <div className="ph-inline-note"><ShieldCheck size={13} /><span>Class-wide reads do not grant submit, review, approval, release, correction, or acknowledgment actions.</span></div>
                  </>
                )}

                {role === "PO" && (
                  <>
                    <div className="ph-actor">
                      <span className="ph-actor-icon"><UserRound size={16} /></span>
                      <div><small>PO view</small><strong>Jordan Ellis · synthetic preview identity</strong></div>
                    </div>
                    {visibleToPo ? (
                      <>
                        <h3 className="ph-action-title">{status === "awaiting_po_totals_review" ? "Review your records" : status === "po_acknowledged" ? "Receipt acknowledged" : "Released · own records only"}</h3>
                        <p className="ph-action-copy">{status === "awaiting_po_totals_review"
                          ? "Review your unacceptable ratings and daily, weekly, and monthly counts before this packet can route to the Coordinator."
                          : "Your UA details and period counts are available; full report content and other POs’ records stay restricted."}</p>
                        {status === "released" && (
                          <div className="ph-actions">
                            <button type="button" className="ph-button primary" onClick={acknowledgePoReceipt}><CheckCircle2 size={13} />Acknowledge totals receipt</button>
                          </div>
                        )}
                        {status === "po_acknowledged" && <div className="ph-frozen"><CheckCircle2 size={14} />Receipt recorded for your own UA details and period counts.</div>}
                      </>
                    ) : (
                      <div className="ph-po-empty">
                        <LockKeyhole size={18} />
                        <h3>Waiting for Coordinator release</h3>
                        <p>Totals review is recorded. The PO’s totals view returns after the approved snapshot is released.</p>
                      </div>
                    )}
                    <div className="ph-inline-note"><ShieldCheck size={13} /><span>Only this PO’s records are available here. The display excludes full report details, run data, and every other PO’s information.</span></div>
                  </>
                )}
              </div>
            </section>

            <section className="ph-panel" aria-labelledby="ph-meaning-heading">
              <div className="ph-panel-head">
                <h2 id="ph-meaning-heading">What receipt means</h2>
                <span className="ph-panel-kicker">Recordkeeping note</span>
              </div>
              <div className="ph-side-body">
                <div className="ph-frozen">
                  <ArrowDown size={14} />
                  <span><strong>Coordinator receipt</strong> confirms the submitted snapshot reached the review queue. Approval still follows separately.</span>
                </div>
                <div className="ph-frozen" style={{ marginTop: 7 }}>
                  <CheckCircle2 size={14} />
                  <span><strong>PO acknowledgment</strong> confirms receipt and review only. It is not agreement with the contents and is not an electronic signature.</span>
                </div>
                <p className="ph-disclaimer"><strong>Weekly signature workflow remains separate.</strong> PO packet review and receipt do not replace, satisfy, or alter that workflow.</p>
              </div>
            </section>
          </div>
        </div>

        <footer className="ph-footer">
          <span>Isolated preview · synthetic names and sample data · interactions change local preview state only</span>
          <button type="button" className="ph-reset" onClick={resetPreview}><RotateCcw size={11} />Reset to PO review</button>
        </footer>
      </div>
    </main>
  );
}
