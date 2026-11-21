import { useEffect, useMemo, useState } from "react";
import { apiEndpoint } from "@workspace/api-client-react/api-config";
import { clearMockToken } from "@workspace/api-client-react/auth";
import {
  Activity,
  AlertTriangle,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Copy,
  FileSearch,
  Fingerprint,
  LockKeyhole,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";

type AuditRecord = {
  timestamp: string;
  request_id: string;
  actor: { assigned_role: string; user_id_hash?: string };
  network: { client_ip_hash: string; user_agent: string };
  event: {
    http_method: string;
    endpoint: string;
    payload_bytes: number;
    status_code: number;
    success: boolean;
    disposition: string;
    error_message?: string;
  };
  source: Record<string, unknown>;
};
type FetchState = "loading" | "ready" | "error";

const text = (value: unknown, fallback: string): string =>
  typeof value === "string" && value.trim() ? value : fallback;
const numberValue = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const hashValue = (value: unknown): string | undefined =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value) ? value : undefined;

function normalizeRecord(value: unknown): AuditRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const network = row.network && typeof row.network === "object" && !Array.isArray(row.network)
    ? row.network as Record<string, unknown> : {};
  const event = row.event && typeof row.event === "object" && !Array.isArray(row.event)
    ? row.event as Record<string, unknown> : {};
  const rawActor = row.actor;
  let actorRole = "UNAUTHENTICATED";
  let userIdHash: string | undefined;
  if (typeof rawActor === "string" && ["ANONYMOUS", "UNAUTHENTICATED"].includes(rawActor)) {
    actorRole = rawActor;
  } else if (rawActor && typeof rawActor === "object" && !Array.isArray(rawActor)) {
    const actorObject = rawActor as Record<string, unknown>;
    const role = text(actorObject?.assigned_role, "Unspecified");
    actorRole = ["RECRUIT", "FTO", "SERGEANT", "ADMIN"].includes(role) ? role : "Unspecified";
    userIdHash = hashValue(actorObject?.user_id_hash);
  }
  const status = numberValue(event?.status_code, 0);
  const errorMessage = typeof event?.error_message === "string" ? event.error_message.slice(0, 200) : undefined;
  const method = text(event?.http_method, "—").toUpperCase();
  const allowedMethods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
  return {
    timestamp: text(row?.timestamp, "Timestamp unavailable"),
    request_id: text(row?.request_id, "Request ID unavailable").slice(0, 64),
    actor: { assigned_role: actorRole, ...(userIdHash ? { user_id_hash: userIdHash } : {}) },
    network: {
      client_ip_hash: hashValue(network?.client_ip_hash) ?? "Not provided",
      user_agent: text(network?.user_agent, "Not provided").slice(0, 80),
    },
    event: {
      http_method: allowedMethods.includes(method) ? method : "—",
      endpoint: text(event?.endpoint, "Route unavailable").slice(0, 200),
      payload_bytes: Math.max(0, numberValue(event?.payload_bytes)),
      status_code: status,
      success: typeof event?.success === "boolean" ? event.success : status >= 200 && status < 300,
      disposition: text(event?.disposition, "UNSPECIFIED"),
      ...(errorMessage ? { error_message: errorMessage } : {}),
    },
    source: row,
  };
}

function roleOf(log?: AuditRecord | null): string {
  return log?.actor?.assigned_role ?? "Unspecified";
}
function statusTone(code: number): string {
  if (code >= 500) return "critical";
  if (code >= 400) return "caution";
  if (code >= 200 && code < 300) return "healthy";
  return "neutral";
}
function formatTimestamp(value: string): { date: string; time: string } {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "—", time: value };
  return {
    date: new Intl.DateTimeFormat("en", { month: "short", day: "2-digit", year: "numeric", timeZone: "UTC" }).format(date),
    time: new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "UTC" }).format(date),
  };
}

export function AdminLogsDashboard() {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [environment, setEnvironment] = useState("MOCK_DEVELOPMENT");
  const [state, setState] = useState<FetchState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AuditRecord | null>(null);
  const [sessionActive, setSessionActive] = useState(true);
  const [copiedField, setCopiedField] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 15_000);
    setState("loading");
    setErrorMessage("");

    async function loadRecords() {
      try {
        const response = await fetch(apiEndpoint("/v1/audit-logs"), {
          method: "GET",
          cache: "no-store",
          headers: { Accept: "application/json" },
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`The audit service returned HTTP ${response.status}.`);
        const payload: unknown = await response.json();
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
          throw new Error("The audit service returned an unreadable response.");
        }
        const envelope = payload as Record<string, unknown>;
        const metadata = envelope.metadata && typeof envelope.metadata === "object" && !Array.isArray(envelope.metadata)
          ? envelope.metadata as Record<string, unknown> : {};
        if (envelope.status !== "success" || !Array.isArray(envelope.data)) {
          throw new Error("The audit service response did not match the expected record format.");
        }
        const normalized = envelope.data.map(normalizeRecord);
        if (normalized.some((record) => record === null)) {
          throw new Error("One or more audit records could not be safely validated.");
        }
        if (controller.signal.aborted) return;
        setRecords(normalized as AuditRecord[]);
        setTotalRecords(numberValue(metadata.total_records, normalized.length));
        setEnvironment(text(metadata.environment, "MOCK_DEVELOPMENT"));
        setState("ready");
      } catch (error) {
        if (controller.signal.aborted && !timedOut) return;
        if (controller.signal.aborted && timedOut) {
          setErrorMessage("The request took longer than 15 seconds. Retry to check the audit service again.");
        } else {
          setErrorMessage(error instanceof Error ? error.message : "A network error interrupted the request.");
        }
        setState("error");
      } finally {
        window.clearTimeout(timeoutId);
      }
    }
    void loadRecords();
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [attempt]);

  const visibleRecords = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return records;
    return records.filter((record) =>
      record.request_id.toLocaleLowerCase().includes(term) || roleOf(record).toLocaleLowerCase().includes(term),
    );
  }, [records, query]);
  const successRate = records.length
    ? `${((records.filter((record) => record.event.status_code === 200).length / records.length) * 100).toFixed(1)}%`
    : "—";
  const warnings = records.filter((record) => record.event.status_code >= 400).length;

  const logout = () => {
    clearMockToken();
    setSessionActive(false);
    setSelected(null);
    setRecords([]);
    setTotalRecords(0);
    setQuery("");
    setState("ready");
  };
  const copyHash = async (label: string, value: string) => {
    if (value === "Not provided") return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(label);
      window.setTimeout(() => setCopiedField(""), 1800);
    } catch {
      setCopiedField("");
    }
  };

  return (
    <main className="audit-shell">
      <style>{`
        .audit-shell{--ink:#172d38;--muted:#62757d;--line:#dce5e4;--paper:#f4f7f5;--surface:#fffefa;--teal:#246b66;--teal-soft:#e6f1ed;--amber:#9c641b;--amber-soft:#fbf1df;--red:#a33d39;--red-soft:#f9e8e5;min-height:100dvh;background:var(--paper);color:var(--ink);font-family:'DM Sans',sans-serif;font-size:14px;}
        .audit-shell *{box-sizing:border-box}.audit-shell button,.audit-shell input{font:inherit}.audit-shell button{cursor:pointer}.audit-topbar{height:68px;background:#18323c;color:#f3f6f3;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(18px,4vw,58px);border-bottom:1px solid rgba(255,255,255,.12)}
        .audit-brand{display:flex;align-items:center;gap:13px;min-width:0}.audit-brand-mark{width:34px;height:34px;border:1px solid #759a91;border-radius:9px;display:grid;place-items:center;color:#b8d2c9}.audit-brand-name{font:700 13px 'Manrope',sans-serif;letter-spacing:.055em}.audit-brand-sub{font:10px 'DM Mono',monospace;color:#a6bbb8;letter-spacing:.09em;margin-top:3px}.audit-top-right{display:flex;align-items:center;gap:19px}.audit-env{display:flex;align-items:center;gap:8px;border:1px solid rgba(173,206,194,.25);border-radius:4px;padding:7px 10px;color:#c4ded1;font:10px 'DM Mono',monospace;letter-spacing:.06em}.audit-env-dot{height:7px;width:7px;border-radius:50%;background:#79b59b;box-shadow:0 0 0 3px rgba(121,181,155,.12)}.audit-session{border-left:1px solid rgba(255,255,255,.18);padding-left:17px;display:flex;align-items:center;gap:9px;color:#dce7e2;font-size:12px}.audit-session small{display:block;color:#9fb5b2;font-size:10px;margin-top:2px}.audit-logout{display:flex;align-items:center;gap:7px;color:#dbe6e2;background:transparent;border:0;padding:8px 4px;font-size:12px}.audit-logout:hover{color:white}.audit-content{max-width:1440px;margin:0 auto;padding:33px clamp(18px,4vw,58px) 54px}.audit-crumb{font:10px 'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;color:#7b8a8b;margin-bottom:16px;display:flex;align-items:center;gap:8px}.audit-heading-row{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:25px}.audit-title{font:800 clamp(26px,3vw,36px)/1.12 'Manrope',sans-serif;letter-spacing:-.045em;margin:0;color:#18323c}.audit-intro{color:#718187;margin:9px 0 0;font-size:13px}.audit-heading-meta{display:flex;align-items:center;gap:8px;color:#6c7e82;font:10px 'DM Mono',monospace;white-space:nowrap}.audit-heading-meta svg{color:#527f76}.audit-metrics{display:grid;grid-template-columns:1.1fr 1fr 1fr;gap:12px;margin-bottom:24px}.audit-metric{position:relative;overflow:hidden;background:var(--surface);border:1px solid var(--line);border-radius:7px;padding:17px 20px 16px;min-height:105px}.audit-metric:before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:#91b7aa}.audit-metric:nth-child(2):before{background:#618f85}.audit-metric:nth-child(3):before{background:#d2a45c}.audit-metric-top{display:flex;align-items:center;justify-content:space-between;color:#708188;font-size:11px}.audit-metric-icon{color:#72958b}.audit-metric-value{font:700 27px 'Manrope',sans-serif;letter-spacing:-.04em;margin-top:10px;color:#203842}.audit-metric-note{font:10px 'DM Mono',monospace;color:#879596;margin-left:9px;letter-spacing:.02em}.audit-card{background:var(--surface);border:1px solid var(--line);border-radius:8px;overflow:hidden;box-shadow:0 5px 18px rgba(31,58,62,.035)}.audit-toolbar{min-height:68px;padding:13px 18px;display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:1px solid var(--line)}.audit-table-label{font:700 13px 'Manrope',sans-serif;display:flex;align-items:center;gap:9px}.audit-table-label svg{color:#508079}.audit-table-caption{font-size:11px;color:#849294;margin-top:4px}.audit-search{position:relative;width:min(300px,42vw)}.audit-search svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#7d8e8f}.audit-search input{width:100%;height:37px;border:1px solid #d8e2df;border-radius:5px;background:#fbfcfa;padding:0 12px 0 36px;color:#294149;outline:none;font-size:12px}.audit-search input:focus{border-color:#759e93;box-shadow:0 0 0 3px rgba(88,139,125,.11)}.audit-search input::placeholder{color:#99a6a4}.audit-table-wrap{overflow-x:auto}.audit-table{width:100%;border-collapse:collapse;min-width:880px}.audit-table thead{background:#f5f8f6}.audit-table th{text-align:left;padding:11px 14px;color:#718287;font:10px 'DM Mono',monospace;letter-spacing:.055em;text-transform:uppercase;border-bottom:1px solid #e0e8e5;white-space:nowrap}.audit-table td{padding:13px 14px;border-bottom:1px solid #edf1ef;font-size:12px;white-space:nowrap;vertical-align:middle}.audit-table tbody tr{transition:background .16s ease;cursor:pointer}.audit-table tbody tr:hover{background:#f5f9f6}.audit-table tbody tr:last-child td{border-bottom:0}.audit-time-date{font-size:11px;color:#3a5057}.audit-time-clock{font:10px 'DM Mono',monospace;color:#8a999a;margin-top:4px}.audit-role{display:inline-flex;align-items:center;gap:7px;color:#40585e;font-size:11px}.audit-role-mark{width:22px;height:22px;background:#eaf1ed;border:1px solid #dbe6df;border-radius:50%;display:grid;place-items:center;color:#4e766c}.audit-id{font:11px 'DM Mono',monospace;color:#536970}.audit-method{display:inline-block;min-width:43px;padding:4px 6px;text-align:center;border-radius:3px;background:#eff4f1;color:#45655d;font:10px 'DM Mono',monospace}.audit-route{font:11px 'DM Mono',monospace;color:#38535a}.audit-status{display:inline-flex;align-items:center;gap:7px;padding:4px 8px;border-radius:3px;font:11px 'DM Mono',monospace}.audit-status.healthy{color:#276958;background:#e8f3ec}.audit-status.caution{color:#8a5b18;background:#fbf0dd}.audit-status.critical{color:#9d3837;background:#fae7e5}.audit-status.neutral{color:#64777c;background:#eef2f0}.audit-status.critical .audit-status-dot{animation:audit-pulse 1.7s infinite}.audit-status-dot{width:6px;height:6px;background:currentColor;border-radius:50%}@keyframes audit-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.38;transform:scale(.72)}}.audit-row-arrow{color:#a5b2b0;display:flex;align-items:center}.audit-foot{padding:12px 18px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #e8eeeb;color:#849294;font:10px 'DM Mono',monospace}.audit-foot strong{color:#4d676b;font-weight:500}.audit-loading,.audit-error,.audit-empty{padding:40px 20px;text-align:center;color:#6d8083}.audit-loading{display:grid;gap:12px}.audit-skeleton{height:15px;background:linear-gradient(90deg,#edf2ef 20%,#f6f8f6 45%,#edf2ef 70%);background-size:220% 100%;border-radius:4px;animation:audit-shimmer 1.4s ease infinite}.audit-skeleton:nth-child(2){width:83%}.audit-skeleton:nth-child(3){width:91%}.audit-skeleton:nth-child(4){width:72%}@keyframes audit-shimmer{to{background-position-x:-220%}}.audit-empty-icon,.audit-error-icon{height:40px;width:40px;margin:0 auto 12px;display:grid;place-items:center;background:#edf3ef;color:#5c847a;border-radius:50%}.audit-empty h3,.audit-error h3{font:700 14px 'Manrope',sans-serif;color:#29434b;margin:0 0 6px}.audit-empty p,.audit-error p{font-size:12px;margin:0 0 15px}.audit-error-icon{background:#fbf0dd;color:#926629}.audit-retry{border:1px solid #bfd1c9;border-radius:4px;background:#f6faf7;padding:8px 12px;color:#426c61;font-size:11px;display:inline-flex;align-items:center;gap:7px}.audit-retry:hover{background:#eaf3ed}.audit-session-ended{background:#e8efec;color:#456660;border:1px solid #d2e1db;border-radius:5px;padding:8px 11px;font-size:11px;display:flex;align-items:center;gap:7px}.audit-drawer-scrim{position:fixed;inset:0;background:rgba(16,35,40,.32);z-index:8;animation:audit-fade .18s ease}.audit-drawer{position:fixed;z-index:9;right:0;top:0;height:100dvh;width:min(520px,100vw);background:#fbfcf9;box-shadow:-16px 0 45px rgba(22,45,49,.16);display:flex;flex-direction:column;animation:audit-slide .22s ease}.audit-drawer-head{padding:22px 24px 18px;background:#18323c;color:#f3f6f2}.audit-drawer-top{display:flex;align-items:center;justify-content:space-between}.audit-drawer-eyebrow{font:10px 'DM Mono',monospace;color:#a9c2b9;letter-spacing:.1em;text-transform:uppercase}.audit-close{width:30px;height:30px;display:grid;place-items:center;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.17);border-radius:4px;color:white}.audit-drawer h2{font:700 20px 'Manrope',sans-serif;margin:16px 0 8px;letter-spacing:-.03em}.audit-drawer-sub{font:11px 'DM Mono',monospace;color:#b1c3be;word-break:break-all}.audit-drawer-body{padding:22px 24px;overflow:auto}.audit-detail-status{display:flex;justify-content:space-between;align-items:center;padding-bottom:18px;border-bottom:1px solid var(--line);margin-bottom:20px}.audit-detail-status span:first-child{color:#728389;font-size:11px}.audit-detail-section{margin-bottom:23px}.audit-detail-title{font:700 11px 'Manrope',sans-serif;color:#496268;text-transform:uppercase;letter-spacing:.07em;display:flex;align-items:center;gap:7px;margin-bottom:12px}.audit-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 16px}.audit-detail-cell small{display:block;color:#899798;font:10px 'DM Mono',monospace;margin-bottom:5px}.audit-detail-cell div{font-size:12px;color:#2d454c;overflow-wrap:anywhere}.audit-detail-cell .mono{font:11px 'DM Mono',monospace}.audit-hash-block{border:1px solid #dce6e2;background:#f2f6f3;border-radius:5px;padding:10px 11px;margin-top:7px}.audit-hash-top{display:flex;align-items:center;justify-content:space-between;color:#728380;font:10px 'DM Mono',monospace}.audit-copy{border:0;background:transparent;color:#55796f;padding:3px;display:flex;align-items:center;gap:5px;font-size:10px}.audit-hash-block pre{white-space:pre-wrap;overflow-wrap:anywhere;user-select:text;font:11px/1.6 'DM Mono',monospace;color:#29484d;margin:9px 0 0}.audit-json{margin:0;padding:14px;background:#eef3f0;border:1px solid #dce6e1;border-radius:5px;white-space:pre-wrap;overflow-wrap:anywhere;user-select:text;color:#405a60;font:10px/1.7 'DM Mono',monospace}.audit-disclaimer{border-top:1px solid var(--line);padding-top:14px;color:#839290;font-size:10px;line-height:1.55;display:flex;gap:8px}.audit-disclaimer svg{flex:none;color:#718f83}.audit-session-notice{margin-top:15px;padding:11px 13px;border-radius:5px;background:#edf3ef;color:#56736b;font-size:11px;display:flex;gap:8px;align-items:center}.audit-live-dot{width:7px;height:7px;background:#8bbc9f;border-radius:50%}@keyframes audit-slide{from{transform:translateX(18px);opacity:.7}to{transform:translateX(0);opacity:1}}@keyframes audit-fade{from{opacity:0}to{opacity:1}}
        @media(max-width:760px){.audit-topbar{height:auto;min-height:64px;padding:12px 16px}.audit-brand-sub{display:none}.audit-top-right{gap:10px}.audit-session{display:none}.audit-env{font-size:9px;padding:6px 7px}.audit-logout{font-size:0}.audit-logout svg{width:18px;height:18px}.audit-content{padding:25px 15px 38px}.audit-heading-row{align-items:flex-start;flex-direction:column;gap:12px;margin-bottom:19px}.audit-title{font-size:28px}.audit-heading-meta{font-size:9px}.audit-metrics{grid-template-columns:1fr;gap:8px;margin-bottom:16px}.audit-metric{min-height:auto;padding:13px 16px}.audit-metric-value{font-size:23px;margin-top:6px}.audit-toolbar{align-items:flex-start;flex-direction:column;padding:14px}.audit-search{width:100%}.audit-table-wrap{overflow:visible}.audit-table{min-width:0;display:block}.audit-table thead{display:none}.audit-table tbody{display:grid;gap:0}.audit-table tr{display:grid;grid-template-columns:1fr auto;gap:5px 10px;padding:13px 14px;border-bottom:1px solid #edf1ef}.audit-table td{padding:0;border:0;white-space:normal}.audit-table td:nth-child(1){grid-column:1;grid-row:1}.audit-table td:nth-child(2){grid-column:1;grid-row:2}.audit-table td:nth-child(3){grid-column:1;grid-row:3}.audit-table td:nth-child(4){display:none}.audit-table td:nth-child(5){grid-column:1 / 3;grid-row:4;overflow-wrap:anywhere;padding-top:3px}.audit-table td:nth-child(6){grid-column:2;grid-row:1 / 3;align-self:center}.audit-table td:nth-child(7){display:none}.audit-time-date{display:inline}.audit-time-clock{display:inline;margin-left:7px}.audit-role-mark{width:19px;height:19px}.audit-foot{padding:11px 14px;font-size:9px}.audit-drawer-head{padding:18px}.audit-drawer-body{padding:18px}.audit-detail-grid{gap:13px 10px}.audit-disclaimer{font-size:9px}}
        @media(prefers-reduced-motion:reduce){.audit-shell *, .audit-shell *:before{animation-duration:.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important;transition-duration:.01ms!important}}
      `}</style>
      <style>{`
        .audit-metrics-heading{margin:0 0 10px;color:#526c70}
        @media(max-width:760px) {
          .audit-table td:nth-child(4){display:block;grid-column:2;grid-row:2;align-self:center;text-align:right}
          .audit-table td:nth-child(6){grid-column:2;grid-row:1;align-self:center}
          .audit-method::before{content:"HTTP "}
        }
      `}</style>
      <header className="audit-topbar" data-testid="region-secure-navigation">
        <div className="audit-brand">
          <div className="audit-brand-mark"><ShieldCheck size={19} strokeWidth={1.8} /></div>
          <div><div className="audit-brand-name">ADMIN AUDIT LOG</div><div className="audit-brand-sub">GOVERNMENT SYSTEM</div></div>
        </div>
        <div className="audit-top-right">
          <div className="audit-env" data-testid="status-environment"><span className="audit-env-dot" />{environment}</div>
          {sessionActive ? <div className="audit-session" data-testid="status-active-role"><LockKeyhole size={14} /><span>ADMIN<small>Active role</small></span></div> : <div className="audit-session-ended" data-testid="status-session-ended"><Check size={13} />Session ended</div>}
          <button className="audit-logout" type="button" onClick={logout} disabled={!sessionActive} data-testid="button-logout" aria-label="Log out"><LogOut size={15} />Log out</button>
        </div>
      </header>

      <section className="audit-content">
        <div className="audit-crumb"><span>Government System</span><ChevronRight size={12} /><span>Admin Audit Log</span></div>
        <div className="audit-heading-row">
          <div><h1 className="audit-title">Admin Audit Log</h1><p className="audit-intro">A traceable record of API access events and response outcomes.</p></div>
          <div className="audit-heading-meta"><Clock3 size={14} /> All timestamps shown in UTC <span aria-hidden="true">·</span> Latest records first</div>
        </div>
        <div className="audit-table-label audit-metrics-heading">System Telemetry</div>
        <div className="audit-metrics" data-testid="region-audit-telemetry" aria-label="System Telemetry">
          <article className="audit-metric" data-testid="metric-total-requests"><div className="audit-metric-top"><span>Total API Requests</span><Activity size={15} className="audit-metric-icon" /></div><div className="audit-metric-value">{state === "ready" ? totalRecords.toLocaleString("en-US") : "—"}<span className="audit-metric-note">records in response</span></div></article>
          <article className="audit-metric" data-testid="metric-success-rate"><div className="audit-metric-top"><span>Global Success Rate</span><Check size={15} className="audit-metric-icon" /></div><div className="audit-metric-value">{state === "ready" ? successRate : "—"}<span className="audit-metric-note">of returned requests were 200</span></div></article>
          <article className="audit-metric" data-testid="metric-security-warnings"><div className="audit-metric-top"><span>Active Security Warnings</span><AlertTriangle size={15} className="audit-metric-icon" /></div><div className="audit-metric-value">{state === "ready" ? warnings : "—"}<span className="audit-metric-note">4xx / 5xx responses</span></div></article>
        </div>

        <section className="audit-card" aria-label="Forensic audit records" data-testid="region-forensic-grid">
          <div className="audit-toolbar">
            <div><div className="audit-table-label"><FileSearch size={16} /> Request records</div><div className="audit-table-caption">Review pseudonymized access events. Select a row to inspect its safe record.</div></div>
            <label className="audit-search"><Search size={15} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search request ID or actor role" aria-label="Search request ID or actor role" data-testid="input-audit-search" /></label>
          </div>
          {state === "loading" ? <div className="audit-loading" aria-busy="true" data-testid="state-audit-loading"><div className="audit-skeleton" /><div className="audit-skeleton" /><div className="audit-skeleton" /><div className="audit-skeleton" /></div> : null}
          {state === "error" ? <div className="audit-error" role="alert" data-testid="state-audit-error"><div className="audit-error-icon"><AlertTriangle size={18} /></div><h3>Audit records unavailable</h3><p>{errorMessage || "The audit request could not be completed."}</p><button type="button" className="audit-retry" onClick={() => setAttempt((value) => value + 1)} data-testid="button-retry-audit"><RefreshCw size={13} />Try Again</button></div> : null}
          {state === "ready" && visibleRecords.length === 0 ? <div className="audit-empty" data-testid="state-audit-empty"><div className="audit-empty-icon"><CircleHelp size={18} /></div><h3>{records.length === 0 ? "No audit records yet" : "No matching records"}</h3><p>{records.length === 0 ? "There are no API access events in this response." : "Try a different request ID or actor role."}</p>{query ? <button className="audit-retry" type="button" onClick={() => setQuery("")} data-testid="button-clear-search">Clear search</button> : null}</div> : null}
          {state === "ready" && visibleRecords.length > 0 ? <>
            <div className="audit-table-wrap">
              <table className="audit-table">
                <thead><tr><th>Timestamp · UTC</th><th>Actor role</th><th>Request ID</th><th>HTTP method</th><th>Target endpoint route</th><th>Status code</th><th aria-label="Open record" /></tr></thead>
                <tbody>{visibleRecords.map((record, index) => {
                  const stamp = formatTimestamp(record.timestamp);
                  const tone = statusTone(record.event.status_code);
                  return <tr key={`${record.request_id}-${index}`} onClick={() => setSelected(record)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(record); } }} tabIndex={0} aria-haspopup="dialog" data-testid={`row-audit-record-${index}`} aria-label={`Inspect ${record.request_id}`}>
                    <td><div className="audit-time-date">{stamp.date}</div><div className="audit-time-clock">{stamp.time}</div></td>
                    <td><span className="audit-role"><span className="audit-role-mark"><Fingerprint size={12} /></span>{roleOf(record)}</span></td>
                    <td className="audit-id" data-testid={`text-request-id-${index}`}>{record.request_id}</td>
                    <td><span className="audit-method">{record.event.http_method}</span></td>
                    <td className="audit-route">{record.event.endpoint}</td>
                    <td><span className={`audit-status ${tone}`} data-testid={`status-code-${index}`}><span className="audit-status-dot" />{record.event.status_code || "—"}</span></td>
                    <td><span className="audit-row-arrow"><ChevronRight size={15} /></span></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
            <div className="audit-foot"><span>Showing <strong>{visibleRecords.length}</strong> of <strong>{totalRecords}</strong> records</span><span>Safe view · identifiers pseudonymized</span></div>
          </> : null}
        </section>
        {!sessionActive ? <div className="audit-session-notice" data-testid="notice-session-ended"><LockKeyhole size={14} />Session ended. Loaded audit records were cleared from this view.</div> : null}
      </section>

      {selected ? <><div className="audit-drawer-scrim" onClick={() => setSelected(null)} aria-hidden="true" />
        <aside className="audit-drawer" role="dialog" aria-modal="true" aria-label="Audit record details" data-testid="panel-audit-details">
          <div className="audit-drawer-head"><div className="audit-drawer-top"><span className="audit-drawer-eyebrow">Record detail · safe view</span><button type="button" className="audit-close" onClick={() => setSelected(null)} aria-label="Close details" data-testid="button-close-details"><X size={16} /></button></div><h2>Request details</h2><div className="audit-drawer-sub">{selected.request_id}</div></div>
          <div className="audit-drawer-body">
            <div className="audit-detail-status"><span>Response status</span><span className={`audit-status ${statusTone(selected.event.status_code)}`}><span className="audit-status-dot" />{selected.event.status_code || "—"} · {selected.event.disposition}</span></div>
            <section className="audit-detail-section"><div className="audit-detail-title"><Activity size={13} /> Event</div><div className="audit-detail-grid">
              <div className="audit-detail-cell"><small>Timestamp · UTC</small><div>{selected.timestamp}</div></div>
              <div className="audit-detail-cell"><small>Actor role</small><div>{roleOf(selected)}</div></div>
              <div className="audit-detail-cell"><small>HTTP method</small><div className="mono">{selected.event.http_method}</div></div>
              <div className="audit-detail-cell"><small>Payload size</small><div>{selected.event.payload_bytes.toLocaleString()} bytes</div></div>
              <div className="audit-detail-cell" style={{ gridColumn: "1 / -1" }}><small>Target endpoint route</small><div className="mono">{selected.event.endpoint}</div></div>
              {selected.event.error_message ? <div className="audit-detail-cell" style={{ gridColumn: "1 / -1" }}><small>Response note</small><div>{selected.event.error_message}</div></div> : null}
            </div></section>
            <section className="audit-detail-section"><div className="audit-detail-title"><LockKeyhole size={13} /> Pseudonymized identifiers</div>
              <div className="audit-hash-block"><div className="audit-hash-top"><span>CLIENT_IP_HASH</span><button type="button" className="audit-copy" onClick={() => void copyHash("client_ip_hash", selected?.network?.client_ip_hash ?? "Not provided")} data-testid="button-copy-client-ip-hash">{copiedField === "client_ip_hash" ? <Check size={12} /> : <Copy size={12} />}{copiedField === "client_ip_hash" ? "Copied" : "Copy"}</button></div><pre data-testid="text-client-ip-hash"><code>{selected?.network?.client_ip_hash ?? "Not provided"}</code></pre></div>
              <div className="audit-hash-block"><div className="audit-hash-top"><span>USER_ID_HASH</span><button type="button" className="audit-copy" onClick={() => void copyHash("user_id_hash", selected?.actor?.user_id_hash ?? "Not provided")} data-testid="button-copy-user-id-hash">{copiedField === "user_id_hash" ? <Check size={12} /> : <Copy size={12} />}{copiedField === "user_id_hash" ? "Copied" : "Copy"}</button></div><pre data-testid="text-user-id-hash"><code>{selected?.actor?.user_id_hash ?? "Not provided"}</code></pre></div>
            </section>
            <section className="audit-detail-section"><div className="audit-detail-title"><FileSearch size={13} /> Complete safe record</div><pre className="audit-json" data-testid="text-safe-record-json"><code>{JSON.stringify(selected?.source ?? {}, null, 2)}</code></pre></section>
            <div className="audit-disclaimer"><ShieldCheck size={14} /><span>Identifiers are shown only as hashes supplied by the audit service. This panel contains no raw network address or user identifier.</span></div>
          </div>
        </aside>
      </> : null}
    </main>
  );
}

export default AdminLogsDashboard;
