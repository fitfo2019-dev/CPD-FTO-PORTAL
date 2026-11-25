import { useCallback, useMemo, useState } from "react";
import { ArrowUpRight, BookOpen, FileText, FolderOpen, Library, ShieldCheck } from "lucide-react";
import tokens from "../generated/tokens.js";
import { EmptyState, LibraryNavigation, ResourceCard, ResourceDrawer, SearchControls, type LibraryResource } from "../components/library.js";

export const exampleResources: LibraryResource[] = [
  { title: "Domestic Violence Protocol", group: "Uploaded reference documents" },
  { title: "Ohio Constitutional Opinions", group: "Uploaded reference documents" },
  { title: "Police Phone Directory", group: "Uploaded reference documents" },
  { title: "BMV 2255", group: "Uploaded reference documents", note: "2 files" },
];
export function PageTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <header className="ds-page-title"><p>{eyebrow}</p><h1>{title}</h1><div>{description}</div></header>;
}
export function LibrarySpecimen() {
  const [category, setCategory] = useState("All resources");
  const [query, setQuery] = useState("");
  const [sorted, setSorted] = useState(false);
  const [selected, setSelected] = useState<LibraryResource | null>(null);
  const close = useCallback(() => setSelected(null), []);
  const shown = useMemo(() => {
    const filtered = exampleResources.filter(item => (category === "All resources" || item.group === category) &&
      ["Reference", item.title, item.group, item.note ?? ""].join(" ").toLowerCase().includes(query.trim().toLowerCase()));
    return sorted ? [...filtered].sort((a,b) => a.title.localeCompare(b.title)) : filtered;
  }, [category, query, sorted]);
  return <div className="ds-specimen" data-testid="library-specimen">
    <LibraryNavigation category={category} onCategoryChange={setCategory} collections={[
      { name:"All resources", icon:<FolderOpen size={15}/>, count:4 },
      { name:"Law Library", icon:<Library size={15}/>, count:"—" },
      { name:"Uploaded reference documents", icon:<FileText size={15}/>, count:4 },
    ]}/>
    <section className="ds-specimen-main">
      <div className="ds-specimen-top"><span><BookOpen size={13}/>RESOURCE DISCOVERY</span><span>INTERACTIVE SPECIMEN</span></div>
      <h2>Law library</h2><p>Approved reference materials for field-training lookup.</p>
      <SearchControls query={query} onQueryChange={setQuery} sorted={sorted} onToggleSort={() => setSorted(value => !value)}/>
      <div className="ds-specimen-count"><strong>Available references</strong><span>{shown.length} items</span></div>
      <div className="fls-grid">{shown.length ? shown.map(resource => <ResourceCard key={resource.title} resource={resource} onSelect={setSelected}/>) : <EmptyState/>}</div>
      <div className="ds-specimen-notice"><ShieldCheck size={14}/>Illustrative entries only. No document access or backend connection.</div>
    </section>
    <ResourceDrawer resource={selected} onClose={close}/>
  </div>;
}
export function OverviewPage() {
  return <>
    <div className="ds-hero"><div><p className="ds-eyebrow">SOURCE-DERIVED / FIELD REFERENCE</p>
      <h1>Clarity, on<br/>every call<span>.</span></h1>
      <p className="ds-hero-copy">A considered visual language for the FTO law library.<br/>Extracted from your selected mockup. Ready for review.</p>
      <div className="ds-hero-meta"><span>5 COMPONENT FAMILIES</span><span>LIGHT + DERIVED DARK</span></div></div>
      <div className="ds-palette-stack" aria-label="Core palette">
        {(["primary","secondary","accent"] as const).map((role,index) => <div key={role} style={{ background:tokens.color.light[role], color:role === "primary" ? tokens.color.light.primaryForeground : tokens.color.light.foreground }}>
          <span>0{index + 1} / {role}</span><strong>{tokens.color.light[role].toUpperCase()}</strong></div>)}
      </div>
    </div>
    <section className="ds-section"><div className="ds-section-heading"><div><p>THE SYSTEM, TOGETHER</p><h2>A working reference</h2></div><span><ArrowUpRight size={14}/> Search, browse, open & close</span></div>
      <LibrarySpecimen/>
    </section>
    <section className="ds-principles"><article><span>01 / TYPE</span><h3>Distinct, not distracting.</h3><p>Manrope headings. DM Sans body copy. DM Mono metadata. The same hierarchy as the source.</p></article>
      <article><span>02 / STRUCTURE</span><h3>Compact by design.</h3><p>Quiet borders, 8px cards, 6px controls, and a two-column resource grid that collapses on smaller screens.</p></article>
      <article><span>03 / HONEST STATES</span><h3>Make availability clear.</h3><p>The source labels its previews and disabled document access. These components preserve that distinction.</p></article></section>
    <section className="ds-section"><div className="ds-section-heading"><div><p>FIFTH FAMILY / FEEDBACK</p><h2>When nothing matches</h2></div></div><EmptyState/></section>
    <div className="ds-approval-note"><ShieldCheck size={16}/><div><strong>Extracted, not applied.</strong><p>This is a separate design-system preview. It has not replaced the Law Library mockup, portal styles, authentication, or resource services.</p></div></div>
  </>;
}
export function ColorsPage() {
  const core = ["primary","secondary","accent"] as const;
  const supporting = Object.keys(tokens.color.light).filter(key => !core.some(role => role === key)) as Array<keyof typeof tokens.color.light>;
  return <><PageTitle eyebrow="FOUNDATIONS / COLORS" title="An indigo signature." description="Core roles come from the selected mockup. Dark mode and unsupported semantic/chart roles are derived extensions."/>
    <div className="ds-swatch-grid">{[...core, ...supporting].map(role => <article className="ds-swatch" key={role}>
      <div style={{ background:`hsl(var(--${role.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`).replace(/(\D)(\d+)$/, "$1-$2")}))` }}/>
      <strong>{role}</strong><code>{tokens.color.light[role]}</code></article>)}</div>
    <p className="ds-muted">Hex labels describe the source light palette; swatches follow the active theme. The source’s muted small text needs contrast review before operational adoption. No accessibility certification is implied.</p></>;
}
export function FontsPage() {
  return <><PageTitle eyebrow="FOUNDATIONS / TYPOGRAPHY" title="Three voices. One library." description="Exact source families, with no substitutions. Latin font subsets are embedded in the generated theme; rendering does not contact Google Fonts."/>
    {[["Manrope","The right reference, right away.","var(--app-font-heading)","600 · 700 · 800 / HEADINGS"],
      ["DM Sans","Approved reference materials for field-training lookup.","var(--app-font-sans)","400 · 500 · 600 · 700 / BODY"],
      ["DM Mono","COLUMBUS · LAW LIBRARY / 10 ITEMS","var(--app-font-mono)","400 · 500 / METADATA"]].map(([name,sample,font,weights]) =>
      <article className="ds-type-card" key={name}><header><strong>{name}</strong><span>{weights}</span></header><p style={{fontFamily:font}}>{sample}</p><small>Aa Bb Cc Dd Ee Ff Gg Hh · 0123456789</small></article>)}
    <p className="ds-muted">The bundled fonts retain their SIL Open Font Licenses. Non-Latin characters use the generic fallback stack. Georgia is an unused compatibility fallback, not a source typeface.</p></>;
}
export function LayoutPage() {
  return <><PageTitle eyebrow="FOUNDATIONS / LAYOUT" title="A quieter framework." description="Values traced to the mockup’s CSS—not a replacement for its resource-service or access-control implementation."/>
    <section className="ds-section"><h2>Spacing base · 4px</h2><div className="ds-spacing">{[4,8,12,16,24,32].map(size =>
      <div key={size}><span style={{width:size*3}}/><code>{size}px</code></div>)}</div></section>
    <section className="ds-section"><h2>Source geometry</h2><div className="ds-principles">
      <article><span>CARDS</span><h3>8px radius</h3><p>14px × 15px padding. Subtle border, 2px hover lift.</p></article>
      <article><span>CONTROLS</span><h3>39px high</h3><p>6px radius. Indigo focus border and quiet focus halo.</p></article>
      <article><span>DRAWER</span><h3>430px wide</h3><p>Full viewport height, capped to screen width; 220ms entrance.</p></article></div></section>
    <section className="ds-section"><h2>Responsive & motion states</h2><p className="ds-muted">Below 760px, cards become a single column and collection navigation becomes horizontal. Reduced-motion preferences remove transitions. Keyboard focus remains visible.</p></section></>;
}
