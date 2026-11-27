import type { DispatchIncidentPrefill } from './dispatch-prefill.js';

/**
 * One incident row as shown in the Patrol View incident detail. The Patrol View API fields are not yet
 * published; this shape follows the screen (owner, Nov 27, 2026) and is narrowed by the API adapter later.
 * Caller, phone and narrative notes are intentionally absent and are never read.
 */
export type PatrolViewIncidentRow = {
  incidentNumber: string;
  /** Date the call was received, MM/DD/YYYY (the date shown under the incident number). */
  receivedDate: string;
  /** Call type as shown, e.g. "10 - 55". */
  callType?: string;
  location?: string;
  apartment?: string;
  zone?: string;
  district?: string;
  units?: string;
  rec?: string;
  disp?: string;
  arr?: string;
  clr?: string;
  /** Status history lines in display order, e.g. "CLEARED 4". */
  statusHistory?: string[];
};

const INCIDENT = /^P\d{9}$/;
const TIME = /^([01]\d|2[0-3]):?([0-5]\d)(?::?[0-5]\d)?$/;
const MDY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

function localIso(date: string, time: string, dayOffset: number): string | undefined {
  const day = MDY.exec(date.trim());
  const clock = TIME.exec(time.trim());
  if (!day || !clock) return;
  const local = new Date(Number(day[3]), Number(day[1]) - 1, Number(day[2]) + dayOffset, Number(clock[1]), Number(clock[2]));
  if (Number.isNaN(local.getTime()) || local.getHours() !== Number(clock[1])) return;
  return local.toISOString();
}

const minutesOf = (time: string) => { const clock = TIME.exec(time.trim()); return clock ? Number(clock[1]) * 60 + Number(clock[2]) : undefined; };

/** Disp, Arr and Clr earlier than Rec belong to the next calendar day. */
function timeAfterReceived(row: PatrolViewIncidentRow, value: string | undefined): string | undefined {
  if (!value?.trim()) return;
  const received = row.rec ? minutesOf(row.rec) : undefined;
  const at = minutesOf(value);
  if (at === undefined) return;
  return localIso(row.receivedDate, value, received !== undefined && at < received ? 1 : 0);
}

function clearanceFrom(history: string[] | undefined): DispatchIncidentPrefill['clearanceCode'] {
  const last = [...(history ?? [])].reverse().map(line => /\bCLEARED\s+([1-4])\b/i.exec(line)).find(Boolean);
  return last ? `${last[1]}V` as DispatchIncidentPrefill['clearanceCode'] : undefined;
}

/** Maps a Patrol View incident row to run prefill values; returns undefined when the incident number is not P#########. */
export function mapPatrolViewIncident(row: PatrolViewIncidentRow): DispatchIncidentPrefill | undefined {
  const incidentNumber = row.incidentNumber.trim().toUpperCase();
  if (!INCIDENT.test(incidentNumber) || !MDY.test(row.receivedDate.trim())) return;
  const result: DispatchIncidentPrefill = { incidentNumber };
  const code = /^10\s*-\s*(\d{1,3})\b/.exec(row.callType?.trim() ?? '');
  if (code) result.dispatchedCode = code[1];
  const location = [row.location?.trim(), row.apartment?.trim() ? `Apt ${row.apartment.trim()}` : ''].filter(Boolean).join(' ');
  if (location) result.location = location;
  if (row.zone?.trim()) result.zone = row.zone.trim();
  if (row.district?.trim()) result.cruiserDistrict = row.district.trim();
  if (row.units?.trim()) result.unitNumber = row.units.trim();
  const day = MDY.exec(row.receivedDate.trim())!;
  result.eventDate = `${day[3]}-${day[1].padStart(2, '0')}-${day[2].padStart(2, '0')}`;
  const dispatched = timeAfterReceived(row, row.disp);
  if (dispatched) { result.dispatchedAt = dispatched; result.eventIngressAt = dispatched; }
  const cleared = timeAfterReceived(row, row.clr);
  if (cleared && (!dispatched || Date.parse(cleared) >= Date.parse(dispatched))) result.clearedAt = cleared;
  const clearance = clearanceFrom(row.statusHistory);
  if (clearance) result.clearanceCode = clearance;
  return result;
}
