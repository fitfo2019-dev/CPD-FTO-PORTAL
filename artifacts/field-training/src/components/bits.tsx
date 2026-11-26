import React, { type ReactNode } from 'react';
import { cn } from '@/lib/utils.js';
import { photo, type PhotoKey } from '@/lib/photos.js';
import { STATUS_LABEL, ratingLabel, ratingShortLabel, type Rating, type Status } from '@/lib/model.js';

/** Keeps the possessive/plural "’s" lowercase inside uppercase shell labels (PO’s, UA’s, FTO’s). */
export function caseSafe(text: ReactNode): ReactNode {
  if (typeof text !== 'string' || !/[’']s\b/.test(text)) return text;
  const parts = text.split(/([’']s)\b/);
  return <span>{parts.map((part, index) => /^[’']s$/.test(part) ? <span key={index} className="normal-case">{part}</span> : part)}</span>;
}

/** Page titles use shell casing; set titleIsData when the title shows a person's name so it keeps its exact case. */
export type HeroStat = { label: string; value: ReactNode; testId: string };
export function PageHead({ kicker, title, children, titleIsData = false, photo: photoKey, stats }: { kicker: string; title: string; children?: ReactNode; titleIsData?: boolean; photo?: PhotoKey; stats?: HeroStat[] }) {
  const heading = <div className="mr-auto min-w-0"><div className="label-caps">{caseSafe(kicker)}</div><h1 className={cn('page-title text-2xl sm:text-3xl font-extrabold tracking-tight', titleIsData && 'page-title-data')}>{titleIsData ? title : caseSafe(title)}</h1></div>;
  const actions = children && <div className="page-head-actions">{children}</div>;
  if (!photoKey) return <div className="page-head flex flex-wrap items-end gap-3 mb-5 rise">{heading}{actions}</div>;
  const img = photo(photoKey);
  return <div className="page-head page-hero mb-5 rise" data-testid="page-hero">
    <img className="page-hero-photo" src={img.src} alt="" aria-hidden="true" style={{ objectPosition: img.position }} decoding="async" />
    <div className="page-hero-body">
      <div className="flex flex-wrap items-end gap-3">{heading}{actions}</div>
      {stats && stats.length > 0 && <dl className="page-hero-stats" data-testid="page-hero-stats">{stats.map(s => <div key={s.testId} data-testid={s.testId}><dt>{caseSafe(s.label)}</dt><dd>{s.value}</dd></div>)}</dl>}
    </div>
  </div>;
}
export function Panel({ title, action, children, className, id }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return <section id={id} className={cn('min-w-0 rounded-md border bg-card rise', className)}>{title && <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b"><h2 className="label-caps min-w-0 text-foreground mr-auto">{caseSafe(title)}</h2>{action}</div>}{children}</section>;
}
const STATUS_CLS: Record<Status,string> = { draft:'border-dashed border-muted-foreground/60 text-muted-foreground', fto_signed:'border-accent text-warn', recruit_signed:'border-primary text-primary', locked:'bg-foreground text-background border-foreground' };
export function StatusPill({ s }: { s: Status }) { return <span className={cn('inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-wider whitespace-nowrap', STATUS_CLS[s])}>{STATUS_LABEL[s]}</span>; }
export function RatingChip({ r, size = 'sm' }: { r: Rating; size?: 'sm'|'lg' }) {
  const cls = !r ? 'border-dashed text-muted-foreground' : r==='UA'||r==='NRT' ? 'bg-destructive text-destructive-foreground border-destructive' : r==='NO' ? 'text-muted-foreground' : r==='RT' ? 'bg-accent text-accent-foreground border-accent' : 'bg-primary text-primary-foreground border-primary';
  return <span title={ratingLabel(r)} aria-label={ratingLabel(r)} className={cn('mono inline-grid place-items-center rounded-sm border font-bold', size==='lg' ? 'h-9 min-w-9 px-1 text-base' : 'h-6 min-w-6 px-1 text-xs', cls)}>{ratingShortLabel(r)}</span>;
}
export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: string; tone?: 'warn'|'bad' }) {
  return <div className="p-4"><div className="label-caps">{label}</div><div className={cn('mono text-3xl font-bold mt-1 tabular-nums', tone==='warn' && 'text-warn', tone==='bad' && 'text-destructive')}>{value}</div>{sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}</div>;
}
