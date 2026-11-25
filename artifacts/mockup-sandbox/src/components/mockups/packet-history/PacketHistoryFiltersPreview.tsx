import { useState } from "react";
import { CalendarDays, ChevronDown, FilterX, Search } from "lucide-react";
import "./packet-history-preview.css";

const samplePackets = [
  { id: "SYNTHETIC-PT-104", date: "Nov 23, 2026", recruit: "Mia Santos", badge: "PO-4821", phase: "Phase II" },
  { id: "SYNTHETIC-PT-098", date: "Nov 18, 2026", recruit: "Mia Santos", badge: "PO-4821", phase: "Phase II" },
  { id: "SYNTHETIC-PT-091", date: "Nov 12, 2026", recruit: "Mia Santos", badge: "PO-4821", phase: "Phase II" },
  { id: "SYNTHETIC-PT-087", date: "Nov 6, 2026", recruit: "Mia Santos", badge: "PO-4821", phase: "Phase I" },
];

/** Fictional-only UI review. No portal APIs, account state, or real packet data. */
export function PacketHistoryFiltersPreview() {
  const [recruit, setRecruit] = useState("Mia Santos");
  const [from, setFrom] = useState("2026-11-01");
  const [to, setTo] = useState("2026-11-30");
  const [applied, setApplied] = useState("Mia Santos");
  const [page, setPage] = useState(1);

  function applyFilters() {
    setApplied(recruit.trim());
    setPage(1);
  }
  function clearFilters() {
    setRecruit("");
    setFrom("");
    setTo("");
    setApplied("");
    setPage(1);
  }

  const visiblePackets = samplePackets.slice(0, page === 1 ? 2 : samplePackets.length);

  return <main className="packet-history-preview packet-transfer">
    <div className="php-banner">
      <strong>Sandbox Preview — Approval Required</strong>
      <span>Fictional Examples · No Live Records · Portal Unchanged</span>
    </div>
    <header className="php-header">
      <div><p className="pp-eyebrow">Division of Police</p><h1>Field Training Officer Portal</h1></div>
      <span className="php-role">FTO</span>
    </header>
    <section className="php-panel">
      <div className="php-title">
        <div><p className="pp-eyebrow">Daily Records / Shared Records</p><h2>Packet History</h2></div>
        <span className="php-read-only">Read-Only Agency Copies</span>
      </div>
      <p className="php-intro">Find records by recruit and date. Results stay limited to the assignments authorized for your signed-in account.</p>

      <section className="php-filters" aria-label="Filter packet history">
        <label className="php-recruit">
          <span>Recruit name or badge</span>
          <input value={recruit} onChange={event => setRecruit(event.target.value)}
            placeholder="Search recruit" aria-label="Recruit name or badge" />
        </label>
        <label>
          <span>From date</span>
          <div className="php-date"><CalendarDays size={16} aria-hidden="true" />
            <input type="date" value={from} onChange={event => setFrom(event.target.value)} aria-label="From date" />
          </div>
        </label>
        <label>
          <span>To date</span>
          <div className="php-date"><CalendarDays size={16} aria-hidden="true" />
            <input type="date" value={to} onChange={event => setTo(event.target.value)} aria-label="To date" />
          </div>
        </label>
        <div className="php-actions">
          <button type="button" className="pp-button pp-primary" onClick={applyFilters}><Search size={15} />Apply filters</button>
          <button type="button" className="pp-button pp-secondary" onClick={clearFilters}><FilterX size={15} />Clear</button>
        </div>
      </section>
      <p className="php-filter-note">Date range includes both selected dates. Applying new filters starts from the newest matching record.</p>

      <div className="php-results-heading">
        <div><h3>Matching packets</h3><p>{applied ? `Recruit: ${applied}` : "All authorized recruits"} · {from || "Any date"} to {to || "Any date"}</p></div>
        <span>Showing {visiblePackets.length} of 4</span>
      </div>
      <ul className="php-records">
        {visiblePackets.map(packet => <li key={packet.id}>
          <div className="php-record-icon"><CalendarDays size={17} /></div>
          <div className="php-record-main">
            <strong>{packet.date} · {packet.recruit}</strong>
            <span>{packet.badge} · {packet.phase} · Read-only</span>
          </div>
          <span className="php-record-id">{packet.id}</span>
        </li>)}
      </ul>
      <div className="php-pagination">
        <p>Showing the newest matching records first. More records load in bounded pages.</p>
        <button type="button" className="pp-button pp-secondary" disabled={page > 1} onClick={() => setPage(2)}>
          <ChevronDown size={15} />{page === 1 ? "Load older records" : "All preview records shown"}
        </button>
      </div>
    </section>
    <p className="php-footer">Every page rechecks the server roster. Changing a filter resets pagination; continuation pages keep the same filters.</p>
  </main>;
}
