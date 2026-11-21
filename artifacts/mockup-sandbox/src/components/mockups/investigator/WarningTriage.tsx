import { useMemo, useState } from "react";
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
  LockKeyhole,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";

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

export function WarningTriage() {
  const [filter, setFilter] = useState("All warnings");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Finding | null>(findings[0]);
  const [reviewed, setReviewed] = useState<string[]>(["req_09e6a3b1"]);
  const [copied, setCopied] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const visible = useMemo(() => findings.filter((item) => {
    const matchesFilter = filter === "All warnings" || (filter === "Unreviewed" ? !reviewed.includes(item.id) : item.severity === filter.toLowerCase());
    const term = query.toLowerCase().trim();
    const matchesQuery = !term || `${item.id} ${item.actor} ${item.route} ${item.disposition}`.toLowerCase().includes(term);
    return matchesFilter && matchesQuery;
  }), [filter, query, reviewed]);

  const markReviewed = (id: string) => setReviewed((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const copyFinding = async () => {
    if (!selected) return;
    const sanitized = JSON.stringify({ request_id: selected.id, actor_role: selected.actor, route: selected.route, status: selected.status, disposition: selected.disposition, client_hash: selected.hash }, null, 2);
    try {
      await navigator.clipboard.writeText(sanitized);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="triage">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap');
        .triage{--ink:#19343c;--muted:#6c7f82;--line:#dbe5e1;--paper:#f2f6f3;--surface:#fffefa;--teal:#36766d;--soft:#e8f1ed;--red:#a6423b;--redbg:#fae9e5;--amber:#95641d;--amberbg:#fbf1df;min-height:100dvh;background:var(--paper);color:var(--ink);font:13px 'DM Sans',sans-serif}
        .triage *{box-sizing:border-box}.triage button,.triage input{font:inherit}.triage button{cursor:pointer}
        .triage-top{height:66px;background:#18323c;color:#f4f6f2;padding:0 clamp(18px,4vw,58px);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.12)}
        .triage-brand{display:flex;gap:12px;align-items:center}.triage-mark{width:34px;height:34px;border:1px solid #789c91;border-radius:8px;display:grid;place-items:center;color:#bad3ca}.triage-brand-title{font:800 12px 'Manrope',sans-serif;letter-spacing:.06em}.triage-brand-sub{font:9px 'DM Mono',monospace;color:#a7bcb7;letter-spacing:.1em;margin-top:3px}
        .triage-top-meta{display:flex;align-items:center;gap:18px}.triage-env{font:9px 'DM Mono',monospace;color:#c3d9cf;border:1px solid #3c5a5b;padding:7px 9px;border-radius:4px;letter-spacing:.06em}.triage-env i{display:inline-block;width:6px;height:6px;background:#83b99c;border-radius:50%;margin-right:7px}.triage-admin{display:flex;align-items:center;gap:8px;border-left:1px solid #3a5358;padding-left:17px;color:#dce8e3;font-size:11px}.triage-admin small{display:block;color:#9db5ae;font-size:9px;margin-top:2px}
        .triage-layout{max-width:1500px;margin:auto;padding:30px clamp(18px,4vw,58px) 46px}.triage-crumb{font:9px 'DM Mono',monospace;text-transform:uppercase;letter-spacing:.1em;color:#7b8c8d;display:flex;align-items:center;gap:8px;margin-bottom:18px}
        .triage-title-row{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:23px}.triage-title{margin:0;font:800 clamp(26px,3vw,35px)/1.08 'Manrope',sans-serif;letter-spacing:-.045em;color:#18343d}.triage-lede{margin:9px 0 0;color:#718287;font-size:12px}.triage-updated{font:9px 'DM Mono',monospace;color:#788b8d;display:flex;align-items:center;gap:7px;white-space:nowrap}.triage-updated svg{color:#628c7e}
        .triage-summary{display:grid;grid-template-columns:1.18fr 1fr 1fr;gap:11px;margin-bottom:19px}.triage-stat{border:1px solid var(--line);background:var(--surface);border-radius:6px;padding:15px 18px;min-height:92px;position:relative;overflow:hidden}.triage-stat:before{content:"";position:absolute;inset:0 auto 0 0;width:3px;background:#b77955}.triage-stat:nth-child(2):before{background:#72988c}.triage-stat:nth-child(3):before{background:#c49950}.triage-stat-label{color:#758589;font-size:10px;display:flex;justify-content:space-between;align-items:center}.triage-stat-label svg{color:#718e83}.triage-stat-value{margin-top:9px;font:700 25px 'Manrope',sans-serif;letter-spacing:-.04em;color:#203b42}.triage-stat-note{font:9px 'DM Mono',monospace;color:#859495;margin-left:8px}
        .triage-columns{display:grid;grid-template-columns:minmax(380px,1.12fr) minmax(340px,.88fr);gap:13px;align-items:start}.triage-list,.triage-detail{background:var(--surface);border:1px solid var(--line);border-radius:7px;overflow:hidden;box-shadow:0 5px 18px rgba(31,58,62,.03)}.triage-list-head{padding:16px 17px 13px;border-bottom:1px solid var(--line)}.triage-list-heading{display:flex;justify-content:space-between;align-items:center}.triage-list-heading h2{margin:0;font:700 13px 'Manrope',sans-serif;display:flex;align-items:center;gap:8px}.triage-list-heading h2 svg{color:#638a7f}.triage-count{font:9px 'DM Mono',monospace;color:#78908d;background:#edf3ef;padding:5px 7px;border-radius:3px}
        .triage-controls{display:flex;gap:8px;margin-top:13px}.triage-search{height:34px;display:flex;align-items:center;gap:8px;padding:0 10px;border:1px solid #dce5e1;border-radius:4px;background:#fbfcfa;flex:1;color:#849394}.triage-search input{border:0;background:transparent;outline:0;width:100%;font-size:10px;color:#29444a}.triage-search input::placeholder{color:#9aa7a5}.triage-filter{height:34px;border:1px solid #dce5e1;border-radius:4px;background:#fbfcfa;color:#526c6d;padding:0 9px;display:flex;align-items:center;gap:7px;font-size:10px;white-space:nowrap}
        .triage-filter-menu{display:flex;gap:5px;flex-wrap:wrap;padding:10px 15px;background:#f5f8f5;border-bottom:1px solid var(--line)}.triage-filter-menu button{border:1px solid #d8e4de;background:#fffefa;border-radius:3px;padding:5px 8px;color:#617674;font-size:9px}.triage-filter-menu button.active{background:#e4efea;border-color:#acc7bb;color:#315e54}
        .triage-item{width:100%;text-align:left;border:0;border-bottom:1px solid #edf1ee;background:transparent;padding:14px 16px 13px;display:block;color:inherit;transition:background .16s ease}.triage-item:hover{background:#f6f9f6}.triage-item.selected{background:#f0f6f2;box-shadow:inset 3px 0 #548477}.triage-item:last-child{border-bottom:0}.triage-item-top{display:flex;align-items:center;justify-content:space-between;gap:10px}.triage-item-time{font:9px 'DM Mono',monospace;color:#829191}.triage-pill{font:9px 'DM Mono',monospace;padding:4px 7px;border-radius:3px;display:inline-flex;align-items:center;gap:5px}.triage-pill.urgent{color:#9f403a;background:var(--redbg)}.triage-pill.review{color:#87601e;background:var(--amberbg)}.triage-pill.watch{color:#52776d;background:#e9f2ec}.triage-http{display:flex;align-items:center;gap:8px;margin:10px 0 6px}.triage-code{font:700 11px 'DM Mono',monospace;color:#9f4841}.triage-method{font:9px 'DM Mono',monospace;color:#53736b;background:#edf3ef;padding:3px 5px;border-radius:2px}.triage-route{font:10px 'DM Mono',monospace;color:#35545a;overflow-wrap:anywhere}.triage-record-id{font:9px 'DM Mono',monospace;color:#91a09f;margin-top:7px;display:flex;justify-content:space-between;gap:8px}.triage-reviewed{color:#568476;display:flex;align-items:center;gap:4px}
        .triage-list-foot{border-top:1px solid #e8eeeb;padding:11px 16px;display:flex;align-items:center;justify-content:space-between;color:#82908f;font:9px 'DM Mono',monospace}
        .triage-detail-head{background:#18323c;color:#f3f6f2;padding:17px 19px 16px}.triage-detail-top{display:flex;align-items:center;justify-content:space-between;color:#afc6bd;font:9px 'DM Mono',monospace;letter-spacing:.08em;text-transform:uppercase}.triage-status-large{font:9px 'DM Mono',monospace;color:#f0b5a9;border:1px solid #714e4d;background:rgba(143,62,56,.25);border-radius:3px;padding:5px 7px}.triage-detail-head h2{font:700 17px 'Manrope',sans-serif;letter-spacing:-.02em;margin:13px 0 5px}.triage-detail-id{font:10px 'DM Mono',monospace;color:#b3c4bf}.triage-detail-body{padding:18px 19px}.triage-note{border:1px solid #ead9bd;background:#fcf5e9;padding:11px 12px;border-radius:4px;display:flex;gap:9px;color:#725b36;font-size:11px;line-height:1.5;margin-bottom:18px}.triage-note svg{flex:none;color:#aa7d37;margin-top:1px}.triage-section-title{font:700 10px 'Manrope',sans-serif;text-transform:uppercase;letter-spacing:.075em;color:#536d70;margin:0 0 12px;display:flex;align-items:center;gap:7px}.triage-section-title svg{color:#698b80}
        .triage-facts{display:grid;grid-template-columns:1fr 1fr;gap:14px 13px;padding-bottom:18px;border-bottom:1px solid #e5ece8}.triage-fact small{display:block;font:9px 'DM Mono',monospace;color:#8a9999;margin-bottom:5px}.triage-fact div{font-size:11px;color:#344f54;overflow-wrap:anywhere}.triage-fact .mono{font:10px 'DM Mono',monospace}.triage-wide{grid-column:1/-1}.triage-hash{margin:15px 0 18px;border:1px solid #dfe8e3;background:#f3f7f4;border-radius:4px;padding:10px 11px}.triage-hash-head{font:9px 'DM Mono',monospace;color:#788b88;display:flex;justify-content:space-between}.triage-hash-value{font:10px/1.6 'DM Mono',monospace;color:#34565a;margin-top:8px;overflow-wrap:anywhere}.triage-sanitized{margin-top:15px;border-top:1px solid #e5ece8;padding-top:14px}.triage-sanitized p{font-size:10px;line-height:1.6;color:#788a89;margin:0;display:flex;gap:8px}.triage-sanitized svg{color:#65877c;flex:none}.triage-actions{display:flex;gap:8px;margin-top:17px}.triage-action{height:35px;border:1px solid #bfd2c8;border-radius:4px;background:#f4f8f5;color:#426a5f;padding:0 11px;display:inline-flex;align-items:center;gap:7px;font-size:10px}.triage-action.primary{background:#356f66;border-color:#356f66;color:#fff}.triage-action:hover{filter:brightness(.97)}
        .triage-empty{padding:38px 18px;text-align:center;color:#7b8c8e}.triage-empty svg{color:#77958a;margin-bottom:10px}.triage-empty strong{display:block;font:700 13px 'Manrope',sans-serif;color:#345057;margin-bottom:5px}.triage-empty span{font-size:10px}
        @media(max-width:900px){.triage-columns{grid-template-columns:1fr}.triage-detail{position:relative}.triage-summary{gap:8px}.triage-stat{padding:13px}.triage-stat-note{display:block;margin:3px 0 0}}
        @media(max-width:600px){.triage-top{padding:0 15px}.triage-brand-sub{display:none}.triage-top-meta{gap:8px}.triage-admin{display:none}.triage-env{font-size:8px}.triage-layout{padding:24px 14px 34px}.triage-title-row{align-items:flex-start;flex-direction:column;gap:10px}.triage-title{font-size:28px}.triage-summary{grid-template-columns:1fr;gap:7px}.triage-stat{min-height:72px}.triage-stat-value{margin-top:5px;font-size:22px}.triage-columns{grid-template-columns:minmax(0,1fr)}.triage-list-head{padding:14px}.triage-controls{gap:6px}.triage-filter{font-size:9px;padding:0 7px}.triage-item{padding:13px 13px}.triage-detail-body{padding:15px}.triage-detail-head{padding:16px}.triage-facts{gap:12px}.triage-actions{flex-wrap:wrap}}
        @media(prefers-reduced-motion:reduce){.triage *{scroll-behavior:auto!important;transition-duration:.01ms!important}}
      `}</style>
      <header className="triage-top">
        <div className="triage-brand"><div className="triage-mark"><ShieldCheck size={18} /></div><div><div className="triage-brand-title">WARNING TRIAGE</div><div className="triage-brand-sub">FIELD TRAINING SYSTEM</div></div></div>
        <div className="triage-top-meta"><div className="triage-env"><i />MOCK DEVELOPMENT</div><div className="triage-admin"><LockKeyhole size={13} /><span>ADMIN<small>Investigator access</small></span></div></div>
      </header>
      <section className="triage-layout">
        <div className="triage-crumb"><span>Operations</span><ChevronRight size={11} /><span>Request monitoring</span><ChevronRight size={11} /><span>Warning triage</span></div>
        <div className="triage-title-row">
          <div><h1 className="triage-title">Failed request triage</h1><p className="triage-lede">Sort warning signals. Review only what the sanitized record can safely tell you.</p></div>
          <div className="triage-updated"><Clock3 size={13} /> Last 60 minutes <span>·</span> UTC</div>
        </div>
        <div className="triage-summary">
          <article className="triage-stat"><div className="triage-stat-label"><span>Warnings requiring attention</span><AlertOctagon size={15} /></div><div className="triage-stat-value">06<span className="triage-stat-note">failed requests in window</span></div></article>
          <article className="triage-stat"><div className="triage-stat-label"><span>Urgent failures</span><ArrowUpRight size={15} /></div><div className="triage-stat-value">02<span className="triage-stat-note">5xx · service impact</span></div></article>
          <article className="triage-stat"><div className="triage-stat-label"><span>Reviewed by you</span><CheckCheck size={15} /></div><div className="triage-stat-value">{String(reviewed.length).padStart(2, "0")}<span className="triage-stat-note">of 06 findings</span></div></article>
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
            {showFilters && <div className="triage-filter-menu" aria-label="Finding filters">{["All warnings", "Unreviewed", "Urgent", "Review", "Watch"].map((item) => <button key={item} type="button" className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div>}
            {visible.length ? visible.map((item) => <button key={item.id} type="button" className={`triage-item ${selected?.id === item.id ? "selected" : ""}`} onClick={() => setSelected(item)} aria-pressed={selected?.id === item.id}>
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
                <div className="triage-hash"><div className="triage-hash-head"><span>CLIENT IDENTIFIER · HASH ONLY</span><span>SHA-256</span></div><div className="triage-hash-value">{selected.hash}</div></div>
                <div className="triage-sanitized"><p><ShieldCheck size={14} /><span>Raw IP addresses, request bodies, and personal identifiers are intentionally excluded. This finding is suitable for safe review and handoff.</span></p></div>
                <div className="triage-actions"><button type="button" className="triage-action primary" onClick={() => markReviewed(selected.id)}>{reviewed.includes(selected.id) ? <CheckCheck size={13} /> : <Check size={13} />}{reviewed.includes(selected.id) ? "Mark unreviewed" : "Mark reviewed"}</button><button type="button" className="triage-action" onClick={() => void copyFinding()}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "Copied safe summary" : "Copy safe summary"}</button></div>
              </div>
            </> : <div className="triage-empty"><ArrowDownRight size={20} /><strong>Select a finding</strong><span>Choose a warning to review its sanitized details.</span></div>}
          </aside>
        </div>
      </section>
    </main>
  );
}

export default WarningTriage;
