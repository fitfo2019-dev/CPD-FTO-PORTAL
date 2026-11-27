import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TrainingAlert } from '@workspace/api-client-react';
import { deviceAlerts, formatStamp, fromServerAlert } from './training-alerts.js';
import type { Report, Week15Recommendation } from './model.js';

const actor = { name: 'TEST FTO', badge: 'T-2', role: 'fto' as const };
const report = (over: Partial<Report>): Report => ({
  id: 'TEST-r1', date: '2026-11-20', phase: 2, recruitName: 'TEST PO', recruitBadge: 'T-1', syncStatus: 'submitted_complete',
  ratings: { dutyReadiness: { rating: 'NRT', justification: 'x' } }, updatedAt: '2026-11-20T23:00:00.000Z', ...over,
} as unknown as Report);
const week15 = (over: Partial<Week15Recommendation>): Week15Recommendation => ({
  id: 'TEST-w', className: 'TEST', recruitName: 'TEST PO', recruitBadge: 'T-1', choice: 'not_release', statement: '',
  history: [{ choice: 'not_release', at: '2026-11-21T15:00:00.000Z', by: actor }], alertStatus: 'queued', updatedAt: '2026-11-21T15:00:00.000Z', ...over,
});
const empty = { reports: [], nrtReviewRequests: [], week15Recommendations: [], ftoPhaseSignups: [], alertClosures: [] };

test('times are shown in the reader\'s local time, not UTC', () => {
  // Run with TZ=America/New_York: 03:30 UTC is 22:30 the previous evening.
  assert.equal(formatStamp('2026-11-27T03:30:00.000Z'), '11/26/2026 22:30');
  assert.equal(formatStamp('2026-11-26 14:03:00+00'), formatStamp('2026-11-26T14:03:00Z'));
  assert.equal(formatStamp('not a date'), '');
});

test('device alerts: one NRT per finalized category, never for drafts or limbo days', () => {
  const alerts = deviceAlerts({ ...empty, reports: [report({}), report({ id: 'TEST-draft', syncStatus: 'local_draft_pending' } as Partial<Report>), report({ id: 'TEST-limbo', limboDay: true })] }, { includeWithdrawals: false });
  assert.deepEqual(alerts.map(a => a.key), ['nrt-TEST-r1-dutyReadiness']);
  assert.equal(alerts[0].kind, 'NRT');
});

test('a Not release later changed to Release stays listed and shows the change', () => {
  const changed = week15({ choice: 'release', history: [{ choice: 'release', at: '2026-11-22T15:00:00.000Z', by: actor }, { choice: 'not_release', at: '2026-11-21T15:00:00.000Z', by: actor }] });
  const [alert] = deviceAlerts({ ...empty, week15Recommendations: [changed] }, { includeWithdrawals: false });
  assert.equal(alert.kind, 'NOT_RELEASE');
  assert.equal(alert.changedToRelease, true);
  assert.equal(deviceAlerts({ ...empty, week15Recommendations: [week15({ choice: 'release', history: [{ choice: 'release', at: '2026-11-22T15:00:00.000Z', by: actor }] })] }, { includeWithdrawals: false }).length, 0);
});

test('a local closure carries the note, closer and local time', () => {
  const [alert] = deviceAlerts({ ...empty, week15Recommendations: [week15({})],
    alertClosures: [{ alertKey: 'nr-TEST-w', note: 'TEST handled', closedBy: { name: 'TEST SGT', badge: '', role: 'fto_sgt' }, closedAt: '2026-11-27T03:30:00.000Z' }] }, { includeWithdrawals: false });
  assert.deepEqual(alert.closure, { note: 'TEST handled', line: 'TEST SGT · 11/26/2026 22:30' });
});

test('server alerts map closer name, role fallback and change to Release', () => {
  const base: TrainingAlert = { id: '00000000-0000-4000-8000-000000000001', kind: 'NOT_RELEASE', po_name: 'TEST PO', po_badge: 'T-1', class_name: 'TEST', phase: 4,
    fto_name: 'TEST FTO', coordinator_id: 'c', category: null, record_date: null, report_ids: [], summary: '', week15_choice: 'release',
    week15_changed_at: '2026-11-22T15:00:00+00:00', created_at: '2026-11-21T15:00:00+00:00', state: 'closed', closed_by_name: null,
    closed_by_role: 'FTO_SGT', closed_at: '2026-11-27T03:30:00+00:00', close_note: 'TEST' };
  const view = fromServerAlert(base);
  assert.equal(view.serverId, base.id);
  assert.equal(view.changedToRelease, true);
  assert.equal(view.at, base.week15_changed_at);
  assert.equal(view.closure?.line, 'FTO Sergeant · 11/26/2026 22:30');
  assert.equal(fromServerAlert({ ...base, closed_by_name: 'TEST Name' }).closure?.line, 'TEST Name · 11/26/2026 22:30');
  const nrt = fromServerAlert({ ...base, kind: 'NRT', category: 'dutyReadiness', record_date: '2026-11-20', state: 'open', closed_at: null });
  assert.equal(nrt.closure, undefined);
  assert.match(nrt.detail, /Daily Performance Summary 11\/20\/2026$/);
});
