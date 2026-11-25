import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownAZ,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  FileText,
  FolderOpen,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";

type Resource = {
  title: string;
  group: "Uploaded reference documents";
  note?: string;
};

const resources: Resource[] = [
  { title: "Amy's Law Factors", group: "Uploaded reference documents" },
  { title: "BMV 2255", group: "Uploaded reference documents", note: "2 files" },
  { title: "Domestic Violence Protocol", group: "Uploaded reference documents" },
  { title: "Drug Possession Weights", group: "Uploaded reference documents" },
  { title: "DV Strangulation Diagram", group: "Uploaded reference documents" },
  { title: "Key Criminal Law Issues (2024)", group: "Uploaded reference documents" },
  { title: "Ohio Constitutional Opinions", group: "Uploaded reference documents" },
  { title: "Ohio Supreme Court Felony Quick Reference", group: "Uploaded reference documents" },
  { title: "Police Phone Directory", group: "Uploaded reference documents" },
  { title: "Prior Offenses Constituting WUD", group: "Uploaded reference documents" },
];

export function ResourceLibraryRefined() {
  const [query, setQuery] = useState("");
  const [sortAZ, setSortAZ] = useState(false);
  const [selected, setSelected] = useState<Resource | null>(null);
  const [category, setCategory] = useState<"All resources" | "Uploaded reference documents">("All resources");

  const filteredResources = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = resources.filter((item) => {
      const matchesCategory = category === "All resources" || item.group === category;
      const matchesQuery = !normalizedQuery || `${item.title} ${item.group} ${item.note ?? ""}`.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
    return sortAZ ? [...filtered].sort((a, b) => a.title.localeCompare(b.title)) : filtered;
  }, [category, query, sortAZ]);

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  return (
    <main className="rlr-shell">
      <style>{`
        .rlr-shell {
          --rlr-ink: #20283c;
          --rlr-muted: #768096;
          --rlr-line: #e1e5ed;
          --rlr-paper: #f4f6fa;
          --rlr-surface: #ffffff;
          --rlr-primary: #4f55a5;
          --rlr-primary-soft: #eeeffb;
          min-height: 100dvh;
          background: var(--rlr-paper);
          color: var(--rlr-ink);
          font: 14px/1.5 "DM Sans", Inter, sans-serif;
          position: relative;
          isolation: isolate;
        }
        .rlr-shell *, .rlr-shell *::before, .rlr-shell *::after { box-sizing: border-box; }
        .rlr-shell button, .rlr-shell input { font: inherit; }
        .rlr-shell button { cursor: pointer; }
        .rlr-shell :focus-visible { outline: 2px solid #777dc1; outline-offset: 3px; }
        .rlr-layout { min-height: 100dvh; display: grid; grid-template-columns: 248px minmax(0, 1fr); }
        .rlr-sidebar {
          min-height: 100%;
          padding: 25px 16px 18px;
          background: #fbfcfe;
          border-right: 1px solid var(--rlr-line);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .rlr-brand { display: flex; align-items: center; gap: 11px; padding: 2px 9px 29px; }
        .rlr-brand-mark {
          width: 36px; height: 36px; flex: none; display: grid; place-items: center;
          color: white; background: var(--rlr-primary); border-radius: 9px;
          box-shadow: 0 4px 10px #4f55a526;
        }
        .rlr-brand-name { font: 800 14px/1.2 Manrope, Inter, sans-serif; letter-spacing: -.02em; }
        .rlr-brand-sub { margin-top: 4px; color: #8991a6; font: 9px/1.2 "DM Mono", monospace; letter-spacing: .08em; }
        .rlr-eyebrow { margin: 0 0 9px; padding: 0 11px; color: #9199aa; font: 500 9px/1.4 "DM Mono", monospace; letter-spacing: .12em; text-transform: uppercase; }
        .rlr-nav { display: grid; gap: 4px; }
        .rlr-nav button {
          width: 100%; min-height: 40px; display: flex; align-items: center; gap: 10px;
          border: 0; border-radius: 6px; padding: 9px 11px; background: transparent;
          color: #667087; text-align: left; font-size: 12px; transition: background .16s, color .16s;
        }
        .rlr-nav button:hover { background: #f1f3f8; color: #38415d; }
        .rlr-nav button[aria-pressed="true"] { background: var(--rlr-primary-soft); color: var(--rlr-primary); font-weight: 700; }
        .rlr-nav-count { margin-left: auto; color: #8991a6; font: 10px "DM Mono", monospace; }
        .rlr-sidebar-note { border-top: 1px solid var(--rlr-line); padding: 14px 10px 0; color: #838ca0; font-size: 10px; line-height: 1.6; }
        .rlr-trust { display: flex; align-items: center; gap: 7px; margin-bottom: 4px; color: #5e6982; font-weight: 700; }
        .rlr-main { width: 100%; max-width: 1440px; min-width: 0; margin: 0 auto; padding: 27px clamp(22px, 4vw, 56px) 48px; }
        .rlr-topline { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 26px; color: #7c8498; font: 10px "DM Mono", monospace; }
        .rlr-crumb { display: flex; align-items: center; gap: 8px; }
        .rlr-live { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
        .rlr-live-dot { width: 7px; height: 7px; border-radius: 50%; background: #79a88a; box-shadow: 0 0 0 3px #79a88a20; }
        .rlr-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; margin-bottom: 20px; }
        .rlr-heading h1 { margin: 0; color: #202840; font: 800 clamp(26px, 3vw, 34px)/1.1 Manrope, Inter, sans-serif; letter-spacing: -.045em; }
        .rlr-heading p { margin: 8px 0 0; color: #7a8397; font-size: 12px; }
        .rlr-mode { display: inline-flex; align-items: center; gap: 8px; border: 1px solid #dde1eb; border-radius: 6px; padding: 8px 10px; background: white; color: #68738c; font: 10px "DM Mono", monospace; white-space: nowrap; }
        .rlr-search-panel { display: flex; align-items: center; gap: 10px; padding: 11px; margin-bottom: 22px; border: 1px solid var(--rlr-line); border-radius: 9px; background: white; box-shadow: 0 4px 15px #26355708; }
        .rlr-search { position: relative; flex: 1; min-width: 0; }
        .rlr-search > svg { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: #8991a5; pointer-events: none; }
        .rlr-search input { width: 100%; height: 40px; border: 1px solid #e2e6ee; border-radius: 6px; padding: 0 38px; background: #f9fafc; color: #27314a; font-size: 12px; }
        .rlr-search input::placeholder { color: #a1a8b7; }
        .rlr-clear { position: absolute; right: 7px; top: 50%; transform: translateY(-50%); display: grid; width: 27px; height: 27px; place-items: center; border: 0; border-radius: 5px; background: transparent; color: #737d94; }
        .rlr-clear:hover { background: #eef0f6; }
        .rlr-sort { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 40px; padding: 0 12px; border: 1px solid var(--rlr-line); border-radius: 6px; background: white; color: #68728a; font-size: 11px; white-space: nowrap; }
        .rlr-sort:hover, .rlr-sort[aria-pressed="true"] { background: #f7f8fb; color: var(--rlr-primary); }
        .rlr-results-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 1px 11px; }
        .rlr-results-head h2 { margin: 0; color: #39445d; font: 700 12px Manrope, Inter, sans-serif; }
        .rlr-count { color: #8c94a7; font: 10px "DM Mono", monospace; }
        .rlr-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .rlr-card {
          min-width: 0; min-height: 126px; padding: 14px 15px;
          border: 1px solid var(--rlr-line); border-radius: 8px; background: white;
          text-align: left; transition: border-color .16s, transform .16s, box-shadow .16s;
        }
        .rlr-card:hover { border-color: #c1c5e2; transform: translateY(-2px); box-shadow: 0 7px 20px #30375e0b; }
        .rlr-card-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 11px; }
        .rlr-file-icon { display: grid; width: 30px; height: 30px; place-items: center; border-radius: 7px; background: #f0f1fb; color: #5b61ad; }
        .rlr-card-type { color: #9299aa; font: 9px "DM Mono", monospace; letter-spacing: .06em; text-transform: uppercase; }
        .rlr-card h3 { margin: 0 0 9px; color: #29334d; font: 700 13px/1.4 Manrope, Inter, sans-serif; letter-spacing: -.015em; }
        .rlr-card-bottom { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: #9198a9; font-size: 10px; }
        .rlr-card-collection { display: inline-flex; align-items: center; gap: 6px; min-width: 0; }
        .rlr-card-collection span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .rlr-card-open { display: grid; width: 25px; height: 25px; flex: none; place-items: center; border: 1px solid #e8eaf0; border-radius: 5px; color: #8b91a4; background: white; }
        .rlr-card:hover .rlr-card-open { color: var(--rlr-primary); border-color: #d7d9ee; }
        .rlr-footnote { display: flex; align-items: flex-start; gap: 9px; margin-top: 20px; padding: 12px 14px; border: 1px solid #e2e5ed; border-radius: 7px; background: #f8f9fb; color: #7e879a; font-size: 10px; line-height: 1.55; }
        .rlr-footnote svg { flex: none; color: #7780a6; margin-top: 1px; }
        .rlr-empty { grid-column: 1 / -1; padding: 46px 20px; border: 1px dashed #d8dce7; border-radius: 9px; background: white; text-align: center; }
        .rlr-empty-icon { width: 40px; height: 40px; display: grid; place-items: center; margin: 0 auto 12px; border-radius: 50%; background: #f0f1f8; color: #777eaf; }
        .rlr-empty h3 { margin: 0; color: #39435d; font: 700 13px Manrope, Inter, sans-serif; }
        .rlr-empty p { margin: 6px 0 0; color: #8b93a4; font-size: 11px; }
        .rlr-empty button { margin-top: 15px; padding: 7px 11px; border: 1px solid #dfe2ec; border-radius: 5px; background: white; color: var(--rlr-primary); font-size: 11px; font-weight: 700; }
        .rlr-overlay { position: fixed; inset: 0; z-index: 8; width: 100%; padding: 0; border: 0; background: #20294150; animation: rlr-fade .18s ease; }
        .rlr-drawer { position: fixed; z-index: 9; top: 0; right: 0; display: flex; width: min(440px, 100vw); height: 100dvh; flex-direction: column; background: #fbfcfe; box-shadow: -14px 0 40px #1f29401f; animation: rlr-slide .22s ease; }
        .rlr-drawer-head { padding: 22px 24px 19px; border-bottom: 1px solid #e0e3ee; background: #f1f2fa; }
        .rlr-drawer-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #777fa0; font: 10px "DM Mono", monospace; letter-spacing: .1em; text-transform: uppercase; }
        .rlr-close { width: 32px; height: 32px; display: grid; place-items: center; border: 1px solid #dfe2eb; border-radius: 6px; background: white; color: #747c91; }
        .rlr-close:hover { background: #e9eaf4; color: #404773; }
        .rlr-drawer h2 { margin: 21px 0 9px; color: #28314a; font: 800 21px/1.3 Manrope, Inter, sans-serif; letter-spacing: -.035em; }
        .rlr-category-chip { display: inline-flex; padding: 5px 8px; border-radius: 4px; background: #e5e7f5; color: #555d9d; font: 9px "DM Mono", monospace; letter-spacing: .04em; text-transform: uppercase; }
        .rlr-drawer-body { padding: 22px 24px; overflow: auto; }
        .rlr-preview-placeholder { min-height: 172px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; border: 1px dashed #d8dce7; border-radius: 8px; background: #f4f6fa; color: #7c86a0; text-align: center; }
        .rlr-preview-placeholder svg { margin-bottom: 10px; color: #777eaf; }
        .rlr-preview-placeholder strong { color: #47516c; font: 700 12px Manrope, Inter, sans-serif; }
        .rlr-preview-placeholder span { max-width: 255px; margin-top: 5px; color: #858da0; font-size: 10px; line-height: 1.5; }
        .rlr-info { margin-top: 20px; border-top: 1px solid #e4e7ee; }
        .rlr-info-row { display: flex; justify-content: space-between; gap: 20px; padding: 12px 0; border-bottom: 1px solid #e9ebf1; font-size: 11px; }
        .rlr-info-row span:first-child { color: #9299aa; }
        .rlr-info-row span:last-child { color: #515c75; text-align: right; }
        .rlr-notice { display: flex; align-items: flex-start; gap: 8px; margin-top: 17px; padding: 11px; border-radius: 6px; background: #f3f4f8; color: #7d879a; font-size: 10px; line-height: 1.5; }
        .rlr-notice svg { flex: none; color: #8188a7; }
        .rlr-notice strong { color: #545e77; }
        .rlr-unavailable { width: 100%; margin-top: 17px; padding: 10px; border: 1px solid #dfe2ec; border-radius: 6px; background: white; color: #777f97; font-size: 11px; }
        .rlr-unavailable:disabled { cursor: not-allowed; opacity: .8; }
        @keyframes rlr-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes rlr-slide { from { transform: translateX(18px); opacity: .7; } to { transform: translateX(0); opacity: 1; } }
        @media(max-width: 760px) {
          .rlr-layout { display: block; }
          .rlr-sidebar { display: block; min-height: auto; padding: 13px 15px; border-right: 0; border-bottom: 1px solid var(--rlr-line); }
          .rlr-brand { padding: 0 1px 12px; }
          .rlr-eyebrow, .rlr-sidebar-note { display: none; }
          .rlr-nav { display: flex; gap: 6px; overflow-x: auto; }
          .rlr-nav button { width: auto; min-height: 36px; flex: none; padding: 7px 10px; border: 1px solid #e6e8ef; font-size: 10px; white-space: nowrap; }
          .rlr-nav-count { display: none; }
          .rlr-main { padding: 21px 15px 34px; }
          .rlr-topline { margin-bottom: 18px; }
          .rlr-live { display: none; }
          .rlr-heading { align-items: flex-start; flex-direction: column; gap: 12px; margin-bottom: 16px; }
          .rlr-mode { font-size: 9px; }
          .rlr-search-panel { padding: 8px; margin-bottom: 17px; }
          .rlr-sort { width: 40px; padding: 0; font-size: 0; }
          .rlr-sort svg { width: 16px; }
          .rlr-grid { grid-template-columns: 1fr; }
          .rlr-card { min-height: 116px; padding: 13px; }
          .rlr-drawer-head, .rlr-drawer-body { padding: 18px; }
          .rlr-preview-placeholder { min-height: 150px; }
        }
        @media(prefers-reduced-motion: reduce) {
          .rlr-shell *, .rlr-shell *::before, .rlr-shell *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
        }
      `}</style>

      <div className="rlr-layout">
        <aside className="rlr-sidebar" aria-label="Resource categories">
          <div>
            <div className="rlr-brand">
              <div className="rlr-brand-mark"><ShieldCheck size={19} /></div>
              <div>
                <div className="rlr-brand-name">Field Reference</div>
                <div className="rlr-brand-sub">COLUMBUS · LAW LIBRARY</div>
              </div>
            </div>
            <p className="rlr-eyebrow">Browse library</p>
            <nav className="rlr-nav" aria-label="Library filters">
              <button type="button" aria-pressed={category === "All resources"} onClick={() => setCategory("All resources")}>
                <FolderOpen size={15} /> All resources <span className="rlr-nav-count">10</span>
              </button>
              <button type="button" aria-pressed={category === "Uploaded reference documents"} onClick={() => setCategory("Uploaded reference documents")}>
                <FileText size={15} /> Reference documents <span className="rlr-nav-count">10</span>
              </button>
            </nav>
          </div>
          <div className="rlr-sidebar-note">
            <div className="rlr-trust"><ShieldCheck size={13} /> Training reference view</div>
            Preview only · resource availability is not connected.
          </div>
        </aside>

        <section className="rlr-main">
          <div className="rlr-topline">
            <div className="rlr-crumb"><span>Resources</span><ChevronRight size={12} /><span>Law library</span></div>
            <div className="rlr-live"><span className="rlr-live-dot" /> Field training reference</div>
          </div>
          <header className="rlr-heading">
            <div>
              <h1>Law library</h1>
              <p>Reference materials for field-training lookup.</p>
            </div>
            <div className="rlr-mode"><BookOpen size={13} /> Local preview · no live files</div>
          </header>

          <div className="rlr-search-panel">
            <label className="rlr-search">
              <Search size={16} />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search titles and reference documents"
                aria-label="Search law library resources"
              />
              {query && <button type="button" className="rlr-clear" onClick={() => setQuery("")} aria-label="Clear search"><X size={15} /></button>}
            </label>
            <button
              type="button"
              className="rlr-sort"
              aria-pressed={sortAZ}
              onClick={() => setSortAZ((current) => !current)}
              title={sortAZ ? "Show default order" : "Sort alphabetically"}
            >
              {sortAZ ? <ArrowDownAZ size={14} /> : <SlidersHorizontal size={14} />}
              {sortAZ ? "A–Z" : "Sort"}
            </button>
          </div>

          <div className="rlr-results-head">
            <h2>{category === "All resources" ? "Available references" : category}</h2>
            <span className="rlr-count">{filteredResources.length} {filteredResources.length === 1 ? "item" : "items"}</span>
          </div>

          <div className="rlr-grid">
            {filteredResources.length ? filteredResources.map((item) => (
              <button
                type="button"
                className="rlr-card"
                key={item.title}
                onClick={() => setSelected(item)}
                aria-label={`Preview ${item.title}`}
              >
                <div className="rlr-card-top">
                  <span className="rlr-file-icon"><FileText size={16} /></span>
                  <span className="rlr-card-type">Reference</span>
                </div>
                <h3>{item.title}</h3>
                <div className="rlr-card-bottom">
                  <span className="rlr-card-collection"><BookOpen size={12} /><span>Reference document{item.note ? ` · ${item.note}` : ""}</span></span>
                  <span className="rlr-card-open"><ArrowUpRight size={13} /></span>
                </div>
              </button>
            )) : (
              <div className="rlr-empty">
                <span className="rlr-empty-icon"><Search size={18} /></span>
                <h3>No matching resources</h3>
                <p>Try a different title or clear your search to browse all references.</p>
                <button type="button" onClick={() => { setQuery(""); setCategory("All resources"); }}>Clear search</button>
              </div>
            )}
          </div>

          <div className="rlr-footnote">
            <ShieldCheck size={14} />
            <span>Preview only. This sandbox does not load document contents or provide remote file access. Use the approved library in the Field Training Officer Portal for official reference.</span>
          </div>
        </section>
      </div>

      {selected && (
        <>
          <button type="button" className="rlr-overlay" onClick={() => setSelected(null)} aria-label="Close resource preview" />
          <aside className="rlr-drawer" role="dialog" aria-modal="true" aria-labelledby="rlr-drawer-title">
            <header className="rlr-drawer-head">
              <div className="rlr-drawer-top">
                <span>Resource preview</span>
                <button type="button" className="rlr-close" onClick={() => setSelected(null)} aria-label="Close preview"><X size={16} /></button>
              </div>
              <h2 id="rlr-drawer-title">{selected.title}</h2>
              <span className="rlr-category-chip">{selected.group}</span>
            </header>
            <div className="rlr-drawer-body">
              <div className="rlr-preview-placeholder">
                <FileText size={25} />
                <strong>Document preview unavailable</strong>
                <span>This mockup shows the resource entry only. Document contents are not loaded in this sandbox.</span>
              </div>
              <div className="rlr-info">
                <div className="rlr-info-row"><span>Resource</span><span>{selected.title}</span></div>
                <div className="rlr-info-row"><span>Collection</span><span>Reference documents</span></div>
                <div className="rlr-info-row"><span>Access</span><span>Portal reference</span></div>
              </div>
              <div className="rlr-notice"><ShieldCheck size={14} /><span><strong>Preview only.</strong> This sandbox is not connected to the resource service. No document is opened or downloaded.</span></div>
              <button className="rlr-unavailable" type="button" disabled><Check size={13} /> Open resource · unavailable in preview</button>
            </div>
          </aside>
        </>
      )}
    </main>
  );
}
