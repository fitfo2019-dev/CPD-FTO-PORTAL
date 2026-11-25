import React from "react";
import { Search } from "lucide-react";

export function EmptyState({ title = "No matching resources", description = "Try another title or browse all resources." }: {
  title?: string; description?: string;
}) {
  return <div className="fls-empty" role="status"><span className="fls-empty-icon"><Search size={18}/></span>
    <h3>{title}</h3><p>{description}</p></div>;
}
