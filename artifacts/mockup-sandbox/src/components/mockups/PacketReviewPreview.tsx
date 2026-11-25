import { useMemo, useState } from "react";
import {
  AlertCircle,
  Archive,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileCheck2,
  FileText,
  LockKeyhole,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";

type Evaluation = {
  number: number;
  category: string;
  rating: "NO" | "A" | "RT" | "UA" | "NRT";
  note: string;
};
type Packet = {
  id: string;
  serverState: "Committed · coordinator review" | "Released to PO" | "Withdrawn · permanently closed";
  created: string;
  reviewed: boolean;
  poConfirmed: boolean;
  acknowledged: boolean;
  comment: string;
  correctionReason: string;
};

// Display labels are copied from the portal's SEG_CATEGORIES / CATEGORY_LABEL
// metadata as a reference. Keep this mockup isolated from the portal artifact.
const ratingLabels: Record<Evaluation["rating"], string> = {
  NO: "Not Observed",
  A: "Acceptable",
  RT: "Responding to Training",
  UA: "Unacceptable",
  NRT: "Not Responding to Training",
};
const evaluations: Evaluation[] = [
  { number: 1, category: "Report/Prepared for Duty", rating: "A", note: "Arrived prepared for duty and participated in roll call and equipment checks." },
  { number: 2, category: "Comprehension/Usage", rating: "A", note: "Used assigned radio and computer systems clearly during calls." },
  { number: 3, category: "Public/Police Interaction", rating: "A", note: "Communicated respectfully with community members and partner officers." },
  { number: 4, category: "Feedback Acceptance", rating: "A", note: "Applied coaching on documenting the next investigative step." },
  { number: 5, category: "Precinct Orientation", rating: "A", note: "Navigated the assigned zone and identified key locations." },
  { number: 6, category: "Routine", rating: "A", note: "Operated the vehicle safely during routine patrol conditions." },
  { number: 7, category: "EVO", rating: "NO", note: "No emergency vehicle operation was observed this shift." },
  { number: 8, category: "Policies/Procedures", rating: "A", note: "Followed required notification and documentation procedures." },
  { number: 9, category: "Criminal / Traffic Offenses", rating: "A", note: "Identified the applicable traffic offense during a call." },
  { number: 10, category: "Arrest, Search, Seizure", rating: "A", note: "Applied relevant legal standards to the observed report and follow-up." },
  { number: 11, category: "Information Gathering", rating: "A", note: "Collected and organized the material facts for the theft report." },
  { number: 12, category: "Resource/Equipment Usage", rating: "A", note: "Used available records and assigned equipment appropriately." },
  { number: 13, category: "Form Usage", rating: "A", note: "Selected the appropriate report form for the incident." },
  { number: 14, category: "Grammar/Legibility", rating: "A", note: "Draft was legible and used clear, complete sentences." },
  { number: 15, category: "Content Accuracy", rating: "A", note: "Report details were consistent with the information gathered." },
  { number: 16, category: "Completion Time", rating: "A", note: "Completed documentation within a reasonable time for the call load." },
  { number: 17, category: "Response to Enforcement", rating: "A", note: "Recognized an enforcement opportunity and selected a proportionate response." },
  { number: 18, category: "Threat Assessment", rating: "A", note: "Maintained awareness of people and surroundings during contacts." },
  { number: 19, category: "Initiating Arrests", rating: "NO", note: "No arrest initiation was observed this shift." },
  { number: 20, category: "Handling Prisoners", rating: "NO", note: "No prisoner handling or transport was observed this shift." },
  { number: 21, category: "Vehicle Stops", rating: "NO", note: "No vehicle stop was observed this shift." },
  { number: 22, category: "Run Approach", rating: "A", note: "Approached call locations with appropriate awareness and communication." },
  { number: 23, category: "Building Search", rating: "NO", note: "No building search was conducted this shift." },
  { number: 24, category: "Pat Down/Searches", rating: "NO", note: "No pat down or search was observed this shift." },
  { number: 25, category: "Low Stress Situations", rating: "A", note: "Handled routine calls with sound judgment and follow-through." },
  { number: 26, category: "High Stress Situations", rating: "NO", note: "No moderate- or high-stress situation was observed this shift." },
  { number: 27, category: "Arrest Situations", rating: "NO", note: "No arrest decision was required this shift." },
  { number: 28, category: "Problem Solving", rating: "A", note: "Considered practical next steps and followed through on feedback." },
  { number: 29, category: "Motivational Traits", rating: "A", note: "Engaged in calls and completed patrol responsibilities." },
  { number: 30, category: "Task Management", rating: "A", note: "Balanced calls, follow-up, and report completion safely." },
];

const snapshot = {
  header: {
    recordType: "Daily Performance Log",
    sourceRecord: "DPL-2025-0417-06",
    date: "April 17, 2025",
    shift: "Day watch · 0700–1700",
    phase: "Phase 2 · Directed patrol",
    precinct: "Precinct 4",
    zone: "Zone 4B",
    cruiserDistrict: "C-412",
    assignment: "FTO Elena Martinez",
    probationaryOfficer: "PO Jordan Ellis",
    badge: "48271",
  },
  duty: [
    ["Roll call", "07:00–07:18", "Briefing and equipment check"],
    ["Directed patrol", "07:18–11:42", "Zone 4B"],
    ["Meal / report time", "11:42–12:30", "Precinct 4"],
    ["Calls and follow-up", "12:30–16:35", "Zone 4B"],
    ["End-of-shift review", "16:35–17:00", "Precinct 4"],
  ],
  runs: [
    { time: "08:16", call: "Residential alarm", disposition: "False alarm; premises checked", location: "Sample address · Zone 4B" },
    { time: "10:04", call: "Traffic complaint", disposition: "Driver contacted; verbal warning", location: "Sample intersection · Zone 4B" },
    { time: "13:27", call: "Theft report", disposition: "Initial report completed; follow-up assigned", location: "Sample business · Zone 4B" },
    { time: "15:11", call: "Wellness check", disposition: "Contact made; no further action requested", location: "Sample address · Zone 4B" },
  ],
  activity: [
    ["Traffic stops", 3], ["Citations", 1], ["Warnings", 2], ["Field interviews", 2],
    ["Arrests", 0], ["Reports", 2], ["Assists", 1], ["Community contacts", 4],
  ],
  narrative: "Jordan handled a varied day-watch call load with steady communication and good attention to scene details. On the theft report, Jordan gathered the initial account, checked available information, and completed a clear first draft. We discussed documenting the next investigative step before clearing the call. Jordan accepted the feedback and updated the follow-up plan. Continue building confidence with independent call prioritization.",
  recruitComments: "The report review helped me see where to make the next step clearer. I will use that structure on the next follow-up.",
  ftoComments: "Good progress this shift. Keep practicing concise radio updates when call information changes.",
};

const initialPacket: Packet = {
  id: "AG-25-0417-02",
  serverState: "Committed · coordinator review",
  created: "Apr 18, 2025 · 08:42",
  reviewed: false,
  poConfirmed: false,
  acknowledged: false,
  comment: "",
  correctionReason: "",
};

const badgeClass = (state: Packet["serverState"]) =>
  state.startsWith("Released") ? "pr-status released" : state.startsWith("Withdrawn") ? "pr-status withdrawn" : "pr-status committed";

export default function PacketReviewPreview() {
  const [role, setRole] = useState<"Coordinator" | "Probationary officer">("Coordinator");
  const [packets, setPackets] = useState<Packet[]>([initialPacket]);
  const [selectedId, setSelectedId] = useState(initialPacket.id);
  const [showRaw, setShowRaw] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");
  const [refreshedAt, setRefreshedAt] = useState("08:42");

  const visiblePackets = useMemo(() => packets.filter((packet) =>
    role === "Coordinator"
      ? true
      : packet.serverState === "Released to PO",
  ), [packets, role]);
  const selected = visiblePackets.find((packet) => packet.id === selectedId) ?? visiblePackets[0] ?? null;
  const patchPacket = (id: string, updates: Partial<Packet>) =>
    setPackets((current) => current.map((packet) => packet.id === id ? { ...packet, ...updates } : packet));
  const refresh = () => {
    setUnavailable(false);
    setRefreshMessage("Preview list refreshed. No agency service was contacted.");
    setRefreshedAt("08:43");
  };
  const createReplacement = () => {
    const replacement: Packet = {
      id: `AG-25-0417-${String(packets.length + 2).padStart(2, "0")}`,
      serverState: "Committed · coordinator review",
      created: "Apr 18, 2025 · just now",
      reviewed: false,
      poConfirmed: false,
      acknowledged: false,
      comment: "",
      correctionReason: "",
    };
    setPackets((current) => [...current, replacement]);
    setSelectedId(replacement.id);
    setShowWithdraw(false);
    setWithdrawReason("");
    setRole("Coordinator");
    setRefreshMessage("Replacement packet created in this local preview. Coordinator review is required again.");
  };
  const releasePacket = () => {
    if (!selected?.reviewed) return;
    patchPacket(selected.id, { serverState: "Released to PO" });
    setRefreshMessage("Packet released to Jordan Ellis in this local preview.");
  };
  const withdrawPacket = () => {
    if (!selected || !withdrawReason.trim()) return;
    patchPacket(selected.id, {
      serverState: "Withdrawn · permanently closed",
      correctionReason: withdrawReason.trim(),
    });
    setShowWithdraw(false);
    setWithdrawReason("");
    setRefreshMessage("Packet withdrawn and permanently closed. Create a new packet for corrections.");
  };
  const acknowledge = () => {
    if (!selected) return;
    patchPacket(selected.id, { acknowledged: true });
    setRefreshMessage("Review receipt recorded in this local preview.");
  };

  return (
    <main className="packet-preview">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap');
        .packet-preview{--navy:#203744;--navy2:#2e4d59;--ink:#263943;--muted:#718087;--line:#dce4e2;--paper:#f3f6f4;--surface:#fffefa;--sage:#477d70;--sage-soft:#e7f0eb;--gold:#b18448;--gold-soft:#f5efe3;min-height:100dvh;background:var(--paper);color:var(--ink);font:14px 'DM Sans',sans-serif}
        .packet-preview *{box-sizing:border-box}.packet-preview button,.packet-preview input,.packet-preview textarea{font:inherit}.packet-preview button{cursor:pointer}
        .pr-top{height:66px;background:var(--navy);color:#f5f7f4;padding:0 clamp(16px,4vw,52px);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #ffffff1b}
        .pr-brand{display:flex;align-items:center;gap:12px}.pr-mark{width:34px;height:34px;border:1px solid #8ba69c;border-radius:6px;color:#bfd1c8;display:grid;place-items:center}.pr-brand-title{font:700 12px Manrope,sans-serif;letter-spacing:.07em}.pr-brand-sub{font:9px 'DM Mono',monospace;color:#b5c5c2;letter-spacing:.1em;margin-top:3px}
        .pr-top-right{display:flex;align-items:center;gap:15px}.pr-preview-flag{display:flex;align-items:center;gap:7px;padding:7px 9px;border:1px solid #ffffff32;border-radius:4px;color:#d8e2dc;font:9px 'DM Mono',monospace;letter-spacing:.09em}.pr-preview-flag i{height:6px;width:6px;background:#c9aa70;border-radius:50%}.pr-role-toggle{display:flex;padding:3px;background:#142d38;border:1px solid #ffffff25;border-radius:5px}.pr-role-toggle button{border:0;border-radius:3px;background:transparent;color:#c0ceca;padding:7px 10px;font-size:10px;white-space:nowrap}.pr-role-toggle button.active{background:#e9eee9;color:var(--navy);font-weight:700}
        .pr-page{max-width:1420px;margin:0 auto;padding:27px clamp(16px,4vw,52px) 54px}.pr-crumb{display:flex;align-items:center;gap:7px;color:#819096;font:10px 'DM Mono',monospace;letter-spacing:.05em;margin-bottom:19px}.pr-title-row{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:23px}.pr-title-row h1{font:800 clamp(26px,3.2vw,35px)/1.12 Manrope,sans-serif;letter-spacing:-.045em;color:var(--navy);margin:0}.pr-title-row p{color:var(--muted);font-size:12px;margin:8px 0 0}.pr-refresh{height:36px;display:inline-flex;align-items:center;gap:8px;padding:0 12px;border:1px solid var(--line);border-radius:4px;background:var(--surface);color:#53666d;font-size:11px}.pr-refresh:hover{background:#f8faf8}.pr-refresh-note{font:9px 'DM Mono',monospace;color:#899698;margin-top:6px;text-align:right}
        .pr-preview-note{display:flex;align-items:flex-start;gap:10px;padding:11px 13px;border:1px solid #d7e2dd;background:#eaf1ed;border-radius:5px;color:#526c68;font-size:10px;line-height:1.55;margin-bottom:19px}.pr-preview-note svg{flex:none;color:#62857a;margin-top:1px}
        .pr-columns{display:grid;grid-template-columns:minmax(275px,340px) minmax(0,1fr);gap:17px;align-items:start}.pr-list,.pr-detail{border:1px solid var(--line);border-radius:7px;background:var(--surface);box-shadow:0 4px 14px #223d3a08;overflow:hidden}
        .pr-list-head{padding:15px 17px 13px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between}.pr-list-head h2{font:700 13px Manrope,sans-serif;color:var(--navy);margin:0}.pr-list-count{font:9px 'DM Mono',monospace;color:#829095;letter-spacing:.06em}.pr-list-sub{font-size:10px;color:#859196;padding:0 17px 12px;margin:0;border-bottom:1px solid #edf0ee}
        .pr-packet-row{display:block;width:100%;text-align:left;background:transparent;border:0;border-bottom:1px solid #e9eeeb;padding:14px 16px;color:inherit;transition:background .15s}.pr-packet-row:hover{background:#f6f8f6}.pr-packet-row.selected{background:#edf3ef;box-shadow:inset 3px 0 #568173}.pr-row-top{display:flex;align-items:center;justify-content:space-between;gap:8px}.pr-packet-id{font:500 10px 'DM Mono',monospace;color:#50656c}.pr-row-officer{font:700 12px Manrope,sans-serif;color:#2c4149;margin-top:9px}.pr-row-meta{display:flex;justify-content:space-between;gap:8px;color:#8a9698;font-size:10px;margin-top:5px}.pr-status{display:inline-flex;align-items:center;gap:5px;border-radius:3px;padding:4px 6px;font:9px 'DM Mono',monospace;white-space:nowrap}.pr-status.committed{background:#f4efe3;color:#856a3d}.pr-status.released{background:#e6f1eb;color:#3e7565}.pr-status.withdrawn{background:#f4e9e6;color:#925d50}.pr-list-foot{padding:12px 16px;color:#899597;font-size:9px;line-height:1.5;background:#fafbf9}
        .pr-detail{min-width:0}.pr-detail-head{padding:18px 21px 16px;background:#f8faf8;border-bottom:1px solid var(--line)}.pr-detail-top{display:flex;justify-content:space-between;align-items:center;gap:12px}.pr-detail-kicker{font:9px 'DM Mono',monospace;color:#829094;letter-spacing:.09em;text-transform:uppercase}.pr-detail-head h2{font:700 21px Manrope,sans-serif;letter-spacing:-.035em;color:var(--navy);margin:10px 0 4px}.pr-detail-sub{font:10px 'DM Mono',monospace;color:#78878b}.pr-state-line{margin-top:14px;padding-top:12px;border-top:1px solid #e3e9e6;display:flex;justify-content:space-between;align-items:center;gap:12px}.pr-state-line span:first-child{font-size:10px;color:#839094}.pr-state-line strong{font-size:10px;color:#50696b;font-weight:700;text-align:right}
        .pr-unverified{margin:15px 18px 0;padding:10px 12px;border-left:3px solid #b28a50;background:#f7f2e9;color:#786644;font-size:10px;line-height:1.55;display:flex;gap:8px}.pr-unverified svg{flex:none;margin-top:1px}
        .pr-snapshot{padding:19px 20px 20px}.pr-section{margin-bottom:21px}.pr-section:last-child{margin-bottom:0}.pr-section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 11px;color:#52696e;font:700 10px Manrope,sans-serif;text-transform:uppercase;letter-spacing:.08em}.pr-section-head span{display:flex;align-items:center;gap:7px}.pr-section-head small{font:9px 'DM Mono',monospace;letter-spacing:.02em;text-transform:none;color:#929e9e;font-weight:400}
        .pr-facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px 15px}.pr-fact small{display:block;color:#899799;font:9px 'DM Mono',monospace;letter-spacing:.045em;margin-bottom:5px}.pr-fact div{font-size:11px;color:#344b52;line-height:1.4}
        .pr-table-wrap{overflow-x:auto;border:1px solid #e3e9e6;border-radius:4px}.pr-table{width:100%;border-collapse:collapse;min-width:510px}.pr-table th{text-align:left;background:#f5f8f5;color:#78888a;padding:8px 10px;font:9px 'DM Mono',monospace;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #e3e9e6}.pr-table td{padding:8px 10px;border-bottom:1px solid #edf0ee;color:#465b61;font-size:10px;vertical-align:top}.pr-table tr:last-child td{border-bottom:0}.pr-table td:first-child{font:10px 'DM Mono',monospace;color:#6d8083;white-space:nowrap}
        .pr-activity{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border:1px solid #e3e9e6;border-radius:4px;overflow:hidden}.pr-activity-item{padding:10px;border-right:1px solid #e8edeb;border-bottom:1px solid #e8edeb}.pr-activity-item:nth-child(4n){border-right:0}.pr-activity-item:nth-last-child(-n+4){border-bottom:0}.pr-activity-item span{display:block;color:#839093;font-size:9px}.pr-activity-item strong{display:block;color:#354d54;font:700 16px Manrope,sans-serif;margin-top:4px}
        .pr-evals{border:1px solid #e3e9e6;border-radius:4px;overflow:hidden}.pr-eval-row{display:grid;grid-template-columns:34px minmax(130px,1fr) 48px minmax(150px,1.7fr);gap:10px;align-items:start;padding:8px 10px;border-bottom:1px solid #edf0ee;font-size:10px}.pr-eval-row:last-child{border-bottom:0}.pr-eval-no{font:9px 'DM Mono',monospace;color:#8c9999}.pr-eval-name{font-weight:600;color:#445a60}.pr-rating{font:9px 'DM Mono',monospace;background:#eaf1ed;color:#4e7468;border-radius:3px;padding:3px 5px;text-align:center;white-space:nowrap}.pr-rating.no{background:#f2f1ec;color:#877d67}.pr-eval-note{color:#748286;line-height:1.45}.pr-raw-toggle{border:0;background:transparent;color:#507a70;font-size:10px;padding:9px 0;display:flex;align-items:center;gap:6px}.pr-raw-toggle:hover{text-decoration:underline}.pr-json{white-space:pre-wrap;overflow-wrap:anywhere;background:#f2f6f3;border:1px solid #dfe8e3;border-radius:4px;padding:13px;color:#466067;font:9px/1.6 'DM Mono',monospace;max-height:340px;overflow:auto}
        .pr-prose{padding:12px 13px;border:1px solid #e4eae7;background:#fbfcfa;border-radius:4px;color:#56696c;font-size:11px;line-height:1.65}.pr-comment-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.pr-comment-card{padding:12px;border:1px solid #e4eae7;border-radius:4px;background:#fbfcfa}.pr-comment-card small{display:block;color:#8a9898;font:9px 'DM Mono',monospace;margin-bottom:7px}.pr-comment-card p{margin:0;color:#586a6d;font-size:10px;line-height:1.6}
        .pr-workflow{padding:16px 20px 18px;border-top:1px solid var(--line);background:#fafbf9}.pr-workflow-heading{font:700 11px Manrope,sans-serif;color:#415b60;margin-bottom:11px;display:flex;align-items:center;gap:7px}.pr-confirm{display:flex;align-items:flex-start;gap:9px;color:#506569;font-size:10px;line-height:1.5;margin:0 0 12px;cursor:pointer}.pr-confirm input{accent-color:#477d70;margin:2px 0 0;flex:none}.pr-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px}.pr-button{min-height:35px;padding:0 12px;border:1px solid #ccd9d4;border-radius:4px;background:#fffefa;color:#53696b;font-size:10px;display:inline-flex;align-items:center;justify-content:center;gap:7px}.pr-button:hover:not(:disabled){background:#f2f6f3}.pr-button.primary{background:#345f5c;color:#fff;border-color:#345f5c;font-weight:700}.pr-button.primary:hover:not(:disabled){background:#284e4c}.pr-button.danger{color:#9a5b4e;border-color:#e3d1cb;background:#fffaf8}.pr-button:disabled{opacity:.45;cursor:not-allowed}.pr-help{font-size:9px;color:#879394;margin:9px 0 0;line-height:1.5}.pr-textarea{width:100%;min-height:70px;resize:vertical;border:1px solid #dce5e1;background:#fffefa;border-radius:4px;padding:9px 10px;color:#344d53;font-size:10px;outline:none}.pr-textarea:focus{border-color:#7b9e91;box-shadow:0 0 0 3px #477d7013}.pr-field-label{display:block;color:#728286;font-size:9px;margin:0 0 6px}.pr-withdraw-box{margin-top:13px;padding:12px;border:1px solid #ead8d2;background:#fbf5f2;border-radius:4px}.pr-withdraw-box p{font-size:10px;line-height:1.5;color:#7c655f;margin:0 0 9px}.pr-withdraw-box .pr-actions{margin-top:9px}.pr-closed-note{display:flex;align-items:flex-start;gap:8px;padding:11px 12px;background:#f6efec;border:1px solid #eadbd5;border-radius:4px;color:#805f55;font-size:10px;line-height:1.5}.pr-ack-note{margin-top:11px;padding:11px 12px;background:#eaf2ed;border:1px solid #d5e4dc;border-radius:4px;color:#4b7063;font-size:10px;display:flex;align-items:flex-start;gap:8px;line-height:1.5}.pr-feedback{font-size:10px;color:#4b7569;margin:10px 0 0;display:flex;gap:6px;align-items:center}.pr-empty,.pr-error{padding:39px 22px;text-align:center}.pr-empty-icon,.pr-error-icon{height:38px;width:38px;border-radius:50%;background:#eaf1ed;color:#65847a;margin:0 auto 11px;display:grid;place-items:center}.pr-error-icon{background:#f7eee3;color:#9a7444}.pr-empty h3,.pr-error h3{font:700 13px Manrope,sans-serif;color:#40595e;margin:0 0 6px}.pr-empty p,.pr-error p{color:#859295;font-size:10px;line-height:1.6;margin:0 auto 14px;max-width:310px}
        @media(max-width:860px){.pr-columns{grid-template-columns:1fr}.pr-list{order:1}.pr-detail{order:2}.pr-list{display:grid;grid-template-columns:1fr 1fr}.pr-list-head,.pr-list-sub,.pr-list-foot{grid-column:1/-1}.pr-packet-row{border-right:1px solid #e9eeeb}.pr-facts{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:600px){.pr-top{height:auto;min-height:62px;padding:10px 14px;gap:10px;align-items:flex-start}.pr-brand-sub{font-size:8px}.pr-top-right{align-items:flex-end;flex-direction:column;gap:7px}.pr-role-toggle button{padding:6px 7px;font-size:9px}.pr-preview-flag{font-size:8px;padding:5px 7px}.pr-page{padding:21px 13px 35px}.pr-title-row{align-items:flex-start;flex-direction:column;margin-bottom:17px}.pr-title-actions{display:flex;align-items:center;gap:9px}.pr-refresh-note{text-align:left;margin:0}.pr-columns{gap:11px}.pr-list{display:block}.pr-packet-row{border-right:0}.pr-detail-head{padding:15px}.pr-snapshot{padding:16px 14px}.pr-workflow{padding:14px}.pr-facts{gap:11px 9px}.pr-fact div{font-size:10px}.pr-activity{grid-template-columns:repeat(2,minmax(0,1fr))}.pr-activity-item:nth-child(4n){border-right:1px solid #e8edeb}.pr-activity-item:nth-child(2n){border-right:0}.pr-activity-item:nth-last-child(-n+4){border-bottom:1px solid #e8edeb}.pr-activity-item:nth-last-child(-n+2){border-bottom:0}.pr-eval-row{grid-template-columns:23px minmax(90px,1fr) 42px;gap:7px}.pr-eval-note{grid-column:2/-1}.pr-comment-grid{grid-template-columns:1fr}.pr-detail-top{align-items:flex-start;flex-direction:column}.pr-state-line{align-items:flex-start;flex-direction:column;gap:5px}.pr-state-line strong{text-align:left}}
        @media(prefers-reduced-motion:reduce){.packet-preview *{scroll-behavior:auto!important;transition-duration:.01ms!important}}
      `}</style>

      <header className="pr-top">
        <div className="pr-brand">
          <div className="pr-mark"><ShieldCheck size={18} /></div>
          <div><div className="pr-brand-title">FIELD TRAINING OFFICER PORTAL</div><div className="pr-brand-sub">COLUMBUS DIVISION OF POLICE</div></div>
        </div>
        <div className="pr-top-right">
          <div className="pr-preview-flag"><i />PREVIEW · SYNTHETIC RECORD</div>
          <div className="pr-role-toggle" aria-label="Preview role">
            <button type="button" className={role === "Coordinator" ? "active" : ""} onClick={() => setRole("Coordinator")} aria-pressed={role === "Coordinator"} data-testid="button-role-coordinator">Coordinator</button>
            <button type="button" className={role === "Probationary officer" ? "active" : ""} onClick={() => setRole("Probationary officer")} aria-pressed={role === "Probationary officer"} data-testid="button-role-po">PO view</button>
          </div>
        </div>
      </header>

      <section className="pr-page">
        <div className="pr-crumb"><span>Training records</span><ChevronRight size={11} /><span>Agency packets</span></div>
        <div className="pr-title-row">
          <div><h1>Agency packets</h1><p>{role === "Coordinator" ? "Review committed training records before releasing an immutable packet to the officer." : "Read released packets for your training record and acknowledge receipt of review."}</p></div>
          <div className="pr-title-actions">
            <button type="button" className="pr-refresh" onClick={refresh} data-testid="button-refresh-packets"><RefreshCw size={13} />Refresh</button>
            <button type="button" className="pr-refresh" onClick={() => { setUnavailable(true); setRefreshMessage(""); }} data-testid="button-preview-unavailable">Unavailable state</button>
            <div className="pr-refresh-note">Last checked {refreshedAt} · preview only</div>
          </div>
        </div>

        <div className="pr-preview-note"><ShieldCheck size={14} /><span>Approval preview only. All names and record details below are synthetic. This page makes no API calls and does not change the Field Training Officer Portal.</span></div>
        {refreshMessage && <p className="pr-feedback" role="status"><CheckCircle2 size={13} />{refreshMessage}</p>}

        <div className="pr-columns">
          <section className="pr-list" aria-label="Agency packet list">
            <div className="pr-list-head"><h2>{role === "Coordinator" ? "Authorized class packets" : "Your released packets"}</h2><span className="pr-list-count">{visiblePackets.length} {visiblePackets.length === 1 ? "PACKET" : "PACKETS"}</span></div>
            <p className="pr-list-sub">{role === "Coordinator" ? "Training class · Columbus Police Academy" : "Only packets released for Jordan Ellis are shown."}</p>
            {unavailable ? <div className="pr-error" role="alert"><div className="pr-error-icon"><AlertCircle size={17} /></div><h3>Packets unavailable</h3><p>The packet service could not be reached in this preview. Your work has not been changed.</p><button className="pr-button" type="button" onClick={refresh}><RefreshCw size={12} />Try refresh</button></div> : visiblePackets.length ? visiblePackets.map((packet) =>
              <button key={packet.id} type="button" className={`pr-packet-row ${selected?.id === packet.id ? "selected" : ""}`} onClick={() => { setSelectedId(packet.id); setShowWithdraw(false); setShowRaw(false); }} aria-pressed={selected?.id === packet.id} data-testid={`button-packet-${packet.id}`}>
                <div className="pr-row-top"><span className="pr-packet-id">{packet.id}</span><span className={badgeClass(packet.serverState)}><i />{packet.serverState.startsWith("Committed") ? "Committed" : packet.serverState.startsWith("Released") ? "Released" : "Withdrawn"}</span></div>
                <div className="pr-row-officer">Jordan Ellis <span style={{ color: "#899698", fontWeight: 500 }}>· PO 48271</span></div>
                <div className="pr-row-meta"><span>Phase 2 · Apr 17, 2025</span><span>{packet.created.split("·")[0].trim()}</span></div>
              </button>,
            ) : <div className="pr-empty"><div className="pr-empty-icon"><Archive size={17} /></div><h3>{role === "Coordinator" ? "No committed packets" : "No released packets yet"}</h3><p>{role === "Coordinator" ? "Committed daily records for your authorized classes will appear here for review." : "When your coordinator releases a packet, it will appear here. Draft and withdrawn packets are not visible to you."}</p></div>}
            <div className="pr-list-foot"><LockKeyhole size={11} style={{ verticalAlign: "middle", marginRight: 5 }} />{role === "Coordinator" ? "Class access is restricted to authorized training groups." : "PO view is limited to released packets for this synthetic account."}</div>
          </section>

          <section className="pr-detail" aria-label="Packet snapshot">
            {unavailable ? <div className="pr-error" role="alert"><div className="pr-error-icon"><AlertCircle size={17} /></div><h3>Packet snapshot unavailable</h3><p>Refresh to try loading this synthetic preview record again. No packet state has been changed.</p><button className="pr-button" type="button" onClick={refresh}><RefreshCw size={12} />Retry</button></div> : selected ? <>
              <header className="pr-detail-head">
                <div className="pr-detail-top"><span className="pr-detail-kicker">Immutable packet snapshot · synthetic</span><span className={badgeClass(selected.serverState)}><i />{selected.serverState}</span></div>
                <h2>Jordan Ellis · Daily Performance Log</h2><div className="pr-detail-sub">{selected.id} <span>·</span> Source record {snapshot.header.sourceRecord}</div>
                <div className="pr-state-line"><span>Server workflow state</span><strong>{selected.serverState}</strong></div>
              </header>
              <div className="pr-unverified"><AlertCircle size={14} /><span><strong>Snapshot not independently verified.</strong> Uploaded record content is displayed as submitted. It is not the source of packet release, withdrawal, or acknowledgment state.</span></div>
              <div className="pr-snapshot">
                <section className="pr-section">
                  <h3 className="pr-section-head"><span><FileText size={13} />Record header</span><small>uploaded content</small></h3>
                  <div className="pr-facts">
                    <div className="pr-fact"><small>RECORD TYPE</small><div>{snapshot.header.recordType}</div></div>
                    <div className="pr-fact"><small>DATE / SHIFT</small><div>{snapshot.header.date}<br />{snapshot.header.shift}</div></div>
                    <div className="pr-fact"><small>PHASE</small><div>{snapshot.header.phase}</div></div>
                    <div className="pr-fact"><small>PRECINCT / ZONE</small><div>{snapshot.header.precinct} · {snapshot.header.zone}</div></div>
                    <div className="pr-fact"><small>CRUISER DISTRICT</small><div>{snapshot.header.cruiserDistrict}</div></div>
                    <div className="pr-fact"><small>FTO ASSIGNMENT</small><div>{snapshot.header.assignment}</div></div>
                    <div className="pr-fact"><small>PROBATIONARY OFFICER</small><div>{snapshot.header.probationaryOfficer}</div></div>
                    <div className="pr-fact"><small>BADGE</small><div>{snapshot.header.badge}</div></div>
                  </div>
                </section>

                <section className="pr-section">
                  <h3 className="pr-section-head"><span><Clock3 size={13} />Duty record</span><small>5 entries</small></h3>
                  <div className="pr-table-wrap"><table className="pr-table"><thead><tr><th>Assignment</th><th>Time</th><th>Location / note</th></tr></thead><tbody>{snapshot.duty.map((entry) => <tr key={entry[0]}><td>{entry[0]}</td><td>{entry[1]}</td><td>{entry[2]}</td></tr>)}</tbody></table></div>
                </section>

                <section className="pr-section">
                  <h3 className="pr-section-head"><span><FileCheck2 size={13} />Calls / runs</span><small>{snapshot.runs.length} entries</small></h3>
                  <div className="pr-table-wrap"><table className="pr-table"><thead><tr><th>Time</th><th>Call / location</th><th>Disposition</th></tr></thead><tbody>{snapshot.runs.map((run) => <tr key={run.time}><td>{run.time}</td><td>{run.call}<br /><span style={{ color: "#899698" }}>{run.location}</span></td><td>{run.disposition}</td></tr>)}</tbody></table></div>
                </section>

                <section className="pr-section">
                  <h3 className="pr-section-head"><span><Archive size={13} />Activity totals</span><small>uploaded counts</small></h3>
                  <div className="pr-activity">{snapshot.activity.map(([name, count]) => <div className="pr-activity-item" key={name}><span>{name}</span><strong>{count}</strong></div>)}</div>
                </section>

                <section className="pr-section">
                  <h3 className="pr-section-head"><span><CheckCircle2 size={13} />Daily evaluations</span><small>30 manual categories · full snapshot</small></h3>
                  <div className="pr-evals">{evaluations.map((evaluation) => <div className="pr-eval-row" key={evaluation.number}><span className="pr-eval-no">{String(evaluation.number).padStart(2, "0")}</span><span className="pr-eval-name">{evaluation.category}</span><span className={`pr-rating ${evaluation.rating === "NO" ? "no" : ""}`} title={ratingLabels[evaluation.rating]}>{evaluation.rating}</span><span className="pr-eval-note">{evaluation.note}</span></div>)}</div>
                  <p className="pr-help">Manual rating codes: NO · Not Observed; A · Acceptable; RT · Responding to Training; UA · Unacceptable; NRT · Not Responding to Training.</p>
                  <button className="pr-raw-toggle" type="button" onClick={() => setShowRaw((value) => !value)} aria-expanded={showRaw} data-testid="button-toggle-raw-json"><ChevronDown size={13} style={{ transform: showRaw ? "rotate(180deg)" : undefined }} />{showRaw ? "Hide" : "Expand"} raw snapshot JSON</button>
                  {showRaw && <pre className="pr-json">{JSON.stringify({ ...snapshot, evaluations }, null, 2)}</pre>}
                </section>

                <section className="pr-section">
                  <h3 className="pr-section-head"><span><MessageSquareText size={13} />Narrative</span><small>uploaded content</small></h3>
                  <div className="pr-prose">{snapshot.narrative}</div>
                </section>
                <section className="pr-section">
                  <h3 className="pr-section-head"><span><MessageSquareText size={13} />Comments</span><small>uploaded content</small></h3>
                  <div className="pr-comment-grid">
                    <div className="pr-comment-card"><small>PO COMMENTS</small><p>{snapshot.recruitComments}</p></div>
                    <div className="pr-comment-card"><small>FTO COMMENTS</small><p>{snapshot.ftoComments}</p></div>
                  </div>
                </section>
              </div>

              {role === "Coordinator" ? <footer className="pr-workflow">
                <div className="pr-workflow-heading"><UserRound size={14} />Coordinator review</div>
                {selected.serverState.startsWith("Committed") ? <>
                  <label className="pr-confirm"><input type="checkbox" checked={selected.reviewed} onChange={(event) => patchPacket(selected.id, { reviewed: event.target.checked })} data-testid="checkbox-coordinator-reviewed" /><span>I reviewed the complete snapshot above and confirm it is the packet I intend to release to Jordan Ellis.</span></label>
                  <div className="pr-actions"><button type="button" className="pr-button primary" onClick={releasePacket} disabled={!selected.reviewed} data-testid="button-release-packet"><Check size={13} />Release for PO review</button></div>
                  <p className="pr-help">Release uses the server workflow state, not values inside the uploaded record. The packet snapshot cannot be edited after commit.</p>
                </> : selected.serverState.startsWith("Released") ? <>
                  {selected.acknowledged && <div className="pr-ack-note"><CheckCircle2 size={14} /><span>PO review receipt recorded in this preview. Receipt is not agreement or an electronic signature.</span></div>}
                  <div className="pr-actions" style={{ marginTop: 12 }}><button type="button" className="pr-button danger" onClick={() => setShowWithdraw((value) => !value)} data-testid="button-open-withdraw"><X size={13} />Withdraw packet</button></div>
                  {showWithdraw && <div className="pr-withdraw-box"><p><strong>Permanent closure.</strong> Withdrawal removes this packet from the PO's released list. It cannot be reopened. A correction must be submitted as a new packet and receive fresh review.</p><label className="pr-field-label" htmlFor="correction-reason">Correction reason · required</label><textarea id="correction-reason" className="pr-textarea" value={withdrawReason} onChange={(event) => setWithdrawReason(event.target.value)} placeholder="Describe why this released packet must be withdrawn." data-testid="input-correction-reason" /><div className="pr-actions"><button type="button" className="pr-button danger" onClick={withdrawPacket} disabled={!withdrawReason.trim()} data-testid="button-confirm-withdraw">Permanently withdraw</button><button type="button" className="pr-button" onClick={() => { setShowWithdraw(false); setWithdrawReason(""); }}>Cancel</button></div></div>}
                </> : <>
                  <div className="pr-closed-note"><LockKeyhole size={14} /><span>This packet is permanently closed and cannot be reopened or edited. Its correction reason is retained in the coordinator view.</span></div>
                  <div className="pr-prose" style={{ marginTop: 10 }}><strong>Correction reason:</strong> {selected.correctionReason}</div>
                  <div className="pr-actions" style={{ marginTop: 12 }}><button type="button" className="pr-button primary" onClick={createReplacement} data-testid="button-create-replacement"><FileText size={13} />Create replacement packet</button></div>
                  <p className="pr-help">A replacement has a new packet ID and starts with fresh coordinator review. The original remains permanently closed.</p>
                </>}
              </footer> : <footer className="pr-workflow">
                <div className="pr-workflow-heading"><UserRound size={14} />Your review</div>
                <label className="pr-confirm"><input type="checkbox" checked={selected.poConfirmed} disabled={selected.acknowledged} onChange={(event) => patchPacket(selected.id, { poConfirmed: event.target.checked })} data-testid="checkbox-po-reviewed" /><span>I reviewed this packet and acknowledge receipt of the snapshot.</span></label>
                <label className="pr-field-label" htmlFor="po-comment">Optional comments for the training record</label>
                <textarea id="po-comment" className="pr-textarea" value={selected.comment} onChange={(event) => patchPacket(selected.id, { comment: event.target.value })} placeholder="Add a comment if useful. You may leave this blank." disabled={selected.acknowledged} data-testid="input-po-comment" />
                {selected.acknowledged ? <div className="pr-ack-note"><CheckCircle2 size={14} /><span>Receipt of review acknowledged in this preview. This is not agreement with the contents and is not an electronic signature.</span></div> : <div className="pr-actions" style={{ marginTop: 10 }}><button type="button" className="pr-button primary" onClick={acknowledge} disabled={!selected.poConfirmed} data-testid="button-acknowledge"><Check size={13} />Acknowledge review</button></div>}
                <p className="pr-help">Acknowledgment confirms receipt and review only. It does not mean agreement with the record and is not an electronic signature.</p>
              </footer>}
            </> : <div className="pr-empty"><div className="pr-empty-icon"><FileText size={17} /></div><h3>{role === "Probationary officer" ? "No released packets yet" : "Select a packet"}</h3><p>{role === "Probationary officer" ? "Packets appear here only after coordinator release. Committed and withdrawn records remain hidden from this view." : "Choose a committed record from your authorized class list to inspect its immutable snapshot."}</p></div>}
          </section>
        </div>
      </section>
    </main>
  );
}
