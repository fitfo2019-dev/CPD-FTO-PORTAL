import { useState } from "react";
import { SearchControls } from "../../components/ui/search-controls.js";
import { PageTitle } from "../foundations.js";
export default function SearchDemo() {
  const [query,setQuery] = useState(""); const [sorted,setSorted] = useState(false);
  return <><PageTitle eyebrow="DISCOVERY / SEARCH" title="Find without friction." description="Text search and the source’s sort toggle. The Filter label switches to A–Z when active; no advanced filtering behavior is invented."/>
    <SearchControls query={query} onQueryChange={setQuery} sorted={sorted} onToggleSort={() => setSorted(value => !value)}/>
    <p className="ds-muted" role="status">Query: {query || "Empty"} · Alphabetical sorting: {sorted ? "on" : "off"}</p>
    <h2 className="ds-subheading">Disabled state</h2><SearchControls query="Unavailable" onQueryChange={() => {}} sorted={false} onToggleSort={() => {}} disabled/></>;
}
