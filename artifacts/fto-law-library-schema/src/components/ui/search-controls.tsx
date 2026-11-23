import { Search, SlidersHorizontal } from "lucide-react";

export interface SearchControlsProps {
  query: string;
  onQueryChange: (query: string) => void;
  sorted: boolean;
  onToggleSort: () => void;
  disabled?: boolean;
}
/** Source search and boolean sort control; filtering remains consumer-owned. */
export function SearchControls({ query, onQueryChange, sorted, onToggleSort, disabled }: SearchControlsProps) {
  return <div className="fls-searchbar">
    <label className="fls-search"><Search size={16}/>
      <input type="text" value={query} disabled={disabled}
        onChange={event => onQueryChange(event.target.value)}
        placeholder="Search directives, codes, SOPs..." aria-label="Search law library resources"/></label>
    <button className="fls-filter" type="button" onClick={onToggleSort} disabled={disabled}
      aria-label={sorted ? "Disable alphabetical sorting" : "Sort resources alphabetically"}
      aria-pressed={sorted}><SlidersHorizontal size={14}/>{sorted ? "A–Z" : "Filter"}</button>
  </div>;
}
