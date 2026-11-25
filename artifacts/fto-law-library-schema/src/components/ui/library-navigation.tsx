import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

export interface LibraryCollection { name: string; icon: ReactNode; count?: string | number }
export interface LibraryNavigationProps {
  collections: LibraryCollection[];
  category: string;
  onCategoryChange: (category: string) => void;
  title?: string;
  subtitle?: string;
}
/** Extracted from the source's controlled category sidebar. */
export function LibraryNavigation({ collections, category, onCategoryChange,
  title = "Field Reference", subtitle = "COLUMBUS · LAW LIBRARY" }: LibraryNavigationProps) {
  return <aside className="fls-sidebar" aria-label="Resource categories">
    <div className="fls-brand"><span className="fls-brand-mark"><ShieldCheck size={18}/></span>
      <div><strong>{title}</strong><small>{subtitle}</small></div></div>
    <p className="fls-section-label">Browse library</p>
    <nav className="fls-nav">{collections.map(item => <button type="button" key={item.name}
      className={category === item.name ? "active" : ""} aria-pressed={category === item.name}
      onClick={() => onCategoryChange(item.name)}>{item.icon}<span>{item.name}</span>
      {item.count !== undefined && <span className="fls-nav-count">{item.count}</span>}</button>)}</nav>
  </aside>;
}
