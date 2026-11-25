import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { Link, Router } from 'wouter';
import { savedOrientationContext, savedOrientationHref } from './saved-orientation.js';
import { resolveOperationalPacket } from './operational-state-machine.js';
import { seedReports } from './seed.js';
import type { PhaseCaseFolder, SubstationOrientationRecord, Workspace } from './model.js';

const report = seedReports()[0];
const folders: PhaseCaseFolder[] = ([1, 2, 3, 4] as const).map(phase => ({
  className: report.className, recruitName: report.recruitName, recruitBadge: report.recruitBadge,
  ftoName: report.ftoName, ftoBadge: report.ftoBadge, phase, shift: 'A-Co',
  zone: report.zone, precinct: report.precinct, cruiserDistrict: report.cruiserDistrict,
  daysOff: [0, 6], phaseStartDate: '2025-01-05', openedAt: report.createdAt,
}));
const orientations: SubstationOrientationRecord[] = folders.map(folder => ({
  id: `orientation ${folder.phase}`, className: folder.className ?? '',
  recruitName: folder.recruitName, recruitBadge: folder.recruitBadge,
  ftoName: folder.ftoName, ftoBadge: folder.ftoBadge, phase: folder.phase,
  phaseStartDate: '2025-01-06', dateTime: '2025-01-06T09:00:00Z', substation: '1',
  checklist: { restrooms: false }, checklistReviewedAt: report.updatedAt,
  directivesReview: 'Saved review', narrative: `Saved phase ${folder.phase} notes.`,
  updatedAt: report.updatedAt,
}));

for (const phase of [1, 2, 3, 4] as const) {
  test(`Phase ${phase} first-day link reopens the exact saved orientation without browser history`, () => {
    const before = JSON.stringify({ folders, orientations });
    const packet = resolveOperationalPacket({ ...report, phase, date: '2025-01-06' }, folders, orientations);
    const href = savedOrientationHref('fto', packet.orientation);
    assert.ok(href);
    const id = new URL(href, 'https://example.test').searchParams.get('orientation');
    assert.ok(id);
    // Put a different phase first to represent an unrelated active case folder.
    const context = savedOrientationContext(id, [...folders].reverse(), orientations);
    assert.equal(context?.folder.phase, phase);
    assert.equal(context?.existing, orientations[phase - 1]);
    assert.equal(context?.existing.narrative, `Saved phase ${phase} notes.`);
    assert.equal(context?.existing.checklist.restrooms, false);
    assert.equal(context?.existing.checklistReviewedAt, report.updatedAt);
    assert.equal(JSON.stringify({ folders, orientations }), before);
    const html = renderToString(createElement(Router, {
      base: '/portal/ui-preview',
      hook: () => ['/portal/ui-preview/reports/first-day', () => {}] as [string, () => void],
      children: createElement(Link, { href }, 'Substation Orientation'),
    }));
    assert.ok(html.includes(`/portal/ui-preview/substation-orientation?orientation=orientation%20${phase}`));
    const nextDay = resolveOperationalPacket({ ...report, phase, date: '2025-01-07' }, folders, orientations);
    assert.equal(savedOrientationHref('fto', nextDay.orientation), undefined);
  });
}

test('only existing FTO and Coordinator roles receive saved orientation links', () => {
  for (const role of ['fto', 'fto_coordinator'] as const) {
    assert.ok(savedOrientationHref(role, orientations[0]));
    assert.equal(savedOrientationHref(role, undefined), undefined);
  }
  for (const role of ['po', 'fto_sgt', 'fto_coc', 'policenet', 'policenet_admin_sgt'] satisfies Workspace['role'][]) {
    assert.equal(savedOrientationHref(role, orientations[0]), undefined);
  }
});

test('unknown targets and mismatched first-day identities never fall back to the active phase', () => {
  assert.equal(savedOrientationContext('missing', folders, orientations), undefined);
  for (const patch of [
    { recruitBadge: 'other' }, { className: 'other' }, { phase: 4 as const },
    { phaseStartDate: '2025-01-07' },
  ]) {
    assert.equal(savedOrientationContext(orientations[0].id, [{ ...folders[0], ...patch }], orientations), undefined);
  }
});

test('legacy Phase I records and phase-start date matching retain their existing behavior', () => {
  const legacy = { ...orientations[0], phase: undefined, phaseStartDate: folders[0].phaseStartDate };
  assert.equal(savedOrientationContext(legacy.id, folders, [legacy])?.existing, legacy);
  assert.equal(savedOrientationContext(legacy.id, [folders[1]], [legacy]), undefined);
});
