import type { TrainingAlert } from '@workspace/api-client-react';
import { CATEGORIES, CATEGORY_LABEL, type AlertClosure, type Category, type Report, type Workspace } from './model.js';
import { formatDateDMY, localISODate } from './training-calendar.js';

export type AlertKind = 'NRT' | 'NRT_REVIEW_REQUEST' | 'NOT_RELEASE' | 'FTO_WITHDRAWAL';
export interface AlertView {
  key: string;
  /** Present only for alerts stored on the agency server. */
  serverId?: string;
  kind: AlertKind;
  who: string;
  detail: string;
  at: string;
  /** A Not release recommendation the FTO later changed to Release. */
  changedToRelease: boolean;
  closure?: { note: string; line: string };
}

const PHASE = ['', 'I', 'II', 'III', 'IV'];

/** Finalized by the FTO (Finalize and Submit to Coordinator). */
export const isFinalized = (report: Report) => report.syncStatus === 'submitted_complete' || report.syncStatus === 'synchronized_complete';

/** Local date and 24-hour time for a stored ISO timestamp, in the reader's time zone. */
export function formatStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return `${formatDateDMY(localISODate(date))} ${time}`;
}

const categoryLabel = (key: string | null) =>
  key && (CATEGORIES as string[]).includes(key) ? CATEGORY_LABEL[key as Category] : key ?? '';

export function closerLabel(name: string | null, role: TrainingAlert['closed_by_role']): string {
  return name || (role === 'FTO_SGT' ? 'FTO Sergeant' : role === 'FTO_COORDINATOR' ? 'FTO Coordinator' : '');
}

export function fromServerAlert(alert: TrainingAlert): AlertView {
  const who = `PO ${alert.po_name} #${alert.po_badge}`;
  const detail = alert.kind === 'NRT'
    ? `${categoryLabel(alert.category)} · Daily Performance Summary ${alert.record_date ? formatDateDMY(alert.record_date) : ''}`
    : alert.kind === 'NRT_REVIEW_REQUEST'
      ? `${alert.report_ids.length} Daily Performance Summaries linked · Phase ${PHASE[alert.phase]} · FTO ${alert.fto_name}`
      : `Phase IV · FTO ${alert.fto_name}`;
  return {
    key: `server-${alert.id}`, serverId: alert.id, kind: alert.kind, who, detail: detail.trim(),
    at: alert.week15_changed_at ?? alert.created_at,
    changedToRelease: alert.kind === 'NOT_RELEASE' && alert.week15_choice === 'release',
    closure: alert.state === 'closed' && alert.closed_at
      ? { note: alert.close_note, line: `${closerLabel(alert.closed_by_name, alert.closed_by_role)} · ${formatStamp(alert.closed_at)}` }
      : undefined,
  };
}

function localClosure(closures: Map<string, AlertClosure>, key: string): AlertView['closure'] {
  const closure = closures.get(key);
  if (!closure) return undefined;
  const by = `${closure.closedBy.name}${closure.closedBy.badge ? ` #${closure.closedBy.badge}` : ''}`;
  return { note: closure.note, line: `${by} · ${formatStamp(closure.closedAt)}` };
}

/** The same alert rules applied to records saved on this device (UI preview and no agency server). */
export function deviceAlerts(ws: Pick<Workspace, 'reports' | 'nrtReviewRequests' | 'week15Recommendations' | 'ftoPhaseSignups' | 'alertClosures'>,
  options: { includeWithdrawals: boolean }): AlertView[] {
  const closures = new Map((ws.alertClosures ?? []).map(c => [c.alertKey, c]));
  const nrt = ws.reports.filter(report => isFinalized(report) && !report.limboDay).flatMap(report =>
    CATEGORIES.filter(category => report.ratings[category]?.rating === 'NRT').map(category => {
      const key = `nrt-${report.id}-${category}`;
      return { key, kind: 'NRT' as const, who: `PO ${report.recruitName} #${report.recruitBadge}`,
        detail: `${CATEGORY_LABEL[category]} · Daily Performance Summary ${formatDateDMY(report.date)}`,
        at: report.updatedAt ?? report.date, changedToRelease: false, closure: localClosure(closures, key) };
    }));
  const requests = (ws.nrtReviewRequests ?? []).map(r => {
    const key = `nrt-${r.id}`;
    return { key, kind: 'NRT_REVIEW_REQUEST' as const, who: `PO ${r.recruitName} #${r.recruitBadge}`,
      detail: `${r.reportIds.length} Daily Performance Summaries linked · Phase ${PHASE[r.phase]} · FTO ${r.requestedBy.name}`,
      at: r.createdAt, changedToRelease: false, closure: localClosure(closures, key) };
  });
  const week15 = (ws.week15Recommendations ?? [])
    .filter(r => r.choice === 'not_release' || r.history.some(change => change.choice === 'not_release'))
    .map(r => {
      const key = `nr-${r.id}`;
      const by = r.history.find(change => change.choice === 'not_release')?.by;
      return { key, kind: 'NOT_RELEASE' as const, who: `PO ${r.recruitName} #${r.recruitBadge}`,
        detail: by ? `Phase IV · FTO ${by.name}` : 'Phase IV', at: r.updatedAt,
        changedToRelease: r.choice === 'release', closure: localClosure(closures, key) };
    });
  const withdrawals = options.includeWithdrawals ? (ws.ftoPhaseSignups ?? []).filter(s => s.status === 'withdrawn').map(s => {
    const key = `wd-${s.id}`;
    return { key, kind: 'FTO_WITHDRAWAL' as const, who: `FTO ${s.ftoName} #${s.ftoBadge}`, detail: '', at: s.updatedAt,
      changedToRelease: false, closure: localClosure(closures, key) };
  }) : [];
  return sortAlerts([...nrt, ...requests, ...week15, ...withdrawals]);
}

export function sortAlerts(alerts: AlertView[]): AlertView[] {
  return [...alerts].sort((a, b) => b.at.localeCompare(a.at) || a.key.localeCompare(b.key));
}
