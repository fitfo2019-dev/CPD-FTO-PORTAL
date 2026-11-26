import test from 'node:test';
import assert from 'node:assert/strict';
import { missingDorDates, week15StartDate, week15Statement, week15Window, weeklyPacketDueDate, weeklyPacketDueState } from './weekly-packet.js';

test('due date is the end of the first working day after the Saturday week end', () => {
  // Week ends Saturday 2026-11-21. Off Sun/Mon/Tue -> due Wednesday 11/25.
  assert.deepEqual(weeklyPacketDueDate('2026-11-21', [0, 1, 2]), { dueDate: '2026-11-25', basis: 'off_days' });
  // Off Fri/Sat/Sun (midwatch 4x10) -> due Monday 11/23.
  assert.deepEqual(weeklyPacketDueDate('2026-11-21', [5, 6, 0]), { dueDate: '2026-11-23', basis: 'off_days' });
  // Off Sat/Sun (5x8) -> due Monday 11/23.
  assert.deepEqual(weeklyPacketDueDate('2026-11-21', [6, 0]), { dueDate: '2026-11-23', basis: 'off_days' });
});

test('without saved off days the manual default of 3 days applies', () => {
  assert.deepEqual(weeklyPacketDueDate('2026-11-21', []), { dueDate: '2026-11-24', basis: 'manual_default' });
  assert.deepEqual(weeklyPacketDueDate('2026-11-21', undefined), { dueDate: '2026-11-24', basis: 'manual_default' });
});

test('due state reports due today, late days and completion lateness', () => {
  assert.deepEqual(weeklyPacketDueState('2026-11-25', '2026-11-23'), { kind: 'not_due', daysUntilDue: 2 });
  assert.deepEqual(weeklyPacketDueState('2026-11-25', '2026-11-25'), { kind: 'due_today' });
  assert.deepEqual(weeklyPacketDueState('2026-11-25', '2026-11-27'), { kind: 'late', daysLate: 2 });
  assert.deepEqual(weeklyPacketDueState('2026-11-25', '2026-11-30', '2026-11-26'), { kind: 'complete', daysLate: 1 });
  assert.deepEqual(weeklyPacketDueState('2026-11-25', '2026-11-30', '2026-11-24'), { kind: 'complete', daysLate: 0 });
});

test('Week 15 statements use the manual wording with 30 categories and the PO name', () => {
  assert.equal(week15Statement('release', 'Isaiah Novak'), 'On Phase four PO Isaiah Novak demonstrated they could perform at an acceptable level in the 30 categories that make up the Standard Evaluation Guidelines and have shown they can operate as a safe efficient one officer unit with little to no FTO assistance.');
  assert.equal(week15Statement('not_release', 'Isaiah Novak'), 'On Phase four PO Isaiah Novak did not demonstrate they could perform at an acceptable level in the 30 categories that make up the Standard Evaluation Guidelines and have not shown they can operate as a safe efficient one officer car without significant FTO assistance.');
  assert.ok(!/terminat/i.test(week15Statement('not_release', 'X')));
});

test('Week 15 pre-selection is due before Phase IV week 3 begins', () => {
  const folder = { phase: 4 as const, phaseStartDate: '2026-11-01' };
  assert.equal(week15StartDate(folder), '2026-11-15');
  assert.equal(week15Window(folder, '2026-11-10', false), 'open');
  assert.equal(week15Window(folder, '2026-11-15', false), 'overdue');
  assert.equal(week15Window(folder, '2026-11-16', true), 'final_week');
  assert.equal(week15Window({ phase: 3 as const, phaseStartDate: '2026-11-01' }, '2026-11-10', false), 'not_phase_four');
});

test('missing DOR dates skip off days and days with records', () => {
  const folder = { phase: 2 as const, phaseStartDate: '2026-11-15', daysOff: [0, 6] as (0 | 6)[], recruitBadge: '4821', className: '135' };
  const reports = [
    { date: '2026-11-16', phase: 2, recruitBadge: '4821', className: '135' },
    { date: '2026-11-18', phase: 2, recruitBadge: '4821', className: '135' },
    { date: '2026-11-17', phase: 2, recruitBadge: '9999', className: '135' },
  ];
  assert.deepEqual(missingDorDates(folder, reports, '2026-11-20'), ['2026-11-17', '2026-11-19']);
});

test('weekly packet FTO draft removes the review notice from form content', async () => {
  const { TIMELINE_DRAFT_PREAMBLE_PATTERN } = await import('./timeline-interpolation.js');
  const text = 'System-generated weekly record draft: verify each entry.\n\nReviewed rating frequencies: NO: 9.';
  assert.equal(text.replace(TIMELINE_DRAFT_PREAMBLE_PATTERN, ''), 'Reviewed rating frequencies: NO: 9.');
});
