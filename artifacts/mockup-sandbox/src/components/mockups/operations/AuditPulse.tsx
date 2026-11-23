import { useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock3,
  Copy,
  FileText,
  Fingerprint,
  ListFilter,
  LockKeyhole,
  Network,
  RotateCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";

type AuditEvent = {
  id: string;
  time: string;
  role: string;
  method: string;
  route: string;
  code: number;
  disposition: string;
  bytes: number;
  hash: string;
  requestHash: string;
  note?: string;
  group: string;
};

const events: AuditEvent[] = [
  { id: "req_7f2a91c0", time: "14:42:18", role: "ADMIN", method: "PATCH", route: "/v1/users/•••/role", code: 403, disposition: "ACCESS_DENIED", bytes: 218, hash: "c92b1a7f0d341b9a…", requestHash: "0e3a9a112855ac90…", note: "Role change denied by policy. No resource was modified.", group: "Today · 14:00—15:00" },
  { id: "req_2c81e4b6", time: "14:39:06", role: "FTO", method: "GET", route: "/v1/recruits/•••/daily-logs", code: 200, disposition: "COMPLETED", bytes: 0, hash: "b41c7790a3f0192d…", requestHash: "7a821c65181f4a0d…", group: "Today · 14:00—15:00" },
  { id: "req_5e13b8d2", time: "14:31:52", role: "UNAUTHENTICATED", method: "POST", route: "/v1/session", code: 429, disposition: "RATE_LIMITED", bytes: 64, hash: "5fa0c14e42b4a083…", requestHash: "aa51936df1cf0ac4…", note: "Request threshold reached. Retry-after policy applied.", group: "Today · 14:00—15:00" },
  { id: "req_0a94d711", time: "14:22:40", role: "SERGEANT", method: "GET", route: "/v1/phase-extensions", code: 200, disposition: "COMPLETED", bytes: 0, hash: "d2c8e94f03e37ca1…", requestHash: "13f23c88a509e1a7…", group: "Today · 14:00—15:00" },
  { id: "req_8b60c903", time: "13:58:13", role: "ADMIN", method: "DELETE", route: "/v1/audit-logs/export", code: 500, disposition: "UPSTREAM_ERROR", bytes: 0, hash: "43ad7c1b620bb568…", requestHash: "8c0bc9519b578d11…", note: "The request could not be completed. Upstream response was not available.", group: "Today · 13:00—14:00" },
  { id: "req_7d0f2aa4", time: "13:42:03", role: "FTO", method: "POST", route: "/v1/shift-reports", code: 201, disposition: "CREATED", bytes: 842, hash: "19bd87c06742ee31…", requestHash: "437e2c403ba9fe91…", group: "Today · 13:00—14:00" },
  { id: "req_313c89e2", time: "12:16:45", role: "ADMIN", method: "GET", route: "/v1/audit-logs", code: 200, disposition: "COMPLETED", bytes: 0, hash: "a4e91d8f0d466a02…", requestHash: "fb21c11e711cf849…", group: "Today · 12:00—13:00" },
  { id: "req_905bc773", time: "11:54:21", role: "RECRUIT", method: "PUT", route: "/v1/recruits/•••/orientation", code: 422, disposition: "VALIDATION_FAILED", bytes: 364, hash: "d9303e18c453bd27…", requestHash: "1730a456123d8f9c…", note: "The submitted record did not pass validation.", group: "Today · 11:00—12:00" },
];

type Filter = "All events" | "Needs attention" | "Successful";
const tone = (code: number) => code >= 500 ? "critical" : code >= 400 ? "caution" : "healthy";

export function AuditPulse() {
  const [filter, setFilter] = useState<Filter>("All events");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(events[0].id);
  const [copied, setCopied] = useState("");
  const [refreshed, setRefreshed] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState("All roles");

  const filtered = useMemo(() => events.filter((event) => {
    const matchesKind = filter === "All events" || (filter === "Needs attention" ? event.code >= 400 : event.code < 400);
    const matchesRole = roleFilter === "All roles" || roleFilter === event.role;
    const needle = query.trim().toLowerCase();
    const matchesQuery = !needle || [event.id, event.role, event.method, event.route, event.disposition].some((item) => item.toLowerCase().includes(needle));
    return matchesKind && matchesRole && matchesQuery;
  }), [filter, query, roleFilter]);
  const selected = selectedId ? filtered.find((event) => event.id === selectedId) ?? filtered[0] : undefined;
  const groups = Array.from(new Set(filtered.map((event) => event.group)));
  const successCount = events.filter((event) => event.code < 400).length;
  const attentionCount = events.filter((event) => event.code >= 400).length;

  const copyValue = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1500);
    } catch {
      setCopied("");
    }
  };

  return (
    <main className="pulse">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap');
        .pulse{--ink:#19373b;--sub:#698083;--line:#dce6e1;--paper:#eef3ef;--surface:#fbfcf8;--teal:#3a756b;--mint:#e5f1eb;--red:#a6443c;--redbg:#f8eae5;--amber:#98631f;--amberbg:#f8f0df;min-height:100dvh;background:var(--paper);color:var(--ink);font-family:'DM Sans',sans-serif;font-size:13px}
        .pulse *{box-sizing:border-box}.pulse button,.pulse input{font:inherit}.pulse button{cursor:pointer}
        .pulsebar{height:66px;background:#18363a;color:#f1f4ef;display:flex;align-items:center;justify-content:space-between;padding:0 34px;border-bottom:1px solid #365153}
        .pulsebrand{display:flex;align-items:center;gap:12px}.pulsemark{display:grid;place-items:center;width:32px;height:32px;border:1px solid #77958b;border-radius:8px;color:#b8d2c5}.pulselogo{font:800 12px Manrope,sans-serif;letter-spacing:.09em}.pulsesub{font:9px 'DM Mono',monospace;letter-spacing:.13em;color:#a9c0b6;margin-top:4px}
        .pulsebar-right{display:flex;align-items:center;gap:18px}.pulse-env{display:flex;align-items:center;gap:8px;border:1px solid #47635e;padding:7px 10px;color:#c5d8cc;font:9px 'DM Mono',monospace;letter-spacing:.07em}.pulse-live{width:7px;height:7px;border-radius:50%;background:#8bb79e}.pulse-user{display:flex;align-items:center;gap:8px;color:#dbe5df;border-left:1px solid #47605e;padding-left:17px;font-size:11px}.pulse-user svg{color:#a9c5b7}
        .pulse-main{max-width:1510px;margin:auto;padding:29px 34px 40px}.pulse-topline{display:flex;align-items:center;justify-content:space-between;margin-bottom:17px}.pulse-crumb{display:flex;align-items:center;gap:8px;color:#849491;font:9px 'DM Mono',monospace;letter-spacing:.08em;text-transform:uppercase}.pulse-crumb svg{color:#a3b2ac}.pulse-utc{display:flex;align-items:center;gap:7px;font:9px 'DM Mono',monospace;color:#768986}
        .pulse-heading{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:24px;gap:20px}.pulse-title{font:800 clamp(25px,3vw,34px)/1.1 Manrope,sans-serif;letter-spacing:-.05em;margin:0;color:#18363a}.pulse-description{margin:8px 0 0;color:#718583;font-size:12px}.pulse-actions{display:flex;gap:8px}.pulse-action{border:1px solid #cbd9d1;border-radius:4px;background:#f8faf6;color:#47645d;display:flex;align-items:center;gap:8px;height:34px;padding:0 12px;font-size:11px}.pulse-action:hover{background:#e5eee7}.pulse-action.is-refreshed{color:#347263}
        .pulse-overview{display:grid;grid-template-columns:1.15fr 1fr 1fr 1fr;gap:1px;border:1px solid var(--line);background:var(--line);margin-bottom:22px}.pulse-stat{background:var(--surface);padding:15px 18px;min-height:83px;display:flex;align-items:center;justify-content:space-between}.pulse-stat-name{font-size:10px;color:#728581}.pulse-stat-num{font:700 23px Manrope,sans-serif;letter-spacing:-.04em;margin-top:7px;color:#1e3b3d}.pulse-stat-note{font:9px 'DM Mono',monospace;color:#899895}.pulse-stat-icon{width:30px;height:30px;display:grid;place-items:center;background:#edf3ed;color:#618279;border-radius:50%}.pulse-stat.warn .pulse-stat-icon{background:var(--amberbg);color:var(--amber)}.pulse-rate{font:500 10px 'DM Mono',monospace;color:#59776e;margin-top:4px}
        .pulse-workspace{display:grid;grid-template-columns:minmax(380px,1.05fr) minmax(380px,.95fr);min-height:540px;border:1px solid var(--line);background:var(--surface);box-shadow:0 4px 18px rgba(27,54,51,.035)}
        .pulse-feed{min-width:0;border-right:1px solid var(--line)}.feed-head{padding:16px 18px 13px;border-bottom:1px solid var(--line)}.feed-head-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}.feed-title{display:flex;align-items:center;gap:8px;font:700 12px Manrope,sans-serif}.feed-title svg{color:var(--teal)}.feed-meta{font:9px 'DM Mono',monospace;color:#8b9995}.feed-controls{display:flex;gap:9px;align-items:center}.pulse-search{position:relative;flex:1}.pulse-search svg{position:absolute;left:10px;top:10px;color:#83938f}.pulse-search input{height:34px;width:100%;border:1px solid #dce5df;background:#f7f9f5;border-radius:3px;padding:0 10px 0 32px;outline:none;color:#304e4d;font-size:11px}.pulse-search input:focus{border-color:#84a79a}.pulse-search input::placeholder{color:#9ba9a3}.filter-toggle{height:34px;border:1px solid #dce5df;background:#f7f9f5;border-radius:3px;padding:0 10px;display:flex;align-items:center;gap:7px;color:#607671;font-size:10px}.filter-toggle:hover{background:#eaf1eb}.filter-pop{margin-top:10px;padding:10px 11px;background:#f1f5f0;border:1px solid #dbe5dd;display:flex;align-items:center;gap:9px;color:#72837e;font-size:10px}.filter-pop select{border:0;background:transparent;color:#385b55;font:10px 'DM Mono',monospace;outline:none}
        .pulse-tabs{display:flex;gap:4px;margin-top:13px}.pulse-tab{border:0;background:transparent;border-radius:3px;padding:7px 10px;color:#71837f;font-size:10px}.pulse-tab.active{background:#e8f1eb;color:#386b5d;font-weight:700}.pulse-tab em{font:9px 'DM Mono',monospace;color:#93a19a;font-style:normal;margin-left:4px}.pulse-tab.active em{color:#548174}
        .event-list{max-height:463px;overflow:auto}.event-group-label{padding:13px 18px 7px;color:#8a9994;font:9px 'DM Mono',monospace;letter-spacing:.08em;text-transform:uppercase;background:#fbfcf8;position:sticky;top:0;z-index:1}.event-row{width:100%;border:0;border-bottom:1px solid #edf1ed;background:transparent;text-align:left;display:grid;grid-template-columns:39px minmax(0,1fr) auto;gap:10px;padding:12px 18px;transition:background .15s ease;color:inherit}.event-row:hover{background:#f4f8f3}.event-row.active{background:#edf5ef;box-shadow:inset 3px 0 #538476}.event-indicator{width:29px;height:29px;border:1px solid #dbe8dd;background:#eff5ef;border-radius:50%;display:grid;place-items:center;color:#518171;margin-top:2px}.event-indicator.caution{background:#fbf3e5;border-color:#f0dfbd;color:#9c6b28}.event-indicator.critical{background:#f9ece8;border-color:#efd7d1;color:#a84b42}.event-main{min-width:0}.event-top{display:flex;align-items:center;gap:8px;margin-bottom:5px}.event-code{font:500 10px 'DM Mono',monospace;color:#435e5c}.event-id{font:9px 'DM Mono',monospace;color:#8a9995}.event-endpoint{font:10px 'DM Mono',monospace;color:#375453;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:6px}.event-bottom{display:flex;align-items:center;gap:7px;color:#84928d;font-size:9px}.event-role{border:1px solid #e0e8e1;padding:2px 5px;border-radius:2px;font:8px 'DM Mono',monospace;color:#6d8179}.event-right{display:flex;align-items:center;gap:8px;color:#9cab9f;font:9px 'DM Mono',monospace}.event-pill{padding:4px 6px;border-radius:2px;font:9px 'DM Mono',monospace}.event-pill.healthy{background:#e8f2ea;color:#427461}.event-pill.caution{background:#faf0dc;color:#93631f}.event-pill.critical{background:#f8e9e5;color:#a4463f}
        .pulse-detail{min-width:0;display:flex;flex-direction:column}.detail-head{padding:21px 23px 17px;background:#f4f7f2;border-bottom:1px solid var(--line)}.detail-top{display:flex;align-items:center;justify-content:space-between}.detail-kicker{font:9px 'DM Mono',monospace;letter-spacing:.08em;color:#7f918a;text-transform:uppercase}.detail-open{border:0;background:transparent;color:#81928b;padding:4px;display:grid;place-items:center}.detail-open:hover{color:#355d53}.detail-title-row{display:flex;align-items:center;gap:10px;margin-top:16px}.detail-title{margin:0;font:700 18px Manrope,sans-serif;letter-spacing:-.035em;color:#1e3b3c}.detail-pill{display:flex;align-items:center;gap:6px;font:9px 'DM Mono',monospace;padding:5px 8px;border-radius:2px}.detail-pill.healthy{background:#e7f1e9;color:#427562}.detail-pill.caution{background:#faf0dc;color:#91611e}.detail-pill.critical{background:#f8e9e5;color:#a4463f}.detail-route{margin-top:8px;font:11px 'DM Mono',monospace;color:#53706c}.detail-timestamp{display:flex;align-items:center;gap:6px;color:#899791;font:9px 'DM Mono',monospace;margin-top:13px}
        .detail-body{padding:19px 23px;overflow:auto}.detail-section{margin-bottom:22px}.detail-section-head{display:flex;align-items:center;gap:7px;color:#638077;font:700 9px Manrope,sans-serif;letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px}.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:15px 20px}.detail-cell small{display:block;color:#91a09a;font:9px 'DM Mono',monospace;margin-bottom:5px}.detail-cell strong{font:500 11px 'DM Mono',monospace;color:#3b5755;overflow-wrap:anywhere}.detail-cell .plain{font:500 11px 'DM Sans',sans-serif}.hash-card{background:#f3f6f1;border:1px solid #dfe8df;padding:10px 11px;margin-top:7px}.hash-line{display:flex;align-items:center;justify-content:space-between;gap:8px}.hash-value{font:10px 'DM Mono',monospace;color:#3c5c57;overflow-wrap:anywhere}.hash-copy{display:flex;align-items:center;gap:5px;border:0;background:transparent;padding:2px;color:#62857a;font-size:9px;white-space:nowrap}.hash-copy:hover{color:#285e51}.detail-note{border-left:2px solid #d2a55d;background:#fbf5e9;padding:11px 12px;color:#715c39;font-size:10px;line-height:1.55}.detail-note strong{display:block;font:700 9px Manrope,sans-serif;letter-spacing:.07em;text-transform:uppercase;color:#8d692e;margin-bottom:4px}.safe-foot{margin-top:auto;padding:12px 23px;border-top:1px solid var(--line);display:flex;gap:7px;align-items:center;color:#80918a;font-size:9px}.safe-foot svg{color:#6c9182;flex:none}.feed-empty{padding:38px 20px;text-align:center;color:#7b8b86;font-size:11px}.feed-empty strong{display:block;color:#47645d;margin-bottom:5px;font:700 12px Manrope,sans-serif}
        @media(max-width:880px){.pulse-main{padding:22px 20px}.pulse-overview{grid-template-columns:repeat(2,1fr)}.pulse-workspace{grid-template-columns:1fr}.pulse-feed{border-right:0;border-bottom:1px solid var(--line)}.event-list{max-height:360px}.pulse-detail{min-height:470px}}
        @media(max-width:560px){.pulsebar{padding:0 15px}.pulse-env{display:none}.pulse-main{padding:18px 12px 28px}.pulse-topline{align-items:flex-start}.pulse-utc{font-size:8px}.pulse-heading{align-items:flex-start;flex-direction:column;margin-bottom:18px}.pulse-title{font-size:27px}.pulse-actions{width:100%}.pulse-action{flex:1;justify-content:center}.pulse-overview{gap:1px}.pulse-stat{padding:12px;min-height:72px}.pulse-stat-num{font-size:20px}.pulse-stat-note{font-size:8px}.feed-head{padding:13px}.event-row{padding:11px 12px;grid-template-columns:32px minmax(0,1fr) auto;gap:7px}.event-indicator{width:26px;height:26px}.event-right{gap:5px}.event-id{display:none}.detail-head,.detail-body{padding-left:16px;padding-right:16px}.detail-grid{gap:13px}.safe-foot{padding:11px 16px}.pulse-user{border:0;padding-left:0}.pulse-user span{display:none}}
        @media(prefers-reduced-motion:reduce){.pulse *{transition-duration:.01ms!important;animation-duration:.01ms!important}}
      `}</style>
      <header className="pulsebar">
        <div className="pulsebrand"><div className="pulsemark"><ShieldCheck size={17} /></div><div><div className="pulselogo">GOVERNMENT SYSTEM</div><div className="pulsesub">SECURITY OBSERVABILITY</div></div></div>
        <div className="pulsebar-right"><div className="pulse-env"><i className="pulse-live" />MOCK_DEVELOPMENT</div><div className="pulse-user"><LockKeyhole size={14} /><span>ADMIN · ACTIVE SESSION</span></div></div>
      </header>
      <div className="pulse-main">
        <div className="pulse-topline"><div className="pulse-crumb"><span>Security</span><ChevronRight size={11} /><span>Activity monitor</span></div><div className="pulse-utc"><Clock3 size={12} /> TODAY · UTC</div></div>
        <div className="pulse-heading">
          <div><h1 className="pulse-title">Activity monitor</h1><p className="pulse-description">Follow requests as they move through the system. Review exceptions in context.</p></div>
          <div className="pulse-actions"><button className={`pulse-action ${refreshed ? "is-refreshed" : ""}`} onClick={() => { setRefreshed(true); window.setTimeout(() => setRefreshed(false), 1800); }}><RotateCw size={13} />{refreshed ? "Just checked" : "Check for updates"}</button><button className="pulse-action" onClick={() => { setFilter("All events"); setRoleFilter("All roles"); setQuery(""); }}><ListFilter size={13} />Reset view</button></div>
        </div>
        <section className="pulse-overview" aria-label="Request overview">
          <div className="pulse-stat"><div><div className="pulse-stat-name">Requests in view</div><div className="pulse-stat-num">{events.length}<span className="pulse-stat-note"> · last 4h</span></div></div><div className="pulse-stat-icon"><Activity size={15} /></div></div>
          <div className="pulse-stat"><div><div className="pulse-stat-name">Completed</div><div className="pulse-stat-num">{successCount}<span className="pulse-stat-note"> of {events.length}</span></div><div className="pulse-rate">{((successCount / events.length) * 100).toFixed(1)}% in this window</div></div><div className="pulse-stat-icon"><CircleCheck size={15} /></div></div>
          <div className="pulse-stat warn"><div><div className="pulse-stat-name">Needs attention</div><div className="pulse-stat-num">{attentionCount}<span className="pulse-stat-note"> responses</span></div><div className="pulse-rate">4xx and 5xx outcomes</div></div><div className="pulse-stat-icon"><CircleAlert size={15} /></div></div>
          <div className="pulse-stat"><div><div className="pulse-stat-name">Privacy posture</div><div className="pulse-stat-num" style={{fontSize:17,marginTop:10}}>Identifiers masked</div><div className="pulse-stat-note">safe review enabled</div></div><div className="pulse-stat-icon"><Fingerprint size={15} /></div></div>
        </section>
        <section className="pulse-workspace" aria-label="Audit activity workspace">
          <div className="pulse-feed">
            <div className="feed-head">
              <div className="feed-head-top"><div className="feed-title"><Activity size={15} />Request stream</div><span className="feed-meta">{filtered.length} EVENTS</span></div>
              <div className="feed-controls">
                <label className="pulse-search"><Search size={14} /><input aria-label="Search audit events" placeholder="Find route, request ID, role…" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
                <button className="filter-toggle" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}><ListFilter size={13} />Filter <ChevronDown size={12} /></button>
              </div>
              {filtersOpen ? <div className="filter-pop"><span>Actor role</span><select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Filter by actor role"><option>All roles</option><option>ADMIN</option><option>FTO</option><option>SERGEANT</option><option>RECRUIT</option><option>UNAUTHENTICATED</option></select></div> : null}
              <div className="pulse-tabs" role="tablist" aria-label="Filter by outcome">
                {(["All events", "Needs attention", "Successful"] as Filter[]).map((item) => <button key={item} role="tab" aria-selected={filter === item} className={`pulse-tab ${filter === item ? "active" : ""}`} onClick={() => setFilter(item)}>{item}<em>{item === "All events" ? events.length : item === "Needs attention" ? attentionCount : successCount}</em></button>)}
              </div>
            </div>
            <div className="event-list">
              {filtered.length ? groups.map((group) => <div key={group}><div className="event-group-label">{group}</div>{filtered.filter((event) => event.group === group).map((event) => <button type="button" key={event.id} className={`event-row ${selected?.id === event.id ? "active" : ""}`} onClick={() => setSelectedId(event.id)} aria-pressed={selected?.id === event.id}>
                <span className={`event-indicator ${tone(event.code)}`}>{event.code >= 400 ? <CircleAlert size={14} /> : <CircleCheck size={14} />}</span>
                <span className="event-main"><span className="event-top"><span className="event-code">{event.method}</span><span className="event-id">{event.id}</span></span><span className="event-endpoint">{event.route}</span><span className="event-bottom"><span className="event-role">{event.role}</span><span>{event.disposition.replaceAll("_", " ").toLowerCase()}</span></span></span>
                <span className="event-right"><span className={`event-pill ${tone(event.code)}`}>{event.code}</span><span>{event.time}</span><ChevronRight size={13} /></span>
              </button>)}</div>) : <div className="feed-empty"><strong>No matching requests</strong>Adjust your search or outcome filters.</div>}
            </div>
          </div>
          <div className="pulse-detail">
            {selected ? <>
              <div className="detail-head">
                <div className="detail-top"><span className="detail-kicker">Selected request · safe view</span><button className="detail-open" aria-label="Clear selected request" onClick={() => setSelectedId("")}><X size={15} /></button></div>
                <div className="detail-title-row"><h2 className="detail-title">{selected.disposition.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())}</h2><span className={`detail-pill ${tone(selected.code)}`}>{selected.code >= 400 ? <CircleAlert size={12} /> : <Check size={12} />}{selected.code} · {selected.disposition}</span></div>
                <div className="detail-route">{selected.method} &nbsp;{selected.route}</div>
                <div className="detail-timestamp"><Clock3 size={12} />Today at {selected.time} UTC <span>·</span> {selected.id}</div>
              </div>
              <div className="detail-body">
                <section className="detail-section"><div className="detail-section-head"><FileText size={13} />Request summary</div><div className="detail-grid">
                  <div className="detail-cell"><small>ACTOR ROLE</small><strong className="plain">{selected.role}</strong></div>
                  <div className="detail-cell"><small>PAYLOAD SIZE</small><strong>{selected.bytes.toLocaleString()} bytes</strong></div>
                  <div className="detail-cell"><small>HTTP METHOD</small><strong>{selected.method}</strong></div>
                  <div className="detail-cell"><small>RESPONSE CODE</small><strong>{selected.code}</strong></div>
                </div></section>
                {selected.note ? <div className="detail-note"><strong>System response</strong>{selected.note}</div> : null}
                <section className="detail-section" style={{marginTop:22}}><div className="detail-section-head"><Network size={13} />Pseudonymized references</div>
                  <div className="detail-cell"><small>ACTOR REFERENCE · SHA-256</small><div className="hash-card"><div className="hash-line"><span className="hash-value">{selected.hash}</span><button className="hash-copy" onClick={() => void copyValue("actor", selected.hash)}>{copied === "actor" ? <Check size={12} /> : <Copy size={12} />}{copied === "actor" ? "Copied" : "Copy"}</button></div></div></div>
                  <div className="detail-cell" style={{marginTop:10}}><small>REQUEST REFERENCE · SHA-256</small><div className="hash-card"><div className="hash-line"><span className="hash-value">{selected.requestHash}</span><button className="hash-copy" onClick={() => void copyValue("request", selected.requestHash)}>{copied === "request" ? <Check size={12} /> : <Copy size={12} />}{copied === "request" ? "Copied" : "Copy"}</button></div></div></div>
                </section>
                <section className="detail-section"><div className="detail-section-head"><Fingerprint size={13} />Request reference</div><div className="hash-card"><div className="hash-line"><span className="hash-value">{selected.id}</span><button className="hash-copy" onClick={() => void copyValue("id", selected.id)}>{copied === "id" ? <Check size={12} /> : <Copy size={12} />}{copied === "id" ? "Copied" : "Copy"}</button></div></div></section>
              </div>
              <div className="safe-foot"><ShieldCheck size={13} />Sensitive values are masked. References are one-way hashes, not user identifiers.<ArrowUpRight size={12} style={{marginLeft:"auto"}} /></div>
            </> : <div className="feed-empty" style={{margin:"auto"}}><strong>Select a request</strong>Choose an event in the stream to inspect its safe record.</div>}
          </div>
        </section>
      </div>
    </main>
  );
}
