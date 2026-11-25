import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Clock3,
  Copy,
  FileSearch,
  Filter,
  Fingerprint,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import "./WarningTriage.css";

type Finding = {
  id: string;
  time: string;
  actor: string;
  method: string;
  route: string;
  status: number;
  disposition: string;
  note: string;
  severity: "urgent" | "review" | "watch";
  hash: string;
  payload: number;
};

const findings: Finding[] = [
  { id: "req_7f2a91c8", time: "14:32:08", actor: "RECRUIT", method: "POST", route: "/v1/trainees/evaluations", status: 500, disposition: "UPSTREAM_FAILURE", note: "Evaluation service returned an unexpected response.", severity: "urgent", hash: "b67fd95a…c0142e8a", payload: 1842 },
  { id: "req_c14b08d3", time: "14:28:41", actor: "FTO", method: "PATCH", route: "/v1/trainees/records/summary", status: 403, disposition: "ROLE_RESTRICTED", note: "Current role cannot update this record.", severity: "review", hash: "f207e1bd…11c0a7f9", payload: 624 },
  { id: "req_09e6a3b1", time: "14:26:13", actor: "UNAUTHENTICATED", method: "GET", route: "/v1/training/resources", status: 401, disposition: "AUTH_REQUIRED", note: "A valid session is required to access this route.", severity: "watch", hash: "06bcaa71…f1de6394", payload: 0 },
  { id: "req_5b92d17e", time: "14:19:56", actor: "SERGEANT", method: "DELETE", route: "/v1/trainees/records/close", status: 422, disposition: "VALIDATION_FAILED", note: "Required disposition field was not supplied.", severity: "review", hash: "85a027de…94fa3271", payload: 212 },
  { id: "req_4a80f31c", time: "14:11:27", actor: "RECRUIT", method: "POST", route: "/v1/trainees/check-ins", status: 429, disposition: "RATE_LIMITED", note: "Request limit reached; retry after the cooldown window.", severity: "watch", hash: "34a91be2…0ed6c11b", payload: 388 },
  { id: "req_321dc5aa", time: "13:58:04", actor: "FTO", method: "GET", route: "/v1/trainees/evaluations/current", status: 503, disposition: "DEPENDENCY_TIMEOUT", note: "Evaluation service did not respond within the request window.", severity: "urgent", hash: "f8c450d0…47bf2a31", payload: 0 },
];

const severityName = (severity: Finding["severity"]) =>
  severity === "urgent" ? "Urgent" : severity === "review" ? "Review" : "Watch";
const formatCount = (value: number) => String(value).padStart(2, "0");

export function WarningTriage() {
  const [filter, setFilter] = useState("All warnings");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    findings[0]?.id ?? null,
  );
  const [reviewed, setReviewed] = useState<string[]>(["req_09e6a3b1"]);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const copyTimer = useRef<number | undefined>(undefined);
  const visible = useMemo(() => findings.filter((item) => {
    const matchesFilter = filter === "All warnings" || (filter === "Unreviewed" ? !reviewed.includes(item.id) : item.severity === filter.toLowerCase());
    const term = query.toLowerCase().trim();
    const matchesQuery = !term || `${item.id} ${item.actor} ${item.route} ${item.disposition}`.toLowerCase().includes(term);
    return matchesFilter && matchesQuery;
  }), [filter, query, reviewed]);
  const selected =
    visible.find((item) => item.id === selectedId) ?? visible[0] ?? null;
  const urgentCount = findings.filter((item) => item.severity === "urgent").length;
  const reviewedCount = findings.filter((item) => reviewed.includes(item.id)).length;

  const markReviewed = (id: string) => setReviewed((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const selectFinding = (item: Finding) => {
    setSelectedId(item.id);
    setCopied(false);
    setCopyError("");
    if (copyTimer.current !== undefined) {
      window.clearTimeout(copyTimer.current);
      copyTimer.current = undefined;
    }
  };

  const copyFinding = async () => {
    if (!selected) return;
    const sanitized = JSON.stringify({
      request_id: selected.id,
      actor_role: selected.actor,
      route: selected.route,
      status: selected.status,
      disposition: selected.disposition,
      mock_client_hash: selected.hash,
    }, null, 2);
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard access is unavailable.");
      }
      await navigator.clipboard.writeText(sanitized);
      setCopied(true);
      setCopyError("");
      if (copyTimer.current !== undefined) {
        window.clearTimeout(copyTimer.current);
      }
      copyTimer.current = window.setTimeout(() => {
        setCopied(false);
        copyTimer.current = undefined;
      }, 1800);
    } catch {
      setCopied(false);
      setCopyError("Copy was unavailable. Select the summary and copy it manually.");
    }
  };

  useEffect(() => () => {
    if (copyTimer.current !== undefined) {
      window.clearTimeout(copyTimer.current);
    }
  }, []);

  useEffect(() => {
    setCopied(false);
    setCopyError("");
    if (copyTimer.current !== undefined) {
      window.clearTimeout(copyTimer.current);
      copyTimer.current = undefined;
    }
  }, [selected?.id]);

  return (
    <main className="triage">
      <header className="triage-top">
        <div className="triage-brand"><div className="triage-mark"><ShieldCheck size={18} /></div><div><div className="triage-brand-title">WARNING TRIAGE</div><div className="triage-brand-sub">FIELD TRAINING SYSTEM</div></div></div>
        <div className="triage-top-meta"><div className="triage-env"><i />PREVIEW ONLY</div><div className="triage-admin"><ShieldCheck size={13} /><span>DEMO DATA<small>No authenticated user</small></span></div></div>
      </header>
      <section className="triage-layout">
        <div className="triage-crumb"><span>Operations</span><ChevronRight size={11} /><span>Request monitoring</span><ChevronRight size={11} /><span>Warning triage</span></div>
        <div className="triage-title-row">
          <div><h1 className="triage-title">Failed request triage</h1><p className="triage-lede">Sort warning signals. Review only what the sanitized record can safely tell you.</p></div>
          <div className="triage-updated"><Clock3 size={13} /> Last 60 minutes <span>·</span> UTC</div>
        </div>
        <div className="triage-summary">
          <article className="triage-stat"><div className="triage-stat-label"><span>Warnings requiring attention</span><AlertOctagon size={15} /></div><div className="triage-stat-value">{formatCount(findings.length)}<span className="triage-stat-note">failed requests in window</span></div></article>
          <article className="triage-stat"><div className="triage-stat-label"><span>Urgent failures</span><ArrowUpRight size={15} /></div><div className="triage-stat-value">{formatCount(urgentCount)}<span className="triage-stat-note">5xx · service impact</span></div></article>
          <article className="triage-stat"><div className="triage-stat-label"><span>Reviewed</span><CheckCheck size={15} /></div><div className="triage-stat-value">{formatCount(reviewedCount)}<span className="triage-stat-note">of {formatCount(findings.length)} sample findings</span></div></article>
        </div>
        <div className="triage-columns">
          <section className="triage-list" aria-label="Failed request queue">
            <div className="triage-list-head">
              <div className="triage-list-heading"><h2><FileSearch size={15} /> Warning queue</h2><span className="triage-count">{visible.length} FINDINGS</span></div>
              <div className="triage-controls">
                <label className="triage-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search request, route, disposition" aria-label="Search findings" /></label>
                <button className="triage-filter" type="button" onClick={() => setShowFilters((value) => !value)} aria-expanded={showFilters}><SlidersHorizontal size={13} /> Filter <ChevronDown size={12} /></button>
              </div>
            </div>
            {showFilters && <div className="triage-filter-menu" role="group" aria-label="Finding filters">{["All warnings", "Unreviewed", "Urgent", "Review", "Watch"].map((item) => <button key={item} type="button" className={filter === item ? "active" : ""} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}</div>}
            {visible.length ? visible.map((item) => <button key={item.id} type="button" className={`triage-item ${selected?.id === item.id ? "selected" : ""}`} onClick={() => selectFinding(item)} aria-pressed={selected?.id === item.id}>
              <div className="triage-item-top"><span className="triage-item-time">{item.time} UTC</span><span className={`triage-pill ${item.severity}`}><CircleDot size={10} />{severityName(item.severity)}</span></div>
              <div className="triage-http"><span className="triage-code">{item.status}</span><span className="triage-method">{item.method}</span><span className="triage-route">{item.route}</span></div>
              <div className="triage-record-id"><span>{item.id} · {item.actor}</span>{reviewed.includes(item.id) && <span className="triage-reviewed"><Check size={11} /> Reviewed</span>}</div>
            </button>) : <div className="triage-empty"><Filter size={19} /><strong>Nothing in this view</strong><span>Adjust the filter or search a different term.</span></div>}
            <div className="triage-list-foot"><span>Sorted by newest first</span><span>Identifiers sanitized</span></div>
          </section>
          <aside className="triage-detail" aria-label="Sanitized finding detail">
            {selected ? <>
              <div className="triage-detail-head"><div className="triage-detail-top"><span>Finding detail · safe view</span><span className="triage-status-large">HTTP {selected.status}</span></div><h2>Request failure</h2><div className="triage-detail-id">{selected.id}</div></div>
              <div className="triage-detail-body">
                <div className="triage-note"><AlertTriangle size={14} /><span>{selected.note}</span></div>
                <h3 className="triage-section-title"><Fingerprint size={13} /> Sanitized request summary</h3>
                <div className="triage-facts">
                  <div className="triage-fact"><small>OBSERVED · UTC</small><div className="mono">Today, {selected.time}</div></div>
                  <div className="triage-fact"><small>ACTOR ROLE</small><div>{selected.actor}</div></div>
                  <div className="triage-fact"><small>HTTP METHOD</small><div className="mono">{selected.method}</div></div>
                  <div className="triage-fact"><small>PAYLOAD SIZE</small><div>{selected.payload.toLocaleString()} bytes</div></div>
                  <div className="triage-fact triage-wide"><small>ROUTE</small><div className="mono">{selected.route}</div></div>
                  <div className="triage-fact triage-wide"><small>DISPOSITION</small><div className="mono">{selected.disposition}</div></div>
                </div>
                 <div className="triage-hash"><div className="triage-hash-head"><span>MOCK IDENTIFIER · TRUNCATED EXAMPLE</span><span>DEMO VALUE</span></div><div className="triage-hash-value">{selected.hash}</div></div>
                 <div className="triage-sanitized"><p><ShieldCheck size={14} /><span>These are sample findings, not live audit records. Raw IP addresses, request bodies, and personal identifiers are not included.</span></p></div>
                 <div className="triage-actions"><button type="button" className="triage-action primary" onClick={() => markReviewed(selected.id)}>{reviewed.includes(selected.id) ? <CheckCheck size={13} /> : <Check size={13} />}{reviewed.includes(selected.id) ? "Mark unreviewed" : "Mark reviewed"}</button><button type="button" className="triage-action" onClick={() => void copyFinding()}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "Copied safe summary" : "Copy safe summary"}</button></div>
                 {(copied || copyError) && <p className={`triage-copy-feedback ${copyError ? "error" : ""}`} role="status" aria-live="polite">{copyError || "Safe summary copied."}</p>}
              </div>
             </> : <div className="triage-empty"><ArrowDownRight size={20} /><strong>No matching finding</strong><span>Adjust the filter or search to show a finding here.</span></div>}
          </aside>
        </div>
      </section>
    </main>
  );
}

export default WarningTriage;
