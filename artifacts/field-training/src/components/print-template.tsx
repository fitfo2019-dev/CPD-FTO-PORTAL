import React, { type HTMLAttributes, type ReactNode } from 'react';
import { PrintableColumbusFooterMarks, PrintableColumbusHeader } from './printable-columbus-header.js';

type DocumentProps = HTMLAttributes<HTMLElement> & { as?: 'article' | 'section'; landscape?: boolean };
export function PrintDocument({ as: Tag = 'article', className = '', landscape, children, ...props }: DocumentProps) {
  const blocks = React.Children.toArray(children);
  const footer = blocks.at(-1);
  const footerBlock = React.isValidElement<{ className?: string }>(footer)
    ? React.cloneElement(footer, { className: `print-template-footer ${footer.props.className ?? ''}` })
    : <PrintFooter>{footer}</PrintFooter>;
  return <Tag {...props} className={`print-document print-reference-pilot ${landscape ? 'print-document-landscape' : ''} ${className}`}>
    <table className="print-page-frame">
      <thead><tr><td>{blocks[0]}</td></tr></thead>
      <tbody><tr><td><div className="print-page-body">{blocks.slice(1,-1)}</div></td></tr></tbody>
      <tfoot><tr><td>{footerBlock}</td></tr></tfoot>
    </table>
  </Tag>;
}

export function PrintTitleBlock({ title, formId, revisionKey, marker, children }: { title: string; formId: string; revisionKey?: string; marker?: ReactNode; children?: ReactNode }) {
  return <header className="print-run-header print-title-block">
    <div><PrintableColumbusHeader formId={revisionKey??formId} /><h1>{title}</h1>{marker?<div className="print-title-meta-line">{formId&&<b>{formId}</b>}{marker}</div>:formId&&<b>{formId}</b>}</div>
    {children && <div className="print-run-header-meta">{children}</div>}
  </header>;
}

export function PrintFieldGrid({ children, className = '', columns = 4 }: {
  children: ReactNode; className?: string; columns?: 2 | 3 | 4;
}) {
  return <div className={`print-field-grid print-field-grid-${columns} ${className}`}>{children}</div>;
}

export function PrintField({ label, children }: { label: string; children: ReactNode }) {
  return <span className="print-field" data-print-field={label}><b>{label}</b>{children}</span>;
}

export function PrintSectionPanel({ title, children, className = '', heading = 2 }: {
  title: string; children: ReactNode; className?: string; heading?: 2 | 3;
}) {
  const Heading = heading === 3 ? 'h3' : 'h2';
  return <section className={`print-section-panel ${className}`}><Heading>{title}</Heading>{children}</section>;
}

export function PrintChecklistRow({ label, checked, mixed, help, details }: {
  label: string; checked: boolean; mixed?: boolean; help?: string; details?: ReactNode;
}) {
  return <li className="print-checklist-row" title={help}>
    <b aria-label={mixed ? 'Partly completed' : checked ? 'Complete' : 'Not complete'}>{mixed ? '◩' : checked ? '☒' : '☐'}</b>
    <span>{label}{details}</span>
  </li>;
}

export function PrintNotesArea({ title, children, className = '' }: {
  title: string; children: ReactNode; className?: string;
}) {
  return <section className={`print-notes-area print-run-narrative ${className}`}><b>{title}</b><p>{children}</p></section>;
}

export function PrintFooter({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <footer className={`print-template-footer ${className}`}>{children}<PrintableColumbusFooterMarks /></footer>;
}
