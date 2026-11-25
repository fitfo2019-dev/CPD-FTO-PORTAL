import { useEffect, useId, useRef } from "react";
import { FileText, ShieldCheck, X } from "lucide-react";
import type { LibraryResource } from "./resource-card.js";

export function ResourceDrawer({ resource, onClose }: {
  resource: LibraryResource | null; onClose: () => void;
}) {
  const titleId = useId();
  const panel = useRef<HTMLElement>(null);
  // Preserve the source's controlled selection/close behavior, adding keyboard
  // containment and focus restoration without making a document-access claim.
  useEffect(() => {
    if (!resource) return;
    const previous = document.activeElement;
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key === "Tab") {
        const controls = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]');
        const first = controls?.[0]; const last = controls?.[controls.length - 1];
        if (first && last && (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
          event.preventDefault(); (event.shiftKey ? last : first).focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [resource, onClose]);
  if (!resource) return null;
  return <><div className="fls-overlay" onClick={onClose} aria-hidden="true"/>
    <aside ref={panel} className="fls-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header className="fls-drawer-head"><div className="fls-drawer-top"><span>Resource preview</span>
        <button className="fls-close" type="button" onClick={onClose} aria-label="Close preview"><X size={16}/></button></div>
        <h2 id={titleId}>{resource.title}</h2><span className="fls-drawer-category">{resource.group}</span></header>
      <div className="fls-drawer-body"><div className="fls-placeholder"><FileText size={25}/>
        <strong>Document preview unavailable</strong><span>This preview shows the resource entry only. Document contents are not loaded.</span></div>
        <div className="fls-info">{[["Resource", resource.title], ["Collection", resource.group], ["Access", "Portal reference"]].map(([name,value]) =>
          <div className="fls-info-row" key={name}><span>{name}</span><span>{value}</span></div>)}</div>
        <div className="fls-notice"><ShieldCheck size={14}/>This preview is not connected to the resource service. No document is opened or downloaded.</div>
        <button type="button" className="fls-panel-button" disabled>Open resource · unavailable in preview</button></div>
    </aside></>;
}
