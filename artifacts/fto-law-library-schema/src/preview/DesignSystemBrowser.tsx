import { Suspense, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ChevronRight, Moon, Search, Sun } from "lucide-react";
import { ALL_ENTRIES, DESIGN_SYSTEM, NAV_GROUPS, OVERVIEW_ENTRY } from "./registry.js";

function currentPage() {
  const id = new URLSearchParams(window.location.hash.slice(1)).get("page");
  return ALL_ENTRIES.some(entry => entry.id === id) ? id! : "overview";
}
export function DesignSystemBrowser() {
  const [page, setPage] = useState(currentPage);
  const [query, setQuery] = useState("");
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const onHash = () => setPage(currentPage());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    return () => document.documentElement.classList.remove("dark");
  }, [dark]);
  const groups = useMemo(() => NAV_GROUPS.map(group => ({ ...group, entries: group.entries.filter(entry =>
    `${group.name} ${entry.name} ${entry.description}`.toLowerCase().includes(query.trim().toLowerCase())) })).filter(group => group.entries.length), [query]);
  const selected = ALL_ENTRIES.find(entry => entry.id === page) ?? OVERVIEW_ENTRY;
  const Page = selected.Page;
  const select = (id: string) => { window.location.hash = new URLSearchParams({ page: id }).toString(); setPage(id); };
  return <div className="ds-browser fls-scope">
    <aside className="ds-sidebar">
      <a className="ds-wordmark" href="#page=overview" onClick={() => select("overview")}>
        <span>FTO / REFERENCE</span><strong>Law Library<br/>Schema<span className="ds-dot">.</span></strong></a>
      <div className="ds-catalog-label">DESIGN SYSTEM <span>01</span></div>
      <label className="ds-nav-search"><Search size={14}/><input aria-label="Find a design-system section" placeholder="Find a component..." value={query} onChange={event => setQuery(event.target.value)}/></label>
      <nav aria-label="Design system sections">
        {(!query || "overview".includes(query.toLowerCase())) && <button className={`ds-nav-link ${page === "overview" ? "active" : ""}`} type="button" onClick={() => select("overview")} aria-current={page === "overview" ? "page" : undefined}>Overview<ArrowUpRight size={13}/></button>}
        {groups.map(group => <section className="ds-nav-group" key={group.name}><h2>{group.name}</h2>
          {group.entries.map(entry => <button type="button" key={entry.id} className={`ds-nav-link ${entry.id === page ? "active" : ""}`}
            aria-current={entry.id === page ? "page" : undefined} onClick={() => select(entry.id)}>{entry.name}{entry.id === page && <ChevronRight size={13}/>}</button>)}</section>)}
        {!groups.length && query && <p className="ds-muted">No matching sections.</p>}
      </nav>
      <div className="ds-sidebar-note"><span className="ds-status-dot"/>EXTRACTED · NOT APPLIED<p>Existing screens remain unchanged.<br/>Application requires your approval.</p></div>
    </aside>
    <div className="ds-body"><header className="ds-topbar"><span>{DESIGN_SYSTEM.title}</span>
      <button type="button" className="ds-theme" aria-pressed={dark} onClick={() => setDark(value => !value)}>{dark ? <Sun size={14}/> : <Moon size={14}/>}
        {dark ? "Light source" : "Dark · derived"}</button></header>
      {dark && <div className="ds-derived" role="status">Derived dark theme · the source mockup defines light mode only.</div>}
      <main className="ds-page"><div className="ds-breadcrumb">Design system <ChevronRight size={11}/>{selected.name}</div>
        <Suspense fallback={<div className="ds-loading" role="status">Loading component reference…</div>}><Page/></Suspense>
      </main>
    </div>
  </div>;
}
