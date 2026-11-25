import { ArrowUpRight, Clock3, FileText } from "lucide-react";

export interface LibraryResource { title: string; group: string; note?: string }
/** Preserves source activation semantics: pointer, Enter and Space. */
export function ResourceCard({ resource, onSelect }: {
  resource: LibraryResource; onSelect: (resource: LibraryResource) => void;
}) {
  return <article className="fls-card resource-card" role="button" tabIndex={0}
    onClick={() => onSelect(resource)}
    onKeyDown={event => { if (event.key === "Enter" || event.key === " ") {
      event.preventDefault(); onSelect(resource);
    } }} aria-label={`Preview ${resource.title}`}>
    <div className="fls-card-top"><span className="fls-fileicon"><FileText size={16}/></span>
      <span className="fls-type" data-searchable>Reference</span></div>
    <h3 data-searchable>{resource.title}</h3>
    <div className="fls-card-meta"><span className="fls-meta-group" data-searchable>
      <Clock3 size={12}/>Approved resource · {resource.group}</span>
      {resource.note && <span data-searchable>{resource.note}</span>}
      <span className="fls-open"><ArrowUpRight size={13}/></span></div>
  </article>;
}
