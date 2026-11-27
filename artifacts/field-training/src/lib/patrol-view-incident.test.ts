import assert from 'node:assert/strict';
import test from 'node:test';
import { mapPatrolViewIncident, type PatrolViewIncidentRow } from './patrol-view-incident.js';

// Synthetic values only; no real incident, caller, phone or plate data.
const row = (extra: Partial<PatrolViewIncidentRow> = {}): PatrolViewIncidentRow => ({
  incidentNumber: 'P000000001', receivedDate: '11/09/2026', callType: '10 - 55', location: '100 SAMPLE AVE', apartment: '2B',
  zone: '03', district: '99', units: '991', rec: '22:10', disp: '22:15', arr: '22:30', clr: '23:05',
  statusHistory: ['DISPATCHED', 'CLEARED 1', 'CLEARED 4'], ...extra,
});

test('a Patrol View row maps to run prefill values', () => {
  const mapped = mapPatrolViewIncident(row());
  assert.ok(mapped);
  assert.equal(mapped.incidentNumber, 'P000000001');
  assert.equal(mapped.dispatchedCode, '55');
  assert.equal(mapped.location, '100 SAMPLE AVE Apt 2B');
  assert.equal(mapped.zone, '03');
  assert.equal(mapped.cruiserDistrict, '99');
  assert.equal(mapped.unitNumber, '991');
  assert.equal(mapped.eventDate, '2026-11-09');
  assert.equal(mapped.dispatchedAt, new Date(2026, 10, 9, 22, 15).toISOString());
  assert.equal(mapped.eventIngressAt, mapped.dispatchedAt);
  assert.equal(mapped.clearedAt, new Date(2026, 10, 9, 23, 5).toISOString());
  assert.equal(mapped.clearanceCode, '4V');
});

test('times earlier than the received time move to the next day', () => {
  const mapped = mapPatrolViewIncident(row({ rec: '23:50', disp: '23:55', clr: '00:40' }));
  assert.equal(mapped?.dispatchedAt, new Date(2026, 10, 9, 23, 55).toISOString());
  assert.equal(mapped?.clearedAt, new Date(2026, 10, 10, 0, 40).toISOString());
  const both = mapPatrolViewIncident(row({ rec: '23:58', disp: '00:05', clr: '01:00' }));
  assert.equal(both?.dispatchedAt, new Date(2026, 10, 10, 0, 5).toISOString());
});

test('caller, phone and notes are never read and invalid incident numbers are refused', () => {
  const withExtras = { ...row(), caller: 'SYNTHETIC NAME', phone: '000-000-0000', notes: 'SYNTHETIC NOTE' } as PatrolViewIncidentRow;
  assert.doesNotMatch(JSON.stringify(mapPatrolViewIncident(withExtras)), /SYNTHETIC|000-000/);
  assert.equal(mapPatrolViewIncident(row({ incidentNumber: '12345' })), undefined);
  assert.equal(mapPatrolViewIncident(row({ statusHistory: ['DISPATCHED'] }))?.clearanceCode, undefined);
});
