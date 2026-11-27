import type { PhaseCaseFolder, Report } from './model.js';

export type WorkSchedule = '5x8' | '4x10';

/**
 * Full-phase day thresholds (owner decision; 2026 FTO manual incentive rule).
 * 5x8: 17 of 20 days (Phase IV: 14 of 15). 4x10: 13 of 16 days (Phase IV: 11 of 12).
 */
export function incentiveThreshold(schedule: WorkSchedule, phase: number): { required: number; scheduled: number } {
  const finalPhase = phase === 4;
  if (schedule === '4x10') return finalPhase ? { required: 11, scheduled: 12 } : { required: 13, scheduled: 16 };
  return finalPhase ? { required: 14, scheduled: 15 } : { required: 17, scheduled: 20 };
}

/** Three regular days off a week is a 4x10 schedule; otherwise 5x8. */
export function scheduleFromDaysOff(daysOff: readonly unknown[]): WorkSchedule {
  return daysOff.length >= 3 ? '4x10' : '5x8';
}

/** Only finalized Daily Performance Summaries count, so the report rests on submitted records. */
export const countsAsCoachedDay = (report: Report) =>
  report.syncStatus === 'submitted_complete' || report.syncStatus === 'synchronized_complete';

export type IncentiveRow = {
  ftoName: string; ftoBadge: string; className: string; phase: number; schedule: WorkSchedule;
  poNames: string; assignedDays: number; coverageDays: number; totalDays: number;
  required: number; scheduled: number; fullPhase: boolean;
};

const norm = (value: string | undefined) => (value ?? '').trim().toLocaleLowerCase();

/**
 * One row per FTO for one class and phase.
 * Assigned days: the FTO's own finalized summaries for PO's assigned to them in that phase.
 * Coverage days: finalized summaries the FTO wrote while covering another FTO in that phase.
 * Coverage days count toward the covering FTO's day total but never make a phase by themselves:
 * FULL PHASE requires a phase assignment and a day total at or above the threshold.
 */
export function buildIncentiveRows(reports: readonly Report[], folders: readonly PhaseCaseFolder[], className: string, phase: number): IncentiveRow[] {
  const inScope = reports.filter(r => r.phase === phase && norm(r.className) === norm(className) && countsAsCoachedDay(r));
  const rows = new Map<string, IncentiveRow & { days: Set<string>; coverage: Set<string>; pos: Set<string> }>();
  const assigned = folders.filter(f => f.phase === phase && norm(f.className) === norm(className));
  const ensure = (name: string, badge: string, schedule: WorkSchedule) => {
    const key = norm(badge);
    let row = rows.get(key);
    if (!row) {
      const t = incentiveThreshold(schedule, phase);
      row = { ftoName: name, ftoBadge: badge, className, phase, schedule, poNames: '', assignedDays: 0, coverageDays: 0, totalDays: 0,
        required: t.required, scheduled: t.scheduled, fullPhase: false, days: new Set(), coverage: new Set(), pos: new Set() };
      rows.set(key, row);
    }
    return row;
  };
  for (const folder of assigned) ensure(folder.ftoName, folder.ftoBadge, scheduleFromDaysOff(folder.daysOff)).pos.add(`${folder.recruitName} #${folder.recruitBadge}`);
  for (const report of inScope) {
    const covering = !!report.substituteCoverage;
    const folder = assigned.find(f => norm(f.ftoBadge) === norm(report.ftoBadge));
    const row = ensure(report.ftoName, report.ftoBadge, folder ? scheduleFromDaysOff(folder.daysOff) : '5x8');
    (covering ? row.coverage : row.days).add(report.date);
  }
  return [...rows.values()].map(({ days, coverage, pos, ...row }) => {
    const coverageOnly = [...coverage].filter(date => !days.has(date));
    const totalDays = days.size + coverageOnly.length;
    const isAssigned = assigned.some(f => norm(f.ftoBadge) === norm(row.ftoBadge));
    return { ...row, poNames: [...pos].join('; '), assignedDays: days.size, coverageDays: coverageOnly.length, totalDays,
      fullPhase: isAssigned && totalDays >= row.required };
  }).sort((a, b) => a.ftoName.localeCompare(b.ftoName) || a.ftoBadge.localeCompare(b.ftoBadge));
}
